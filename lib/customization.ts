import type { Product } from "./products";
import { findStoredProduct } from "./productCatalog";
import { getMaskPolygon, isMaskShape, type MaskPoint, type MaskShape } from "./maskShapes";
import { hasSupabaseConfiguration } from "./supabase/config";
import { sharedTemplates } from "./sharedCache";
export type { MaskPoint, MaskShape } from "./maskShapes";

export type SurfaceType = "flat" | "perspective" | "cylinder" | "tapered-cylinder" | "custom-mask" | "fabric";
export type BlendMode = "normal" | "screen" | "multiply" | "overlay";

export type TemplateArea = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  surface: SurfaceType;
  curvature: number;
  perspective: number;
  taper: number;
  maskRadius: number;
  maskShape?: MaskShape;
  maskPoints?: MaskPoint[];
  opacity: number;
  blendMode: BlendMode;
  precisionWrap?: boolean;
  wrapAngle?: number;
  edgeFade?: number;
  diameterMm?: number;
  surfaceMap?: string;
  displacementStrength?: number;
  fabricBlendStrength?: number;
  fabricTextureStrength?: number;
  defaultArtworkScale?: number;
  defaultArtworkRotation?: number;
  defaultArtworkOffsetX?: number;
  defaultArtworkOffsetY?: number;
  widthMm: number;
  heightMm: number;
  targetDpi: number;
  safeMarginMm: number;
  bleedMm: number;
};

export type TemplateConfig = {
  id: string;
  productId: string;
  version: number;
  status: "draft" | "published";
  updatedAt: string;
  area: TemplateArea;
  backArea?: TemplateArea;
  mockupImages?: Partial<Record<"front" | "back", string>>;
  tools: {
    images: boolean;
    text: boolean;
    maxImages: number;
    allowMove: boolean;
    allowScale: boolean;
    allowRotate: boolean;
    allowCrop: boolean;
  };
};

const STORAGE_PREFIX = "inkivo:template:";
const PUBLISHED_PREFIX = "inkivo:published-template:";
export const TEMPLATE_EVENT = "inkivo:template-saved";

const positions: Record<string, Pick<TemplateConfig["area"], "x" | "y" | "width" | "height">> = {
  "bamboo-travel-mug": { x: 40.5, y: 35.5, width: 19, height: 33 },
  "cork-base-bottle": { x: 42.2, y: 32, width: 15.6, height: 37 },
  "loop-steel-bottle": { x: 41.4, y: 34, width: 17.2, height: 36 },
  "classic-cotton-tshirt": { x: 34, y: 29, width: 32, height: 39 },
};

export function createDefaultTemplate(product: Product): TemplateConfig {
  const position = positions[product.slug] ?? { x: 39, y: 32, width: 22, height: 38 };
  const cylindrical = product.printArea.surface === "cylinder" || product.printArea.surface === "tapered-cylinder";
  const wrapAngle = cylindrical && product.printArea.diameterMm
    ? Math.round(Math.min(150, Math.max(45, (product.printArea.widthMm / (Math.PI * product.printArea.diameterMm)) * 360)))
    : 110;
  const area: TemplateConfig["area"] = {
    name: "Front print area",
    ...position,
    rotation: 0,
    surface: product.printArea.surface,
    curvature: product.printArea.surface === "cylinder" ? 72 : product.printArea.surface === "fabric" ? 58 : 60,
    perspective: 0,
    taper: product.printArea.surface === "tapered-cylinder" ? 12 : 0,
    maskRadius: 2,
    maskShape: product.printArea.surface === "tapered-cylinder" ? "tapered" : "rectangle",
    maskPoints: [],
    opacity: product.printArea.surface === "fabric" ? 1 : 0.96,
    blendMode: "normal",
    precisionWrap: cylindrical,
    wrapAngle,
    edgeFade: cylindrical ? 9 : 0,
    diameterMm: product.printArea.diameterMm,
    displacementStrength: product.printArea.surface === "fabric" ? 62 : 0,
    fabricBlendStrength: product.printArea.surface === "fabric" ? 48 : 0,
    fabricTextureStrength: product.printArea.surface === "fabric" ? 18 : 0,
    defaultArtworkScale: 1,
    defaultArtworkRotation: 0,
    defaultArtworkOffsetX: 0,
    defaultArtworkOffsetY: 0,
    widthMm: product.printArea.widthMm,
    heightMm: product.printArea.heightMm,
    targetDpi: 300,
    safeMarginMm: 3,
    bleedMm: 2,
  };
  return {
    id: `template-${product.id}`,
    productId: product.id,
    version: 1,
    status: "draft",
    updatedAt: new Date(0).toISOString(),
    area,
    backArea: product.views ? { ...area, name: "Back print area", x: 34, y: 27, width: 32, height: 42 } : undefined,
    tools: {
      images: true,
      text: true,
      maxImages: 1,
      allowMove: true,
      allowScale: true,
      allowRotate: true,
      allowCrop: true,
    },
  };
}

export function maskClipPath(shape: MaskShape = "rectangle", points: MaskPoint[] = []) {
  if (shape === "ellipse") return "ellipse(50% 50% at 50% 50%)";
  const polygon = getMaskPolygon(shape, points);
  if (polygon) return `polygon(${polygon.map((point) => `${point.x}% ${point.y}%`).join(", ")})`;
  return undefined;
}

export function loadTemplate(product: Product): TemplateConfig {
  if (hasSupabaseConfiguration()) return sharedTemplates.get(product.id)?.draft ?? sharedTemplates.get(product.id)?.published ?? createDefaultTemplate(product);
  return loadLocalTemplate(product);
}

