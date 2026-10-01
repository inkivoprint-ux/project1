import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildOrderZip } from "./orderZip";
import type { OrderRecord } from "./orders";

const order: OrderRecord = {
  id: "order-1", orderNumber: "INK-123", customerName: "മലയാളം Customer", phone: "9876543210",
  address: "First line\nSecond line", subtotal: 200, status: "submitted", storageMode: "local",
  createdAt: "2026-10-01T00:00:00Z",
  items: [{ productId: "p", productName: "Bottle", quantity: 2, unitPrice: 100, designId: "d", configuration: { view: "back" },
    assets: [
      { kind: "original", slot: 0, fileName: "photo.png", mimeType: "image/png" },
      { kind: "original", slot: 1, fileName: "logo.png", mimeType: "image/png" },
      { kind: "edited", fileName: "print.png", mimeType: "image/png" },
      { kind: "preview", fileName: "preview.png", mimeType: "image/png" },
    ],
  }],
};

describe("full order ZIP", () => {
  it("contains both originals, generated images and readable UTF-8 customer details", async () => {
    const progress: number[] = [];
    const archive = await buildOrderZip(order, async (asset) => new Blob([asset.fileName]), (done) => progress.push(done));
    const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
    expect(archive.fileName).toBe("INK-123.zip");
    expect(Object.keys(files)).toHaveLength(5);
    expect(strFromU8(files["item-1-Bottle/2-logo.png"])).toBe("logo.png");
    const details = strFromU8(files["customer-and-order-details.txt"]);
    for (const value of [order.customerName, order.phone, order.address, "Quantity: 2", "Print side: Back", "INR 200.00"]) expect(details).toContain(value);
    expect(progress).toEqual([1, 2, 3, 4]);
  });

  it("keeps identical filenames from separate items and sanitizes archive paths", async () => {
    const archive = await buildOrderZip({ ...order, orderNumber: "../../order", items: [order.items[0], { ...order.items[0], designId: "different-design", productName: "../../Bottle" }] }, async () => new Blob(["image"]));
    const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
    expect(Object.keys(files)).toHaveLength(9);
    expect(Object.keys(files).every((path) => !path.includes(".."))).toBe(true);
    expect(archive.fileName.includes("/")).toBe(false);
  });

  it("does not return an incomplete ZIP when a listed image is unavailable", async () => {
    await expect(buildOrderZip(order, async () => { throw new Error("Missing image"); })).rejects.toThrow("Missing image");
  });

  it("downloads a shared design once and retains every size and quantity in the details", async () => {
    let reads = 0;
    const archive = await buildOrderZip({ ...order, subtotal: 600, items: [
      { ...order.items[0], size: "XS", quantity: 1 },
      { ...order.items[0], size: "S", quantity: 2, assets: order.items[0].assets.map(asset => ({ ...asset, storagePath: `legacy-size-copy/${asset.fileName}` })) },
      { ...order.items[0], size: "XXL", quantity: 3 },
    ] }, async () => { reads++; return new Blob(["image"]); });
    const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
    expect(reads).toBe(4); expect(Object.keys(files)).toHaveLength(5);
    const details = strFromU8(files["customer-and-order-details.txt"]);
    expect(details).toContain("XS × 1, S × 2, XXL × 3");
    expect(details).toContain("ORDER TOTAL: INR 600.00");
  });

  it("still exports customer details for an order with no artwork", async () => {
    const archive = await buildOrderZip({ ...order, items: [{ ...order.items[0], assets: [] }] }, async () => { throw new Error("Unexpected file read"); });
    expect(Object.keys(unzipSync(new Uint8Array(await archive.blob.arrayBuffer())))).toEqual(["customer-and-order-details.txt"]);
  });
});
