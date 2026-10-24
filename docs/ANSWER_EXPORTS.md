# Student answer exports

Teachers open **Export student answers** from the activity report header (Class overview or Student results), or **Export answer as PDF** from a student's result-row menu. The individual dialog selects the exact submitted attempt, defaulting to the latest. Both dialogs offer **Include the prompt with each answer** (on by default) and **Include grades, rubric scores, comments and test results** (off by default).

Bulk export lists only students with submitted or graded attempts within the authorized course/section scope. Check all / Uncheck all and individual checkboxes control the selection. Teachers choose the latest submitted attempt (default) or all submitted attempts, and either one combined PDF or a ZIP containing one PDF per selected student enrollment. Multiple attempts for a student stay together in that student's PDF. Each attempt starts a new page. Filenames include a sequence number to avoid collisions between duplicate names. Started and deleted attempts never qualify; invalid, foreign, or concurrently removed selections fail instead of silently exporting a different student's work.

Exporting reads stored answers and the latest recorded grading evidence; it never reruns tests, calls AI, starts/submits attempts, marks messages read, or changes grades. Ungraded submissions remain exportable and are labelled ungraded when grading is included. Each attempt's recorded grade is labelled separately from the current gradebook grade, so teacher overrides and best/weighted-average selections are not attributed to an unrelated historical attempt. Teacher override comments accompany the current gradebook grade. Enabling grading includes recorded results and human-facing feedback, not raw model requests, provider credentials, internal provenance, or grading instructions. Disabling it suppresses all score/result/rubric/comment and correctness content.

## Content and boundaries

`grading.supportsAnswerExport` advertises the capability. A server plugin registers `submissionExport.getContent`, scoped by activity type, to project its own submitted work into Markdown, code, and tables. Core authorizes and selects students/attempts; the API owns document layout and downloads. Core never queries plugin tables or guesses their payload formats.

- MCQ: selected choices; optional question text and available choices; optional answer key and saved feedback. Question numbers remain when prompts are omitted.
- Programming Exercises: submitted source, latest saved automatic-test results, rubric scores and saved feedback. No Judge0 or model call occurs.
- Parsons: submitted block order and indentation, optional prompt and saved feedback. No reevaluation occurs.
- Web Design: submitted files rendered as escaped source, plus optional saved Playwright results and comments. Student HTML/JavaScript is never executed.
- Programming Homework: stored text/source files and challenge answers, optional assignment Markdown/question text, appended assignment-PDF pages, and teacher comments. Binary attachments are identified by filename/size rather than executed or converted into source. The PDF is not a replacement for downloading original uploaded attachments.
- Compound Tests: the submitted manifest determines item membership/order; stored child responses and submission-time revision prompts/config are used where available. Child exports use the same plugin contracts. Recovered, submitted-ungraded saved responses remain exportable.

Standalone activities without a stored prompt snapshot use their current authored prompt, matching teacher review. A missing or inaccessible image is visibly identified in the PDF. Markdown tables, code, inline/display formulas, and authorized uploaded images render in the document. Public remote raster images are fetched without session headers, with DNS-pinned public IPv4 checks, revalidated redirects, and byte/time limits. The renderer itself is offline and denies network requests and scripts. Raw submitted HTML is escaped. Uploaded homework assignment PDFs, when prompts are enabled, follow the associated attempt; their page artwork is embedded into clean pages without copying document scripts/actions.

`GET /api/courses/:courseId/gradebook/activities/:activityId/answers-export` returns eligible student/attempt metadata. `POST` accepts the shared `AnswerExportRequestSchema` and returns PDF or ZIP with `Cache-Control: no-store`. Both routes enforce course/section grading access; a learner cannot use them. POST revalidates every selected participant and exact attempt. Files are generated in memory and returned only to the requesting teacher; there is no stored public export URL. The UI uses the shared blocking progress dialog and restores options on a failed export.

Exports are bounded to 500 selected enrollments, 1,000 attempts, two concurrent Chromium renders per API process, 100 unique images, and bounded HTML/archive/image sizes. Larger selections fail with guidance to select fewer students; no answer is silently truncated.

## Runtime installation

The API uses pinned Playwright Chromium for **trusted, escaped, script-disabled print HTML**. This runs in the API environment and is separate from the Web Design execution runner. Install the API's Chromium before using this feature on a new machine:

```bash
npm run pdf:install-browser
```

On Linux, install system dependencies as root and the browser as the application service account. Use a shared browser-cache directory accessible to that account, and set the same `PLAYWRIGHT_BROWSERS_PATH` in its service environment:

```bash
sudo npx playwright install-deps chromium
sudo apt-get install -y fonts-noto-core fonts-noto-cjk
sudo install -d -m 0750 -o instance1 -g instance1 /srv/cognelo/instance1/shared/browsers
sudo -u instance1 env PLAYWRIGHT_BROWSERS_PATH=/srv/cognelo/instance1/shared/browsers npm run pdf:install-browser
```

Run those commands from the checked-out release directory. Refresh the cached browser when the pinned Playwright version changes. The fonts provide multilingual PDF text, including Arabic and Chinese. KaTeX fonts are embedded from the locked package; printing does not require a CDN.

Alternatively, `PDF_CHROMIUM_EXECUTABLE_PATH` can select an already-installed compatible Chrome/Chromium executable. Local browser testing's `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` is also honored, so development can use its configured Chrome. No database migration is required.

## Verification

Core tests cover grading scope, submitted-only selection, latest/all/exact attempts, changed selections, grade suppression, and Test revision/order preservation. Renderer tests cover escaped content, option isolation, filenames, and denied private image targets. E2E scenarios download real PDF/ZIP files from bulk and individual actions, check access denial and selection behavior, and verify exports do not mutate attempts. PDFs are rendered with Poppler for visual review of code wrapping, tables, formulas, page breaks, and footers.
