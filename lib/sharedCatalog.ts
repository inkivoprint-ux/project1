import { hasSupabaseConfiguration } from "./supabase/config";
import { parseStoredProduct, sortProducts, PRODUCT_CATALOG_EVENT, loadAllProducts } from "./productCatalog";
import { sharedTemplates, setSharedProducts } from "./sharedCache";
import { saveTemplate, validateTemplate, TEMPLATE_EVENT, type TemplateConfig } from "./customization";
import type { Product } from "./products";
import { MAX_JSON_BYTES } from "./httpSafety";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (serialized && new TextEncoder().encode(serialized).byteLength > MAX_JSON_BYTES) throw new Error("The catalogue images are too large. Use smaller mockups before saving.");
  const response = await fetch(path, { cache: "no-store", ...(serialized === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: serialized }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The shared catalogue could not be reached. Please try again.");
  return result as T;
}
export async function refreshSharedProducts() {
  if (!hasSupabaseConfiguration()) return loadAllProducts();
  const result = await api<{ products: unknown[] }>("/api/catalogue");
  if (!Array.isArray(result.products)) throw new Error("The shared catalogue response is invalid.");
  const products = result.products.map(parseStoredProduct);
  if (products.some((product) => !product)) throw new Error("A shared product needs administrator attention.");
  const valid = sortProducts(products as Product[]);
  setSharedProducts(valid);
  window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_EVENT));
  return valid;
}
export async function saveSharedProduct(product: Product) {
  const result = await api<{ product: Product }>("/api/catalogue", { product });
  await refreshSharedProducts();
  return result.product;
}
export async function refreshSharedTemplate(product: Product, admin = false) {
  if (!hasSupabaseConfiguration()) return;
  const result = await api<{ draft?: TemplateConfig; published?: TemplateConfig }>(`/api/templates?slug=${encodeURIComponent(product.slug)}${admin ? "&admin=true" : ""}`);
  for (const config of [result.draft, result.published]) {
    if (config) { validateTemplate(config); if (config.productId !== product.id) throw new Error("The print template does not match this product."); }
  }
  sharedTemplates.set(product.id, result);
  window.dispatchEvent(new CustomEvent(TEMPLATE_EVENT));
}
export async function saveSharedTemplate(product: Product, config: TemplateConfig, publish: boolean) {
  if (!hasSupabaseConfiguration()) return saveTemplate(config, publish);
  validateTemplate(config);
  const result = await api<{ template: TemplateConfig }>("/api/templates", { slug: product.slug, template: config, publish });
  await refreshSharedTemplate(product, true);
  return result.template;
}
