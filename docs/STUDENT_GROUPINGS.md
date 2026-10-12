# Student groupings and teams

Status: grouping management implemented. Activity-specific exceptions and collaborative activity execution are future integrations.

## Model and behavior

The hierarchy is **course → section (`CourseGroup`) → grouping (`StudentGrouping`) → teams (`StudentTeam`) → student enrollments (`StudentTeamMember`)**. A section can have independent groupings such as Project teams, Lab partners, and Exam arrangements. Grouping titles are unique within a section. Team titles are unique within their grouping (case-insensitive validation), and surrounding whitespace is trimmed.

A student can belong to at most one team in each grouping, but can have a different assignment in every grouping. Unassigned students, empty teams, and empty groupings are valid. Membership references a section participant, including pending enrollments without an activated account. Teachers and TAs are never eligible team members. Cross-section membership and team IDs from another grouping are rejected.

Each team has a stable ID that survives renaming and membership edits. The database's composite membership key enforces one team per grouping per participant, and the composite team foreign key ensures that a membership's team belongs to its grouping. Service validation checks the participant's section and student role.

## Permissions and interface

Administrators and explicit course owners/teachers manage groupings in any section they manage. A section teacher may manage groupings only in their assigned section. TAs, learners, and unrelated staff cannot list or mutate groupings. Grouping descriptions and memberships are not included in learner course responses; a future exception feature may need to keep these details private.

Course managers use **Course → Groupings**, then select a section. Section teachers use the **Groupings** tab in their section workspace. The panel loads only when opened. The editor saves the grouping name, optional description, teams, and all assignments together. It supports student search, an unassigned-only filter, explicit unassigned choices, and visible team sizes. English, French, Chinese, and Arabic copy is maintained in the host application.

One draft owns the shared Save/Cancel action bar and unsaved-navigation guard. Cancel restores the saved snapshot; Close confirms discarding unsaved work. A failed save retains the draft. A stale save or delete shows a recoverable conflict, with an explicit reload action that confirms before discarding edits. Section selection is disabled while an editor is open.

## API and concurrency

Routes are under `/api/courses/:courseId/groups/:groupId/groupings`:

- `GET /`: returns `{ groupings, students }` for the authorized section.
- `POST /`: creates a grouping and optional teams; returns `{ grouping }` with status 201.
- `PATCH /:groupingId`: replaces the grouping's editable composition using its current positive integer `revision`.
- `DELETE /:groupingId`: accepts `{ revision }` and deletes the grouping and its teams, preserving student enrollments.

Create/update input contains `title`, optional `description`, and `teams: [{ id?, title, participantIds }]`. Creation accepts new teams only; on update, retained teams must supply their existing IDs. Omitting an existing team removes it. Title length is limited to 120 characters, description to 2,000, teams to 500, and members per team to 5,000. No full-roster assignment is required.

Writes run in serializable transactions. Updates and deletes compare the supplied revision; updates increment it. A conflicting edit, transaction serialization failure, or concurrent foreign-key change returns 409. Duplicate grouping names also return 409. Invalid team/member composition returns 400; an authorized request for a section outside the URL course, or a grouping outside the URL section, returns 404. Actor-attributed `CourseAuditEvent` snapshots record grouping creation, update, and deletion in the same transaction.

## Lifecycle and deployment

Migration `202610120001_student_groupings` adds three core tables without changing existing participant or activity data. Apply it with the standard `npm run db:migrate:all` workflow. Restart running API processes after generating the changed Prisma client.

Unenrollment cascades only the student's team memberships; the grouping and teams remain. An open editor attempting to restore a removed enrollment fails membership validation and must reload. Deleting a grouping never unenrolls students. Deleting a section cascades its groupings and teams. The existing section-delete-and-move-roster action also deletes that section's groupings; teams are not transferred into an unrelated section's grouping structure. No activity or academic record currently depends on these team IDs.

Future activity links must define archival/deletion rules before depending on this cascade behavior. Extra-time exceptions need explicit precedence and timing-snapshot rules; collaborative work needs team attempt, submission, ownership, and grading policies. Creating a grouping currently changes none of those activity behaviors.

## Verification

`packages/core/src/student-groupings.test.ts` covers authorization delegation, section scoping, invalid composition, stable team identity, atomic audit writes, optimistic conflicts, and database error mapping. `tests/e2e/student-groupings.spec.ts` covers real API/browser CRUD, multiple independent groupings, pending enrollments, search, reload persistence, concurrent saves, team name swaps, failed/stale draft recovery, guarded navigation, narrow layouts, section teacher/TA/student boundaries, and roster/section cleanup. It belongs to the independent `@regression` set.
