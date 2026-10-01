import type { MetadataRoute } from "next";
import { getSharedCatalogue } from "@/lib/catalogueServer";
import { isProductAvailable } from "@/lib/productAvailability";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = (await getSharedCatalogue()).filter(isProductAvailable);
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://inkivo.in";
  return [{ url: base, changeFrequency: "weekly", priority: 1 }, ...products.flatMap((product) => [
    { url: `${base}/products/${product.slug}`, changeFrequency: "weekly" as const, priority: .9 },
    { url: `${base}/customize/${product.slug}`, changeFrequency: "weekly" as const, priority: .8 },
  ])];
}
