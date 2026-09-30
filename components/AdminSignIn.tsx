"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "./BrandLogo";

export function AdminSignIn({ message }: { message: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const client = createClient();
      const { data, error: failure } = await client.auth.signInWithPassword({ email, password });
      if (failure || !data.user) throw new Error("Sign-in failed. Check your email and password.");
      const { data: profile } = await client.from("profiles").select("role").eq("id", data.user.id).single();
      if (profile?.role !== "admin") { await client.auth.signOut(); throw new Error("This account does not have administrator access."); }
      setPassword(""); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-in is unavailable. Try again."); }
    finally { setBusy(false); }
  };
  return <main className="admin-signin"><form onSubmit={submit}><BrandLogo /><h1>Administrator sign-in</h1><p>{message}</p><label>Email<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button><Link href="/">Return to storefront</Link></form></main>;
}
