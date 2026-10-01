import { getAdminSession } from "@/lib/supabase/admin";
import { cloudOrderRecord, type CloudOrderRow } from "@/lib/cloudOrders";
import { reportDateRange } from "@/lib/salesReports";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const params = new URL(request.url).searchParams;
    const range = reportDateRange(params.get("from") ?? "", params.get("to") ?? "");
    const channel = params.get("channel");
    if (channel !== "online" && channel !== "offline") throw new Error("Choose online or offline reports.");
    const orders = [];
    for (let offset = 0; ; offset += 500) {
      const result = await session.client.from("orders").select("id, order_number, customer_name, phone, shipping_address, subtotal, created_at, state, completed_at, deleted_at, updated_at, order_items(product_id, product_name_snapshot, variant_snapshot, quantity, unit_price, order_customizations(editable_state, generated_files(kind, original_filename, mime_type, storage_path)))")
        .gte("created_at", range.start).lt("created_at", range.end).not("state", "in", "(draft,uploading,failed)").order("created_at").order("id").range(offset, offset + 499);
      if (result.error) throw new Error("Sales reports could not be loaded.");
      const rows = result.data as unknown as CloudOrderRow[];
      orders.push(...rows.filter((row) => row.state !== "processing" || Boolean(row.deleted_at)).map(cloudOrderRecord).filter((order) => order.salesChannel === channel));
      if (rows.length < 500) break;
    }
    return Response.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid report request." }, { status: 400 }); }
}
