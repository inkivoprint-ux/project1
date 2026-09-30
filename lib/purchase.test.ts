import { describe, expect, it } from "vitest";
import { createPurchaseEntry, normalizePurchaseQuantity } from "./purchase";
import { products } from "./products";
import { parseOrderPayload } from "./orderSubmission";
import { buildWhatsAppOrderMessage, type OrderRecord } from "./orders";

describe("single-product purchases", () => {
  it("normalizes missing, invalid and out-of-range quantity parameters", () => {
    expect([null, undefined, "", "bad", Infinity].map(normalizePurchaseQuantity)).toEqual([1, 1, 1, 1, 1]);
    expect(["3", "3.9", "0", "-4", "200"].map(normalizePurchaseQuantity)).toEqual([3, 3, 1, 1, 99]);
  });

  it("creates a plain selection with no fabricated design or assets", () => {
    expect(createPurchaseEntry(products[0].id, 3)).toEqual({ productId: products[0].id, quantity: 3 });
  });

  it("preserves the exact saved design reference for personalised checkout", () => {
    expect(createPurchaseEntry(products[0].id, 2, "saved-design-reference")).toEqual({ productId: products[0].id, quantity: 2, designId: "saved-design-reference" });
  });

  it("rejects invalid quantities instead of silently submitting a different amount", () => {
    for (const quantity of [0, -1, 100, 1.5, NaN, Infinity]) {
      expect(() => createPurchaseEntry(products[0].id, quantity)).toThrow("quantity between 1 and 99");
    }
  });

  it("validates a quantity-based unpersonalised order without requiring artwork", () => {
    const product = products[0];
    const entry = createPurchaseEntry(product.id, 3);
    const payload = parseOrderPayload({ customerName: "Validation fixture", phone: "9999999999", address: "Validation only", subtotal: product.price * entry.quantity, items: [{ ...entry, productName: product.name, unitPrice: product.price, assets: [] }] });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBe(3);
    expect(payload.items[0].assets).toEqual([]);
    expect(payload.subtotal).toBe(1947);
    const order: OrderRecord = { ...payload, id: "validation-only", orderNumber: "validation-only", status: "local", storageMode: "local", createdAt: "2026-09-30T00:00:00.000Z" };
    const message = buildWhatsAppOrderMessage(order);
    expect(message).toContain(`3 × ${product.name}`);
    expect(message).toContain("Personalisation: Without personalisation");
    expect(message).toContain("Order details are saved on my device only");
    expect(message).not.toContain("Files are saved");
    expect(message).not.toContain("cropped:");
  });
});
