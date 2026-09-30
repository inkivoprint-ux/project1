import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { purgeOrderFiles } from "./purgeOrder";
const orderId = "11111111-1111-4111-8111-111111111111";
function clientWith(storage: object) { return { storage: { from: vi.fn(() => storage) } } as unknown as SupabaseClient; }
describe("permanent order file cleanup", () => {
  it("recursively removes only the chosen order's files, including orphan uploads", async () => {
    const root = `orders/${orderId}`;
    const storage = { list: vi.fn(async (folder: string) => ({ error: null, data: folder === root ? [{ name: "design", id: null }] : [{ name: "orphan.png", id: "file" }] })), remove: vi.fn<(paths: string[]) => Promise<{ error: null }>>(async () => ({ error: null })) };
    await purgeOrderFiles(clientWith(storage), orderId);
    expect(storage.remove).toHaveBeenCalledWith([`${root}/design/orphan.png`]);
  });
  it("lists every page before removing files and batches large deletions", async () => {
    const storage = { list: vi.fn(async (_folder: string, options: { offset: number }) => ({ error: null, data: Array.from({ length: options.offset === 0 ? 100 : 1 }, (_, index) => ({ name: `file-${options.offset + index}.png`, id: "file" })) })), remove: vi.fn<(paths: string[]) => Promise<{ error: null }>>(async () => ({ error: null })) };
    await purgeOrderFiles(clientWith(storage), orderId);
    expect(storage.list).toHaveBeenCalledTimes(2);
    expect(storage.remove.mock.calls.map((call) => call[0].length)).toEqual([100, 1]);
  });
  it("stops on listing or deletion failures so the caller can retain records for retry", async () => {
    const failure = new Error("storage unavailable");
    const storage = { list: vi.fn<() => Promise<{ error: Error | null; data: { name: string; id: string }[] }>>(async () => ({ error: failure, data: [] })), remove: vi.fn(async () => ({ error: failure })) };
    await expect(purgeOrderFiles(clientWith(storage), orderId)).rejects.toThrow("storage unavailable");
    expect(storage.remove).not.toHaveBeenCalled();
    storage.list.mockResolvedValue({ error: null, data: [{ name: "file.png", id: "file" }] });
    await expect(purgeOrderFiles(clientWith(storage), orderId)).rejects.toThrow("storage unavailable");
  });
  it("does not accept paths that escape the chosen order folder", async () => {
    const storage = { list: vi.fn(async () => ({ error: null, data: [{ name: "../other", id: "file" }] })), remove: vi.fn() };
    await expect(purgeOrderFiles(clientWith(storage), orderId)).rejects.toThrow("Invalid order file path");
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