export function loadLocalTemplate(product: Product): TemplateConfig {
  if (typeof window === "undefined") return createDefaultTemplate(product);
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${product.id}`);
    if (!saved) return createDefaultTemplate(product);
    const defaults = createDefaultTemplate(product);
    const parsed = JSON.parse(saved) as Partial<TemplateConfig>;
    const config = {
      ...defaults,
      ...parsed,
      area: { ...defaults.area, ...parsed.area },
      backArea: parsed.backArea ? { ...(defaults.backArea ?? defaults.area), ...parsed.backArea } : defaults.backArea,
      tools: { ...defaults.tools, ...parsed.tools, maxImages: 1 },
    };
    validateTemplate(config);
    return config;
  } catch {
    return createDefaultTemplate(product);
  }
}

export function saveTemplate(config: TemplateConfig, publish = false): TemplateConfig {
  if (hasSupabaseConfiguration()) throw new Error("Shared templates must be saved through the administrator connection.");
  validateTemplate(config);
  let publishedVersion = 0;
  try { publishedVersion = Number(JSON.parse(window.localStorage.getItem(`${PUBLISHED_PREFIX}${config.productId}`) || "null")?.version) || 0; } catch { /* A corrupt prior copy must not block a valid replacement. */ }
  const next: TemplateConfig = {
    ...config,
    version: publish ? Math.max(config.version, publishedVersion) + 1 : config.version,
    status: publish ? "published" : "draft",
    updatedAt: new Date().toISOString(),
  };
  const draftKey = `${STORAGE_PREFIX}${config.productId}`, publishedKey = `${PUBLISHED_PREFIX}${config.productId}`;
  const previousDraft = window.localStorage.getItem(draftKey), previousPublished = window.localStorage.getItem(publishedKey);
  const product = findStoredProduct(config.productId.replace(/^custom-/, ""));
  const baseline = previousDraft ?? JSON.stringify(product ? createDefaultTemplate(product) : config);
  try {
    window.localStorage.setItem(publishedKey, publish ? JSON.stringify(next) : previousPublished ?? baseline);
    window.localStorage.setItem(draftKey, JSON.stringify(next));
  } catch (error) {
    // Keep the last working version when the browser storage quota is exceeded.
    if (previousPublished === null) window.localStorage.removeItem(publishedKey);
    else window.localStorage.setItem(publishedKey, previousPublished);
    if (previousDraft === null) window.localStorage.removeItem(draftKey);
    else window.localStorage.setItem(draftKey, previousDraft);
    throw error;
  }
  window.dispatchEvent(new CustomEvent(TEMPLATE_EVENT, { detail: next }));
  return next;
}

export function resetTemplate(product: Product) {
  window.localStorage.removeItem(`${STORAGE_PREFIX}${product.id}`);
  const next = createDefaultTemplate(product);
  window.dispatchEvent(new CustomEvent(TEMPLATE_EVENT, { detail: next }));
  return next;
}

export function loadCustomerTemplate(product: Product): TemplateConfig {
  if (hasSupabaseConfiguration()) return sharedTemplates.get(product.id)?.published ?? createDefaultTemplate(product);
  return loadLocalCustomerTemplate(product);
}

export function loadLocalCustomerTemplate(product: Product): TemplateConfig {
  if (typeof window === "undefined") return createDefaultTemplate(product);
  try {
    const published = window.localStorage.getItem(`${PUBLISHED_PREFIX}${product.id}`);
    if (!published) return loadLocalTemplate(product); // Preserve legacy workspace settings.
    const config = JSON.parse(published) as TemplateConfig;
    validateTemplate(config);
    return config;
  } catch { return createDefaultTemplate(product); }
}

export function subscribeToTemplates(callback: () => void) {
  const storage = (event: StorageEvent) => { if (event.key?.startsWith(STORAGE_PREFIX) || event.key?.startsWith(PUBLISHED_PREFIX)) callback(); };
  window.addEventListener(TEMPLATE_EVENT, callback); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(TEMPLATE_EVENT, callback); window.removeEventListener("storage", storage); };
}

export function validateTemplate(config: TemplateConfig) {
  if (!Number.isInteger(config.version) || config.version < 1 || !config.area || !config.tools || Object.entries(config.tools).some(([key, value]) => key !== "maxImages" && typeof value !== "boolean")) throw new Error("The template settings are invalid.");
  for (const area of [config.area, config.backArea].filter((value): value is TemplateArea => Boolean(value))) {
    if (area.maskShape !== undefined && !isMaskShape(area.maskShape)) throw new Error("Choose a supported print mask shape.");
    const values = [area.x, area.y, area.width, area.height, area.rotation, area.curvature, area.perspective, area.taper, area.opacity, area.widthMm, area.heightMm, area.targetDpi, area.bleedMm, area.safeMarginMm];
    if (!values.every(Number.isFinite) || area.x < 0 || area.y < 0 || area.width <= 0 || area.height <= 0 || area.x + area.width > 100.01 || area.y + area.height > 100.01 || area.widthMm <= 0 || area.heightMm <= 0 || area.targetDpi < 72 || area.targetDpi > 1200 || area.bleedMm < 0 || area.safeMarginMm < 0 || area.opacity < 0 || area.opacity > 1 || !["flat", "perspective", "cylinder", "tapered-cylinder", "custom-mask", "fabric"].includes(area.surface) || (area.maskPoints ?? []).some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100)) {
      throw new Error("Check the print area: placement must fit the product, physical dimensions must be positive, and DPI must be 72–1200.");
    }
  }
}
