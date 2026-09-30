import { getAdminSession } from "@/lib/supabase/admin";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { publicCatalogueClient, getSharedProduct } from "@/lib/catalogueServer";
import { validateTemplate, type TemplateConfig } from "@/lib/customization";
import { storeCatalogueImage } from "@/lib/catalogueAssets";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export async function GET(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "Shared templates are not configured." }, { status: 503 });
  try {
    const params = new URL(request.url).searchParams, slug = params.get("slug");
    if (!slug) return Response.json({ error: "Choose a product." }, { status: 400 });
    let client = publicCatalogueClient(); const admin = params.get("admin") === "true";
    if (admin) { const session = await getAdminSession(); if (session.error) return Response.json({ error: session.error }, { status: session.status }); client = session.client; }
    const product = await client.from("products").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (product.error) throw product.error;
    if (!product.data) return Response.json({ error: "Product not found." }, { status: 404 });
    const rows = await client.from("storefront_templates").select("status, config").eq("product_id", product.data.id).in("status", admin ? ["draft", "published"] : ["published"]);
    if (rows.error) throw rows.error;
    return Response.json(Object.fromEntries((rows.data ?? []).map((row) => [row.status, row.config])), { headers: { "Cache-Control": admin ? "private, no-store" : "no-store" } });
  } catch { return Response.json({ error: "The print template could not be loaded. Please try again." }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "Shared templates are not configured." }, { status: 503 });
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const body = await readLimitedJson(request) as { slug: string; template: TemplateConfig; publish: boolean };
    if (typeof body.slug !== "string" || typeof body.publish !== "boolean") throw new Error("Invalid template request.");
    const product = await getSharedProduct(body.slug), template = body.template;
    if (!product || template?.productId !== product.id) throw new Error("The template does not match this product.");
    validateTemplate(template);
    for (const view of ["front", "back"] as const) if (template.mockupImages?.[view]) template.mockupImages[view] = await storeCatalogueImage(session.client, template.mockupImages[view]!);
    for (const area of [template.area, template.backArea]) if (area?.surfaceMap) area.surfaceMap = await storeCatalogueImage(session.client, area.surfaceMap);
    const result = await session.client.rpc("save_storefront_template", { product_slug: body.slug, document: template, publish: body.publish });
    if (result.error) return Response.json({ error: "The shared template could not be saved. Check the migration and administrator access." }, { status: 500 });
    return Response.json({ template: result.data });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Template save failed." }, { status: 400 }); }
}
