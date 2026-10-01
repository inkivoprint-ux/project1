import { z } from "zod";
import { getAdminSession } from "@/lib/supabase/admin";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";
import { assertProductSize, T_SHIRT_SIZES } from "@/lib/productSizes";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const input = z.object({ idempotencyKey: z.string().uuid(), customerName: z.string().trim().min(1).max(160), phone: z.string().max(40), address: z.string().max(2000), items: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(1).max(99), unitPrice: z.number().positive(), size: z.enum(T_SHIRT_SIZES).optional() })).min(1).max(99) }).parse(await readLimitedJson(request, 64000));
    for (const item of input.items) {
      const product = await session.client.from("products").select("name, storefront_config").eq("slug", item.slug).single();
      if (product.error) throw new Error("Refresh the counter product list.");
      assertProductSize(item.size, product.data.storefront_config?.category ?? "", product.data.name);
    }
    const result = await session.client.rpc("submit_counter_order", { document: input });
    if (result.error) return Response.json({ error: /Insufficient stock|price changed/.test(result.error.message) ? result.error.message : "Counter order could not be saved. Check the stock/counter migration and refresh products." }, { status: 409 });
    const saved = await session.client.from("orders").select("order_number").eq("id", result.data).single();
    // The sale is already committed; do not encourage a second submission on a read failure.
    return Response.json({ orderId: result.data, orderNumber: saved.data?.order_number ?? result.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid counter order." }, { status: 400 }); }
}
