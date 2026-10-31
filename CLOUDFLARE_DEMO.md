# Cloudflare demo

The owner explicitly approved public demo hosting on 31 October 2026. This supersedes the earlier local-only hosting restriction for synthetic data only.

- URL: https://my-website.fyllxestonia.workers.dev/quan-tri
- Worker: `my-website`, in the existing owner's Cloudflare account.
- Isolated D1: `afyllx-mealcheck-demo-20261031`; created empty, then the four reviewed migrations were applied. No local database or roster was uploaded.
- Runtime configuration: `wrangler.demo.jsonc`. The original `wrangler.jsonc`, loopback restriction and `.wrangler/local-state` remain for local use.
- Demo administration is public, without teacher sign-in, as approved. The UI labels the demo clearly. Live-space requests and roster edits/imports are rejected by the server; the built-in seed only creates synthetic `TEST...` students.
- The demo uses a separate QR secret in Cloudflare runtime secrets. Never copy that value into Git, logs, build variables or this document. Never use or replace the original local QR key.
- Daily `.xls` generation runs in the browser at `/xuat-excel`, using today's date from the server, because the 1,000-student BIFF8 workbook exceeds the free Worker's CPU budget. The original local `.xls` endpoint remains unchanged.

## Build and deploy

Cloudflare Workers Builds settings, repository root `/`, production branch `main`:

```text
Build command: pnpm check && pnpm build:demo
Deploy command: pnpm deploy:demo
```

`build:demo` explicitly selects the demo Wrangler config in Vite. `deploy:demo` verifies the built Worker name, deployment mode and isolated database ID before deploying `dist/server/wrangler.json`. Do not run raw `npx wrangler deploy` on the TypeScript entry: Vinext's virtual entry requires the framework build first.

CI checks the default local build and isolated local HTTP QA before building the cloud demo. Do not automatically apply migrations or upload student data in CI. The demo D1 schema was initialized separately; any future schema change requires review.

When building on the owner's computer, stop localhost first. After checking/building the demo, run the normal `pnpm build` again before `Start-Local.ps1`; the local launcher expects the default local build. Verify the real student count and saved hashes without test writes.

## Collaboration

`SucVatHoaThan` was invited after explicit confirmation and the GitHub permission API now confirms **Write** access. This permits source changes and pushes; a change on `main` can trigger Cloudflare deployment. It does not grant Cloudflare dashboard access or access to the owner's local database/keys. Prefer a branch and pull request for review; never force push.

For deployment rollback, use an observed previous Worker version. Code rollback does not roll back D1. This public demo is not a production deployment for the 34 real students; the old hosted Site remains untouched.
