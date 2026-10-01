import { describe, expect, it } from "vitest";
import { collectOrderFiles, parseOrderPayload } from "./orderSubmission";

const payload = {
  customerName: "Sneha",
  phone: "9999999999",
  address: "Kerala",
  subtotal: 799,
  items: [{
    productId: "classic-cotton-tshirt",
    productName: "Classic Cotton T-shirt",
    quantity: 1,
    unitPrice: 799,
    designId: "design-1",
    configuration: { text: "Hello" },
    assets: [
      { kind: "edited" as const, fileName: "design-1-cropped.png", mimeType: "image/png", designId: "design-1" },
      { kind: "preview" as const, fileName: "design-1-preview.png", mimeType: "image/png", designId: "design-1" },
    ],
  }],
};

describe("order submission validation", () => {
  it("accepts exact declared filenames and files", () => {
    const parsed = parseOrderPayload(payload);
    const formData = new FormData();
    formData.set("asset:0:edited", new File(["edited"], "design-1-cropped.png", { type: "image/png" }));
    formData.set("asset:0:preview", new File(["preview"], "design-1-preview.png", { type: "image/png" }));

    expect([...collectOrderFiles(parsed, formData).values()].map((file) => file.name)).toEqual([
      "design-1-cropped.png",
      "design-1-preview.png",
    ]);
  });

  it("rejects a customized item without both generated files", () => {
    expect(() => parseOrderPayload({
      ...payload,
      items: [{ ...payload.items[0], assets: payload.items[0].assets.slice(0, 1) }],
    })).toThrow("cropped image and product preview");
  });

  it("rejects a file whose uploaded name differs from the saved order name", () => {
    const parsed = parseOrderPayload(payload);
    const formData = new FormData();
    formData.set("asset:0:edited", new File(["edited"], "renamed.png", { type: "image/png" }));
    formData.set("asset:0:preview", new File(["preview"], "design-1-preview.png", { type: "image/png" }));

    expect(() => collectOrderFiles(parsed, formData)).toThrow("does not match design-1-cropped.png");
  });

  it("rejects a subtotal that does not match the saved line items", () => {
    expect(() => parseOrderPayload({ ...payload, subtotal: 1 })).toThrow("subtotal does not match");
  });

  it("keeps exact filenames when the same personalised item has multiple copies", () => {
    const parsed = parseOrderPayload({ ...payload, subtotal: 2397, items: [{ ...payload.items[0], quantity: 3 }] });
    const formData = new FormData();
    formData.set("asset:0:edited", new File(["edited"], "design-1-cropped.png", { type: "image/png" }));
    formData.set("asset:0:preview", new File(["preview"], "design-1-preview.png", { type: "image/png" }));
    expect(parsed.items[0].quantity).toBe(3);
    expect([...collectOrderFiles(parsed, formData).values()].map((file) => file.name)).toEqual(["design-1-cropped.png", "design-1-preview.png"]);
  });

  it("retains the same design filenames on different size lines without confusing upload keys", () => {
    const parsed = parseOrderPayload({ ...payload, subtotal: 2397, items: [{ ...payload.items[0], size: "S", quantity: 1 }, { ...payload.items[0], size: "XL", quantity: 2 }] });
    const formData = new FormData();
    for (const index of [0, 1]) {
      formData.set(`asset:${index}:edited`, new File(["edited"], "design-1-cropped.png", { type: "image/png" }));
      formData.set(`asset:${index}:preview`, new File(["preview"], "design-1-preview.png", { type: "image/png" }));
    }
    const files = collectOrderFiles(parsed, formData);
    expect([...files.keys()]).toEqual(["asset:0:edited", "asset:0:preview", "asset:1:edited", "asset:1:preview"]);
    expect(files.get("asset:0:edited")?.name).toBe(files.get("asset:1:edited")?.name);
    expect(parsed.items.map((item) => [item.size, item.quantity])).toEqual([["S", 1], ["XL", 2]]);
  });
});

it("reuses one design upload across T-shirt sizes and rejects mismatched references", () => {
  const item = payload.items[0];
  const shared = { ...payload, subtotal: 1598, items: [{ ...item, size: "M", assets: item.assets.map((asset) => ({ ...asset, uploadItemIndex: 0 })) }, { ...item, size: "L", assets: item.assets.map((asset) => ({ ...asset, uploadItemIndex: 0 })) }] };
  const data = new FormData();
  data.set("asset:0:edited", new File(["edited"], "design-1-cropped.png", { type: "image/png" }));
  data.set("asset:0:preview", new File(["preview"], "design-1-preview.png", { type: "image/png" }));
  const files = collectOrderFiles(parseOrderPayload(shared), data);
  expect(files.get("asset:0:edited")).toBe(files.get("asset:1:edited"));
  shared.items[1].designId = "different-design";
  shared.items[1].assets.forEach((asset) => { asset.designId = "different-design"; });
  expect(() => collectOrderFiles(parseOrderPayload(shared), data)).toThrow("does not match");
});

describe("two-image order files", () => {
  const originals = [
    { kind: "original", slot: 0, fileName: "design-1-photo.png", mimeType: "image/png", designId: "design-1" },
    { kind: "original", slot: 1, fileName: "design-1-logo.png", mimeType: "image/png", designId: "design-1" },
  ];
  it("keeps both originals distinct, including shared uploads across size lines", () => {
    const item = { ...payload.items[0], assets: [...originals, ...payload.items[0].assets].map((asset) => ({ ...asset, uploadItemIndex: 0 })) };
    const parsed = parseOrderPayload({ ...payload, subtotal: payload.subtotal * 2, items: [item, item] });
    const form = new FormData();
    form.set("asset:0:original", new File(["photo"], originals[0].fileName, { type: "image/png" }));
    form.set("asset:0:original:1", new File(["logo"], originals[1].fileName, { type: "image/png" }));
    form.set("asset:0:edited", new File(["edited"], "design-1-cropped.png", { type: "image/png" }));
    form.set("asset:0:preview", new File(["preview"], "design-1-preview.png", { type: "image/png" }));
    const files = collectOrderFiles(parsed, form);
    expect(files.get("asset:1:original")?.name).toBe(originals[0].fileName);
    expect(files.get("asset:1:original:1")?.name).toBe(originals[1].fileName);
    expect(files.size).toBe(8);
  });
  it("rejects duplicate image slots and extra composite layers", () => {
    expect(() => parseOrderPayload({ ...payload, items: [{ ...payload.items[0], assets: [...originals.map((asset) => ({ ...asset, slot: 0 })), ...payload.items[0].assets] }] })).toThrow("Duplicate");
    expect(() => parseOrderPayload({ ...payload, items: [{ ...payload.items[0], assets: [...payload.items[0].assets, { ...payload.items[0].assets[0], slot: 1 }] }] })).toThrow("Duplicate");
  });
});
