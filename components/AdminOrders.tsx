"use client";

import Image from "next/image";
import { CheckCircle2, CircleAlert, Download, FileImage, LoaderCircle, PackageCheck, RotateCcw, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/products";
import { deleteOrderAsset, loadAdminOrders, loadDesignDraft, loadOrders, manageOrder, subscribeToOrders, type OrderAsset, type OrderRecord } from "@/lib/orders";
import type { OrderManagementAction } from "@/lib/orderManagement";
import { useDialog } from "@/lib/useDialog";

export function AdminOrders({ onCount }: { onCount?: (count: number) => void }) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const refresh = () => setReload((current) => current + 1);
  useEffect(() => {
    let cancelled = false;
    loadAdminOrders(true).then((next) => { if (!cancelled) { setOrders(next); onCount?.(next.filter((order) => !order.deletedAt).length); setError(""); setLoading(false); } }).catch((failure) => { if (!cancelled) { setError(failure instanceof Error ? failure.message : "Orders could not be loaded."); setLoading(false); } });
    const unsubscribe = subscribeToOrders(() => setReload((current) => current + 1));
    return () => { cancelled = true; unsubscribe(); };
  }, [reload, onCount]);

  if (loading) return <section className="admin-card admin-empty" id="orders" role="status"><LoaderCircle className="spin" /><p>Loading orders…</p></section>;
  if (error) return <section className="admin-card admin-empty" id="orders"><CircleAlert /><h2>Orders unavailable</h2><p role="alert">{error}</p><button type="button" onClick={refresh}>Try again</button></section>;

  if (!orders.length) return <section className="admin-card admin-empty" id="orders"><ShoppingBag /><h2>No orders yet</h2><p>Orders saved during checkout will appear here with their artwork files.</p><button type="button" onClick={refresh}>Refresh orders</button></section>;

  const visibleOrders = orders.filter((order) => Boolean(order.deletedAt) === showTrash);
  return <section className="admin-orders" id="orders">
    <header><div><span className="admin-kicker">ORDER WORKSPACE</span><h2>{showTrash ? "Order Trash" : "Recent WhatsApp orders"}</h2><p>{showTrash ? "Deleted orders and files are retained. Restore an order to return it to the workspace." : "Mark finished work completed, then delete it to Trash. Cloud mode shows the latest 200 records."}</p></div><button type="button" onClick={refresh}>Refresh orders</button></header>
    <div className="order-view-tabs" role="group" aria-label="Order list"><button type="button" aria-pressed={!showTrash} onClick={() => setShowTrash(false)}>Orders ({orders.filter((order) => !order.deletedAt).length})</button><button type="button" aria-pressed={showTrash} onClick={() => setShowTrash(true)}><Trash2 size={15} /> Trash ({orders.filter((order) => order.deletedAt).length})</button></div>
    {!visibleOrders.length && <div className="admin-card admin-empty"><ShoppingBag /><h2>{showTrash ? "Trash is empty" : "No active orders"}</h2><p>{showTrash ? "Deleted completed orders will appear here." : "Saved checkout orders will appear here. Deleted orders can be restored from Trash."}</p></div>}
    {visibleOrders.map((order) => <article className="admin-order-card" key={order.id}>
      <div className="admin-order-head"><div><span>{order.orderNumber}</span><strong>{order.customerName}</strong><small>{order.phone} · {order.address}</small></div><div><span className={`order-storage ${order.storageMode}`}><PackageCheck /> {order.storageMode === "supabase" ? "Saved to Supabase" : "Local workspace"}</span><small>{new Date(order.createdAt).toLocaleString("en-IN")}</small></div></div>
      <OrderManagementControls order={order} onChanged={refresh} />
      {order.items.map((item, index) => <div className="admin-order-item" key={`${item.productId}-${index}`}>
        <div className="admin-order-product"><strong>{item.quantity} × {item.productName}{item.size ? ` · Size ${item.size}` : ""}</strong><span>{formatPrice(item.unitPrice * item.quantity)}</span></div>
        <div className="order-assets">
          {item.assets.length ? item.assets.map((asset) => <OrderAssetTile key={`${asset.kind}-${asset.fileName}`} order={order} itemIndex={index} asset={asset} onDeleted={refresh} />) : <div className="order-no-assets"><FileImage /><span>{item.designId ? "No files available for this item" : "Without personalisation · No artwork required"}</span></div>}
        </div>
      </div>)}
      <footer><span>Order total</span><strong>{formatPrice(order.subtotal)}</strong></footer>
    </article>)}
  </section>;
}

