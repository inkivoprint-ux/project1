import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac } from "node:crypto";
import type { OrderAsset, OrderItemRecord, OrderRecord } from "@/lib/orders";
import { assertOrderProduct, collectOrderFiles, orderAssetKey, parseOrderPayload, MAX_ORDER_REQUEST_BYTES } from "@/lib/orderSubmission";
import { products } from "@/lib/products";
import { getAdminSession } from "@/lib/supabase/admin";
import { cloudOrderRecord, type CloudOrderRow } from "@/lib/cloudOrders";
import { createDefaultTemplate, validateTemplate, type TemplateConfig } from "@/lib/customization";
import { assertProductSize } from "@/lib/productSizes";
import { hasSupabaseConfiguration, serverSupabaseKey } from "@/lib/supabase/config";
import { assertSameOrigin, readLimitedBody } from "@/lib/httpSafety";
import { assertSafeTextEps } from "@/lib/textEps";

const orderSelect = "id, order_number, customer_name, phone, shipping_address, subtotal, created_at, state, updated_at, completed_at, deleted_at, request_hash, order_items(product_id, product_name_snapshot, variant_snapshot, quantity, unit_price, order_customizations(editable_state, generated_files(kind, original_filename, mime_type, storage_path)))";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = serverSupabaseKey();
  if (!url || !serviceKey) return Response.json({ error: "Supabase order storage is not configured." }, { status: 503 });

  let formData: FormData;
  let payload: ReturnType<typeof parseOrderPayload>;
  let orderFiles: ReturnType<typeof collectOrderFiles>;
  try {
    assertSameOrigin(request);
    const bytes = await readLimitedBody(request, MAX_ORDER_REQUEST_BYTES);
    formData = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    payload = parseOrderPayload(JSON.parse(String(formData.get("payload") || "{}")));
    if (payload.salesChannel === "offline") {
      const session = await getAdminSession();
      if (session.error) return Response.json({ error: session.error }, { status: session.status });
    }
    orderFiles = collectOrderFiles(payload, formData);
    if (!payload.idempotencyKey) throw new Error("Refresh this checkout before submitting.");
    for (const file of orderFiles.values()) {
      if (file.type === "application/postscript") assertSafeTextEps(await file.text());
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const valid = file.type === "application/postscript" ? new TextDecoder().decode(header).startsWith("%!PS-Adobe-") && file.name.endsWith(".eps") : file.type === "image/png" ? [137,80,78,71,13,10,26,10].every((byte, index) => header[index] === byte) : file.type === "image/jpeg" ? header[0] === 255 && header[1] === 216 && header[2] === 255 : new TextDecoder().decode(header.slice(0, 4)) === "RIFF" && new TextDecoder().decode(header.slice(8, 12)) === "WEBP";
      if (!valid) throw new Error("An uploaded file does not contain a supported image.");
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Incomplete or invalid order details." }, { status: 400 });
  }

  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const idempotencyKey = createHash("sha256").update(payload.idempotencyKey!).digest("hex");
    const { idempotencyKey: omittedKey, ...content } = payload;
    void omittedKey;
    const requestHash = createHash("sha256").update(JSON.stringify(content)).digest("hex");
    const existing = await supabase.from("orders").select(orderSelect).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (existing.data.request_hash !== requestHash) return Response.json({ error: "This checkout changed. Reopen it before submitting." }, { status: 409 });
      if (["submitted", "confirmed", "design_review", "printing", "ready", "completed"].includes(existing.data.state) && !existing.data.deleted_at) return Response.json({ order: cloudOrderRecord(existing.data as unknown as CloudOrderRow) }, { headers: { "Cache-Control": "private, no-store" } });
      return Response.json({ error: "This order is already being processed or needs recovery. Contact Inkivo before submitting another order." }, { status: 409 });
    }
    // Vercel overwrites X-Forwarded-For. Do not trust arbitrary forwarded headers elsewhere.
    const address = process.env.VERCEL ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() : "local-server";
    const identifier = createHmac("sha256", serviceKey).update(address || "unknown-client").digest("hex");
    if (payload.salesChannel !== "offline") {
      const limit = await supabase.rpc("consume_order_attempt", { identifier_hash: identifier });
      if (limit.error) throw limit.error;
      if (limit.data !== true) return Response.json({ error: "Too many order attempts. Please wait ten minutes or contact Inkivo." }, { status: 429, headers: { "Retry-After": "600" } });
    }
    const validatedProducts = [];
    // Validate all prices/categories/templates before creating an order record.
    for (const item of payload.items) {
      const slug = item.productId.replace(/^custom-/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const found = await supabase.from("products").select("id, name, base_price, offer_price, is_active, category_id, storefront_config").eq("slug", slug).maybeSingle();
      if (found.error) throw found.error;
      try {
        assertOrderProduct(item, found.data);
        const known = products.find((product) => product.id === item.productId);
        const category = found.data?.category_id ? await supabase.from("categories").select("name").eq("id", found.data.category_id).maybeSingle() : null;
        if (category?.error) throw category.error;
        assertProductSize(item.size, category?.data?.name ?? known?.category ?? "", item.productName);
        if (item.assets.length) {
          const snapshot = item.configuration?.templateSnapshot as TemplateConfig | undefined;
          if (!snapshot || snapshot.productId !== item.productId) throw new Error("The print template is missing. Personalise this product again.");
          validateTemplate(snapshot);
        }
      } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Refresh the product before ordering." }, { status: 400 }); }
      validatedProducts.push(found.data!);
    }
    const { data: orderRow, error: orderError } = await supabase.from("orders").insert({
      customer_name: payload.customerName.trim(),
      phone: payload.phone.trim(),
      whatsapp: payload.phone.trim(),
      shipping_address: { address: payload.address.trim(), salesChannel: payload.salesChannel ?? "online" },
      state: "uploading",
      subtotal: payload.subtotal,
      total: payload.subtotal,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
    }).select("id, created_at, order_number").single();
    if (orderError?.code === "23505") return Response.json({ error: "This checkout is already processing. Wait briefly and retry the same checkout." }, { status: 409 });
    if (orderError || !orderRow) throw orderError ?? new Error("Order could not be created.");
    const orderNumber = orderRow.order_number;

    const completedItems: OrderItemRecord[] = [];
    const uploadedPaths: string[] = [];
    try {
      for (const [index, item] of payload.items.entries()) {
        const knownProduct = products.find((product) => product.id === item.productId);
        const productRow = validatedProducts[index];

        const { data: orderItem, error: itemError } = await supabase.from("order_items").insert({
          order_id: orderRow.id,
          product_id: productRow.id,
          product_name_snapshot: item.productName,
          variant_snapshot: { productId: item.productId, ...(item.size ? { size: item.size } : {}) },
          unit_price: item.unitPrice,
          quantity: item.quantity,
          line_total: item.unitPrice * item.quantity,
        }).select("id").single();
        if (itemError || !orderItem) throw itemError ?? new Error("Order item could not be saved.");

        if (!item.assets.length) { completedItems.push(item); continue; }
        const snapshot = (item.configuration?.templateSnapshot ?? (knownProduct ? createDefaultTemplate(knownProduct) : null)) as TemplateConfig | null;
        if (!snapshot) throw new Error("The print template snapshot is missing. Personalise this product again.");
        validateTemplate(snapshot);
        // Capture the actual order template immutably, rather than reusing a newer
        // catalogue template or inventing a flat 100 × 100 mm print area.
        const capturedTemplate = await supabase.from("customization_templates").insert({ product_id: productRow.id, version: snapshot.version, name: `Order capture ${orderNumber}`, status: "draft", allowed_tools: snapshot.tools }).select("id").single();
        if (capturedTemplate.error || !capturedTemplate.data) throw capturedTemplate.error ?? new Error("The order template could not be captured.");
        const templateRow = capturedTemplate.data;
        const selectedArea = snapshot.area;
        const capturedArea = await supabase.from("customization_areas").insert({ template_id: templateRow.id, name: selectedArea.name, surface_type: selectedArea.surface.replaceAll("-", "_"), width_mm: selectedArea.widthMm, height_mm: selectedArea.heightMm, target_dpi: selectedArea.targetDpi, bleed_mm: selectedArea.bleedMm, safe_margin_mm: selectedArea.safeMarginMm, renderer_config: selectedArea }).select("id").single();
        if (capturedArea.error || !capturedArea.data) throw capturedArea.error ?? new Error("The order print area could not be captured.");
        const areaRow = capturedArea.data;
        const { data: customization, error: customizationError } = await supabase.from("order_customizations").insert({ order_item_id: orderItem.id, template_id: templateRow.id, area_id: areaRow.id, editable_state: { ...item.configuration, designId: item.designId, productId: item.productId } }).select("id").single();
        if (customizationError || !customization) throw customizationError ?? new Error("Customization could not be saved.");

        const assets: OrderAsset[] = [];
        for (const declaredAsset of item.assets) {
          const file = orderFiles.get(orderAssetKey(index, declaredAsset));
          if (!file) throw new Error(`The file ${declaredAsset.fileName} is missing.`);
          const storagePath = `orders/${orderRow.id}/${orderItem.id}/${declaredAsset.kind}/${file.name}`;
          const upload = await supabase.storage.from("order-assets").upload(storagePath, file, { contentType: file.type, upsert: false });
          if (upload.error) throw upload.error;
          uploadedPaths.push(storagePath);
          const metadata = await supabase.from("generated_files").insert({ customization_id: customization.id, kind: declaredAsset.kind, storage_path: storagePath, original_filename: file.name, mime_type: file.type, file_size: file.size }).select("id").single();
          if (metadata.error) throw metadata.error;
          assets.push({ kind: declaredAsset.kind, slot: declaredAsset.slot, fileName: file.name, mimeType: file.type, storagePath, designId: item.designId });
        }
        completedItems.push({ ...item, assets });
      }
      const update = await supabase.from("orders").update({ state: "submitted", updated_at: new Date().toISOString() }).eq("id", orderRow.id);
      if (update.error) throw update.error;
    } catch (error) {
      if (uploadedPaths.length) {
        const cleanup = await supabase.storage.from("order-assets").remove(uploadedPaths);
        if (!cleanup.error) await supabase.from("generated_files").delete().in("storage_path", uploadedPaths);
      }
      await supabase.from("orders").update({ state: "failed", failure_reason: error instanceof Error ? error.message : "Order processing failed", updated_at: new Date().toISOString() }).eq("id", orderRow.id);
      throw error;
    }

    const order: OrderRecord = { salesChannel: payload.salesChannel ?? "online", id: orderRow.id, orderNumber, customerName: payload.customerName.trim(), phone: payload.phone.trim(), address: payload.address.trim(), subtotal: payload.subtotal, status: "submitted", storageMode: "supabase", createdAt: orderRow.created_at, items: completedItems };
    return Response.json({ order }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (failure) {
    if (failure && typeof failure === "object" && "message" in failure && String(failure.message).includes("Insufficient stock")) return Response.json({ error: "Insufficient stock. Refresh products and reduce the quantity before ordering." }, { status: 409 });
    return Response.json({ error: "The order could not be saved. Retry this checkout or contact Inkivo if the problem continues." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "Supabase order storage is not configured." }, { status: 503 });
  try {
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    let query = session.client.from("orders").select("id, order_number, customer_name, phone, shipping_address, subtotal, created_at, state, updated_at, completed_at, deleted_at, order_items(product_id, product_name_snapshot, variant_snapshot, quantity, unit_price, order_customizations(editable_state, generated_files(kind, original_filename, mime_type, storage_path)))").not("state", "in", "(draft,uploading,processing,failed)");
    if (new URL(request.url).searchParams.get("includeDeleted") !== "true") query = query.is("deleted_at", null);
    const channel = new URL(request.url).searchParams.get("channel");
    if (channel === "offline") query = query.eq("shipping_address->>salesChannel", "offline");
    if (channel === "online") query = query.or("shipping_address->>salesChannel.is.null,shipping_address->>salesChannel.eq.online");
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return Response.json({ orders: (data as unknown as CloudOrderRow[]).map(cloudOrderRecord) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Cloud orders could not be loaded. Check the administrator session and database setup." }, { status: 500 }); }
}
