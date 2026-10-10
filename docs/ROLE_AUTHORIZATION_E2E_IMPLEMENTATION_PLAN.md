# Role Authorization And Multi-Teacher E2E Plan

Status: implemented and covered by the repository unit/API/Playwright suites on 2026-10-07. Scenario IDs are a traceability catalog; related assertions may be grouped into one stateful Playwright test.

This document defines the separation between global roles, course-wide staff, and section-scoped staff, records the resolved product policies, and maps the executable coverage that proves authorization and real feature behavior.

## Scope

The work covers:

- administrator, course designer (`course_manager`), teacher, and teaching-assistant access;
- explicit course-wide teachers and section-scoped teachers/TAs;
- courses with more than one teacher;
- UI visibility, direct-route access, API authorization, and durable effects;
- ownership boundaries for activity banks and personal AI connections;
- staff assignment, removal, auditing, grading, publication, and challenges.

It does not change learner permissions except where learner actions are needed to prove a staff workflow end to end.

## Implemented Model

- Global roles are `admin`, `course_manager`, `teacher`, and `student`.
- Course memberships are separate and include `owner`, `teacher`, `ta`, and `student`.
- Section/group participants include `teacher`, `ta`, and `student`.
- Course membership provenance is `explicit` or `section_derived`; only explicit owners/teachers confer course management.
- Adding section staff creates a derived discoverability membership without course-wide authority.
- Removing the final matching section assignment removes the derived membership immediately; other assigned sections remain accessible.
- A course has one `createdById`, although it may have multiple staff memberships.
- Activity banks and personal AI connections are individually owned. Course membership does not transfer their ownership.
- Student-triggered question-authoring AI chooses a usable configured staff preference deterministically: course creator first, then another owner, then a teacher. Disabled, missing, unauthorized, or keyless non-local connections are skipped; the request fails without exposing credentials only when no usable explicit course-staff connection remains.

Course and section capabilities are computed centrally and returned with the course DTO so UI visibility follows the same scope as API enforcement. Grade/feedback writes reject stale optimistic versions, staff/roster/course/settings mutations append actor-attributed `CourseAuditEvent` rows, and existing grade/feedback/challenge event streams retain their actor attribution.

## Accepted Authorization Direction

### Global roles and scoped roles are independent

- **Administrator** is global and can manage all platform and course resources.
- **Course designer** is the global `course_manager` role. It creates subjects and courses and performs curriculum/course design within resources it is authorized to manage. It is not an administrator.
- **Teacher** is the global authoring role. Global teacher status alone does not grant access to every course.
- **Course owner** and **course teacher** are explicit course-wide memberships.
- **Section teacher** and **section TA** are section-scoped participant assignments.
- **Student** access remains section- and assignment-scoped.

### Section assignment must not escalate to course-wide access

Adding a user as a section teacher or TA must not implicitly make that user a course-wide teacher or manager. Section staff can view and act only within their assigned sections. Course-wide access requires a separate explicit course membership.

The implementation uses operation-specific capability checks instead of one broad `canManageCourse` decision, covering:

- viewing a course and a section;
- managing course structure and settings;
- managing course-wide staff;
- managing a section roster;
- viewing attempts and gradebook rows;
- grading or responding to challenges;
- releasing/hiding grades;
- exporting grades;
- writing to an activity bank.

### Multiple course teachers are first-class

- A course can have more than one explicit course teacher.
- Every explicit course teacher receives course-wide teaching access independently of section participant rows.
- `createdById` is provenance and a deterministic tie-breaker, not the sole source of authority.
- Removing one teacher must not alter attempts, grades, feedback, challenges, or audit history.
- Removing or deactivating the original creator must not orphan the course. At least one owner must remain, or ownership must be transferred first.
- Permission changes must take effect on the next request, including in an already-open browser session.

### Staff removal is symmetric

- Removing one of several section assignments retains access to the remaining assigned sections.
- Removing the final section assignment removes section-derived access.
- Removing an explicit course membership removes course-wide access even if the browser already has the course open.
- Removing staff never deletes learner academic data or historical actor references.

### Ownership and auditing remain explicit

- Course access does not grant write access to another teacher's activity bank.
- A co-teacher may use and edit the independent course copy but may publish back to a linked bank only when independently authorized for that bank.
- Personal AI connections and credentials remain private to their owner; global connections remain administrator-managed.
- Saving unrelated course settings must never clear another teacher's selected connection or preference.
- Every grade, feedback, challenge, release, membership, and settings mutation records the actual actor.