function OrderManagementControls({ order, onChanged }: { order: OrderRecord; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<"complete" | "delete" | null>(null);
  const confirmRef = useDialog(Boolean(pendingAction), () => setPendingAction(null));
  const change = async (action: OrderManagementAction) => {
    if (busy) return;
    setPendingAction(null);
    setBusy(true); setError("");
    try { await manageOrder(order, action); onChanged(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The order could not be updated."); }
    finally { setBusy(false); }
  };
  return <div className="order-management">
    <span className={`order-work-status ${order.completedAt ? "completed" : ""}`}>{order.completedAt ? <CheckCircle2 size={16} /> : <PackageCheck size={16} />}{order.deletedAt ? "In Trash · files retained" : order.completedAt ? "Work completed" : "Work in progress"}</span>
    <div>{order.deletedAt ? <button type="button" disabled={busy} onClick={() => change("restore")}><RotateCcw size={16} /> Restore order</button> : order.completedAt ? <><button type="button" disabled={busy} onClick={() => change("reopen")}><RotateCcw size={16} /> Reopen order</button><button type="button" className="order-delete-button" disabled={busy} onClick={() => setPendingAction("delete")}><Trash2 size={16} /> Delete order</button></> : <button type="button" disabled={busy} onClick={() => setPendingAction("complete")}><CheckCircle2 size={16} /> Mark completed</button>}{busy && <span role="status">Saving…</span>}</div>
    {error && <p role="alert">{error}</p>}
    {pendingAction && <div ref={confirmRef} className="product-modal" role="dialog" aria-modal="true" aria-labelledby={`order-confirm-${order.id}`}>
      <button className="product-modal-scrim" tabIndex={-1} type="button" aria-label="Cancel order action" onClick={() => setPendingAction(null)} />
      <div className="order-confirm-panel"><span className="admin-kicker">{order.orderNumber}</span><h2 id={`order-confirm-${order.id}`}>{pendingAction === "complete" ? "Finished the work?" : "Move this order to Trash?"}</h2><p>{pendingAction === "complete" ? "Mark the order completed only after finishing the work. You can reopen it if needed." : "The completed order will leave your active list. Its records and files will be retained, and you can restore it from Trash."}</p><div><button data-dialog-focus type="button" onClick={() => setPendingAction(null)}>Cancel</button><button type="button" className="admin-primary" onClick={() => change(pendingAction)}>{pendingAction === "complete" ? "Confirm completed" : "Move to Trash"}</button></div></div>
    </div>}
  </div>;
}

function OrderAssetTile({ order, itemIndex, asset, onDeleted }: { order: OrderRecord; itemIndex: number; asset: OrderAsset; onDeleted: () => void }) {
  const [url, setUrl] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    loadDesignDraft(asset.designId).then((draft) => {
      if (cancelled) return;
      const blob = draft?.assets.find((item) => item.kind === asset.kind && item.fileName === asset.fileName)?.blob;
      if (blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      else if (asset.storagePath) setUrl(`/api/orders/assets?path=${encodeURIComponent(asset.storagePath)}`);
      else setError("This file is no longer available on this device.");
    }).catch(() => { if (!cancelled) { if (asset.storagePath) setUrl(`/api/orders/assets?path=${encodeURIComponent(asset.storagePath)}`); else setError("The local file could not be loaded."); } });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset.designId, asset.kind, asset.fileName, asset.storagePath]);
  const remove = async () => {
    if (!window.confirm(`Permanently delete ${asset.fileName}? This cannot be undone.`)) return;
    setDeleting(true);
    setError("");
    try {
      const localOrder = loadOrders().find((item) => item.id === order.id);
      if (!localOrder && order.storageMode === "supabase") {
        const response = await fetch("/api/orders/assets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, storagePath: asset.storagePath }) });
        if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "The file could not be deleted."); }
      } else await deleteOrderAsset({ orderId: order.id, itemIndex, asset });
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The file could not be deleted.");
      setDeleting(false);
    }
  };
  return <div className="order-asset-tile">
    <div>{url ? <Image src={url} alt={`${asset.kind} order file`} width={70} height={70} unoptimized onError={() => setError("This order file could not be opened. Refresh orders or check the administrator session.")} /> : <FileImage />}</div>
    <span>{asset.kind === "edited" ? "Cropped image" : asset.kind === "original" ? "Original upload" : "Product preview"}</span>
    <small title={asset.fileName}>{asset.fileName}</small>
    <div className="order-asset-actions">{url && <a href={url} download={asset.fileName}><Download /> Download</a>}<button type="button" onClick={remove} disabled={deleting || Boolean(order.deletedAt)} title={order.deletedAt ? "Restore the order before deleting an individual file" : undefined}>{deleting ? <LoaderCircle className="spin" /> : <Trash2 />} Delete file</button></div>
    {error && <p className="order-asset-error" title={error} role="alert"><CircleAlert /> {error}</p>}
  </div>;
}
