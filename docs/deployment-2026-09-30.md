# Inkivo deployment guide and current status

Updated 30 September 2026. Database setup is complete; the application is not yet verified live or certified production-ready.

## Confirmed setup

- Supabase project: `https://xcgcbalvhrpuuqbadsrh.supabase.co`.
- Before setup, there were no public application tables, enum types, storage buckets or storage policies. No existing business records were replaced.
- All five local migrations were applied together through the SQL editor in one transaction, followed by the explicitly approved admin promotion.
- The owner created `inkivoprint@gmail.com` in Supabase Auth and entered/submitted the password privately. Its matching profile has role `admin`, confirmed by database read-back. No password is stored in source code.
- All 15 application tables have row-level security enabled. Anonymous catalogue-edit execution and authenticated access to the server-only rate-limit function are blocked.
- `product-assets` is public for product imagery; `order-assets` is private for customer artwork.
- Products and orders are empty. No catalogue publishing, live order submission or WhatsApp message has been performed.
- Vercel project `inkivoprint-4522/project1` is linked to GitHub `inkivoprint-ux/project1`. Next.js is now the saved framework, with `npm ci` installation and Node.js 24.x; the repository root is unchanged. The previous initial deployment contained only a README. A configured application deployment still needs verification.
- Local Git was initialized with permission and connected to the repository's existing history without replacing project files. The owner authorized GitHub sign-in as `inkivoprint-ux`, and application commit `3f79b0d` was pushed normally to `main`. Unrelated saved accounts and repository history were preserved.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SITE_URL` were saved in Vercel for Production. Supabase API keys have not been entered; no secret was committed or shown in chat. Redeployment is required after adding the keys.
- Vercel lists application commit `3f79b0d` as Ready, but the existing production address returned Vercel `404 NOT_FOUND` during inspection. This first build preceded the corrected framework/public settings; dashboard Ready alone is not proof of a working storefront. Verify the domain mapping and a fresh Next.js deployment after credentials are added.

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

The initial application upload and framework configuration below are complete. Remaining work starts with the API-key entries and a fresh deployment; do not reinitialize Git or replace existing history.

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

Latest local validation after this setup: **72 tests passed across 16 files; type checking, lint and production build passed**. Production browser inspection confirmed no public Admin/tutorial links, no broken storefront images in the inspected page, and a blocked admin workspace when cloud credentials are missing. No warnings/errors were captured in that inspected session. This browser check used unconfigured local production, not a live Supabase-backed checkout.

Exports are preview-resolution selected-side artwork, not guaranteed print-ready masters or combined two-sided production files. No payment gateway, live stock reservation or size inventory is implemented. Shipping/payment confirmation remains a WhatsApp workflow. Manufacturing quality needs manual review.

Deployed admin login, cross-device publishing, cloud orders/uploads, received WhatsApp messages and downloads remain unverified until credentials and application deployment are in place. Failed-order recovery, unused public-image cleanup, retention, backups and legal/business policies need operational decisions. Automated SQL tests use isolated PGlite schemas and do not replace live Auth/Storage/runtime checks.
