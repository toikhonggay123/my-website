# Development checklist

| Phase | Status | Scope |
| --- | --- | --- |
| 0 | Complete | Repository audit and seven design documents |
| 1 | Local workflow verified | Invitation activation, sign-in, tenant and resource scope, organization settings and staff access |
| 2 | Local workflow verified | Courses, classes, students, teacher assignments, enrollment and transfer history |
| 3 | Local workflow verified | Weekly recurrence, dated sessions, rescheduling, conflict checks, ClassCheck corrections and filtered CSV |
| 4 | Not started | Learning operations |
| 5 | Not started | Family portals and communications |
| 6 | In progress | Local adversarial and browser regression tests are running. Pilot hardening and release review remain open. |
| 7 | Not started | Ecosystem readiness |

Production requires a separately provisioned Worker and D1, an HTTPS origin and managed secrets. Real student processing requires owner approval and the legal review specified in the brief.

## Next work

Finish controlled student import, recurrence editing and holiday rules, richer report views, and provider-backed recovery. Phase 4 adds assignments and submissions after those workflow gaps are reviewed. Phase 5 adds guardian and student access, announcements and notifications. A release review still needs staging configuration, backup and restore drills, measured load tests, an accessibility review and an independent security review.
