import { AdminSignIn } from "@/components/AdminSignIn";
import { getAdminSession } from "@/lib/supabase/admin";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfiguration()) {
    if (process.env.NODE_ENV === "development") return children;
    return <main className="route-state"><h1>Administrator sign-in unavailable</h1><p>The secure administrator connection has not been configured.</p><Link href="/">Return to storefront</Link></main>;
  }
  let error: string | null;
  try { error = (await getAdminSession()).error; }
  catch { error = "Administrator verification is currently unavailable. Check the Supabase connection."; }
  return error ? <AdminSignIn message={error} /> : children;
}
