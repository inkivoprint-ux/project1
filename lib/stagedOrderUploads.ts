import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const stagedUploadSchema = z.object({
  key: z.string().regex(/^asset:\d+:(original|edited|preview)(:[1-5])?$/),
  path: z.string().regex(/^checkout-staging\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-zA-Z0-9._-]+$/),
  fileName: z.string().min(1).max(180), mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/postscript"]),
  size: z.number().int().min(1).max(20 * 1024 * 1024),
  checkoutId: z.string().uuid(), expires: z.number().int(), signature: z.string().regex(/^[a-f0-9]{64}$/),
});
export type StagedUpload = z.infer<typeof stagedUploadSchema>;
export function signStagedUpload(value: Omit<StagedUpload, "signature">, secret: string) {
  return createHmac("sha256", secret).update(JSON.stringify([value.key, value.path, value.fileName, value.mimeType, value.size, value.checkoutId, value.expires])).digest("hex");
}
export function verifyStagedUpload(value: StagedUpload, checkoutId: string, secret: string, now = Date.now()) {
  if (value.checkoutId !== checkoutId || value.expires < now || !timingSafeEqual(Buffer.from(value.signature, "hex"), Buffer.from(signStagedUpload(value, secret), "hex"))) throw new Error("The artwork upload expired or changed. Retry this checkout.");
}
