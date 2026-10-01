"use client";

import { SizeChart } from "./SizeChart";
import { stockLevel } from "@/lib/productAvailability";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
import { emptySizeQuantities, normalizeSizeQuantity, totalSizeQuantity, T_SHIRT_SIZES, type SizeQuantities } from "@/lib/productSizes";

export function SizeQuantitySelector({ quantities = emptySizeQuantities(), onChange, disabled = false, stock }: { quantities: SizeQuantities; onChange: (quantities: SizeQuantities) => void; disabled?: boolean; stock?: SizeQuantities | null }) {
  const id = useId();
  return <fieldset className="size-quantity-selector" disabled={disabled}>
    <legend>T-shirt sizes & quantities</legend><SizeChart /><p>Choose one or more sizes. Leave unwanted sizes at 0.</p>
    <div className="size-quantity-grid">{T_SHIRT_SIZES.map((size) => <div key={size} className={`size-quantity-card ${quantities[size] ? "selected" : ""}`}><label htmlFor={`${id}-${size}`}>Size {size}</label><div>
      <button type="button" aria-label={`Decrease size ${size} quantity`} disabled={quantities[size] === 0} onClick={() => onChange({ ...quantities, [size]: quantities[size]-1 })}><Minus size={14} /></button>
      <input id={`${id}-${size}`} type="number" aria-label={`Size ${size} quantity`} min={0} max={Math.min(99, stock?.[size] ?? 99)} disabled={stock?.[size] === 0} step={1} inputMode="numeric" value={quantities[size]} onChange={(event) => onChange({ ...quantities, [size]: Math.min(stock?.[size] ?? 99, normalizeSizeQuantity(event.target.value)) })} />
      <button type="button" aria-label={`Increase size ${size} quantity`} disabled={quantities[size] >= Math.min(99, stock?.[size] ?? 99)} onClick={() => onChange({ ...quantities, [size]: quantities[size]+1 })}><Plus size={14} /></button>
    </div>{stock && <small className={`stock-${stockLevel(stock[size])}`}>{stock[size] === 0 ? "Out of stock" : `${stock[size]} in stock`}</small>}</div>)}</div>
    <div className="size-quantity-total"><span>Total T-shirts</span><strong>{totalSizeQuantity(quantities)}</strong></div>
  </fieldset>;
}
