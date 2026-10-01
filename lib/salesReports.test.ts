import { describe, expect, it } from "vitest";
import { reportDateRange, salesReportCsv } from "./salesReports";
import type { OrderRecord } from "./orders";
describe("India sales report dates", () => {
  it("includes the full final India day without leaking the following day", () => {
    expect(reportDateRange("2026-10-01", "2026-10-31")).toEqual({ start: "2026-09-30T18:30:00.000Z", end: "2026-10-31T18:30:00.000Z" });
  });
  it("rejects impossible and reversed dates", () => {
    for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-02", "2026-10-01"], ["", "2026-10-01"]]) expect(() => reportDateRange(from, to)).toThrow();
  });
  it("quotes customer data, preserves Malayalam and prevents spreadsheet formulas", () => {
    const order: OrderRecord = { id: "1", orderNumber: "POS-1", customerName: "=malicious()", phone: "+919876543210", address: "മലയാളം, address", subtotal: 300, createdAt: "2026-10-01T00:00:00Z", salesChannel: "offline", status: "submitted", storageMode: "supabase", items: [{ productId: "p", productName: 'Product "one"', quantity: 3, unitPrice: 100, assets: [] }] };
    const csv = salesReportCsv([order]);
    expect(csv).toContain("\"'=malicious()\""); expect(csv).toContain("മലയാളം, address"); expect(csv).toContain('Product ""one""'); expect(csv).toContain('"offline"'); expect(csv).toContain('"Total order value INR","300"');
  });
});
