import { z } from "zod";
import type { OrderItemRecord } from "./orders";
import { T_SHIRT_SIZES } from "./productSizes";

const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const assetKinds = ["original", "edited", "preview"] as const;

const assetSchema = z.object({
  kind: z.enum(assetKinds),
  slot: z.number().int().min(0).max(1).optional(),
  fileName: z.string().min(1).max(180).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/).refine((name) => !name.includes("..")),
  mimeType: z.enum(supportedMimeTypes),
  storagePath: z.string().optional(),
  uploadItemIndex: z.number().int().min(0).max(98).optional(),
  designId: z.string().min(1).max(180).optional(),
});

const itemSchema = z.object({
  productId: z.string().min(1).max(180),
  productName: z.string().min(1).max(240),
  quantity: z.number().int().min(1).max(99),
  size: z.enum(T_SHIRT_SIZES).optional(),
  unitPrice: z.number().finite().nonnegative(),
  designId: z.string().min(1).max(180).optional(),
  configuration: z.record(z.unknown()).optional(),
  assets: z.array(assetSchema).max(4),
});

const payloadSchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
  customerName: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).regex(/^\+?[\d\s()-]+$/).refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 10 && digits.length <= 15; }),
  address: z.string().trim().min(1).max(2_000),
  subtotal: z.number().finite().nonnegative(),
  items: z.array(itemSchema).min(1).max(99),
});

export type OrderPayload = {
  idempotencyKey?: string;
  customerName: string;
  phone: string;
  address: string;
  subtotal: number;
  items: OrderItemRecord[];
};

// Leave room beneath Vercel's 4.5 MB function limit for multipart boundaries.
export const MAX_ORDER_REQUEST_BYTES = 4_100_000;
export function assertOrderUploadBudget(payload: unknown, files: Array<{ size: number }>) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length + files.reduce((total, file) => total + file.size + 1024, 0) + 64_000;
  if (bytes > MAX_ORDER_REQUEST_BYTES) throw new Error("This order’s images are too large for checkout. Use a smaller photo or order fewer personalised items together.");
}

export function parseOrderPayload(value: unknown): OrderPayload {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success) throw new Error("Incomplete or invalid order details.");

  const calculatedSubtotal = parsed.data.items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  if (Math.abs(calculatedSubtotal - parsed.data.subtotal) > 0.01) throw new Error("The order subtotal does not match its items.");

  for (const item of parsed.data.items) {
    const kinds = new Set(item.assets.map((asset) => asset.kind));
    if (new Set(item.assets.map((asset) => `${asset.kind}:${asset.slot ?? 0}`)).size !== item.assets.length || item.assets.some((asset) => asset.kind !== "original" && (asset.slot ?? 0) !== 0)) throw new Error(`Duplicate files were supplied for ${item.productName}.`);
    if (!item.designId && item.assets.length) throw new Error(`Unexpected customization files were supplied for ${item.productName}.`);
    if (item.designId && (!kinds.has("edited") || !kinds.has("preview"))) {
      throw new Error(`The cropped image and product preview are required for ${item.productName}.`);
    }
    if (item.assets.some((asset) => asset.designId !== item.designId)) {
      throw new Error(`A customization file does not belong to ${item.productName}.`);
    }
  }

  return parsed.data as OrderPayload;
}

export function collectOrderFiles(payload: OrderPayload, formData: FormData) {
  const files = new Map<string, File>();
  const expectedKeys = new Set<string>();

  payload.items.forEach((item, itemIndex) => {
    item.assets.forEach((asset) => {
      const uploadIndex = asset.uploadItemIndex ?? itemIndex;
      if (uploadIndex > itemIndex) throw new Error("Invalid shared order file reference.");
      const original = payload.items[uploadIndex];
      const declaration = original?.assets.find((entry) => entry.kind === asset.kind && (entry.slot ?? 0) === (asset.slot ?? 0));
      if (!declaration || original.designId !== item.designId || original.productId !== item.productId || declaration.fileName !== asset.fileName || declaration.mimeType !== asset.mimeType || (declaration.uploadItemIndex ?? uploadIndex) !== uploadIndex) throw new Error("The shared customization file does not match this item.");
      const key = orderAssetKey(uploadIndex, asset);
      expectedKeys.add(key);
      if (formData.getAll(key).length !== 1) throw new Error(`Exactly one file is required for ${asset.fileName}.`);
      const value = formData.get(key);
      if (!(value instanceof File) || value.size === 0) throw new Error(`The file ${asset.fileName} is missing.`);
      if (value.name !== asset.fileName) throw new Error(`The uploaded filename does not match ${asset.fileName}.`);
      if (value.type !== asset.mimeType || !supportedMimeTypes.includes(value.type as typeof supportedMimeTypes[number])) {
        throw new Error(`${asset.fileName} must be a JPG, PNG, or WebP image.`);
      }
      if (value.size > 20 * 1024 * 1024) throw new Error(`${asset.fileName} exceeds 20 MB.`);
      files.set(orderAssetKey(itemIndex, asset), value);
    });
  });

  for (const key of formData.keys()) {
    if (key.startsWith("asset:") && !expectedKeys.has(key)) throw new Error("An unexpected order file was supplied.");
  }
  return files;
}

export function assertOrderProduct(item: OrderItemRecord, product: { name: string; base_price: number | string; offer_price: number | string | null; is_active: boolean } | null) {
  if (!product || !product.is_active || product.name !== item.productName || Number(product.offer_price ?? product.base_price) !== item.unitPrice) throw new Error("A product or price has changed. Refresh your cart before submitting. Browser-only products must be added to the shared catalogue first.");
}

export function orderAssetKey(index: number, asset: { kind: string; slot?: number }) {
  return `asset:${index}:${asset.kind}${asset.slot ? `:${asset.slot}` : ""}`;
}
