import type { OrderAsset, OrderRecord } from "./orders";
import { groupOrderArtwork } from "./orderArtwork";

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_").slice(0, 120) || "file";

export function orderDetailsText(order: OrderRecord) {
  const groups = groupOrderArtwork(order);
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
      `Artwork folder: item-${groups.findIndex(group => group.lines.some(line => line.index === index)) + 1}-${safeName(item.productName)}`,
      "",
    ]),
    `ORDER TOTAL: INR ${order.subtotal.toFixed(2)}`,
    "", "SHARED ARTWORK FILES",
    ...groups.flatMap((group, index) => [`item-${index + 1}-${safeName(group.item.productName)}${group.sizes ? ` | Sizes: ${group.sizes}` : ""}`, ...group.assets.map(({ asset }, fileIndex) => `  ${fileIndex + 1}. ${asset.mimeType === "application/postscript" ? "Outlined text EPS" : asset.kind === "edited" ? "Composite artwork reference" : asset.kind === "preview" ? "Product preview" : "Original upload"}: ${asset.fileName}`)]),
    "", "One artwork folder per product/design. Sizes sharing a design use the same files. Removed files are not included.",
  ].join("\r\n");
}

export async function buildOrderZip(order: OrderRecord, readAsset: (asset: OrderAsset) => Promise<Blob>, onProgress?: (done: number, total: number) => void) {
  const { zip } = await import("fflate");
  const entries: Record<string, Uint8Array> = { "customer-and-order-details.txt": new TextEncoder().encode(orderDetailsText(order)) };
  const groups = groupOrderArtwork(order);
  const total = groups.reduce((count, group) => count + group.assets.length, 0);
  let done = 0;
  let bytes = 0;
  for (const [itemIndex, group] of groups.entries()) {
    for (const [fileIndex, { asset }] of group.assets.entries()) {
      const blob = await readAsset(asset);
      if (!blob.size) throw new Error(`The file ${asset.fileName} is empty. Refresh the order and try again.`);
      bytes += blob.size;
      if (bytes > 128 * 1024 * 1024) throw new Error("This order is too large for one ZIP on this device. Download its files individually.");
      entries[`item-${itemIndex + 1}-${safeName(group.item.productName)}/${fileIndex + 1}-${safeName(asset.fileName)}`] = new Uint8Array(await blob.arrayBuffer());
      onProgress?.(++done, total);
    }
  }
  // Images are already compressed; storing them avoids expensive recompression.
  const data = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(entries, { level: 0 }, (error, result) => error ? reject(error) : resolve(new Uint8Array(result))));
  return { blob: new Blob([data], { type: "application/zip" }), fileName: `${safeName(order.orderNumber)}.zip` };
}
