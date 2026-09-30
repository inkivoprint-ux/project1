import { describe, expect, it } from "vitest";
import { buildDesignAssetFileName, buildWhatsAppOrderMessage, removeAssetFromOrderRecord, type OrderRecord } from "./orders";

describe("WhatsApp order message", () => {
  it("uses canonical filenames that remain safe and exact through upload", () => {
    expect(buildDesignAssetFileName("tshirt-123", "original", "image/jpeg")).toBe("tshirt-123-original.jpg");
    expect(buildDesignAssetFileName("tshirt-123", "edited", "image/png")).toBe("tshirt-123-cropped.png");
    expect(buildDesignAssetFileName("tshirt-123", "preview", "image/png")).toBe("tshirt-123-preview.png");
  });

  it("includes the exact original, cropped, and preview filenames", () => {
    const order: OrderRecord = {
      id: "order-1",
      orderNumber: "INK-12345678",
      customerName: "Sneha",
      phone: "9999999999",
      address: "Kerala",
      subtotal: 799,
      status: "submitted",
      storageMode: "supabase",
      createdAt: "2026-09-30T00:00:00.000Z",
      items: [{
        productId: "classic-cotton-tshirt",
        productName: "Classic Cotton T-shirt",
        quantity: 1,
        unitPrice: 799,
        assets: [
          { kind: "original", fileName: "design-original.jpg", mimeType: "image/jpeg" },
          { kind: "edited", fileName: "design-cropped.png", mimeType: "image/png" },
          { kind: "preview", fileName: "design-preview.png", mimeType: "image/png" },
        ],
      }],
    };

    const message = buildWhatsAppOrderMessage(order);

    expect(message).toContain("order INK-12345678");
    expect(message).toContain("original: design-original.jpg");
    expect(message).toContain("cropped: design-cropped.png");
    expect(message).toContain("preview: design-preview.png");
  });

  it("removes only the selected customer file from an order", () => {
    const order: OrderRecord = {
      id: "order-2",
      orderNumber: "INK-87654321",
      customerName: "Customer",
      phone: "9999999999",
      address: "Kerala",
      subtotal: 799,
      status: "local",
      storageMode: "local",
      createdAt: "2026-09-30T00:00:00.000Z",
      items: [{
        productId: "classic-cotton-tshirt",
        productName: "Classic Cotton T-shirt",
        quantity: 1,
        unitPrice: 799,
        assets: [
          { kind: "original", fileName: "original.jpg", mimeType: "image/jpeg" },
          { kind: "edited", fileName: "cropped.png", mimeType: "image/png" },
          { kind: "preview", fileName: "preview.png", mimeType: "image/png" },
        ],
      }],
    };

    const result = removeAssetFromOrderRecord(order, 0, "edited", "cropped.png");

    expect(result.items[0].assets.map((asset) => asset.fileName)).toEqual(["original.jpg", "preview.png"]);
    expect(order.items[0].assets).toHaveLength(3);
  });
});
