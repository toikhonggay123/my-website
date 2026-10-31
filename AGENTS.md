# AFYLLX MealCheck

- Latest owner instruction authorizes reviewing, committing and pushing this source to main of toikhonggay123/my-website without force push. Do not create another repository or modify the old hosted Site. Keep real data local; do not provision or migrate Cloudflare data without a separate instruction.
- Active local URL is http://localhost:3000/quan-tri. Use Start-Local.ps1 / Stop-Local.ps1; keep real data in .wrangler/local-state.
- The real database was imported and verified. Never reinitialize or overwrite it. The original QR secret is unavailable; do not replace it without explicit approval for a card-reissue plan.

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
