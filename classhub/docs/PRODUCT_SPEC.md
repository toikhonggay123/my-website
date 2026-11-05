# AFYLLX ClassHub product specification

AFYLLX → AFYLLX Edu → ClassHub. ClassHub handles courses, classrooms, schedules and academic attendance through its ClassCheck capability. MealCheck and FeeTrack remain separate products with their own data and deployments.

## Operational MVP

An invited owner activates an account and creates a workspace. The owner adds a course, class, staff member and student roster. An assigned teacher signs in, opens a dated lesson and records attendance. The owner reviews the report and exports a scoped CSV. The interface uses Vietnamese and defaults to Asia/Ho_Chi_Minh.

The MVP gate covers persistent writes, historical enrollment, schedule conflict detection, retries, concurrent attendance edits, resource-scoped authorization and phone usability. Learning operations, verified family access, communications and pilot hardening follow this release slice.

## Initial limits

Target small tutoring centers. Cap class size at 100, request pages at 50 rows, and timetable generation at 90 calendar days per call. Treat one instructor as responsible for each session. Schedule conflicts are enforced for that instructor, the class and the branch room. Multiple teachers can be assigned to a class.
