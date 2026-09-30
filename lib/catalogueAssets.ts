import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProjectAssetUrl } from "./productCatalog";

export async function storeCatalogueImage(client: SupabaseClient, value: string) {
  if ((value.startsWith("/") && !value.startsWith("//")) || isProjectAssetUrl(value)) return value;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("Choose a PNG, JPG or WebP catalogue image.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 2_500_000) throw new Error("Catalogue images must be smaller than 2.5 MB.");
  const format = match[1];
  const valid = format === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : format === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new Error("The image content does not match its file type.");
  const path = `catalogue/${crypto.randomUUID()}.${format === "jpeg" ? "jpg" : format}`;
  const { error } = await client.storage.from("product-assets").upload(path, bytes, { contentType: `image/${format}`, upsert: false });
  if (error) throw new Error("The catalogue image could not be uploaded.");
  return client.storage.from("product-assets").getPublicUrl(path).data.publicUrl;
}
