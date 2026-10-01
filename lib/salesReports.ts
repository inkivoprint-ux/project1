import type { OrderRecord } from "./orders";

export function reportDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to) throw new Error("Choose a valid from and to date.");
  return { start: new Date(`${from}T00:00:00+05:30`).toISOString(), end: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000).toISOString() };
}
const cell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export function salesReportCsv(orders: OrderRecord[]) {
  return "\uFEFF" + [
    ["Order", "Date (India)", "Channel", "Customer", "Phone", "Address", "Product", "Size", "Quantity", "Unit price INR", "Line total INR", "Status"],
    ...orders.flatMap((order) => order.items.map((item) => [order.orderNumber, new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), order.salesChannel ?? "online", order.customerName, order.phone, order.address, item.productName, item.size ?? "", item.quantity, item.unitPrice, item.quantity * item.unitPrice, order.deletedAt ? "Trash" : order.completedAt ? "Completed" : "Submitted"])),
    [], ["Total orders", orders.length], ["Total units", orders.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0), 0)],
    ["Grand total INR", orders.reduce((sum, order) => sum + order.subtotal, 0)],
    ["Note", "Online values represent submitted WhatsApp orders, not verified collected payments."],
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}
