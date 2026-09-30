"use client";

import { ChevronLeft, CircleGauge, Layers3, PackageOpen, Settings, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "./BrandLogo";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";

const items = [
  { label: "Dashboard", href: "/admin", icon: CircleGauge },
  { label: "Products", href: "/admin#products", icon: PackageOpen },
  { label: "Templates", href: "/admin#templates", icon: Layers3 },
  { label: "Orders", href: "/admin#orders", icon: ShoppingBag },
  { label: "Settings", href: "/admin#settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const signOut = async () => { try { const result = await createClient().auth.signOut(); if (result.error) throw result.error; router.refresh(); } catch { setError("Sign-out failed. Try again."); } };
  return (
    <aside className="admin-nav">
      <div className="admin-nav-brand"><BrandLogo light /><span>ADMIN</span></div>
      <nav aria-label="Admin navigation">
        {items.map(({ label, href, icon: Icon }) => <Link key={label} href={href} aria-label={label} className={pathname === href || (label === "Templates" && pathname.includes("/templates/")) ? "active" : ""}><Icon size={17} /><span>{label}</span></Link>)}
      </nav>
      {hasSupabaseConfiguration() && <button className="admin-signout" onClick={signOut}>Sign out</button>}
      {error && <p role="alert">{error}</p>}
      <div className="admin-nav-bottom"><span>{hasSupabaseConfiguration() ? "Secure administrator" : "Development workspace"}</span><Link href="/"><ChevronLeft size={15} /> Storefront</Link></div>
    </aside>
  );
}