### Default least-privilege teaching-assistant policy

A section TA may inspect attempts, prepare or save grades and feedback, and work with challenges for learners in assigned sections. A TA may not manage course structure, course settings, staff, other sections, activity banks, or global resources. Final release/hide authority remains with an administrator, course owner, or explicit course teacher unless a later product decision deliberately adds a separate release capability.

## Resolved Policy Decisions

1. A pure course designer who becomes owner may design/manage the course but needs the global teacher role to grade.
2. Explicit course-level `ta` membership is rejected; TAs are assigned to sections.
3. Section teachers and TAs cannot release/hide grades. Release remains course-wide for administrators, explicit course teachers, and global-teacher owners.
4. TAs may send final challenge responses for learners in assigned sections.
5. Concurrent grade and feedback edits use optimistic version rejection with an explicit HTTP 409 conflict; the teacher reloads before saving.
6. Student question-authoring AI uses deterministic creator, owner, then teacher priority, considers only explicit course memberships, skips unusable preferred connections, and fails safely when no usable fallback remains.
7. New grade challenges notify every active course-wide grading teacher and active teacher assigned to the challenged section. TAs remain authorized to respond within their section but are not email-notification recipients; unrelated administrators and other-section teachers are excluded.

## Required E2E Design Rules

Each allowed-action scenario must perform a real mutation or read, reload the page, and verify the durable downstream result. A visible button alone is not proof that a feature works.

Each denied-action scenario must verify all applicable boundaries:

1. the action is absent or disabled in the UI;
2. direct navigation does not expose the feature;
3. the API rejects the operation;
4. substituting another course, section, activity, attempt, or learner ID does not bypass scope.

Stateful scenarios should use disposable, uniquely named records created through authenticated public APIs. Cleanup must target exact created identifiers and invoke public deletion routes before direct database fallback. The suite remains single-worker unless fixture isolation is redesigned.

## Scenario Personas And Data

The shared fixture should provide:

- one administrator;
- one course designer;
- one primary course owner/teacher;
- two additional global teachers;
- one section teacher;
- one teaching assistant;
- students in Section 1 and Section 2;
- one unassigned student;
- one unrelated teacher;
- a primary course with two sections and an unrelated second course;
- an activity bank owned by the primary teacher;
- formative and summative activities with submissions, complete and partial grades, challenges, and unpublished grades.

Do not reuse one browser context for distinct people. Multi-user scenarios need independent authenticated contexts.

## Planned E2E Scenarios

### Common authorization boundaries

- **RBAC-01 — Role-specific navigation:** each role sees only its permitted global navigation and actions.
- **RBAC-02 — Protected routes:** direct navigation to a forbidden page is rejected without leaking its data.
- **RBAC-03 — Protected APIs:** every forbidden operation is rejected when called directly.
- **RBAC-04 — Identifier substitution:** replacing an allowed resource ID with an unauthorized course, section, activity, attempt, or learner ID is rejected.
- **RBAC-05 — Unrelated-course isolation:** staff assigned to Course A cannot discover, view, or mutate Course B.
- **RBAC-06 — Immediate permission changes:** granting or revoking a role changes the next request without requiring sign-out.
- **RBAC-07 — Role composition:** course or section membership does not accidentally grant global administration.
- **RBAC-08 — Audit attribution:** staff mutations identify the actual acting user, not the course creator or resource owner.

### Administrator

- **ADM-01 — User administration:** create a user, assign/change roles, confirm the account, and verify the resulting access.
- **ADM-02 — Global settings:** update email, plugin, runner, and other global configuration and verify that the new configuration is used.
- **ADM-03 — Runner verification:** test each configured endpoint and verify accurate connection and capability results.
- **ADM-04 — Any-course access:** inspect and manage a course without an explicit course membership.
- **ADM-05 — Curriculum administration:** create and edit subjects, graphs, skills, misconceptions, and courses.
- **ADM-06 — Bank ownership:** create or reassign a bank owner and verify the former and new owners' permissions.
- **ADM-07 — Grade intervention:** correct a grade and verify actor attribution and preserved history.
- **ADM-08 — Administrator safety:** prevent removal of the final usable administrator or equivalent self-lockout.

### Course designer

