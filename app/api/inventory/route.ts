import { z } from "zod";
import { getAdminSession } from "@/lib/supabase/admin";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const sizeStock = z.object({ XS: z.number().int().min(0).max(1000000), XXL: z.number().int().min(0).max(1000000), S: z.number().int().min(0).max(1000000), M: z.number().int().min(0).max(1000000), L: z.number().int().min(0).max(1000000), XL: z.number().int().min(0).max(1000000) });
    const input = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), quantity: z.number().int().min(0).max(1000000).nullable(), expectedQuantity: z.number().int().min(0).nullable(), sizeStock: sizeStock.optional(), expectedSizeStock: sizeStock.nullable().optional() }).parse(await readLimitedJson(request, 4096));
    const result = input.sizeStock ? await session.client.rpc("set_product_size_stock", { product_slug: input.slug, quantities: input.sizeStock, expected_quantities: input.expectedSizeStock ?? null, expected_quantity: input.expectedQuantity }) : await session.client.rpc("set_product_stock", { product_slug: input.slug, quantity: input.quantity, expected_quantity: input.expectedQuantity });
    if (result.error) return Response.json({ error: result.error.message.includes("Stock changed") ? "Stock changed during editing. Refresh before updating." : "Stock could not be saved. Check the stock/counter database migration." }, { status: 409 });
    return Response.json({ saved: true });
  } catch { return Response.json({ error: "Invalid inventory update." }, { status: 400 }); }
}
