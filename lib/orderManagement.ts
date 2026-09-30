import type { OrderRecord } from "./orders";

export type OrderManagementAction = "complete" | "delete" | "restore" | "reopen";

export function transitionOrder(order: OrderRecord, action: OrderManagementAction, now = new Date().toISOString()): OrderRecord {
  if (action === "restore") {
    if (!order.deletedAt) throw new Error("This order is not in Trash.");
    return { ...order, deletedAt: undefined };
  }
  if (order.deletedAt) throw new Error("Restore this order before changing it.");
  if (action === "reopen") {
    if (!order.completedAt) throw new Error("This order is already in progress.");
    return { ...order, completedAt: undefined };
  }
  if (action === "complete") return { ...order, completedAt: order.completedAt ?? now };
  if (!order.completedAt) throw new Error("Mark the order completed before deleting it.");
  return { ...order, deletedAt: now };
}

export function assertOrderCanBePurged(order: OrderRecord) {
  if (!order.deletedAt || !order.completedAt) throw new Error("Only completed orders in Trash can be permanently deleted.");
}
