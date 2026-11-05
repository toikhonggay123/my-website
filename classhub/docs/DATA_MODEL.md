# Data model

Better Auth owns user, session, account and verification. ClassHub owns organizations, branches, memberships, invitations, courses, classes, students, enrollments, teacher assignments, timetable rules, sessions, attendance and audit events. Composite foreign keys enforce shared ownership across tenant data. One membership per user and workspace has an owner, branch administrator or teacher role. Stable UUIDs identify domain records.

Enrollments use half-open Vietnam calendar dates [enrolled_on, withdrawn_on). Withdrawal retains the enrollment. A transfer closes one enrollment and creates a new one in one batch. On first attendance save, rows pin the eligible roster for the session. Attendance rows reference the enrollment, preserving historical membership even when the student moves.

Timetable rules describe weekly local start/end times and effective dates. Sessions store epoch milliseconds and the Vietnam calendar date. An immutable source occurrence key guards against regeneration of cancelled or rescheduled sessions. A partial index and triggers enforce constraints against concurrent writers. Audit events record actors, actions, targets, timestamps and limited change metadata.

Entitlement policies, academic periods, guardian links, assignment targets, notifications and external mappings are planned as their workflows come online.
