# AFYLLX MealCheck

- Owner UI update 04/11/2026: menu Edu branding opens a native confirmation before leaving for https://edu.afyllx.com/. The scanner header and launch badge show only large bold MealCheck. The Edu portal reads one existing issued card through GET /api/qr/card-preview; do not generate/reissue QR or initialize sessions in that route, cache tokens, or commit card data.

- Owner hosting update 04/11/2026: edu.afyllx.com root is the Edu portal, served by the afyllx-edu gateway Worker from C:/Users/HarmoniaNEXT/.gemini/antigravity/scratch/afyllx-edu. MealCheck stays at /mealcheck, installation at /mealcheck/cai-dat. The gateway forwards MealCheck pages/API/PWA/assets to my-website using a service binding. Do not attach the Edu custom domain to my-website or replace the portal. Keep the same my-website Worker/D1/key, afyllx.com and the legacy workers.dev host. /quan-tri remains supported locally and for installed apps; preserve manifest identity and old-origin queues.

- Owner branding update 04/11/2026: the education brand is AFYLLX Edu. Keep the symbol on the left, bold AFYLLX Edu on top and regular CheckIn below (display name changed from MealCheck on 08/11/2026; meals read as attendance sessions "Buổi sáng/trưa/tối", wording only — see BRANDING.md), using the shared `app/brand.tsx`. Existing artwork URLs (`public/brand/edtech-mark.png`, `public/icons/edtech-*`) remain stable for installed-app compatibility; they are not display names. See BRANDING.md. Preserve internal QR identifiers and all keys/data.

- Owner update 03/11/2026: Cloudflare now uses 275 synthetic students across 6A/6B–9A/9B, with globally unique normalized names/codes and all QR issued. The real cloud roster (34 students/34 QR plus history) was exported and restore-verified before replacement at `.migration-private/checkpoints/20261103-real-before-eight-classes/`. Do not restore it without an owner request. Keep the Worker QR key unchanged so checkpoint cards remain recoverable. Preserve the local real roster/cards. Never commit private checkpoints, generated rosters or QR tokens.

- Current Cloudflare state (since 03/11/2026, see the note above): the public live deployment serves the 275-student synthetic roster, not the real one. History: on 31/10/2026 the owner authorized public Cloudflare live hosting of the supplied real roster without login and explicitly accepted public access; cloud test data was replaced, a separate live D1 was created and new live QR cards were issued with a new runtime secret, retaining old cards locally. That real cloud roster is now kept only in the private checkpoint; restore it only on an explicit owner request. Public access without login remains the owner's decision. The original key was never exported; do not keep a copy of the replaced demo key. Non-force source pushes to main of toikhonggay123/my-website remain authorized; never commit roster/tokens/keys/import SQL. SucVatHoaThan has Write. Do not create another repository or modify the old hosted Site.
- Active local URL is http://localhost:3000/quan-tri. Use Start-Local.ps1 / Stop-Local.ps1; keep real data in .wrangler/local-state.
- The real database was imported and verified. Never reinitialize or overwrite it. The original QR secret is unavailable; do not replace it without explicit approval for a card-reissue plan.
- New-card approval is for Cloudflare only. Preserve the local database and 34 original local cards; no write tests on live cloud/local records. Read CLOUDFLARE_LIVE.md for the active cloud configuration.

- Flood/DDoS shield: `lib/shield.mjs` runs first in `worker/index.ts` using Workers Rate Limiting bindings from `wrangler.cloud.jsonc` only (local loopback stays unlimited). Keep 429 retryable for the offline scan queue; see CLOUDFLARE_LIVE.md before changing limits. Every Worker response also gets `lib/security-headers.mjs` (keep `public/_headers` in step); runtime code must not call `console.*` because Workers Logs are enabled. ClassHub syncs through the legacy workers.dev alias, so keep it in `MEALCHECK_PUBLIC_HOST_ALIASES`.
- Use `pnpm install --frozen-lockfile`, Node 22.22+, pnpm 10.31.
- Use codex/ feature branches by default. The owner explicitly authorized this initial source handoff directly to main. Stop and report Git conflicts; never force push.
- Run `pnpm check`, `pnpm build`, `node scripts/local-qa.mjs` for backend/build changes.
- Tests may only write to local/demo databases. Never test against real student records.
- Keep QR tokens, private backups, student rosters, credentials and signing keys out of Git and CI artifacts/logs.
- Never replace an existing production QR key or rerun historical migrations.
- The owner explicitly removed teacher login entirely. Keep direct local administration without teacher accounts or a sign-in flag. Ignore client identity headers; bind to loopback only.
- Do not alter the old hosted Site or its data during migration.
- Do not auto-apply production database migrations. Review backup and rollback first.
- Read README.md, DEPLOYMENT.md and CONTRIBUTING.md before hosting/collaboration changes.
