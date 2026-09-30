"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { normalizePurchaseQuantity } from "@/lib/purchase";

export function QuantitySelector({ quantity, onChange, disabled = false }: { quantity: number; onChange: (quantity: number) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="purchase-quantity">
    <label htmlFor={id}>Quantity <small>1–99 items</small></label>
    <div>
      <button type="button" disabled={disabled || quantity <= 1} aria-label="Decrease quantity" onClick={() => onChange(quantity - 1)}><Minus size={16} /></button>
      <input id={id} type="number" inputMode="numeric" min={1} max={99} step={1} value={quantity} disabled={disabled} onChange={(event) => onChange(normalizePurchaseQuantity(event.target.value))} />
      <button type="button" disabled={disabled || quantity >= 99} aria-label="Increase quantity" onClick={() => onChange(quantity + 1)}><Plus size={16} /></button>
    </div>
  </div>;
}
