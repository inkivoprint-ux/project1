import type { Metadata } from "next";
import { OfflineCounter } from "@/components/OfflineCounter";
export const metadata: Metadata = { title: "Offline counter", robots: { index: false, follow: false } };
export default function CounterPage() { return <OfflineCounter />; }
