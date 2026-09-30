import { getSharedCatalogue } from "@/lib/catalogueServer";
import { parseStoredProduct } from "@/lib/productCatalog";
import { getAdminSession } from "@/lib/supabase/admin";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { storeCatalogueImage } from "@/lib/catalogueAssets";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export async function GET() {
  try { return Response.json({ products: await getSharedCatalogue() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "The shared catalogue could not be loaded. Please try again." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "The shared catalogue is not configured." }, { status: 503 });
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const body = await readLimitedJson(request) as { product?: unknown };
    const product = parseStoredProduct(body.product);
    if (!product || !product.description.trim() || !product.finish.trim() || !product.name.trim() || product.price <= 0) throw new Error("Complete the product details, price and print dimensions.");
    product.displayOrder ??= 10000;
    product.image = await storeCatalogueImage(session.client, product.image);
    if (product.views) product.views = await Promise.all(product.views.map(async (view) => ({ ...view, image: await storeCatalogueImage(session.client, view.image) })));
    const saved = await session.client.rpc("save_storefront_product", { document: product });
    if (saved.error) return Response.json({ error: "The shared product could not be saved. Check the catalogue migration and administrator access." }, { status: 500 });
    return Response.json({ product });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "The product could not be saved." }, { status: 400 }); }
}
