import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSameOrigin, readLimitedBody, readLimitedJson } from "./httpSafety";
import { assertOrderUploadBudget, MAX_ORDER_REQUEST_BYTES, parseOrderPayload } from "./orderSubmission";
import { hasSupabaseConfiguration, publicSupabaseKey, serverSupabaseKey } from "./supabase/config";
import { loadAllProducts, parseStoredProduct } from "./productCatalog";
import { loadCustomerTemplate, loadTemplate, createDefaultTemplate, saveTemplate } from "./customization";
import { sharedTemplates, setSharedProducts } from "./sharedCache";
import { products } from "./products";

afterEach(() => { vi.unstubAllEnvs(); sharedTemplates.clear(); setSharedProducts([]); });
describe("deployment boundaries", () => {
  it("accepts only same-origin mutations", () => {
    expect(() => assertSameOrigin(new Request("https://inkivo.in/api/orders", { headers: { origin: "https://inkivo.in" } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request("https://inkivo.in/api/orders", { headers: { origin: "https://other.example" } }))).toThrow();
    expect(() => assertSameOrigin(new Request("https://inkivo.in/api/orders"))).toThrow();
  });
  it("bounds streamed request bodies and rejects invalid JSON", async () => {
    expect(await readLimitedJson(new Request("https://inkivo.in", { method: "POST", body: '{"ok":true}' }), 20)).toEqual({ ok: true });
    await expect(readLimitedBody(new Request("https://inkivo.in", { method: "POST", body: "too large" }), 3)).rejects.toThrow("too large");
    await expect(readLimitedJson(new Request("https://inkivo.in", { method: "POST", body: "invalid" }))).rejects.toThrow();
  });
  it("counts every size-line upload and JSON overhead beneath the hosting limit", () => {
    expect(() => assertOrderUploadBudget({}, [{ size: 1000 }, { size: 1000 }])).not.toThrow();
    expect(() => assertOrderUploadBudget({}, [{ size: MAX_ORDER_REQUEST_BYTES }])).toThrow("too large");
    expect(() => assertOrderUploadBudget({}, Array.from({ length: 4 }, () => ({ size: 1_050_000 })))).toThrow("too large");
  });
  it("supports new keys without removing legacy configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-public-fixture");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-server-fixture");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(hasSupabaseConfiguration()).toBe(true); expect(publicSupabaseKey()).toBe("legacy-public-fixture"); expect(serverSupabaseKey()).toBe("legacy-server-fixture");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-fixture"); vi.stubEnv("SUPABASE_SECRET_KEY", "server-fixture");
    expect(publicSupabaseKey()).toBe("public-fixture"); expect(serverSupabaseKey()).toBe("server-fixture");
  });
  it("never uses local products or drafts as the cloud customer catalogue", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-fixture");
    const product = products[0], published = { ...createDefaultTemplate(product), status: "published" as const }, draft = { ...published, status: "draft" as const, version: 2, area: { ...published.area, opacity: .2 } };
    setSharedProducts([product]); sharedTemplates.set(product.id, { published, draft });
    expect(loadAllProducts()).toEqual([product]); expect(loadTemplate(product)).toBe(draft); expect(loadCustomerTemplate(product)).toBe(published);
    expect(() => saveTemplate(draft)).toThrow("administrator connection");
  });
  it("allows only this project's public product bucket as a remote image", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
    const image = "https://fixture.supabase.co/storage/v1/object/public/product-assets/catalogue/image.png";
    expect(parseStoredProduct({ ...products[0], image })?.image).toBe(image);
    expect(parseStoredProduct({ ...products[0], image: "https://other.example/image.png" })).toBeNull();
    expect(parseStoredProduct({ ...products[0], image: "https://fixture.supabase.co/storage/v1/object/public/order-assets/customer.png" })).toBeNull();
  });
  it("preserves a valid retry key and rejects malformed keys", () => {
    const payload = { idempotencyKey: "c636d65a-4423-4db7-a490-1ff1bc804803", customerName: "Validation fixture", phone: "9999999999", address: "Unit-test input", subtotal: 649, items: [{ productId: products[0].id, productName: products[0].name, unitPrice: 649, quantity: 1, assets: [] }] };
    expect(parseOrderPayload(payload).idempotencyKey).toBe(payload.idempotencyKey);
    expect(() => parseOrderPayload({ ...payload, idempotencyKey: "not-a-key" })).toThrow();
  });
});
