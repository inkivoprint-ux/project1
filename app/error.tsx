"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state"><h1>Temporarily unavailable</h1><p>We could not load this page. Your saved cart has not been changed.</p><button className="button" onClick={reset}>Try again</button><Link href="/">Return to storefront</Link></main>;
}
