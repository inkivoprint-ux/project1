# Inkivo.in

A responsive, premium custom-product storefront and the foundation for Inkivo's versioned product-personalisation platform.

**Current launch status:** the real Supabase database and first administrator were configured on 30 September 2026. The application is uploaded to GitHub and loads on Vercel after owner-entered API keys. The public cloud catalogue connection and signed-out order protection were verified; one owner-added product and its published template are present. Full authenticated checkout/file verification and completion of the catalogue remain outstanding. See [deployment instructions and current status](docs/deployment-2026-09-30.md). Earlier audit documents describe historical checkpoints.

## Included

- Brand-led storefront using the supplied logo and product references.
- Responsive product discovery, category filters, quick add and mobile navigation.
- Working customer customiser with image upload, crop-by-positioning, zoom, rotation, text styles, colour and template-aware rendering.
- Admin dashboard at `/admin` with a visual, draggable product-template editor.
- Separate draft/published templates with test-artwork replacement, physical print settings and per-product customer-tool controls; shared through Supabase when configured.
- Canvas-based cylindrical artwork warping with curvature, taper, perspective, mask, opacity and blend controls.
- One image-relative template coordinate plane shared by desktop/mobile admin and customer previews; no separate mobile template is required. Canvas image loads request anonymous CORS access before loading remote product artwork.
- Data-driven product/print-area definitions.
- Supabase browser/server clients and a normalized initial migration with RLS.
- Private order-file storage model and immutable asset lineage.
- Working cart-to-WhatsApp order handoff with exact original, cropped, and preview filenames.
- Admin order workspace showing local records or the latest 200 authenticated cloud orders, with customer details, products, totals and exact filenames.
- Supabase-admin sign-in protection and server-side role checks. Unconfigured local admin editing is available only during development; production fails closed.
- Malayalam (Anek), bold/italic, opacity, normal/wrinkled/cylindrical text controls.
- Confirmed per-file deletion from Admin Orders; Supabase deletion removes both the private object and its database record after admin verification.
- SEO metadata and production-oriented architecture notes.

Configured products and templates persist in the shared Supabase catalogue, with only published templates available to customers. Browser-local editing is retained for development. A signed-in admin must explicitly publish the approved existing device catalogue; nothing is imported automatically. Orders use local fallback only during unconfigured development. Production/configured-service failures never pretend to be successful local orders. The server validates catalogue prices, limits upload requests, guards retries with stable identifiers and saves order details, the selected template snapshot and private files before WhatsApp opens.

Generated cropped artwork and mockups are preview-resolution files, not validated production print masters. Two-sided products currently save the selected side only. See [the audit report](docs/audit-2026-09-30.md) for verified results and launch blockers.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add Supabase credentials when available.
4. Run `npm run dev` and open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. For a new empty project, apply all five files in `supabase/migrations` in filename order. The existing Inkivo project already has these migrations applied; **do not rerun the initial schema**. Manual SQL-editor setup was not registered through a CLI migration-history workflow; reconcile history before using CLI push.
3. Put the project URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in ignored `.env.local` (legacy anon-key fallback is supported).
4. Add `SUPABASE_SECRET_KEY` for server-side order/private-file storage (legacy service-role fallback is supported). Never prefix the secret with `NEXT_PUBLIC_` or commit it.
5. The existing project already has the owner-created Auth user `inkivoprint@gmail.com`, with verified admin role. Password entry and submission were performed privately by the owner. Do not hardcode a password or automatically promote future users.

## Product customisation model

The schema supports versioned templates, physical print areas, renderer settings, allowed tools and mask/highlight/shadow layers. The current order implementation captures the selected template and editable state, preserving separate original (when uploaded), edited and preview files with identical filenames throughout the saved order, WhatsApp message and Admin Orders. A server-side print-ready renderer is not implemented.

See [docs/architecture.md](docs/architecture.md) for the staged delivery plan and technical boundaries.

## Using the visual template editor

