import type { CartEntry } from "./cart";
import type { Product } from "./products";
import { assertOrderUploadBudget, parseOrderPayload, orderAssetKey } from "./orderSubmission";
import { hasSupabaseConfiguration } from "./supabase/config";
import { z } from "zod";
import { assertOrderCanBePurged, transitionOrder, type OrderManagementAction } from "./orderManagement";
import { assertProductSize, T_SHIRT_SIZES, type TShirtSize } from "./productSizes";

export type AssetKind = "original" | "edited" | "preview";
export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp";
export type DraftAsset = { kind: AssetKind; slot?: number; fileName: string; mimeType: ImageMimeType; blob: Blob };
export type DesignDraft = { id: string; productId: string; configuration: Record<string, unknown>; assets: DraftAsset[]; createdAt: string };
export type OrderAsset = { kind: AssetKind; slot?: number; fileName: string; mimeType: string; storagePath?: string; uploadItemIndex?: number; designId?: string };
export type OrderItemRecord = { productId: string; productName: string; quantity: number; unitPrice: number; size?: TShirtSize; designId?: string; configuration?: Record<string, unknown>; assets: OrderAsset[] };
export type OrderRecord = {
  id: string; orderNumber: string; customerName: string; phone: string; address: string; subtotal: number;
  status: "submitted" | "local"; storageMode: "supabase" | "local"; createdAt: string; items: OrderItemRecord[];
  salesChannel?: "online" | "offline";
  completedAt?: string; deletedAt?: string; purgeStarted?: boolean;
};

const DATABASE_NAME = "inkivo-order-assets";
const DRAFT_STORE = "design-drafts";
const ORDERS_KEY = "inkivo:orders";
export const ORDERS_EVENT = "inkivo:orders-changed";
const SUPABASE_NOT_CONFIGURED = "Supabase order storage is not configured.";

// Saved orders remain readable after an administrator removes an individual file.
// Submission validation is stricter and must not be used to discard those records.
const savedOrderSchema = z.object({
  id: z.string().min(1), orderNumber: z.string().min(1), customerName: z.string(), phone: z.string(), address: z.string(),
  subtotal: z.number().finite().nonnegative(), status: z.enum(["submitted", "local"]), storageMode: z.enum(["supabase", "local"]),
  createdAt: z.string().datetime({ offset: true }), salesChannel: z.enum(["online", "offline"]).optional(),
  completedAt: z.string().datetime({ offset: true }).optional(), deletedAt: z.string().datetime({ offset: true }).optional(), purgeStarted: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.string().min(1), productName: z.string(), quantity: z.number().int().min(1).max(99), unitPrice: z.number().finite().nonnegative(),
    designId: z.string().optional(), configuration: z.record(z.unknown()).optional(),
    size: z.enum(T_SHIRT_SIZES).optional(),
    assets: z.array(z.object({ kind: z.enum(["original", "edited", "preview"]), slot: z.number().int().min(0).max(1).optional(), fileName: z.string().min(1), mimeType: z.string(), storagePath: z.string().optional(), designId: z.string().optional() })),
  })),
});

export function parseSavedOrder(value: unknown): OrderRecord | null {
  const parsed = savedOrderSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const extensionByMimeType: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function buildDesignAssetFileName(designId: string, kind: AssetKind, mimeType: ImageMimeType) {
  const extension = kind === "original" ? extensionByMimeType[mimeType] : "png";
  return `${designId}-${kind === "edited" ? "cropped" : kind}.${extension}`;
}

function openDraftDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRAFT_STORE)) request.result.createObjectStore(DRAFT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDesignDraft(draft: DesignDraft) {
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    transaction.objectStore(DRAFT_STORE).put(draft);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  return draft;
}

export async function loadDesignDraft(id?: string) {
  if (!id || typeof window === "undefined") return null;
  const database = await openDraftDatabase();
  const draft = await new Promise<DesignDraft | null>((resolve, reject) => {
    const request = database.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).get(id);
    request.onsuccess = () => resolve((request.result as DesignDraft | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return draft;
}

export function loadOrders(): OrderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ORDERS_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(parseSavedOrder).filter((order): order is OrderRecord => order !== null) : [];
  } catch {
    return [];
  }
}

export async function loadAdminOrders(includeDeleted = false) {
  const localOrders = loadOrders().filter((order) => includeDeleted || !order.deletedAt);
  if (!hasSupabaseConfiguration()) return process.env.NODE_ENV === "development" ? localOrders : [];
  const response = await fetch(`/api/orders${includeDeleted ? "?includeDeleted=true" : ""}`, { cache: "no-store" });
  const result = await response.json() as { orders?: OrderRecord[]; error?: string };
  if (!response.ok || !Array.isArray(result.orders)) throw new Error(result.error || "Orders could not be loaded.");
  return [...result.orders, ...localOrders.filter((order) => order.storageMode === "local")];
}

export async function manageOrder(order: OrderRecord, action: OrderManagementAction) {
  let next = transitionOrder(order, action);
  if (order.storageMode === "supabase") {
    const response = await fetch("/api/orders/manage", { method: action === "delete" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, action }) });
    const result = await response.json() as { completedAt?: string; deletedAt?: string | null; error?: string };
    if (!response.ok) throw new Error(result.error || "The order could not be updated.");
    next = { ...order, completedAt: result.completedAt, deletedAt: result.deletedAt ?? undefined };
  }
  const saved = loadOrders();
  persistOrders(saved.map((item) => item.id === next.id ? next : item), next);
  return next;
}

