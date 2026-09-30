import { describe, expect, it } from "vitest";
import { assertProductSize, emptySizeQuantities, isTShirtCategory, normalizeSizeQuantity, parseSizeQuantities, serializeSizeQuantities, totalSizeQuantity } from "./productSizes";
import { createProductPurchaseEntries } from "./purchase";
import { changeCartEntrySize } from "./cart";
import { products } from "./products";
import { buildWhatsAppOrderMessage, parseSavedOrder, type OrderRecord } from "./orders";
import { parseOrderPayload } from "./orderSubmission";
import { cloudOrderRecord, type CloudOrderRow } from "./cloudOrders";

const shirt = products[3];
describe("T-shirt size quantities", () => {
  it("recognizes shirt categories without applying clothing sizes to other products", () => {
    expect(["T-Shirts", "Tshirt", "T Shirts", "Kids T-Shirts"].every(isTShirtCategory)).toBe(true);
    expect(isTShirtCategory("Travel Mugs")).toBe(false);
    expect(() => assertProductSize(undefined, shirt.category, shirt.name)).toThrow("Choose a T-shirt size");
    expect(() => assertProductSize("XXL", shirt.category, shirt.name)).toThrow();
    expect(() => assertProductSize("S", products[0].category, products[0].name)).toThrow();
    expect(() => assertProductSize("XL", shirt.category, shirt.name)).not.toThrow();
  });
  it("carries exact per-size quantities into the editor and excludes zero-quantity sizes", () => {
    const sizes = { ...emptySizeQuantities(), S: 2, XL: 3 };
    expect(serializeSizeQuantities(sizes)).toBe("S:2,XL:3");
    expect(parseSizeQuantities(serializeSizeQuantities(sizes))).toEqual(sizes);
    expect(totalSizeQuantity(sizes)).toBe(5);
    expect(createProductPurchaseEntries(shirt, 1, sizes, "saved-design")).toEqual([
      { productId: shirt.id, quantity: 2, size: "S", designId: "saved-design" },
      { productId: shirt.id, quantity: 3, size: "XL", designId: "saved-design" },
    ]);
  });
  it("does not invent a default size for missing, duplicate or malformed selections", () => {
    for (const value of [null, "XXL:2", "M:1,M:2", "S:-1", "XL:100", "S:2:3", "M:NaN"]) expect(parseSizeQuantities(value)).toEqual(emptySizeQuantities());
    expect(() => createProductPurchaseEntries(shirt, 1, emptySizeQuantities())).toThrow("at least one");
    expect(() => createProductPurchaseEntries(shirt, 1, { S: -1, M: 2, L: 0, XL: 0 })).toThrow();
    expect(["", "2.9", "100", "-1", "bad"].map(normalizeSizeQuantity)).toEqual([0, 2, 99, 0, 0]);
    expect(createProductPurchaseEntries(products[0], 3)).toEqual([{ productId: products[0].id, quantity: 3 }]);
  });
  it("changes only the chosen size/design and combines matching sizes without altering the input", () => {
    const cart = [{ productId: shirt.id, quantity: 2, size: "S" as const, designId: "design" }, { productId: shirt.id, quantity: 3, size: "M" as const, designId: "design" }, { productId: shirt.id, quantity: 4, size: "S" as const }];
    const changed = changeCartEntrySize(cart, shirt.id, "M", "design", "S");
    expect(changed).toEqual([{ ...cart[1], quantity: 5 }, cart[2]]);
    expect(cart[0].quantity).toBe(2);
    expect(cart[0].size).toBe("S");
    expect(() => changeCartEntrySize([{ ...cart[0], quantity: 99 }, cart[1]], shirt.id, "M", "design", "S")).toThrow("exceed 99");
  });
  it("preserves size quantities through order validation, saved records and WhatsApp", () => {
    const payload = parseOrderPayload({ customerName: "Validation only", phone: "9999999999", address: "Validation only", subtotal: shirt.price * 5, items: createProductPurchaseEntries(shirt, 1, { S: 2, M: 0, L: 0, XL: 3 }).map((entry) => ({ ...entry, productName: shirt.name, unitPrice: shirt.price, assets: [] })) });
    const order: OrderRecord = { ...payload, id: "validation-only", orderNumber: "validation-only", status: "local", storageMode: "local", createdAt: "2026-09-30T00:00:00.000Z" };
    expect(parseSavedOrder(order)?.items.map((item) => [item.size, item.quantity])).toEqual([["S", 2], ["XL", 3]]);
    const message = buildWhatsAppOrderMessage(order);
    expect(message).toContain(`2 × ${shirt.name} · Size S`);
    expect(message).toContain(`3 × ${shirt.name} · Size XL`);
    expect(message).toContain(`Subtotal: ₹${(shirt.price * 5).toLocaleString("en-IN")}`);
    expect(() => parseOrderPayload({ ...payload, items: [{ ...payload.items[0], size: "XXL" }] })).toThrow();
  });
  it("reads sizes from the existing database variant snapshot for plain and personalised orders", () => {
    const row: CloudOrderRow = { id: "validation-only", order_number: "validation-only", customer_name: "", phone: "", shipping_address: {}, subtotal: 2995, created_at: "2026-09-30T00:00:00.000Z", order_items: [
      { product_id: "database-id", product_name_snapshot: shirt.name, quantity: 2, unit_price: shirt.price, variant_snapshot: { productId: shirt.id, size: "S" }, order_customizations: [] },
      { product_id: "database-id", product_name_snapshot: shirt.name, quantity: 3, unit_price: shirt.price, variant_snapshot: { size: "XL" }, order_customizations: [{ editable_state: { productId: shirt.id, designId: "actual-draft-reference" }, generated_files: [{ kind: "edited", original_filename: "actual-draft-reference-cropped.png", mime_type: "image/png", storage_path: "private/path/file.png" }] }] },
    ] };
    const record = cloudOrderRecord(row);
    expect(record.items.map((item) => [item.productId, item.size, item.quantity])).toEqual([[shirt.id, "S", 2], [shirt.id, "XL", 3]]);
    expect(record.items[1].assets[0].fileName).toBe("actual-draft-reference-cropped.png");
    expect(cloudOrderRecord({ ...row, order_items: [{ ...row.order_items[0], variant_snapshot: undefined }] }).items[0].size).toBeUndefined();
  });
});
