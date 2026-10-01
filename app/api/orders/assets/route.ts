import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getAdminSession } from "@/lib/supabase/admin";
import { hasSupabaseConfiguration, serverSupabaseKey } from "@/lib/supabase/config";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = serverSupabaseKey();
  if (!url || !serviceKey) return Response.json({ error: "Supabase order storage is not configured." }, { status: 503 });

  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });

    const body = await readLimitedJson(request, 4096) as { orderId?: string; storagePath?: string };
    const orderId = body.orderId?.trim();
    const storagePath = body.storagePath?.trim();
    if (!orderId || !storagePath || !storagePath.startsWith(`orders/${orderId}/`)) {
      return Response.json({ error: "Invalid order file reference." }, { status: 400 });
    }

    const serviceClient = createServiceClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: fileRecord, error: recordError } = await serviceClient.from("generated_files").select("id, storage_path").eq("storage_path", storagePath).maybeSingle();
    if (recordError) throw recordError;
    if (!fileRecord) return Response.json({ error: "The customer file no longer exists." }, { status: 404 });

    const related = await serviceClient.from("order_items").select("product_id, order_customizations(editable_state, generated_files(id, kind, original_filename, storage_path))").eq("order_id", orderId);
    if (related.error) throw related.error;
    const files = (related.data ?? []).flatMap(item => item.order_customizations.flatMap(customization => customization.generated_files.map(file => ({ ...file, productId: item.product_id, designId: customization.editable_state?.designId }))));
    const selected = files.find(file => file.id === fileRecord.id);
    const paths = selected?.designId ? files.filter(file => file.productId === selected.productId && file.designId === selected.designId && file.kind === selected.kind && file.original_filename === selected.original_filename).map(file => file.storage_path) : [storagePath];
    const storageResult = await serviceClient.storage.from("order-assets").remove([...new Set(paths)]);
    if (storageResult.error) throw storageResult.error;
    const databaseResult = await serviceClient.from("generated_files").delete().in("storage_path", paths);
    if (databaseResult.error) throw databaseResult.error;
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Customer file deletion failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "Supabase is not configured." }, { status: 503 });
  try {
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const storagePath = new URL(request.url).searchParams.get("path");
    if (!storagePath || !/^orders\/[^/]+\/[^/]+\/(original|edited|preview)\/[^/]+$/.test(storagePath) || storagePath.includes("..")) return Response.json({ error: "Invalid order file reference." }, { status: 400 });
    const { data: record, error } = await session.client.from("generated_files").select("original_filename, mime_type").eq("storage_path", storagePath).maybeSingle();
    if (error) throw error;
    if (!record) return Response.json({ error: "The file was not found." }, { status: 404 });
    const result = await session.client.storage.from("order-assets").download(storagePath);
    if (result.error || !result.data) throw result.error ?? new Error("The file could not be downloaded.");
    const fileName = String(record.original_filename ?? storagePath.split("/").pop()).replace(/[^a-zA-Z0-9._-]/g, "_");
    return new Response(result.data, { headers: { "Content-Type": record.mime_type, "Content-Disposition": `${record.mime_type === "application/postscript" ? "attachment" : "inline"}; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "The private order file could not be downloaded." }, { status: 500 }); }
}