1. Open `/admin`.
2. Choose **Edit template** beside a product.
3. Drag the print region over the product and resize it from the lower-right handle.
4. Configure physical dimensions, curvature, taper, perspective, mask and blend settings.
5. Upload test artwork and confirm the replacement behavior.
6. Select the customer editing tools allowed for that product.
7. Save a draft or publish a new version. Configured customer sessions read the shared published placement; development-only local sessions use this device's storage.

## Merchandising and completed orders

- In **Admin → Edit product**, select **No badge**, **Bestseller** or **New**, and a numbered **Display position**. Moving a product shifts the others automatically. Positions support the full catalogue; existing images, prices and templates are retained. Configured edits are saved in the shared catalogue.
- In **Admin → Orders**, choose **Mark completed** after finishing work. Completed orders offer **Delete order**, which moves the record to recoverable **Trash** and keeps its artwork files. Use **Restore order** to bring it back, or **Reopen order** if work is not actually finished. There is no automatic permanent order/file purge.
- Cloud completion/Trash/Restore requires the order-management migration and an authenticated admin. The migration is applied to the live Inkivo project; deployed order management still needs runtime verification.
- Customer-facing navigation and footers have no Admin link on desktop or mobile. Administrators use `/admin` directly; admin navigation within the administration area is retained.

## Product details and direct purchases

- Product images and names open `/products/[slug]`, which displays the complete saved description, finish, print-area dimensions, product views, price and quantity (1–99). Existing direct **Personalise this** and **Quick add** shortcuts are retained.
- Choose **Without personalisation** to add the selected quantity to the cart or buy it directly. Choose **With personalisation** to carry that quantity into the editor; add artwork before completing a personalised purchase.
- The editor supports quantity, **Add to cart** and **Buy now**. Generated cropped/preview files (and the original photo when supplied) are saved before checkout and retain their exact filenames. Editing the design prepares a new draft; unchanged artwork can be reused.
- **Buy now** uses the same customer/address form, order submission and WhatsApp handoff as the cart, but passes only the chosen item and quantity. It neither adds to nor clears the existing cart. Final shipping/order confirmation still happens on WhatsApp, not through an online payment gateway.
- Configured catalogue edits and custom-product metadata are read from Supabase by product pages and the sitemap. Unconfigured development retains browser-local edits. Quantity and Buy now use existing order fields.

## T-shirt sizes and built-in template shapes

- Products in T-shirt categories show **S, M, L and XL** with a separate quantity for each size (0–99; zero excludes that size). Select at least one size before adding to the cart or buying. No size is chosen automatically, and T-shirt Quick add is replaced with **Choose sizes**.
- Size selections carry into personalisation. All selected sizes can share the same prepared design and exact filenames, while the cart and order keep their individual quantities. Buy now still includes only the selected product, not unrelated cart items.
- Cart size/quantity changes affect only that size/design. Older size-less T-shirt cart entries remain visible and require a size before checkout; historical orders are left unchanged.
- Sizes are saved on local order items and in Supabase's existing `order_items.variant_snapshot` field, then shown in WhatsApp and Admin Orders for plain and personalised purchases. No new SQL migration is required. Shared catalogue products must be assigned the appropriate T-shirt category; live cloud validation still requires configured Supabase credentials.
- In **Admin → Edit template → Placement → Shape**, choose Rectangle, Ellipse, Tapered, Triangle, Diamond, Heart, Star, Hexagon, Octagon, Shield, Ticket, Speech bubble or Arrow; **Draw custom** is still available. The same preset geometry clips the editor, customer preview and generated artwork. Choose **Save draft** or **Publish template** when ready; existing published templates are not changed merely by adding these choices.
- Sizes are purchase selections, not live inventory tracking or a measurement-based size chart. Confirm fit and availability with the Inkivo team.

## Validation commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deployment

Before deploying, complete the launch blockers in the audit report. Deploy to Vercel, add the variables from `.env.example` at build time, set `NEXT_PUBLIC_SITE_URL` to the production origin, and configure matching Supabase Auth redirect URLs. Customer-file buckets must remain private. Admin previews/downloads currently use authenticated, non-cacheable API responses; files are not published through public URLs. Verify deployed upload/request limits against the desired image sizes.
