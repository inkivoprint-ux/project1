import { describe, expect, it } from "vitest";
import { signStagedUpload, stagedUploadSchema, verifyStagedUpload } from "./stagedOrderUploads";

const unsigned = { key: "asset:0:original:4", path: "checkout-staging/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/back-text.eps", fileName: "back-text.eps", mimeType: "application/postscript" as const, size: 6_000_000, checkoutId: "10000000-0000-4000-8000-000000000001", expires: 2_000_000 };
const receipt = { ...unsigned, signature: signStagedUpload(unsigned, "test-secret") };
describe("private staged order uploads", () => {
  it("allows a large vector file without the combined checkout body limit", () => {
    expect(stagedUploadSchema.parse(receipt)).toEqual(receipt);
    expect(() => verifyStagedUpload(receipt, unsigned.checkoutId, "test-secret", 1_000_000)).not.toThrow();
  });
  it("binds files to checkout, storage path, content type and byte size", () => {
    for (const changed of [{ ...receipt, size: 1 }, { ...receipt, path: receipt.path.replace("back-text", "front-text") }, { ...receipt, mimeType: "image/png" as const }]) expect(() => verifyStagedUpload(changed, unsigned.checkoutId, "test-secret", 1_000_000)).toThrow("changed");
    expect(() => verifyStagedUpload(receipt, "another-checkout", "test-secret", 1_000_000)).toThrow("changed");
    expect(() => verifyStagedUpload(receipt, unsigned.checkoutId, "wrong-secret", 1_000_000)).toThrow("changed");
  });
  it("rejects expired tokens and paths outside checkout staging", () => {
    expect(() => verifyStagedUpload(receipt, unsigned.checkoutId, "test-secret", 2_000_001)).toThrow("expired");
    expect(stagedUploadSchema.safeParse({ ...receipt, path: "orders/private/file.eps" }).success).toBe(false);
  });
});
