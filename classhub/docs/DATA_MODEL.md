# Data model

Better Auth owns user, session, account and verification. ClassHub owns organizations, branches, memberships, invitations, courses, classes, students, enrollments, teacher assignments, timetable rules, sessions, attendance and audit events. Composite foreign keys enforce shared ownership across tenant data. One membership per user and workspace has an owner, branch administrator or teacher role. Stable UUIDs identify domain records.

Enrollments use half-open Vietnam calendar dates [enrolled_on, withdrawn_on). Withdrawal retains the enrollment. A transfer closes one enrollment and creates a new one in one batch. On first attendance save, rows pin the eligible roster for the session. Attendance rows reference the enrollment, preserving historical membership even when the student moves.

Timetable rules describe weekly local start/end times and effective dates. Sessions store epoch milliseconds and the Vietnam calendar date. An immutable source occurrence key guards against regeneration of cancelled or rescheduled sessions. A partial index and triggers enforce constraints against concurrent writers. Audit events record actors, actions, targets, timestamps and limited change metadata.

School mode (migration 0005) adds school terms, subjects, bell periods per shift, closure dates, teaching assignments per term, class and subject, and versioned weekly timetables. A term has at most one draft. A published version applies from its effective date until a later published version of the same term. Publishing from a date archives published versions that start on or after it. School attendance sessions are ordinary class sessions with a `shift` of morning or afternoon, unique per class, date and shift, owned by the class's primary teacher assignment (the homeroom teacher). They span the class's first to last period in that shift. Reconciliation creates, moves or cancels only sessions that have not started and hold no attendance, and never touches dates before today.

Migration 0006 adds `organizations.public_slug`, the owner's opt-in for the public student timetable, and `class_sessions.pinned`, set when an administrator cancels or reschedules a session by hand so that reconciliation leaves it unchanged.

Entitlement policies, academic periods, guardian links, assignment targets, notifications and external mappings are planned as their workflows come online.