export async function permanentlyDeleteOrder(order: OrderRecord) {
  assertOrderCanBePurged(order);
  if (order.storageMode === "supabase") {
    const response = await fetch("/api/orders/manage", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, action: "purge" }) });
    const result = await response.json() as { permanentlyDeleted?: boolean; error?: string };
    if (!response.ok || !result.permanentlyDeleted) throw new Error(result.error || "The order could not be permanently deleted.");
  }
  const remaining = loadOrders().filter((item) => item.id !== order.id);
  const retainedDrafts = new Set(remaining.flatMap((item) => item.items.flatMap((line) => [line.designId, ...line.assets.map((asset) => asset.designId)])));
  const drafts = new Set(order.items.flatMap((item) => [item.designId, ...item.assets.map((asset) => asset.designId)]).filter((id): id is string => Boolean(id) && !retainedDrafts.has(id)));
  if (drafts.size) {
    const database = await openDraftDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(DRAFT_STORE, "readwrite");
        for (const id of drafts) transaction.objectStore(DRAFT_STORE).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { database.close(); }
  }
  persistOrders(remaining);
}

function saveOrder(order: OrderRecord) {
  const orders = [order, ...loadOrders().filter((item) => item.id !== order.id)];
  persistOrders(orders, order);
  return order;
}

function persistOrders(orders: OrderRecord[], changedOrder?: OrderRecord) {
  window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent(ORDERS_EVENT, { detail: changedOrder }));
}

export function subscribeToOrders(callback: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === ORDERS_KEY) callback(); };
  window.addEventListener(ORDERS_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(ORDERS_EVENT, callback); window.removeEventListener("storage", onStorage); };
}

export async function submitCartOrder(args: { cart: CartEntry[]; products: Product[]; customerName: string; phone: string; address: string }) {
  if (!args.customerName.trim() || !args.phone.trim() || !args.address.trim()) throw new Error("Complete your name, WhatsApp number, and delivery address.");
  if (!args.cart.length) throw new Error("Your cart is empty.");
  const items: OrderItemRecord[] = [];
  const formData = new FormData();
  const uploadedDesigns = new Map<string, { itemIndex: number; assets: DraftAsset[] }>();
  for (const entry of args.cart) {
    const product = args.products.find((item) => item.id === entry.productId);
    if (!product) throw new Error("A product in your cart is no longer available.");
    assertProductSize(entry.size, product.category, product.name);
    const draft = await loadDesignDraft(entry.designId);
    if (entry.designId && !draft) throw new Error(`The saved design files for ${product.name} could not be found. Please customize it again.`);
    if (draft && draft.productId !== product.id) throw new Error(`The saved design does not match ${product.name}.`);
    const assetKinds = new Set(draft?.assets.map((asset) => asset.kind));
    if (draft && (!assetKinds.has("edited") || !assetKinds.has("preview"))) {
      throw new Error(`The cropped image or product preview for ${product.name} is missing. Please customize it again.`);
    }
    const itemIndex = items.length;
    let shared = draft ? uploadedDesigns.get(draft.id) : undefined;
    if (draft && !shared) {
      const prepared = await Promise.all(draft.assets.map(prepareCheckoutAsset));
      shared = { itemIndex, assets: prepared };
      uploadedDesigns.set(draft.id, shared);
      prepared.forEach((asset) => formData.append(orderAssetKey(itemIndex, asset), asset.blob, asset.fileName));
    }
    const assets = shared?.assets.map((asset) => ({ kind: asset.kind, slot: asset.slot, fileName: asset.fileName, mimeType: asset.mimeType, designId: draft!.id, uploadItemIndex: shared!.itemIndex })) ?? [];
    items.push({ productId: product.id, productName: product.name, quantity: entry.quantity, unitPrice: product.price, ...(entry.size ? { size: entry.size } : {}), designId: draft?.id, configuration: draft?.configuration, assets });
  }
  const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const basePayload = { customerName: args.customerName.trim(), phone: args.phone.trim(), address: args.address.trim(), subtotal, items };
  const fingerprint = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(basePayload))))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const pendingKey = `inkivo:pending-order:${fingerprint}`;
  const idempotencyKey = window.sessionStorage.getItem(pendingKey) || crypto.randomUUID();
  window.sessionStorage.setItem(pendingKey, idempotencyKey);
  const payload = { ...basePayload, idempotencyKey };
  parseOrderPayload(payload);
  assertOrderUploadBudget(payload, [...formData.values()].filter((value): value is File => value instanceof File));
  formData.set("payload", JSON.stringify(payload));

  let response: Response;
  try {
    response = await fetch("/api/orders", { method: "POST", body: formData });
  } catch {
    throw new Error("The order service could not be reached. Please check your connection and try again.");
  }
  const result = await response.json().catch(() => ({})) as { order?: OrderRecord; error?: string };
  if (response.ok && result.order?.status === "submitted") {
    window.sessionStorage.removeItem(pendingKey);
    try { saveOrder(result.order); } catch { /* Cloud success must not be undone by a local cache quota error. */ }
    return result.order;
  }
  if (response.status !== 503 || result.error !== SUPABASE_NOT_CONFIGURED) {
    throw new Error(result.error || "The order files could not be saved. Please try again.");
  }

  if (process.env.NODE_ENV !== "development" || hasSupabaseConfiguration()) throw new Error("Orders are temporarily unavailable. Please contact Inkivo before ordering.");
  const stamp = Date.now();
  return saveOrder({ id: `local-${stamp}`, orderNumber: `INK-${String(stamp).slice(-8)}`, customerName: payload.customerName, phone: payload.phone, address: payload.address, subtotal, status: "local", storageMode: "local", createdAt: new Date().toISOString(), items });
}

