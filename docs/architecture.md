# Inkivo architecture and current boundaries

## Implemented

- Storefront: four built-in products, browser-local additions/overrides, category/search discovery, design-specific cart lines and contact links.
- Customer editor: image and text layers, Malayalam/font styles, opacity, movement/crop/rotation, selected-side previews and saved editable state.
- Renderers: canvas flat/cylinder/tapered-cylinder and fabric displacement, with baked perspective, masks and opacity. Blend is applied during preview/export composition.
- Templates: separate browser-local draft and published settings. Saving a draft does not alter the customer version; publishing emits same-device/cross-tab updates. Legacy workspace settings remain usable.
- Admin: local product editing, template editing, order viewing and confirmed file deletion. With public Supabase credentials configured, admin routes require a database-admin role.
- Cloud orders: server-side price/name validation, trusted built-in catalogue seeding, selected template snapshot capture, private uploads, authenticated latest-200-order listing and file retrieval/deletion.
- Files: original image bytes, edited PNG and product-preview PNG are separate. Names remain identical in request metadata, uploaded file, saved order, WhatsApp message and admin download attribute.

## Order flow

The client saves design blobs in IndexedDB, validates required files/details, then submits multipart form data. The server validates payloads and declared filenames before creating an order. It checks products against the shared database catalogue, captures the selected template, saves files/metadata, then marks the order submitted. Upload failure attempts storage/metadata cleanup and marks the order failed.

If Supabase storage is explicitly unconfigured, the labelled local workflow remains available; WhatsApp says files are only on the customer's device. Other API/network failures remain errors. Opening WhatsApp does not send a message, attach files or prove merchant confirmation.

Actual private storage layout:

`order-assets/orders/{order_id}/{order_item_id}/{original|edited|preview}/{exact_filename}`

## Not implemented or not verified for launch

- Shared database-backed product/template editing and storefront catalogue reads. Browser-local edits are not a multi-device production CMS.
- Production-resolution print masters, bleed/safe-area validation and combined front/back output. Current files are browser-generated previews.
- Client-stable idempotency/retry reconciliation, abuse/rate limits and durable processing workers. The server generates a new idempotency value per submission.
- Customer order history, stock/variant management, payments and full order-status management UI.
- Live Supabase integration, migrations, authentication/RLS and cross-device order files: credentials were unavailable for this audit.
- Deployed upload limits, backup/retention/privacy policies and measured performance/accessibility scores.

These are delivery boundaries, not claims of completed functionality. See [the audit report](audit-2026-09-30.md) for verification evidence.
