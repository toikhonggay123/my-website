# Verification plan

Run tests on an isolated local ClassHub D1 with fictional data. Exercise invitation activation, login, tenant and class scoping, course and class creation, enrollment capacity, duplicate prevention, withdrawal history, schedule generation, overlap rejection, attendance persistence, stale writes, reopening, and CSV. Exercise the teacher workflow on phone and desktop. Test malicious cross-tenant identifiers, retired memberships and direct API writes.

Pilot gates still include provider-backed recovery, load and security review, independent accessibility checks, restore drills on staging, and real-data processing approval.

## Local results

- `pnpm check` passed TypeScript, two SQLite integrity tests and the Worker and web builds.
- `pnpm test:e2e` passed in Edge against the built Worker and a separate Miniflare D1. The scenario used 30 fictional students, two unrelated workspaces, two teachers, a branch administrator and a 375 px teacher viewport. It exercised invitation activation, role and branch scoping, cross-tenant requests, repeat schedule generation, conflict rejection, attendance persistence, stale write rejection, correction audit, membership revocation and CSV export.
- The E2E scenario took 6.7 seconds on the local Windows machine and the full command took 14.7 seconds including QA startup. These timings cover the test scenario, with production load measurements pending.
- `pnpm audit --prod --audit-level moderate` reported no known vulnerabilities at verification time.
- `GET /api/health` returned HTTP 200 on the built local preview. A signed-out request to `/api/v1/me` returned 401.

Workerd emitted a Windows socket warning after Playwright stopped the isolated QA runtime. The test completed successfully.
