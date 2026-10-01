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
