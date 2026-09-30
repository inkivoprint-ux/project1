import { createClient as createServiceClient } from "@supabase/supabase-js";
import { purgeOrderFiles } from "@/lib/purgeOrder";
import { z } from "zod";
import { getAdminSession } from "@/lib/supabase/admin";
import { hasSupabaseConfiguration, serverSupabaseKey } from "@/lib/supabase/config";
import { assertSameOrigin, readLimitedJson } from "@/lib/httpSafety";

export const runtime = "nodejs";
const inputSchema = z.object({ orderId: z.string().uuid(), action: z.enum(["complete", "delete", "restore", "reopen", "purge"]) });

async function updateOrder(request: Request) {
  if (!hasSupabaseConfiguration()) return Response.json({ error: "Supabase order storage is not configured." }, { status: 503 });
  try {
    assertSameOrigin(request);
    const session = await getAdminSession();
    if (session.error) return Response.json({ error: session.error }, { status: session.status });
    const input = inputSchema.safeParse(await readLimitedJson(request, 4096).catch(() => null));
    if (!input.success || (request.method === "DELETE") !== (["delete", "purge"].includes(input.data.action))) return Response.json({ error: "Invalid order action." }, { status: 400 });
    const { orderId, action } = input.data;
    const found = await session.client.from("orders").select("id, state, completed_at, deleted_at").eq("id", orderId).maybeSingle();
    if (found.error) throw found.error;
    if (!found.data) return action === "purge" ? Response.json({ permanentlyDeleted: true }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Order not found." }, { status: 404 });
    const order = found.data;
    if (action === "purge") {
      if (!order.deleted_at || !["completed", "processing"].includes(order.state)) return Response.json({ error: "Only completed orders in Trash can be permanently deleted." }, { status: 409 });
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = serverSupabaseKey();
      if (!url || !key) return Response.json({ error: "Private file deletion is not configured." }, { status: 503 });
      const service = createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      // Reuse the existing processing state while in Trash. The atomic claim
      // prevents concurrent restoration and remains retryable after storage failures.
      const claim = await session.client.from("orders").update({ state: "processing", updated_at: new Date().toISOString() }).eq("id", orderId).eq("state", order.state).eq("deleted_at", order.deleted_at).select("id").maybeSingle();
      if (claim.error) throw claim.error;
      if (!claim.data) return Response.json({ error: "The order changed. Refresh before deleting." }, { status: 409 });
      try {
        await purgeOrderFiles(service, orderId);
        // Existing foreign-key cascades remove items, customizations, file
        // metadata and status history together with the parent order.
        const removed = await session.client.from("orders").delete().eq("id", orderId).eq("state", "processing").eq("deleted_at", order.deleted_at);
        if (removed.error) throw removed.error;
        return Response.json({ permanentlyDeleted: true }, { headers: { "Cache-Control": "private, no-store" } });
      } catch {
        return Response.json({ error: "Permanent deletion could not finish. The order remains in Trash; retry Delete permanently to finish removing its files and records." }, { status: 500 });
      }
    }
    if (order.deleted_at && order.state === "processing") return Response.json({ error: "Permanent deletion has started. Retry Delete permanently; this order can no longer be restored." }, { status: 409 });
    if ((action === "restore" && !order.deleted_at) || (action !== "restore" && order.deleted_at)) return Response.json({ error: "The order has changed. Refresh orders before trying again." }, { status: 409 });
    if (action === "delete" && order.state !== "completed") return Response.json({ error: "Mark the order completed before deleting it." }, { status: 409 });
    if (action === "reopen" && order.state !== "completed") return Response.json({ error: "Only completed orders can be reopened." }, { status: 409 });
    if (action === "complete" && ["draft", "uploading", "processing", "failed", "cancelled"].includes(order.state)) return Response.json({ error: "This order cannot be marked completed in its current state." }, { status: 409 });
    const now = new Date().toISOString();
    const values = action === "complete" ? { state: "completed", completed_at: order.completed_at ?? now, updated_at: now } : action === "reopen" ? { state: "submitted", completed_at: null, updated_at: now } : { deleted_at: action === "delete" ? now : null, updated_at: now };
    let query = session.client.from("orders").update(values).eq("id", orderId).eq("state", order.state);
    query = order.deleted_at ? query.eq("deleted_at", order.deleted_at) : query.is("deleted_at", null);
    const result = await query.select("completed_at, deleted_at").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return Response.json({ error: "The order changed during this update. Refresh orders." }, { status: 409 });
    return Response.json({ completedAt: result.data.completed_at ?? undefined, deletedAt: result.data.deleted_at }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "The order could not be updated. Check the administrator session and apply the order-management migration." }, { status: 500 }); }
}

export const PATCH = updateOrder;
export const DELETE = updateOrder;
