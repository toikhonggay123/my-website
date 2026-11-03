# AFYLLX MealCheck

- Owner hosting update 04/11/2026: canonical cloud entry is https://edu.afyllx.com/mealcheck; install at /mealcheck/cai-dat. Keep the same my-website Worker/D1/key and retain afyllx.com plus the workers.dev host as explicit aliases. /quan-tri remains supported locally and for installed apps. Preserve the manifest ID and old-origin queues.

- Owner branding update 04/11/2026: the education brand is AFYLLX Edu. Keep the symbol on the left, bold AFYLLX Edu on top and regular MealCheck below, using the shared `app/brand.tsx`. Existing artwork URLs (`public/brand/edtech-mark.png`, `public/icons/edtech-*`) remain stable for installed-app compatibility; they are not display names. See BRANDING.md. Preserve internal QR identifiers and all keys/data.

- Owner update 03/11/2026: Cloudflare now uses 275 synthetic students across 6A/6B–9A/9B, with globally unique normalized names/codes and all QR issued. The real cloud roster (34 students/34 QR plus history) was exported and restore-verified before replacement at `.migration-private/checkpoints/20261103-real-before-eight-classes/`. Do not restore it without an owner request. Keep the Worker QR key unchanged so checkpoint cards remain recoverable. Preserve the local real roster/cards. Never commit private checkpoints, generated rosters or QR tokens.

- Latest owner instruction authorizes public Cloudflare live hosting of the supplied real roster without login; the owner explicitly accepted public access. Replace cloud test data, create a separate live D1 and issue new live QR cards with a new runtime secret, retaining old cards locally. The original key was never exported; do not keep a copy of the replaced demo key. Non-force source pushes to main of toikhonggay123/my-website remain authorized; never commit roster/tokens/keys/import SQL. SucVatHoaThan has Write. Do not create another repository or modify the old hosted Site.
- Active local URL is http://localhost:3000/quan-tri. Use Start-Local.ps1 / Stop-Local.ps1; keep real data in .wrangler/local-state.
- The real database was imported and verified. Never reinitialize or overwrite it. The original QR secret is unavailable; do not replace it without explicit approval for a card-reissue plan.
- New-card approval is for Cloudflare only. Preserve the local database and 34 original local cards; no write tests on live cloud/local records. Read CLOUDFLARE_LIVE.md for the active cloud configuration.

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
