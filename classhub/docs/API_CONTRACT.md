# API contract

Application endpoints are under /api/v1. Scoped routes use /api/v1/orgs/:orgId. Auth endpoints under /api/auth use Better Auth. JSON success bodies contain data. Errors contain error.code and error.message. Auth failures are 401, permission failures 403 or a scoped 404, invalid input 400, stale or conflicting writes 409. Mutations require the application Origin and JSON when a body is present. Collection responses expose pagination metadata.

The workspace route and every resource ID are untrusted inputs. The backend resolves membership for the requested organization and then applies branch and class rules. Attendance writes supply the displayed version and the full session roster. A stale version requires the client to reload the session and reconcile changes.

## Implemented surface

| Scope | Routes |
| --- | --- |
| Identity | POST /api/auth/sign-in/email, POST /api/auth/sign-out, GET /api/v1/me, POST /api/v1/activate, POST /api/v1/accept-invitation |
| Workspace | GET and PATCH /settings, GET and POST /branches, GET /staff, POST /staff in loopback mode, PATCH /staff/:userId, POST /invitations in authenticated mode, GET /dashboard |
| Course and student | GET and POST /courses and /students, PATCH /courses/:id and /students/:id, GET /students/:id/enrollments |
| Class | GET and POST /classes, GET and PATCH /classes/:classId |
| Enrollment | GET and POST /classes/:classId/enrollments, PATCH /classes/:classId/enrollments/:id |
| Teaching | GET and POST /classes/:classId/teachers, DELETE /classes/:classId/teachers/:userId |
| Timetable | GET and POST /classes/:classId/timetable, POST /classes/:classId/timetable/:ruleId/generate |
| Sessions | GET /sessions, POST /classes/:classId/sessions, GET and PATCH /sessions/:sessionId |
| ClassCheck | GET and PUT /sessions/:sessionId/attendance, POST suffixes /finalize and /reopen, GET suffix /history |
| Reports | GET /reports/attendance and /reports/attendance.csv (range up to 366 days), GET /reports/summary and /reports/summary.csv?from=&to=, GET /reports/register and /reports/register.csv?class_id=&month=YYYY-MM, GET /reports/alerts?days= (owner and branch administrator, class scope) |
| School setup | GET /school/setup, POST /school/terms, PATCH /school/terms/:termId, POST /school/subjects and /school/subjects/defaults, PATCH /school/subjects/:subjectId, PUT /school/bells, POST /school/closures, DELETE /school/closures/:date |
| School staffing | GET /school/teachers and /school/classes, PUT /school/classes/:classId/homeroom, GET and PUT /school/terms/:termId/assignments |
| Public | GET /api/v1/public/timetable?truong=&lop=&tuan= (no sign-in; only schools with a public slug; PATCH /school/public sets or clears the slug) |
| Teacher page | GET /teacher/today, /teacher/week?from=, /teacher/classes and /teacher/classes/:classId (teacher role only) |
| Timetable | GET /school/terms/:termId/timetable, POST suffix /draft, GET /school/timetable/:versionId, PUT /school/timetable/:versionId/classes/:classId, POST suffixes /publish and /discard, POST /school/sessions/sync |

GET /sessions/:sessionId/attendance also returns `correctableUntil`, the end of the 30-minute self-correction window for the teacher who finalized a school session, or null. School routes require the owner role. Publishing, closure changes and /school/sessions/sync return a `sync` summary with created, updated and cancelled counts and per-class failures. Sync ranges are at most 31 days. GET /sessions accepts `limit` up to 400 for calendar grids.

Workspace-relative paths in the table use the organization prefix. Collections use one-based page numbers and 25 rows per page. Attendance report filters are inclusive Vietnam dates and optional class, branch, teacher and student identifiers. Summary and CSV include finalized rows only. The denominator includes present, late and absent rows. Reopening excludes that session until it is finalized again.
