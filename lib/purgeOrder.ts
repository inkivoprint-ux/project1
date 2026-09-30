import type { SupabaseClient } from "@supabase/supabase-js";

// List the entire private order folder, including files left by interrupted uploads.
export async function purgeOrderFiles(client: SupabaseClient, orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new Error("Invalid order ID.");
  const storage = client.storage.from("order-assets");
  const files: string[] = [];
  async function collect(folder: string) {
    for (let offset = 0; ; offset += 100) {
      const result = await storage.list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (result.error) throw result.error;
      for (const item of result.data ?? []) {
        if (!item.name || item.name === "." || item.name === ".." || /[\\/]/.test(item.name)) throw new Error("Invalid order file path.");
        const path = `${folder}/${item.name}`;
        if (item.id) files.push(path);
        else await collect(path);
      }
      if ((result.data?.length ?? 0) < 100) break;
    }
  }
  await collect(`orders/${orderId}`);
  for (let offset = 0; offset < files.length; offset += 100) {
    const result = await storage.remove(files.slice(offset, offset + 100));
    if (result.error) throw result.error;
  }
}
