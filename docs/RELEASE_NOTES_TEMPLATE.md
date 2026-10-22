# Release notes template

Use only the sections below. Keep bullets short. Omit **Environment variables** entirely when none changed. Do not include approvals, names, dates, rehearsal/validation reports, deployment narratives, or additional sections. Keep operational checklists in private operator notes.

## Highlights

- Brief user-facing changes.

## Fixed

- Brief fixes, or “None.”

## Database migrations

No.

If migrations are required, replace “No.” with “Yes.” and the command supported by that release, normally:

```bash
npm run db:migrate:all
```

## Environment variables

- Only variables added, changed, renamed, or removed, with the required action.
