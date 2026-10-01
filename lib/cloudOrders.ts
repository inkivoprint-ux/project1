import type { OrderRecord } from "./orders";
import { isTShirtSize } from "./productSizes";

export type CloudOrderRow = {
  id: string; order_number: string; customer_name: string; phone: string; shipping_address: { address?: string; salesChannel?: string }; subtotal: number | string; created_at: string;
  state?: string; completed_at?: string | null; deleted_at?: string | null; updated_at?: string;
  order_items: Array<{ product_id: string; product_name_snapshot: string; variant_snapshot?: Record<string, unknown>; quantity: number; unit_price: number | string; order_customizations: Array<{ editable_state: Record<string, unknown>; generated_files: Array<{ kind: string; original_filename: string | null; mime_type: string; storage_path: string }> }> }>;
};

export function cloudOrderRecord(row: CloudOrderRow): OrderRecord {
  return { salesChannel: row.shipping_address?.salesChannel === "offline" ? "offline" : "online", id: row.id, orderNumber: row.order_number, customerName: row.customer_name, phone: row.phone, address: row.shipping_address?.address ?? "", subtotal: Number(row.subtotal), createdAt: row.created_at, completedAt: row.completed_at ?? (row.state === "completed" ? row.updated_at ?? row.created_at : undefined), deletedAt: row.deleted_at ?? undefined, purgeStarted: Boolean(row.deleted_at && row.state === "processing"), status: "submitted", storageMode: "supabase", items: row.order_items.map((item) => {
    const customization = item.order_customizations[0];
    const state = customization?.editable_state;
    const designId = typeof state?.designId === "string" ? state.designId : undefined;
    return { productId: typeof state?.productId === "string" ? state.productId : typeof item.variant_snapshot?.productId === "string" ? item.variant_snapshot.productId : item.product_id, productName: item.product_name_snapshot, quantity: item.quantity, unitPrice: Number(item.unit_price), ...(isTShirtSize(item.variant_snapshot?.size) ? { size: item.variant_snapshot.size } : {}), designId, configuration: state, assets: (customization?.generated_files ?? []).flatMap((file) => file.kind === "original" || file.kind === "edited" || file.kind === "preview" ? [{ kind: file.kind, fileName: file.original_filename ?? file.storage_path.split("/").pop() ?? "order-file", mimeType: file.mime_type, storagePath: file.storage_path, designId }] : []) };
  }) };
}
