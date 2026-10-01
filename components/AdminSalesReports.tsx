"use client";
import { useState } from "react";
import { manageOrder, permanentlyDeleteOrder, type OrderRecord } from "@/lib/orders";
import { salesReportCsv } from "@/lib/salesReports";
import { formatPrice } from "@/lib/products";
import { showSuccess } from "@/lib/notifications";

const indiaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function AdminSalesReports() {
  const [from, setFrom] = useState(indiaToday);
  const [to, setTo] = useState(indiaToday);
  const [channel, setChannel] = useState("online");
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [downloaded, setDownloaded] = useState<OrderRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const clear = () => { setOrders(null); setDownloaded(null); setError(""); setMessage(""); };
  return <section className="admin-card sales-panel" id="reports"><h2>Sales reports</h2><p>Download online and offline counter reports separately. Online totals show submitted WhatsApp orders, not verified payments. Reports include orders in Trash.</p>
    <fieldset disabled={busy} className="report-fields">
      <label>Sales channel<select value={channel} onChange={(event) => { clear(); setChannel(event.target.value); }}><option value="online">Online / WhatsApp</option><option value="offline">Offline counter</option></select></label>
      <button type="button" onClick={() => { clear(); setFrom(indiaToday()); setTo(indiaToday()); }}>Today</button>
      <label>Monthly report<input type="month" onChange={(event) => { const value = event.target.value; if (!value) return; clear(); setFrom(`${value}-01`); const [year, month] = value.split("-").map(Number); setTo(`${value}-${new Date(year, month, 0).getDate()}`); }} /></label>
      <label>From<input type="date" required value={from} onChange={(event) => { clear(); setFrom(event.target.value); }} /></label>
      <label>To<input type="date" required value={to} onChange={(event) => { clear(); setTo(event.target.value); }} /></label>
      <button type="button" onClick={async () => {
        setBusy(true); setError(""); setDownloaded(null); setOrders(null); setMessage("Loading report… Please wait.");
        try { const response = await fetch(`/api/reports?from=${from}&to=${to}&channel=${channel}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setOrders(result.orders); setMessage(""); }
        catch (failure) { setError(failure instanceof Error ? failure.message : "Report could not be loaded."); setMessage(""); }
        finally { setBusy(false); }
      }}>View report</button>
    </fieldset>
    {orders && <><p><strong>{orders.length} orders · {orders.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0), 0)} units · {formatPrice(orders.reduce((sum, order) => sum + order.subtotal, 0))}</strong></p>
      <button disabled={busy} type="button" onClick={() => {
        const url = URL.createObjectURL(new Blob([salesReportCsv(orders)], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `inkivo-${channel}-${from}-to-${to}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); setDownloaded(orders); setMessage("Report download started. Keep your saved copy before deleting orders.");
      }}>Download report CSV</button>
      <div className="report-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Order value</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.orderNumber}</td><td>{order.customerName}</td><td>{formatPrice(order.subtotal)}</td></tr>)}</tbody></table></div>
    </>}
    {downloaded && downloaded.length > 0 && <button type="button" className="report-delete" disabled={busy} onClick={async () => {
      if (!window.confirm(`Have you saved the CSV report and any artwork ZIPs you need? Permanently delete these ${downloaded.length} ${channel} orders from ${from} to ${to}, including customer details and artwork? This cannot be undone. They will disappear from future reports. Stock will not be restored.`)) return;
      setBusy(true); setError(""); const remaining = [...downloaded];
      try {
        while (remaining.length) { let order = remaining[0]; setMessage(`Deleting downloaded orders… ${downloaded.length - remaining.length + 1} of ${downloaded.length}`); if (!order.completedAt) order = await manageOrder(order, "complete"); remaining[0] = order; if (!order.deletedAt) order = await manageOrder(order, "delete"); remaining[0] = order; await permanentlyDeleteOrder(order); remaining.shift(); setDownloaded([...remaining]); }
        setOrders(null); setDownloaded(null); setMessage("Downloaded orders and associated artwork deleted. Stock counts retained."); showSuccess("Selected orders deleted permanently.");
      } catch (failure) { setOrders(remaining); setDownloaded(remaining); setError(failure instanceof Error ? failure.message : "Deletion stopped. Retry the remaining orders."); }
      finally { setBusy(false); }
    }}>Delete downloaded orders permanently</button>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
