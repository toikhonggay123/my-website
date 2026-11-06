# Architecture

## Repository audit

The workspace contains two MealCheck checkouts and no existing ClassHub implementation. The active MealCheck package already uses TypeScript, React, Vite, Workers and D1, with product-specific Vinext routes, database and QR keys. The root workspace has no committed history. ClassHub lives in its own package under classhub/ and uses its own bindings, local persistence and port.

## Decisions

- Use React and Vite for the UI and Hono for the API in one Worker. Serve both from the same origin.
- Use Better Auth with D1 for credentials and server-validated sessions. Store sessions in HttpOnly cookies, use Secure cookies on HTTPS and enforce the configured origin on mutations.
- The loopback development build can use a dedicated local administrator identity from D1. Local setup enables it through `.dev.vars`. It requires the exact configured HTTP loopback origin. Hosted environments use the authenticated flow. Local teacher profiles support scheduling and assignments without credentials.
- Use application-owned tenant memberships and class assignments to authorize operations independently of account authentication.
- Use parameterized SQL migrations and D1 transactional batches. Database triggers protect scheduling and enrollment constraints during concurrent writes. Attendance uses an optimistic edit version.
- Use manually delivered, expiring invitations during local development and controlled trials. Production email delivery and account recovery require separate configuration and testing.
- Pair the owner-supplied AFYLLX Edu mark with the ClassHub product name. Use Be Vietnam Pro (weights 400, 700 and 800), a deep navy navigation surface, blue actions, and clear status labels. Keep dense roster surfaces opaque.

## References

[React on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
[Better Auth D1 support](https://better-auth.com/blog/1-5)
[D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/)
[OWASP ASVS](https://asvs.owasp.org/)
