import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), purge: vi.fn(), service: {} }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminSession: mocks.session }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfiguration: () => true, serverSupabaseKey: () => "test-key" }));
vi.mock("@/lib/purgeOrder", () => ({ purgeOrderFiles: mocks.purge }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.service }));
vi.mock("@/lib/httpSafety", async () => await import("../../../../lib/httpSafety"));
import { DELETE, PATCH } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
function request(action = "purge", method = "DELETE") { return new Request("https://inkivo.in/api/orders/manage", { method, headers: { origin: "https://inkivo.in", "Content-Type": "application/json" }, body: JSON.stringify({ orderId: id, action }) }); }
function database(order: object, claim = true) {
  const operations: string[] = [];
  const client = { from: vi.fn(() => {
    let action = "read";
    const query = {
      select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query),
      update: vi.fn(() => { action = "claim"; operations.push(action); return query; }),
      delete: vi.fn(() => { action = "delete"; operations.push(action); return query; }),
      maybeSingle: vi.fn(async () => ({ error: null, data: action === "read" ? order : claim ? { id } : null })),
      then: (resolve: (value: object) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return query;
  }) };
  mocks.session.mockResolvedValue({ client, error: null });
  return operations;
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co"); mocks.purge.mockResolvedValue(undefined); });
afterEach(() => vi.unstubAllEnvs());
describe("permanent order deletion endpoint", () => {
  it("requires an administrator", async () => {
    mocks.session.mockResolvedValue({ error: "Sign in", status: 401 });
    expect((await DELETE(request())).status).toBe(401);
    expect(mocks.purge).not.toHaveBeenCalled();
  });
  it("refuses active orders and the wrong HTTP method", async () => {
    const operations = database({ id, state: "completed", deleted_at: null });
    expect((await DELETE(request())).status).toBe(409);
    expect(operations).toEqual([]);
    expect((await PATCH(request("purge", "PATCH"))).status).toBe(400);
  });
  it("claims Trash before removing storage and then deletes the parent record", async () => {
    const operations = database({ id, state: "completed", deleted_at: "trash-date" });
    mocks.purge.mockImplementation(async () => { expect(operations).toEqual(["claim"]); });
    const response = await DELETE(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ permanentlyDeleted: true });
    expect(operations).toEqual(["claim", "delete"]);
  });
  it("keeps records when storage fails and allows retrying the processing order", async () => {
    const order = { id, state: "processing", deleted_at: "trash-date" };
    const operations = database(order);
    mocks.purge.mockRejectedValueOnce(new Error("storage failed"));
    expect((await DELETE(request())).status).toBe(500);
    expect(operations).toEqual(["claim"]);
    expect((await PATCH(request("restore", "PATCH"))).status).toBe(409);
    expect((await DELETE(request())).status).toBe(200);
    expect(operations).toEqual(["claim", "claim", "delete"]);
  });
  it("does not remove files when restoration wins the atomic claim", async () => {
    database({ id, state: "completed", deleted_at: "trash-date" }, false);
    expect((await DELETE(request())).status).toBe(409);
    expect(mocks.purge).not.toHaveBeenCalled();
  });
});
