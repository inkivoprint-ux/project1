import { describe, expect, it } from "vitest";
import { printPrice } from "./printPricing";
import { assertOrderProduct } from "./orderSubmission";
import type { OrderItemRecord } from "./orders";

describe("T-shirt side pricing", () => {
  const shirt = { category: "T-Shirts", price: 699, frontBackPrice: 899 };
  it("charges the base price for no print or one side and the second price for both", () => {
    for (const configuration of [undefined, { sides: { front: {} } }, { sides: { back: {} } }]) expect(printPrice(shirt, configuration)).toBe(699);
    expect(printPrice(shirt, { sides: { front: {}, back: {} } })).toBe(899);
    expect(printPrice({ ...shirt, frontBackPrice: undefined }, { sides: { front: {}, back: {} } })).toBe(699);
    expect(printPrice({ ...shirt, category: "Bottles" }, { sides: { front: {}, back: {} } })).toBe(699);
  });
  it("rejects a front-only price submitted for a two-sided shirt", () => {
    const item: OrderItemRecord = { productId: "shirt", productName: "Shirt", quantity: 2, unitPrice: 699, configuration: { sides: { front: {}, back: {} } }, assets: [] };
    const row = { name: "Shirt", base_price: 699, offer_price: null, is_active: true, storefront_config: shirt };
    expect(() => assertOrderProduct(item, row)).toThrow("price has changed");
    expect(() => assertOrderProduct({ ...item, unitPrice: 899 }, row)).not.toThrow();
  });
});
