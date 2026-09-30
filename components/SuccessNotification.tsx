"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

export function SuccessNotification() {
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null);
  useEffect(() => {
    const notify = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message === "string") setNotification({ message, id: Date.now() });
    };
    window.addEventListener("inkivo:success", notify);
    return () => window.removeEventListener("inkivo:success", notify);
  }, []);
  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => setNotification(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notification]);
  return <div className="success-popup-region" role="status" aria-live="polite" aria-atomic="true">{notification && <div className="success-popup" key={notification.id}><CheckCircle2 size={25} aria-hidden="true" /><p>{notification.message}</p><button type="button" aria-label="Dismiss success message" onClick={() => setNotification(null)}><X size={19} /></button></div>}</div>;
}
