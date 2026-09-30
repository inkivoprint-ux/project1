import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseKey } from "./config";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicSupabaseKey();
  if (!url || !key) throw new Error("Supabase is not configured. Add the public URL and anon key to .env.local.");
  return createBrowserClient(url, key);
}
