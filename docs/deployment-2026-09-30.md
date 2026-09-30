# Inkivo deployment guide and current status

Updated 30 September 2026. Database setup is complete; the application is not yet verified live or certified production-ready.

## Confirmed setup

- Supabase project: `https://xcgcbalvhrpuuqbadsrh.supabase.co`.
- Before setup, there were no public application tables, enum types, storage buckets or storage policies. No existing business records were replaced.
- All five local migrations were applied together through the SQL editor in one transaction, followed by the explicitly approved admin promotion.
- The owner created `inkivoprint@gmail.com` in Supabase Auth and entered/submitted the password privately. Its matching profile has role `admin`, confirmed by database read-back. No password is stored in source code.
- All 15 application tables have row-level security enabled. Anonymous catalogue-edit execution and authenticated access to the server-only rate-limit function are blocked.
- `product-assets` is public for product imagery; `order-assets` is private for customer artwork.
- Products and orders were empty at initial setup. Subsequent public API inspection confirmed one owner-added product, Loop Steel Everyday Bottle, and its published template. No live order submission or WhatsApp message has been performed by the agent.
- Vercel project `inkivoprint-4522/project1` is linked to GitHub `inkivoprint-ux/project1`. Next.js is now the saved framework, with `npm ci` installation and Node.js 24.x; the repository root is unchanged. The previous initial deployment contained only a README. A configured application deployment still needs verification.
- Local Git was initialized with permission and connected to the repository's existing history without replacing project files. The owner authorized GitHub sign-in as `inkivoprint-ux`, and application commit `3f79b0d` was pushed normally to `main`. Unrelated saved accounts and repository history were preserved.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` were saved in Vercel for Production. The owner subsequently entered both Supabase API keys privately; no secret was committed or shown in chat. Initial inspection flagged `SUPABASE_SECRET_KEY` as Config and in Preview as well as Production; the owner was asked to save it as Secret, Production-only. Confirm that adjustment before launch. Do not reveal the value to verify it.
- The first deployment returned `404 NOT_FOUND`. After the framework correction and owner-entered keys, deployment `E6fhpCwkpa7PRvKgakuBxbFFrf2v` (commit `bd4d93d`) was Ready and the public production origin loaded correctly. The catalogue endpoint returned HTTP 200 against Supabase; signed-out orders returned HTTP 401, and `/admin` showed sign-in. Private server-key/order/storage operations remain unverified.

## Connection values for Vercel

Open the existing project's **Settings → Environment Variables**. Complete account-security prompts yourself; enabling an authenticator is recommended. Never send passwords, recovery codes or secret keys in chat.

| Variable | Value/source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xcgcbalvhrpuuqbadsrh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | This project's `sb_publishable_…` key from Supabase **Settings → API Keys** |
| `SUPABASE_SECRET_KEY` | This project's `sb_secret_…` key from Supabase **Settings → API Keys**; server-only |
| `NEXT_PUBLIC_SITE_URL` | Initially `https://project1-wheat-alpha.vercel.app`; replace with the verified final custom-domain origin before launch |

