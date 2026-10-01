import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";
import { parseOrderPayload, orderAssetKey } from "@/lib/orderSubmission";
import { getAdminSession } from "@/lib/supabase/admin";
import { serverSupabaseKey } from "@/lib/supabase/config";
import { signStagedUpload } from "@/lib/stagedOrderUploads";
import { MAX_IMAGE_UPLOAD_BYTES } from "@/lib/imageUpload";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = z.object({ payload: z.unknown(), files: z.array(z.object({ key: z.string(), size: z.number().int().min(1).max(20 * 1024 * 1024) })).min(1).max(990) }).parse(await readLimitedJson(request, 1_000_000));
    const payload = parseOrderPayload(input.payload);
    if (!payload.idempotencyKey) throw new Error("Refresh this checkout.");
    if (payload.salesChannel === "offline") {
      const session = await getAdminSession();
      if (session.error) return Response.json({ error: session.error }, { status: session.status });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, secret = serverSupabaseKey();
    if (!url || !secret) return Response.json({ error: "Order storage is not configured." }, { status: 503 });
    const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    if (payload.salesChannel !== "offline") {
      const address = process.env.VERCEL ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() : "local-server";
      const limit = await client.rpc("consume_order_attempt", { identifier_hash: createHmac("sha256", secret).update(address || "unknown-client").digest("hex") });
      if (limit.error || limit.data !== true) return Response.json({ error: "Please wait ten minutes before another artwork upload." }, { status: 429 });
    }
    const declarations = new Map(payload.items.flatMap((item, index) => item.assets.map((asset) => [orderAssetKey(asset.uploadItemIndex ?? index, asset), asset] as const)));
    if (input.files.length !== declarations.size || new Set(input.files.map(file => file.key)).size !== input.files.length || input.files.reduce((sum, file) => sum + file.size, 0) > 128 * 1024 * 1024) throw new Error("Invalid artwork upload list or order exceeds 128 MB.");
    const uploads = [];
    for (const file of input.files) {
      const asset = declarations.get(file.key);
      if (!asset) throw new Error("Unexpected artwork file.");
      if (asset.kind === "original" && asset.mimeType !== "application/postscript" && file.size > MAX_IMAGE_UPLOAD_BYTES) throw new Error("Each uploaded image must be 5 MB or smaller.");
      const receipt = { key: file.key, path: `checkout-staging/${payload.idempotencyKey}/${randomUUID()}/${asset.fileName}`, fileName: asset.fileName, mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/postscript"]).parse(asset.mimeType), size: file.size, checkoutId: payload.idempotencyKey, expires: Date.now() + 30 * 60_000 };
      const signed = await client.storage.from("order-assets").createSignedUploadUrl(receipt.path);
      if (signed.error || !signed.data) throw new Error("Artwork upload could not be prepared.");
      uploads.push({ receipt: { ...receipt, signature: signStagedUpload(receipt, secret) }, token: signed.data.token });
    }
    return Response.json({ uploads }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid upload." }, { status: 400 }); }
}