- **DES-01 — Subject and graph authoring:** create a subject; add concepts, prerequisites, skills, and misconceptions; save; and reload identical data.
- **DES-02 — Course creation:** create a course and receive the intended owner/design membership.
- **DES-03 — Course construction:** create sections, content structure, resources, activities, Tests, and assignments in an authorized course.
- **DES-04 — Usable designed activity:** add or create an activity and verify that the assigned learner can open it.
- **DES-05 — Reuse without source mutation:** reuse curriculum or bank content and verify that the source remains unchanged.
- **DES-06 — No global administration:** deny user, runner, email, plugin, and maintenance administration.
- **DES-07 — Unrelated-resource isolation:** deny changes to another designer's subject, course, or bank without explicit authorization.
- **DES-08 — Gradebook policy:** verify that a pure course designer/owner can design the course but cannot grade without the global teacher role.

### Explicit course teacher

- **TCH-01 — Assigned-course visibility:** the assigned course appears and all permitted tabs open.
- **TCH-02 — Unassigned-course denial:** an unrelated course remains undiscoverable and inaccessible.
- **TCH-03 — Course management:** update permitted settings, sections, participants, content, and assignments and verify persistence.
- **TCH-04 — Own-bank lifecycle:** create, edit, publish, duplicate, vary, archive, restore, and reuse an activity in an owned bank.
- **TCH-05 — Foreign-bank boundary:** use permitted shared content without overwriting another teacher's bank.
- **TCH-06 — Exact section assignments:** assign an activity to selected sections and verify the saved checkbox/effective state.
- **TCH-07 — Attempt inspection:** inspect formative and summative attempts, including conversion semantics.
- **TCH-08 — Manual grading:** review the answer, edit rubric/feedback/final grade, save, and reopen the complete result.
- **TCH-09 — Guided AI grading:** select examples and instructions, run batch grading, and prove selected examples were not regraded.
- **TCH-10 — Grade completeness:** identify partial grades and block release while submitted work is partial or ungraded.
- **TCH-11 — Grade publication:** release complete grades and verify the correct learners can see them.
- **TCH-12 — Challenges:** review, answer, optionally notify, regrade through the shared dialog, resolve, and preserve history.
- **TCH-13 — Grade export:** CSV and XLSX contain correct identities and only complete final grades.
- **TCH-14 — No global administration:** deny global users, runners, plugins, email, and maintenance.
- **TCH-15 — Course-creation boundary:** if creation remains designer-only, deny teacher course creation in both UI and API.

### Section teacher and teaching assistant

- **SEC-01 — Scoped assignment:** assigning staff to Section 1 exposes that section without creating course-wide authority.
- **SEC-02 — Effective content:** section staff can view the effective content and assignments needed for their learners.
- **SEC-03 — Submission inspection:** section staff can inspect attempts for learners in the assigned section.
- **SEC-04 — Scoped grading:** permitted staff can grade an assigned learner and the course teacher sees the result and actor.
- **SEC-05 — Scoped challenges:** permitted staff can inspect and work with challenges only for assigned learners.
- **SEC-06 — Other-section isolation:** Section 2 rosters, attempts, grades, and challenges are denied in UI and API.
- **SEC-07 — Identifier-tampering denial:** substituting a Section 2 participant or attempt ID remains forbidden.
- **SEC-08 — Course-structure denial:** section staff cannot change course structure, settings, or course-wide staff.
- **SEC-09 — Bank/global denial:** section staff cannot modify banks, curriculum, users, runners, plugins, or global settings without a separate role.
- **SEC-10 — TA release denial:** a TA can save permitted grading work but cannot release or hide grades.
- **SEC-11 — Section-teacher release policy:** verify that a section teacher cannot release or hide grades while an explicit course teacher can.
- **SEC-12 — Partial removal:** removing one of several section assignments retains access to the remaining sections only.
- **SEC-13 — Final removal:** removing the final section assignment immediately removes section-derived access.

### Multiple course teachers

