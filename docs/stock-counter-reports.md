# Stock, offline counter, and sales reports

The stock/counter migration is `supabase/migrations/202610010001_stock_counter.sql`. It was installed in the existing production Supabase project on 1 October 2026 through its SQL editor. Existing orders were not modified, and no stock counts were invented.

## Stock

Open Admin > Stock. Enter each product's available quantity and save. Zero means no stock; blank means untracked. Stock covers the entire product across all sizes. The save uses the previously displayed quantity as an optimistic check, so an order submitted during stock editing cannot be silently overwritten. Other catalogue edits preserve the latest stock.

Successful new online submissions and offline counter sales deduct stock transactionally. Duplicate lines are summed before deduction; concurrent sales are serialized in the database. Failed submissions do not consume stock. Retries do not deduct twice. Completion, reopening, Trash, and permanent deletion do not restore sold units. Existing orders are not deducted retroactively. Set starting quantities to your actual remaining physical stock.

## Offline counter

Admin > Counter, at `/admin/counter`, is protected by the existing admin layout and authenticated API. Add products, sizes where applicable, quantities, and optional contact/address information. Submit records the counter order and deducts inventory without WhatsApp or a payment gateway. Product prices and stock are validated in the database. Offline receipt numbers begin POS-. The page is an order-entry counter; it does not process payments or upload artwork.

## Reports

Admin > Reports. Choose Online / WhatsApp or Offline counter, Today, a month, or From/To dates. The last date is inclusive using India time. Reports paginate beyond the ordinary latest-200 order list. CSV files open in Excel; UTF-8 BOM preserves Malayalam. Customer-supplied spreadsheet formulas are escaped. Details include customers, contact information, products, sizes, quantities, unit prices, line totals, and status. Report summary gives order count, units, and order value. Online figures are submitted order values, not verified collections or paid Razorpay transactions.

Orders in Trash are included. Draft, uploading, failed, and untrashed processing orders are excluded. Online and offline totals are separate.

After a CSV download starts, the permanent-delete control becomes available for exactly that fetched set of order IDs. It does not delete new orders subsequently added to the same date range. The confirmation asks the administrator to save the report and any required artwork ZIPs first. Deletion removes the order and private artwork files, using the existing retryable storage-first purge. Successful removals disappear from future reports. Stock is not restored. If deletion stops, remaining orders can be retried. CSV downloading does not automatically download artwork; use each order's ZIP button if those files need archiving.

## Payments

Online checkout remains WhatsApp. Razorpay is awaiting the owner's approval notification and live integration credentials. No payment gateway has been enabled by this change. Switching to Razorpay must later include server-verified orders/signatures, webhook verification and idempotency, payment failure recovery, and a decision on when inventory is reserved/committed. Do not merely replace the WhatsApp button with an unverified payment redirect.

## Verification

Automated PostgreSQL tests cover stock deduction, no double deduction, rejected overselling, stale stock updates, stock preservation on catalogue edits, deletion without restoring stock, and admin-only functions. CSV tests cover India date boundaries, invalid dates, UTF-8, and formula escaping. Do not create production test sales without accounting for their inventory and reporting effects.

## Customer delivery and payment support
Product details and checkout show free shipping/courier and expected delivery in 3–4 working days after confirmation. Customers can contact +91 9744488876 on WhatsApp or inkivoprint@gmail.com / graphyflex@gmail.com with their order number, name and address, including deliveries missing after 5 days.
Checkout shows the saved server order number before the WhatsApp handoff and asks customers to screenshot or retain it. Local development orders are labelled prepared only. No paid-order claim is made.
PaymentSupport includes cancelled and processing messages for future Razorpay integration. These are not connected to a payment callback yet: Razorpay remains inactive until approval is explicitly confirmed. A future successful-payment receipt must use the server order_number only after verified payment, never a browser-only success callback.


## T-shirt size stock (1 October 2026)
XS, S, M, L, XL and XXL are supported. Admin Stock has a separate count for every size. Existing aggregate counts remain unchanged until saved; no real stock is guessed. Saving all six counts enables per-size tracking and calculates the aggregate automatically. Online and offline submissions atomically deduct their exact sizes; duplicate retries do not deduct twice. Sold-out sizes are disabled. The size-chart popup uses approximate adult unisex reference measurements in inches, based on Gildan Softstyle sizing documented at https://www.ooshirts.com/guides/Gildan-T-Shirt-Size-Chart-and-Fit-Guide.html . It explicitly says these are not verified measurements of the stocked products.
Stock counts on product details and size selectors use red below 4, yellow 4–7, green 8 and above.


## Both-side personalisation, offline artwork and EPS text
T-shirt front and back keep independent photo layers, text, colour, positioning and surface controls in the same editor session. Switching sides captures the previous side and restores its controls on returning. Both saved sides are joined in one draft and one priced order item; front/back filenames identify artwork. If a product has no back photograph, a labelled reference back preview is used; configure an actual back mockup for accurate product-specific placement. Current side Reset clears that side only. Leaving the editor before saving discards its unsaved session.
Offline Counter offers Personalise product, using the customer editor with Save counter design in place of online checkout. Existing selected quantity and size carry into the editor; multiple selected sizes return as counter lines sharing one design. Replacing personalisation starts a fresh editor; the previous design remains attached unless a replacement is saved. Staff can remove personalisation. Personalised counter submissions use the existing multipart order storage pipeline with an admin-only offline channel; stock is deducted transactionally and idempotency is retained. Customer phone is optional for authenticated offline orders. Simple unpersonalised counter sales retain their existing RPC path. Admin has separate Online orders and Offline counter orders sections and channel-scoped queries (latest 200 each).
For each side with text, an outlined .eps asset is saved with the originals and included in full order ZIP downloads. Its print area uses the template physical dimensions. EPS traces rendered text alpha contours, retaining browser font shaping (including Malayalam) and surface geometry. It contains solid-colour vector contours and no embedded bitmap/image instructions. Outlines derive from the rendered canvas resolution, so they are not native editable font glyphs and do not retain soft transparency or shading. Original typed text and editable settings remain in order configuration. Photographs and composite/product previews remain raster references. EPS files are clearly labelled Text artwork · EPS vector in Admin and are downloadable without attempting image thumbnails. EPS is Illustrator-compatible; files are not falsely renamed to .ai. Server validation accepts only the restricted vector-only PostScript instruction set emitted by this exporter.
