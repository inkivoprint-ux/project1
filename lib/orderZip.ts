import type { OrderAsset, OrderRecord } from "./orders";

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_").slice(0, 120) || "file";

export function orderDetailsText(order: OrderRecord) {
  return [
    "INKIVO ORDER DETAILS", `Sales channel: ${order.salesChannel === "offline" ? "Offline counter" : "Online"}`, `Order number: ${order.orderNumber}`,
    `Order date: ${new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} (India time)`,
    "", "Customer details", order.customerName, order.phone, order.address, "",
    `Status: ${order.deletedAt ? "In Trash" : order.completedAt ? "Completed" : "In progress"}`,
    "", "ORDER ITEMS",
    ...order.items.flatMap((item, index) => [
      `${index + 1}. ${item.productName}${item.size ? ` | Size: ${item.size}` : ""}`,
      `Quantity: ${item.quantity} | Unit price: INR ${item.unitPrice.toFixed(2)} | Item total: INR ${(item.quantity * item.unitPrice).toFixed(2)}`,
      `Print side: ${item.configuration?.sides ? Object.keys(item.configuration.sides as Record<string, unknown>).join(" + ") : item.configuration?.view === "back" ? "Back" : "Front"}`,
      `Artwork files: ${item.assets.length}`,
      ...item.assets.map((asset, fileIndex) => `  ${fileIndex + 1}. ${asset.mimeType === "application/postscript" ? "Outlined text EPS" : asset.kind === "edited" ? "Composite artwork reference" : asset.kind === "preview" ? "Product preview" : "Original upload"}: ${asset.fileName}`),
      "",
    ]),
    `ORDER TOTAL: INR ${order.subtotal.toFixed(2)}`,
    "", "Each item's available files are in its numbered folder. Removed files are not included.",
  ].join("\r\n");
}

export async function buildOrderZip(order: OrderRecord, readAsset: (asset: OrderAsset) => Promise<Blob>, onProgress?: (done: number, total: number) => void) {
  const { zip } = await import("fflate");
  const entries: Record<string, Uint8Array> = { "customer-and-order-details.txt": new TextEncoder().encode(orderDetailsText(order)) };
  const total = order.items.reduce((count, item) => count + item.assets.length, 0);
  let done = 0;
  let bytes = 0;
  for (const [itemIndex, item] of order.items.entries()) {
    for (const [fileIndex, asset] of item.assets.entries()) {
      const blob = await readAsset(asset);
      if (!blob.size) throw new Error(`The file ${asset.fileName} is empty. Refresh the order and try again.`);
      bytes += blob.size;
      if (bytes > 128 * 1024 * 1024) throw new Error("This order is too large for one ZIP on this device. Download its files individually.");
      entries[`item-${itemIndex + 1}-${safeName(item.productName)}/${fileIndex + 1}-${safeName(asset.fileName)}`] = new Uint8Array(await blob.arrayBuffer());
      onProgress?.(++done, total);
    }
  }
  // Images are already compressed; storing them avoids expensive recompression.
  const data = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(entries, { level: 0 }, (error, result) => error ? reject(error) : resolve(new Uint8Array(result))));
  return { blob: new Blob([data], { type: "application/zip" }), fileName: `${safeName(order.orderNumber)}.zip` };
}
