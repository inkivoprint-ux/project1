import { z } from "zod";
import { getAdminSession } from "@/lib/supabase/admin";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const input = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(0).max(1000000).nullable(), expectedQuantity: z.number().int().min(0).nullable() }).parse(await readLimitedJson(request, 4096));
    const result = await session.client.rpc("set_product_stock", { product_slug: input.slug, quantity: input.quantity, expected_quantity: input.expectedQuantity });
    if (result.error) return Response.json({ error: result.error.message.includes("Stock changed") ? "Stock changed during editing. Refresh before updating." : "Stock could not be saved. Check the stock/counter database migration." }, { status: 409 });
    return Response.json({ saved: true });
  } catch { return Response.json({ error: "Invalid inventory update." }, { status: 400 }); }
}