- **MT-01 — Add a second teacher:** assign an existing teacher explicitly at course level and verify that the course appears after sign-in.
- **MT-02 — Idempotent assignment:** adding the same teacher twice creates no duplicate membership or notification.
- **MT-03 — Independent sessions:** two teachers use the course concurrently from independent browser contexts.
- **MT-04 — Shared content changes:** Teacher B changes content; Teacher A sees it after reload; the audit identifies Teacher B.
- **MT-05 — Shared participant changes:** a section or roster change by one teacher is reflected for the other.
- **MT-06 — Shared grading:** Teacher B grades a learner; Teacher A sees the full result and history.
- **MT-07 — Sequential regrades:** both teachers change one grade sequentially; history retains both actors and snapshots.
- **MT-08 — Concurrent grade edits:** conflicting saves cannot silently discard one teacher's work.
- **MT-09 — Co-teacher publication:** an explicit course teacher can release grades according to the selected policy.
- **MT-10 — Cross-teacher challenge:** one teacher grades, the learner challenges, and another teacher answers or regrades without losing attribution.
- **MT-11 — Linked-bank isolation:** a co-teacher can edit the course copy but cannot publish to the owner's bank without bank permission.
- **MT-12 — Personal AI isolation:** Teacher B cannot read, select, update, or expose Teacher A's private connection credentials.
- **MT-13 — Safe settings update:** Teacher B can save unrelated course settings without clearing Teacher A's AI configuration.
- **MT-14 — Deterministic student AI routing:** multiple configured teachers produce the documented connection choice.
- **MT-15 — AI fallback/error:** a missing or disabled preferred connection follows the selected fallback policy without leaking secrets.
- **MT-16 — Mixed course and section roles:** a course teacher keeps course-wide access when removed from a section; a section-only teacher does not.
- **MT-17 — Explicit membership removal:** removing a course teacher removes the course from their list and rejects the next request.
- **MT-18 — Active-session revocation:** a removed teacher cannot continue through an already-open course page or direct API calls.
- **MT-19 — Academic-data preservation:** staff removal leaves attempts, grades, feedback, challenges, and audit history intact.
- **MT-20 — Creator departure:** deactivating or removing the creator leaves another owner able to manage the course.
- **MT-21 — No orphaned course:** removing the final owner is blocked until a replacement is assigned.
- **MT-22 — Explicit scope distinction:** a section teacher is section-scoped; an explicit course teacher is course-wide.

### Cross-role workflows

- **FLOW-01 — Course lifecycle:** designer creates the course; teacher authors and assigns; learner submits; TA grades; teacher releases; administrator audits.
- **FLOW-02 — Challenge lifecycle:** teacher releases; learner challenges; scoped staff reviews; course teacher regrades/resolves; learner sees the result and optional notification.
- **FLOW-03 — Staff transition:** original teacher creates and grades; second teacher takes over; original teacher is removed; course data and historical ownership remain correct.

## Executable Coverage Map

- `packages/core/src/authorization.test.ts`, `courses.test.ts`, `groups.test.ts`, `gradebook.test.ts`, and `ai-feedback-review.test.ts` cover the capability split, provenance, symmetric cleanup, actor events, release denial, and stale-write conflicts at the service boundary.
- `tests/e2e/access-control.spec.ts` covers RBAC-01..07, the global administrator/teacher/student boundaries, DES-06/DES-08, TCH-14, and the section-teacher/TA UI distinction.
- `tests/e2e/staff-authorization.spec.ts` uses independent accounts and two sections to cover SEC-01..13 and MT-01..22, including idempotent explicit assignment, independent sessions, shared roster/grade visibility, identifier substitution, section roster authority, TA release denial, sequential and stale concurrent grading, actor history, linked-bank and personal-connection isolation, safe settings preservation, deterministic AI fallback, partial/final revocation, academic-data preservation, creator departure, and final-owner protection.
- The existing administrator, account, course lifecycle/management, authoring, activity-bank, learning-flow, grading, challenge, export, runner, and graph specs cover ADM-01..08, DES-01..07, TCH-01..15, FLOW-01/02, and the feature mechanics composed by FLOW-03. Ownership and connection-isolation services additionally retain their focused unit/API tests.
- Closely related catalog entries are deliberately grouped in stateful scenarios so expensive setup is shared without weakening any durable/API/UI assertion. There are no expected-failure annotations for this model.

## Definition Of Done

- The target capability rules are explicit and documented.
- UI and API enforce the same scope.
- Section staff never acquire course-wide authority implicitly.
- Adding and removing multiple teachers is symmetric and immediately enforced.
- Multi-teacher edits and grade changes preserve actor history and never silently lose data.
- Bank and personal AI ownership remain isolated.
- Every scenario above is implemented and passing, or is retained as an expected failure linked to a tracked product defect.

The implementation meets these conditions. The authoritative current run counts belong in test output rather than this durable design document.
