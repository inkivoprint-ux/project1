# Product details, quantity and Buy now — 30 September 2026

## Already present and preserved

- Product records already contained descriptions, prices, finishes, images and print dimensions. Descriptions were not exposed on a customer detail page.
- The cart/order schema already supported quantity and separate plain/personalised lines. The editor still added only one copy per action.
- Actual design-draft storage, generated files, filename validation, order submission, WhatsApp handoff and Admin Orders were retained.
- Existing admin merchandising, mobile navigation, Malayalam font, text effects, template settings and completed-order management were not recreated.
- This folder is not a Git repository; Git was not initialized.

## Changes and fixes

- Added `/products/[slug]` with the full saved description, finish/specification, price, print area and available product views. Product images and names now link there; existing Quick add and Personalise shortcuts remain available.
- Added quantity controls from 1–99, quantity-based totals and explicit with/without-personalisation options.
- Added Buy now through the existing customer/address form and `submitCartOrder` procedure. It passes one selected line only; it does not read, add to, replace or clear the shopping cart.
- Personalised purchases carry quantity and the selected front/back preview into the editor. Artwork is required when entering through the personalised purchase option.
- The editor now supports quantity, Add to cart and Buy now. Real draft files must be prepared successfully before checkout. Unchanged artwork reuses its prepared draft; edited artwork receives a new design reference. Photos from disabled image tools are not included as unused originals.
- Prepared filenames can be expanded in checkout and are read from the actual saved draft. The existing upload/order/WhatsApp/Admin filename pipeline is unchanged.
- WhatsApp messages explicitly distinguish with/without personalisation. Plain local orders no longer claim that artwork files were saved. Admin Orders distinguishes plain items from personalised items whose files were removed.
- Fixed checkout item rows shrinking underneath the customer form, which could obscure quantity controls and filename disclosures. The entire drawer can scroll without overlapping sections.
- Added product-specific title, description, canonical/social metadata and sitemap entries for the built-in catalogue.

## Files added

- `app/products/[slug]/page.tsx`
- `app/products/[slug]/loading.tsx`
- `components/ProductDetail.tsx`
- `components/BuyNowCheckout.tsx`
- `components/QuantitySelector.tsx`
- `lib/purchase.ts`
- `lib/purchase.test.ts`
- `docs/product-purchase-2026-09-30.md` (this report)

## Existing files modified

- `components/Storefront.tsx`
- `components/StoredProductPage.tsx`
- `components/Customizer.tsx`
- `components/CartDrawer.tsx`
- `components/AdminOrders.tsx`
- `lib/orders.ts`
- `lib/orderSubmission.test.ts`
- `app/sitemap.ts`
- `app/refinements.css`
- `README.md`

## Validation results

- Automated tests: **46 passed across 12 files**, including six new focused tests for quantity, plain/personalised selection, order totals, WhatsApp wording and multi-copy filename consistency. These are unit/validation tests, not a claim of live Supabase success.
- Type check: **passed** (`npm run typecheck`).
- Lint: **passed** (`npm run lint`).
- Production build: **passed** (`npm run build`); 22 pages generated, including the four built-in product detail pages.
- Browser checks on the development app: product click → detail page; actual description; plain quantity-based Add to cart; separate existing personalised/plain lines; Buy now containing only the selected item; required checkout fields; personalised artwork requirement; real text/Malayalam rendering and saved cropped/preview draft filenames; unchanged-artwork reuse and changed-artwork replacement; quantity limits; selected T-shirt back view and four-item quantity carried into the editor.
- Responsive checks: 320, 390 and 768 px viewport settings, no horizontal page overflow. Personalised mobile checkout shows filenames and quantity controls without overlapping the form.
- Production-runtime browser check: T-shirt detail/description, front/back image switching, quantity four, single-item plain checkout, canonical URL and description metadata. No browser console errors/warnings were recorded.
- The temporary plain cart line created for verification was removed, and the original three-copy personalised cart line was visibly restored. Existing orders were not changed or deleted. No new order was submitted and no WhatsApp message was sent.

## Remaining manual verification / existing limitations

- No Supabase credentials are configured in this workspace. Real cloud order insertion, authenticated Admin Orders, private uploads/downloads and deployed request limits still require a configured environment and a genuine customer checkout. No database migration was required or applied for these changes.
- Admin catalogue/template settings remain browser-local. Custom products and edited descriptions work in the same browser, but cross-device publishing and server-generated SEO metadata for those browser-only edits require the previously identified shared-catalogue integration.
- Final WhatsApp sending/order confirmation remains manual; this is not an online payment checkout.
- Generated artwork remains preview output, not a verified print-production master. T-shirt order files still capture the selected side only, not a combined front/back print file.
