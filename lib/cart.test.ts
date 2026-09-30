import { describe, expect, it } from "vitest";
import { cartItemCount } from "./cart";

describe("shopping cart", () => {
  it("shows the total quantity across all cart lines", () => {
    expect(cartItemCount([{ productId: "mug", quantity: 2 }, { productId: "bottle", quantity: 3 }])).toBe(5);
  });
});