export function buildWhatsAppOrderMessage(order: OrderRecord) {
  const lines = order.items.flatMap((item) => {
    const assets = item.assets.length ? item.assets.map((asset) => `   ${asset.kind.replace("edited", "cropped")}: ${asset.fileName}`) : ["   Files: no customization uploaded"];
    return [`${item.quantity} × ${item.productName}${item.size ? ` · Size ${item.size}` : ""}`, `   Personalisation: ${item.designId || item.assets.length ? "With personalisation" : "Without personalisation"}`, ...assets];
  });
  const localNotice = order.items.some((item) => item.assets.length)
    ? "Files are saved on my device only. I will share them with you for confirmation."
    : "Order details are saved on my device only. Please confirm my order.";
  return [`Hello Inkivo, ${order.storageMode === "local" ? "I prepared" : "I submitted"} order ${order.orderNumber}.`, ...(order.storageMode === "local" ? [localNotice] : []), ...lines, `Subtotal: ₹${order.subtotal.toLocaleString("en-IN")}`, `Customer: ${order.customerName}`, `Phone: ${order.phone}`, `Delivery address: ${order.address}`].join("\n");
}

export function removeAssetFromOrderRecord(order: OrderRecord, itemIndex: number, kind: AssetKind, fileName: string): OrderRecord {
  return {
    ...order,
    items: order.items.map((item, index) => index === itemIndex ? {
      ...item,
      assets: item.assets.filter((asset) => !(asset.kind === kind && asset.fileName === fileName)),
    } : item),
  };
}

async function removeDraftAsset(designId: string | undefined, kind: AssetKind, fileName: string) {
  if (!designId || typeof window === "undefined") return;
  const database = await openDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    const store = transaction.objectStore(DRAFT_STORE);
    const request = store.get(designId);
    request.onsuccess = () => {
      const draft = request.result as DesignDraft | undefined;
      if (draft) store.put({ ...draft, assets: draft.assets.filter((asset) => !(asset.kind === kind && asset.fileName === fileName)) });
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function deleteOrderAsset(args: { orderId: string; itemIndex: number; asset: OrderAsset }) {
  const order = loadOrders().find((item) => item.id === args.orderId);
  if (!order) throw new Error("Order could not be found in this workspace.");
  if (order.storageMode === "supabase" && args.asset.storagePath) {
    const response = await fetch("/api/orders/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, storagePath: args.asset.storagePath }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || "The Supabase file could not be deleted.");
    }
  }
  await removeDraftAsset(args.asset.designId, args.asset.kind, args.asset.fileName);
  const nextOrder = removeAssetFromOrderRecord(order, args.itemIndex, args.asset.kind, args.asset.fileName);
  persistOrders(loadOrders().map((item) => item.id === order.id ? nextOrder : item), nextOrder);
  return nextOrder;
}

async function prepareCheckoutAsset(asset: DraftAsset): Promise<DraftAsset> {
  // Keep the print-ready transparent PNG untouched. Optimise only the photo
  // reference and product preview; the browser draft retains every original.
  if (asset.kind === "edited" || asset.blob.size < 250_000) return asset;
  const url = URL.createObjectURL(asset.blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The checkout photo could not be read.")); image.src = url; });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, (asset.kind === "preview" ? 1200 : 3000) / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return asset;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", asset.kind === "preview" ? 0.85 : 0.94));
    if (!blob || blob.type !== "image/webp" || blob.size >= asset.blob.size) return asset;
    return { ...asset, blob, mimeType: "image/webp", fileName: asset.fileName.replace(/\.[^.]+$/, ".webp") };
  } finally { URL.revokeObjectURL(url); }
}
