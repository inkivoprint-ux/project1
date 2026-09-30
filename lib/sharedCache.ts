import type { Product } from "./products";
import type { TemplateConfig } from "./customization";

// Cloud data is kept in memory only. Browser-local edits never override cloud records.
export let sharedProducts: Product[] | undefined;
export const sharedTemplates = new Map<string, { draft?: TemplateConfig; published?: TemplateConfig }>();
export function setSharedProducts(products: Product[]) { sharedProducts = products; }
