"use client";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { T_SHIRT_SIZES } from "@/lib/productSizes";
import { useDialog } from "@/lib/useDialog";
const measurements = { XS: [16, 27], S: [18, 28], M: [20, 29], L: [22, 30], XL: [24, 31], XXL: [26, 32] };

export function SizeChart() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useDialog(open, () => setOpen(false));
  return <><button className="size-chart-trigger" type="button" onClick={() => setOpen(true)}>Size chart & measuring guide</button>
    {open && <div ref={ref} className="size-chart-overlay"><button className="size-chart-backdrop" aria-label="Close size chart" onClick={() => setOpen(false)} />
      <section className="size-chart-dialog" role="dialog" aria-modal="true" aria-labelledby={id}><header><h2 id={id}>T-shirt size guide</h2><button data-dialog-focus type="button" aria-label="Close size chart" onClick={() => setOpen(false)}><X /></button></header>
        <p>Approximate adult unisex reference, in inches. Compare with a T-shirt that fits you well. Lay it flat without stretching.</p>
        <ol><li><strong>Chest width:</strong> Measure across the shirt from one underarm to the other. Double this for chest circumference.</li><li><strong>Length:</strong> Measure from the highest shoulder point beside the collar to the bottom hem.</li></ol>
        <table><thead><tr><th>Size</th><th>Chest width</th><th>Length</th></tr></thead><tbody>{T_SHIRT_SIZES.map((size) => <tr key={size}><th scope="row">{size}</th><td>{measurements[size][0]} in</td><td>{measurements[size][1]} in</td></tr>)}</tbody></table>
        <p>Reference based on Gildan Softstyle adult sizing. This is a general guide, not verified measurements of this product. Actual fit varies by brand; contact us if unsure.</p><a href="https://wa.me/919744488876?text=Please%20share%20the%20T-shirt%20size%20measurements" target="_blank" rel="noopener noreferrer">Ask for measurements on WhatsApp</a>
      </section></div>}
  </>;
}
