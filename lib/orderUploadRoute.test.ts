import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signed: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminSession: mocks.admin }));
vi.mock("@/lib/supabase/config", () => ({ serverSupabaseKey: () => "test-secret" }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ createSignedUploadUrl: mocks.signed }) } }) }));
vi.mock("@/lib/httpSafety", () => import("./httpSafety"));
vi.mock("@/lib/orderSubmission", () => import("./orderSubmission"));
vi.mock("@/lib/stagedOrderUploads", () => import("./stagedOrderUploads"));
vi.mock("@/lib/imageUpload", () => import("./imageUpload"));
import { POST } from "../app/api/orders/uploads/route";
import { stagedUploadSchema, verifyStagedUpload } from "./stagedOrderUploads";

const checkoutId = "10000000-0000-4000-8000-000000000001";
const assets = [
  { kind: "original", fileName: "front-logo.png", mimeType: "image/png", slot: 1, designId: "d" },
  { kind: "original", fileName: "back-text.eps", mimeType: "application/postscript", slot: 5, designId: "d" },
  { kind: "edited", fileName: "front-print.png", mimeType: "image/png", designId: "d" },
  { kind: "preview", fileName: "front-preview.png", mimeType: "image/png", designId: "d" },
  { kind: "edited", fileName: "back-print.png", mimeType: "image/png", slot: 1, designId: "d" },
  { kind: "preview", fileName: "back-preview.png", mimeType: "image/png", slot: 1, designId: "d" },
];
const body = { payload: { idempotencyKey: checkoutId, salesChannel: "offline", customerName: "Test", phone: "", address: "Counter", subtotal: 100, items: [{ productId: "p", productName: "Shirt", size: "XS", quantity: 1, unitPrice: 100, designId: "d", assets }] }, files: assets.map(asset => ({ key: `asset:0:${asset.kind}${asset.slot ? `:${asset.slot}` : ""}`, size: 2_000_000 })) };
const request = (content = body) => new Request("https://inkivo.test/api/orders/uploads", { method: "POST", headers: { origin: "https://inkivo.test", "content-type": "application/json" }, body: JSON.stringify(content) });
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.test"); mocks.admin.mockResolvedValue({ error: null }); mocks.signed.mockReset().mockResolvedValue({ data: { token: "signed-upload-token" }, error: null }); });
it("prepares six front/back logo and EPS uploads totalling 12 MB without sending image bytes through checkout", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.uploads).toHaveLength(6);
  for (const upload of result.uploads) {
    const receipt = stagedUploadSchema.parse(upload.receipt);
    expect(() => verifyStagedUpload(receipt, checkoutId, "test-secret")).not.toThrow();
  }
});
it("rejects a user photo above 5 MB before creating its upload URL", async () => {
  const response = await POST(request({ ...body, files: body.files.map((file, index) => index === 0 ? { ...file, size: 5 * 1024 * 1024 + 1 } : file) }));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("5 MB");
  expect(mocks.signed).not.toHaveBeenCalled();
});
it("requires admin access for counter uploads", async () => {
  mocks.admin.mockResolvedValue({ error: "Sign in", status: 401 });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.signed).not.toHaveBeenCalled();
});
