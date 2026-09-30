import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addCartEntries, addCartItem, loadCart, normalizeCart, removeCartItem, updateCartItem, updateCartItemSize } from "./cart";
import { createDefaultTemplate, loadCustomerTemplate, loadTemplate, resetTemplate, saveTemplate, validateTemplate } from "./customization";
import { assertOrderProduct } from "./orderSubmission";
import { loadAllProducts, parseStoredProduct, saveCustomProduct } from "./productCatalog";
import { products } from "./products";
import { projectArtworkColumn } from "./artworkFinishing";
import { parseSavedOrder } from "./orders";

describe("audit regressions", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    const events = new EventTarget();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }, dispatchEvent: (event: Event) => events.dispatchEvent(event), addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps different designs and plain purchases as separate cart lines", () => {
    addCartItem(products[0].id, 1, "design-one"); addCartItem(products[0].id, 2, "design-two"); addCartItem(products[0].id, 1);
    expect(loadCart()).toHaveLength(3);
    updateCartItem(products[0].id, 3, "design-one");
    expect(loadCart().map((item) => item.quantity)).toEqual([3, 2, 1]);
    removeCartItem(products[0].id, "design-two");
    expect(loadCart().map((item) => item.designId)).toEqual(["design-one", undefined]);
  });

  it("keeps sizes separate while updating and removing only the chosen variant", () => {
    addCartEntries([{ productId: products[3].id, quantity: 2, size: "S" }, { productId: products[3].id, quantity: 3, size: "XL" }]);
    addCartItem(products[3].id, 1, "design", "S");
    updateCartItem(products[3].id, 4, undefined, "S");
    expect(loadCart().map((item) => item.quantity)).toEqual([4, 3, 1]);
    removeCartItem(products[3].id, undefined, "XL");
    expect(loadCart().map((item) => item.size)).toEqual(["S", "S"]);
    updateCartItemSize(products[3].id, "M", "design", "S");
    expect(loadCart()[1]).toMatchObject({ quantity: 1, size: "M", designId: "design" });
  });
  it("adds multiple sizes atomically and keeps legacy size-less cart lines readable", () => {
    addCartItem(products[3].id, 99, undefined, "M");
    expect(() => addCartEntries([{ productId: products[3].id, quantity: 1, size: "S" }, { productId: products[3].id, quantity: 1, size: "M" }])).toThrow("at most 99");
    expect(loadCart()).toHaveLength(1);
    const legacy = normalizeCart([{ productId: products[3].id, quantity: 2 }]);
    expect(legacy[0].quantity).toBe(2);
    expect(legacy[0].size).toBeUndefined();
  });

  it("rejects corrupt quantities instead of silently producing NaN totals", () => {
    expect(normalizeCart([{ productId: "x", quantity: "bad" }, { productId: "x", quantity: -1 }])).toEqual([]);
    expect(() => addCartItem("x", NaN)).toThrow();
    expect(() => updateCartItem("x", Infinity)).toThrow();
    expect(addCartItem("x", 200)[0].quantity).toBe(99);
  });

  it("keeps drafts out of the customer editor and publishes actual changes", () => {
    const initial = createDefaultTemplate(products[0]);
    const draft = { ...initial, area: { ...initial.area, opacity: .5 } };
    saveTemplate(draft);
    expect(loadTemplate(products[0]).area.opacity).toBe(.5);
    expect(loadCustomerTemplate(products[0]).area.opacity).toBe(initial.area.opacity);
    const published = saveTemplate(draft, true);
    expect(loadCustomerTemplate(products[0]).area.opacity).toBe(.5);
    saveTemplate({ ...published, area: { ...published.area, opacity: .7 } });
    expect(loadCustomerTemplate(products[0]).area.opacity).toBe(.5);
    const reset = resetTemplate(products[0]);
    expect(loadCustomerTemplate(products[0]).area.opacity).toBe(.5);
    expect(saveTemplate(reset, true).version).toBeGreaterThan(published.version);
  });

  it("publishes new mask presets on both sides without replacing other template settings", () => {
    const initial = createDefaultTemplate(products[3]);
    const draft = { ...initial, area: { ...initial.area, maskShape: "heart" as const }, backArea: { ...initial.backArea!, maskShape: "star" as const } };
    saveTemplate(draft);
    expect(loadCustomerTemplate(products[3]).area.maskShape).toBe("rectangle");
    saveTemplate(draft, true);
    const published = loadCustomerTemplate(products[3]);
    expect(published.area.maskShape).toBe("heart");
    expect(published.backArea?.maskShape).toBe("star");
    expect(published.tools).toEqual(initial.tools);
    expect(published.area.widthMm).toBe(initial.area.widthMm);
    saveTemplate({ ...published, area: { ...published.area, maskShape: "diamond" } });
    expect(loadCustomerTemplate(products[3]).area.maskShape).toBe("heart");
  });

  it("rejects invalid template dimensions and strips obsolete rating fields", () => {
    const template = createDefaultTemplate(products[0]);
    expect(() => validateTemplate({ ...template, area: { ...template.area, widthMm: 0 } })).toThrow();
    expect(() => validateTemplate({ ...template, area: { ...template.area, x: 99, width: 20 } })).toThrow();
    expect(parseStoredProduct({ ...products[0], rating: 5, reviews: 50 })).not.toHaveProperty("rating");
    expect(parseStoredProduct({ ...products[0], price: Infinity })).toBeNull();
    expect(parseStoredProduct({ ...products[0], name: {} })).toBeNull();
  });

  it("uses authoritative prices and refuses anonymous catalogue manipulation", () => {
    const item = { productId: products[0].id, productName: products[0].name, quantity: 1, unitPrice: products[0].price, assets: [] };
    const record = { name: products[0].name, base_price: products[0].price, offer_price: null, is_active: true };
    expect(() => assertOrderProduct(item, record)).not.toThrow();
    expect(() => assertOrderProduct({ ...item, unitPrice: 1 }, record)).toThrow();
    expect(() => assertOrderProduct(item, null)).toThrow();
    expect(() => assertOrderProduct(item, { ...record, is_active: false })).toThrow();
  });

  it("keeps perspective centred and returns identity at zero rotation", () => {
    expect(projectArtworkColumn(280, 560, 30, 700)).toEqual({ x: 280, factor: 1 });
    expect(projectArtworkColumn(0, 560, 0, 700)).toEqual({ x: 0, factor: 1 });
    expect(projectArtworkColumn(560, 560, 0, 700)).toEqual({ x: 560, factor: 1 });
  });

  it("rejects corrupt saved records without rejecting intentionally removed files", () => {
    expect(parseSavedOrder(null)).toBeNull();
    expect(parseSavedOrder({ items: [null] })).toBeNull();
    const order = { id: "unit-order", orderNumber: "unit-reference", customerName: "", phone: "", address: "", subtotal: 1, status: "local", storageMode: "local", createdAt: "2026-09-30T00:00:00.000Z", items: [{ productId: "unit-product", productName: "", quantity: 1, unitPrice: 1, designId: "unit-design", assets: [] }] };
    expect(parseSavedOrder(order)?.items[0].assets).toEqual([]);
    expect(parseSavedOrder({ ...order, subtotal: NaN })).toBeNull();
  });

  it("persists badge removal and display positions without losing product details", () => {
    saveCustomProduct({ ...products[2], badge: "Bestseller", displayOrder: 1 });
    expect(loadAllProducts()[0].id).toBe(products[2].id);
    expect(loadAllProducts()[0].badge).toBe("Bestseller");
    saveCustomProduct({ ...loadAllProducts()[0], badge: undefined, displayOrder: 4 });
    expect(loadAllProducts().map((product) => product.displayOrder)).toEqual([1, 2, 3, 4]);
    expect(loadAllProducts()[3].badge).toBeUndefined();
    expect(loadAllProducts()[3].printArea).toEqual(products[2].printArea);
    expect(loadAllProducts().find((product) => product.id === products[3].id)?.views).toEqual(products[3].views);
  });
});
