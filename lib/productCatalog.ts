import { Product, products } from "./products";
import { z } from "zod";
import { hasSupabaseConfiguration } from "./supabase/config";
import { sharedProducts } from "./sharedCache";

const STORAGE_KEY = "inkivo:custom-products";
export const PRODUCT_CATALOG_EVENT = "inkivo:product-catalog-changed";

export function slugifyProductName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const imagePath = z.string().refine((value) => (value.startsWith("/") && !value.startsWith("//")) || /^data:image\/(png|jpeg|webp);base64,/.test(value) || isProjectAssetUrl(value));
export function isProjectAssetUrl(value: string) {
  try { const asset = new URL(value), project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://invalid.local"); return asset.protocol === "https:" && asset.origin === project.origin && asset.pathname.startsWith("/storage/v1/object/public/product-assets/"); }
  catch { return false; }
}
const productSchema = z.object({
  id: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().min(1),
  shortName: z.string(), category: z.string().min(1), price: z.number().finite().nonnegative(),
  stockQuantity: z.number().int().min(0).max(1000000).nullable().optional(),
  sizeStock: z.object({ XS: z.number().int().min(0).max(1000000), XXL: z.number().int().min(0).max(1000000), S: z.number().int().min(0).max(1000000), M: z.number().int().min(0).max(1000000), L: z.number().int().min(0).max(1000000), XL: z.number().int().min(0).max(1000000) }).nullable().optional(),
  compareAt: z.number().finite().positive().optional(), image: imagePath,
  views: z.array(z.object({ id: z.enum(["front", "back"]), label: z.string(), image: imagePath })).optional(),
  finish: z.string(), badge: z.string().optional(), displayOrder: z.number().int().min(1).max(10000).optional(), description: z.string(),
  printArea: z.object({ widthMm: z.number().finite().positive(), heightMm: z.number().finite().positive(), surface: z.enum(["cylinder", "tapered-cylinder", "fabric"]), diameterMm: z.number().finite().positive().optional() }),
});

export function parseStoredProduct(value: unknown): Product | null {
  const parsed = productSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function loadCustomProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(parseStoredProduct).filter((item): item is Product => item !== null) : [];
  } catch {
    return [];
  }
}

export function loadAllProducts(): Product[] {
  if (hasSupabaseConfiguration()) return sharedProducts ?? [];
  return loadLocalProducts();
}

export function loadLocalProducts(): Product[] {
  const catalogue = [...products];
  for (const product of loadCustomProducts()) {
    const existing = catalogue.findIndex((item) => item.slug === product.slug || item.id === product.id);
    if (existing >= 0) catalogue[existing] = product;
    else catalogue.push(product);
  }
  return sortProducts(catalogue);
}

export function sortProducts(catalogue: Product[]) {
  return catalogue.map((product, index) => ({ product, position: product.displayOrder ?? index + 1, index }))
    .sort((a, b) => a.position - b.position || a.index - b.index).map(({ product }) => product);
}

export function placeProduct(catalogue: Product[], product: Product, position: number) {
  const ordered = sortProducts(catalogue).filter((item) => item.id !== product.id && item.slug !== product.slug);
  ordered.splice(Math.min(ordered.length, Math.max(0, position - 1)), 0, product);
  return ordered.map((item, index) => ({ ...item, displayOrder: index + 1 }));
}

export function saveCustomProduct(product: Product) {
  if (hasSupabaseConfiguration()) throw new Error("Shared products must be saved through the administrator connection.");
  const valid = parseStoredProduct(product);
  if (!valid) throw new Error("Check the product details, image format, price, and print dimensions.");
  const custom = loadCustomProducts();
  const existing = custom.findIndex((item) => item.slug === product.slug || item.id === product.id);
  if (existing >= 0) custom[existing] = valid;
  else custom.push(valid);
  if (valid.displayOrder !== undefined) {
    // Move into the selected slot and shift the others; never leave tied positions.
    for (const ordered of placeProduct(loadAllProducts(), valid, valid.displayOrder)) {
      const index = custom.findIndex((item) => item.id === ordered.id || item.slug === ordered.slug);
      if (index >= 0) custom[index] = ordered;
      else custom.push(ordered);
    }
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_EVENT, { detail: product }));
  return product;
}

export function findStoredProduct(slug: string) {
  return loadAllProducts().find((product) => product.slug === slug);
}

export function filterProducts(catalogue: Product[], query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return catalogue;
  return catalogue.filter((product) => {
    const searchable = [product.name, product.shortName, product.category, product.finish, product.description]
      .join(" ")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function subscribeToProductCatalog(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener(PRODUCT_CATALOG_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PRODUCT_CATALOG_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
