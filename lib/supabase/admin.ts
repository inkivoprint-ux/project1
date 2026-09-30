import { createClient } from "./server";

export async function getAdminSession() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { client, status: 401, error: "Sign in as an administrator to access orders and customer files." };
  const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin") return { client, status: 403, error: "This account does not have administrator access." };
  return { client, status: 200, error: null };
}
