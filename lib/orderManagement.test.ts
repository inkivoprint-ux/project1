import { describe, expect, it } from "vitest";
import { assertOrderCanBePurged, transitionOrder } from "./orderManagement";
import { parseSavedOrder, type OrderRecord } from "./orders";

const order: OrderRecord = { id: "unit-order", orderNumber: "unit-reference", customerName: "", phone: "", address: "", subtotal: 1, status: "local", storageMode: "local", createdAt: "2026-09-30T00:00:00.000Z", items: [{ productId: "unit-product", productName: "", quantity: 1, unitPrice: 1, assets: [{ kind: "preview", fileName: "unit-preview.png", mimeType: "image/png" }] }] };
const now = "2026-09-30T01:00:00.000Z";

describe("completed-order management", () => {
  it("refuses to delete unfinished work", () => {
    expect(() => transitionOrder(order, "delete", now)).toThrow("Mark the order completed");
  });
  it("completes, deletes to Trash and restores without losing order files", () => {
    const completed = transitionOrder(order, "complete", now);
    const deleted = transitionOrder(completed, "delete", now);
    expect(deleted.completedAt).toBe(now);
    expect(deleted.deletedAt).toBe(now);
    expect(parseSavedOrder(deleted)?.deletedAt).toBe(now);
    expect(deleted.items).toEqual(order.items);
    const restored = transitionOrder(deleted, "restore", now);
    expect(restored.deletedAt).toBeUndefined();
    expect(restored.completedAt).toBe(now);
    expect(restored.items).toEqual(order.items);
    expect(transitionOrder(restored, "reopen", now).completedAt).toBeUndefined();
    expect(order.completedAt).toBeUndefined();
  });
  it("blocks invalid Trash actions and preserves the original completion timestamp", () => {
    expect(() => transitionOrder(order, "restore", now)).toThrow();
    const completed = transitionOrder(order, "complete", now);
    expect(transitionOrder(completed, "complete").completedAt).toBe(now);
    const deleted = transitionOrder(completed, "delete", now);
    expect(() => transitionOrder(deleted, "complete", now)).toThrow("Restore this order");
    expect(() => transitionOrder(deleted, "delete", now)).toThrow("Restore this order");
  });
});

it("allows permanent deletion only for completed orders in Trash", () => {
  expect(() => assertOrderCanBePurged(order)).toThrow("Only completed orders in Trash");
  const completed = transitionOrder(order, "complete", now);
  expect(() => assertOrderCanBePurged(completed)).toThrow();
  expect(() => assertOrderCanBePurged({ ...order, deletedAt: now })).toThrow();
  expect(() => assertOrderCanBePurged(transitionOrder(completed, "delete", now))).not.toThrow();
});
