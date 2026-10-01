import { expect, it } from "vitest";
import { MAX_IMAGE_UPLOAD_BYTES, validateImageUpload } from "./imageUpload";
it("accepts supported images at exactly 5 MB and rejects larger images everywhere", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    expect(() => validateImageUpload({ type, size: MAX_IMAGE_UPLOAD_BYTES })).not.toThrow();
    expect(() => validateImageUpload({ type, size: MAX_IMAGE_UPLOAD_BYTES + 1 })).toThrow("5 MB");
  }
  expect(() => validateImageUpload({ type: "image/png", size: 0 })).toThrow();
  expect(() => validateImageUpload({ type: "image/svg+xml", size: 100 })).toThrow("JPG/JPEG");
});