The public key is intended for client use under RLS. The secret key bypasses RLS: never give it a `NEXT_PUBLIC_` prefix, commit it, expose it in screenshots, or put it in client JavaScript. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` fallbacks remain supported; prefer new keys and avoid contradictory credentials. The existing app does not need a database password, connection string, Supabase personal access token or OpenAI key. See [Supabase's key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

Set Production values before the application build. Prefer a separate staging Supabase project for Preview environments rather than letting previews write real production orders. Redeploy after changing variables, especially public variables compiled into the frontend. See [Vercel environment-variable instructions](https://vercel.com/docs/environment-variables). For cloud-connected local development, the owner can enter values in ignored `.env.local` and restart the development server.

## Database migrations: already applied

1. `202609290001_initial_schema.sql`
2. `202609300001_admin_profile_access.sql`
3. `202609300002_order_management.sql`
4. `202609300003_shared_catalogue.sql`
5. `202609300004_order_safety.sql`

These files are in `supabase/migrations`. **Do not rerun initial setup or reset this project.** They were applied manually, not registered through CLI migration history; reconcile history before CLI push. Future changes should be additive migrations after inspecting current state. The profile trigger/backfill creates customer profiles; only the approved account was promoted. Do not disable RLS or make customer storage public to fix errors.

## GitHub upload and Vercel deployment

The initial application upload, framework configuration and API-key entry below are complete. Remaining work includes secret classification, catalogue completion and live acceptance checks; do not reinitialize Git or replace existing history.

1. Authenticate local Git as the Inkivo account with write access to `inkivoprint-ux/project1`. Chrome sign-in does not change saved Git credentials. Preserve unrelated saved accounts.
2. Review the upload list: include code, public product/font assets, migrations, package lock and docs. Exclude environment secrets, `node_modules`, `.next`, logs and build caches.
3. Commit on top of existing `main` history and push normally; never force-push or replace repository history.
4. In the existing Vercel project, select the **Next.js** framework preset and repository root. Use `npm ci` to install, `npm run build` to build, and a supported Node.js version compatible with the installed Next.js package. Do not deploy this as a static README site.
5. Set connection values and redeploy. Verify the deployed commit is the application commit, not `9057527`; visit the website and inspect actual runtime behaviour.

This is a commercial storefront. **Vercel Hobby is limited to personal, non-commercial use.** Choose suitable commercial hosting before business launch. No subscription, paid upgrade or domain purchase has been made for the owner. See [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby).

## Admin login and catalogue publishing

1. Visit deployed `/admin` directly. Customer navigation intentionally contains no Admin links.
2. Sign in using `inkivoprint@gmail.com` and the private password. Verify signed-out and non-admin users cannot access orders or customer files.
3. From the browser/device containing the approved existing products/templates, review them and explicitly choose **Publish this device's catalogue** when the shared catalogue is empty. Nothing is imported automatically and existing local data is retained.
4. Verify badges, numbered positions, descriptions, images, prices and published templates from a different signed-out browser/device. Draft templates must remain private.
5. If import stops after saving some products, inspect successful records and finish missing products/templates individually. Never blindly republish stale local versions over cloud edits.

Set Supabase Auth's site URL to the verified deployment origin and allow only required exact redirect origins. Review password-recovery/email delivery before client handover. Do not hardcode credentials or automatically grant future users admin rights.

## Already purchased domain and SEO

Add the owner's existing domain in Vercel, verify ownership and apply the exact displayed DNS values. Preserve unrelated DNS/mail records; no domain purchase is needed. Verify HTTPS/primary origin, update `NEXT_PUBLIC_SITE_URL` and Supabase Auth URLs, then redeploy.

Metadata, canonical URLs, sitemap and admin/API indexing restrictions are implemented. Verify the live sitemap/robots file, approve business contact information and submit the verified domain/sitemap to the owner's search-console account. No search ranking, analytics installation or measured performance score is claimed. The admin email does not automatically replace the preserved public contact email/WhatsApp number.

The owner must approve business contacts, shipping/refund/privacy terms, retention and backups before launch.

## Required live acceptance checks

Use owner-approved real test details and disposable records, never fabricated success responses. No real cloud order has been submitted during setup.

- Plain quantity/Add to cart and isolated Buy now; existing cart stays intact.
- Actual personalised original/cropped/preview files, Malayalam/text effects, and selected-side output.
- T-shirt S/M/L/XL quantities carried through checkout, database records, WhatsApp and Admin Orders.
- Real orders/files saved before WhatsApp opens; exact filenames match Admin Orders, downloads and the received message.
- Retry after a lost response returns the same successful order, not a duplicate. Verify actual service failures and server-authoritative pricing.
- Private files inaccessible while signed out; admin previews/downloads work. Complete a disposable order, move it to recoverable Trash, then restore it. Permanent file removal needs separate confirmation.
- Shared catalogue changes visible across devices; drafts stay out of public previews. Verify session expiry and sign-out protection.
- Phone/tablet/desktop and keyboard/error/slow-network behaviour. Local viewport checks are not physical-device certification.

Order requests are bounded to about 4.1 MB including overhead; catalogue JSON is bounded to 3.8 MB, with per-image validation. Large/multiple personalised uploads may be rejected with an actionable message. Supporting large files requires a separate direct-upload design, not a fake success.

## Remaining limitations

Latest local validation after the template/export corrections: **101 tests passed across 21 files; type checking, lint and production build passed**. Earlier production browser inspection confirmed no public Admin/tutorial links, no broken storefront images in the inspected page, and a blocked admin workspace when cloud credentials are missing. That earlier inspection used unconfigured local production, not a live Supabase-backed checkout.

Exports are preview-resolution selected-side artwork, not guaranteed print-ready masters or combined two-sided production files. No payment gateway, live stock reservation or size inventory is implemented. Shipping/payment confirmation remains a WhatsApp workflow. Manufacturing quality needs manual review.

Agent verification of deployed admin login, cloud orders/uploads, received WhatsApp messages and downloads remains incomplete. The owner has added one shared product and published template, and the deployed public APIs return them. Failed-order recovery, unused public-image cleanup, retention, backups and legal/business policies need operational decisions. Automated SQL tests use isolated PGlite schemas and do not replace live Auth/Storage/runtime checks.

## Responsive template and canvas-export correction

The owner reported different Windows/mobile template alignment, tainted-canvas errors while preparing purchase files, and difficulty leaving Tapered Cylinder mode. The responsive panel previously stretched the percentage print area independently of the contained product photograph. Admin and customer previews now fit the same image-relative plane uniformly inside the panel, including proportional image padding. Detection and fabric-map generation use that same reference. Desktop/Mobile buttons only change preview size, not saved template data.

Existing products, print-area values, template versions, SQL structure and orders are not rewritten by this correction. Older templates were positioned against a variable panel without a stored reference frame, so review their placement once in the corrected editor and publish only after approval. Any adjustment now applies to both desktop and phone. This does not promise identical physical print masters; selected-side preview-output limitations still apply.

All images drawn to export canvases now set `crossOrigin = anonymous` before assigning their source. Supabase's actual public product-image response was checked and permits CORS. A denied image/export fails with an actionable error; it does not pretend an order or file succeeded. Tapered-mode transitions clear the automatic tapered mask/taper when selecting another surface, while preserving intentional shapes, placement, artwork fit and print dimensions.

Custom Mask previously bypassed curved rendering and ignored taper. It now applies both controls before clipping the chosen mask. Zero curvature/taper keeps straight artwork; positive and negative taper are reversible. Artwork finishing previously blended the canvas inside a transparent stacking context, so it did not interact with the photograph. Admin previews now blend the positioned print area, and customer previews blend each photo/text layer independently against the photograph. Export compositing reads the same blend-mode metadata, including safe Normal/source-over fallback. Text-only Normal surface overrides remain independent of photo blending.

Changed files: `components/MockupStage.tsx`, `components/AdminTemplateEditor.tsx`, `components/Customizer.tsx`, `components/WarpedArtwork.tsx`, `app/globals.css`, `lib/mockupGeometry.ts`, `lib/canvasImages.ts`, `lib/templateSurface.ts`, `lib/surfaceGeometry.ts`, `lib/artworkBlend.ts`, `lib/smartMockup.ts`, their five new regression-test files, `README.md`, and this guide. No database migration is needed.

Validation checkpoint: 101 automated tests passed in 21 files; type checking, lint (no warnings) and production build passed. Local browser checks include switching Tapered Cylinder to Cylinder and Flat without resetting or saving a template, Custom Mask curvature and positive/negative taper controls, and visibly distinct Screen/Multiply blending against the bottle photograph. A 390px customer viewport and desktop viewport use the same image aspect and proportional padding; measured local print-area aspect differs by less than 0.01% from subpixel rounding. No existing template was saved, reset or published by the agent during these checks.

The code correction was pushed as `d53f3729f8642574c129303980410a546a2d5848`. Vercel production deployment `AK5MPjE83zZ18omexZWkJEcxp9kr` reached Ready on 1 October 2026. Live signed-out verification used the owner's current shared bottle product and actual public Supabase PNG. Desktop/390px phone measurements retained the same image-relative geometry (less than 0.02% print-area aspect difference from pixel rounding). Entering text and choosing Buy now prepared both cropped artwork and product-preview PNGs and opened checkout without the tainted-canvas failure. Prepared filenames were displayed together with the same design identifier; the existing shopping cart was unchanged. No warnings/errors were captured for that new live tab. Checkout was closed without entering customer details, saving a cloud order or opening WhatsApp. Actual uploaded-order filenames, Admin Orders/downloads and received WhatsApp contents still need owner-approved live acceptance testing.
