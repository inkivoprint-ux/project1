import { expect, it } from "vitest";
import { groupOrderArtwork } from "./orderArtwork";
import { cloudOrderRecord, type CloudOrderRow } from "./cloudOrders";
import { removeAssetFromOrderRecord, type OrderRecord } from "./orders";

const row: CloudOrderRow = { id: "order", order_number: "INK -01/10/2026 -01", customer_name: "Test", phone: "", shipping_address: {}, subtotal: 300, created_at: "2026-10-01", order_items: [
  { product_id: "p", product_name_snapshot: "Shirt", quantity: 1, unit_price: 100, variant_snapshot: { size: "S" }, order_customizations: [{ editable_state: { designId: "d", productId: "p" }, generated_files: [] }] },
  { product_id: "p", product_name_snapshot: "Shirt", quantity: 2, unit_price: 100, variant_snapshot: { size: "XS" }, order_customizations: [{ editable_state: { designId: "d", productId: "p" }, generated_files: [{ kind: "original", original_filename: "front.png", mime_type: "image/png", storage_path: "orders/order/owner/original/front.png" }] }] },
] };
it("hydrates both size lines from the one stored artwork set regardless of row order", () => {
  const order = cloudOrderRecord(row);
  expect(order.items.map(item => item.assets.length)).toEqual([1, 1]);
  expect(order.items[0].assets[0].storagePath).toBe(order.items[1].assets[0].storagePath);
  const groups = groupOrderArtwork(order);
  expect(groups).toHaveLength(1); expect(groups[0].quantity).toBe(3); expect(groups[0].total).toBe(300);
  expect(groups[0].sizes).toBe("S × 1, XS × 2"); expect(groups[0].assets).toHaveLength(1);
});
it("keeps different designs separate even on the same shirt", () => {
  const order = cloudOrderRecord(row);
  const changed: OrderRecord = { ...order, items: [order.items[0], { ...order.items[1], designId: "other-design" }] };
  expect(groupOrderArtwork(changed)).toHaveLength(2);
});
it("removes a shared file from every matching size without touching a different design", () => {
  const order = cloudOrderRecord(row);
  const changed: OrderRecord = { ...order, items: [...order.items, { ...order.items[1], designId: "other-design" }] };
  expect(removeAssetFromOrderRecord(changed, 0, "original", "front.png").items.map(item => item.assets.length)).toEqual([0, 0, 1]);
});
