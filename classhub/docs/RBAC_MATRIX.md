# Resource permissions

| Capability | Owner | Branch administrator | Teacher |
| --- | --- | --- | --- |
| Workspace settings | Workspace | Read own workspace | Read own workspace |
| Create invitations and manage member access | Workspace | | |
| Course and student directory | Workspace | | |
| Class detail and roster | Workspace | Assigned branch | Assigned class |
| Class and enrollment management | Workspace | Assigned branch | |
| Schedule management | Workspace | Assigned branch | Read assigned classes |
| Session attendance write and finalize | Workspace | Assigned branch | Assigned class and session instructor |
| School session attendance write and finalize | Workspace | Assigned branch | Homeroom teacher, or a teacher with a timetabled period in that class and shift that day |
| Summary, monthly register, alerts and their exports | Workspace | Assigned branch | |
| Reopen and CSV export | Workspace | Assigned branch | Reopen only: the teacher who finalized a school session, within 30 minutes |
| Publish or stop the public student timetable | Workspace | | |
| Teacher page views (today, week, own classes) | | | Own sessions, periods and assigned classes |
| Audit history | Workspace | Scoped to class attendance | |
| School terms, subjects, bells, closures, timetable and homeroom/subject assignments | Workspace | | |

A valid session establishes identity. Each request reloads active membership against the workspace route. Cross-tenant and out-of-scope object identifiers return a generic resource error. Platform staff, students and guardians do not receive an operational membership in this slice. Later releases need separate explicit policies and adversarial tests for those roles.

A branch administrator can enroll a student already active in their branch. The owner handles first enrollment into a branch. Transfers require write access to both classes.
