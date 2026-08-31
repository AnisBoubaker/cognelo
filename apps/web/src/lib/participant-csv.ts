import { z } from "zod";

export type ParticipantCsvRow = {
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  externalId: string | null;
};

export type ParticipantCsvIssue = {
  code:
    | "duplicate_email"
    | "empty_file"
    | "file_too_large"
    | "invalid_column_count"
    | "invalid_email"
    | "malformed_csv"
    | "missing_value"
    | "too_long"
    | "too_many_rows"
    | "unclosed_quote";
  line?: number;
  field?: "firstName" | "lastName" | "email" | "externalId";
  value?: string;
};

export type ParticipantCsvResult = {
  rows: ParticipantCsvRow[];
  issues: ParticipantCsvIssue[];
};

const MAX_ROWS = 500;
const ALLOWED_COLUMN_COUNTS = new Set([3, 4]);
const EmailSchema = z.string().email();

export function parseParticipantCsv(source: string): ParticipantCsvResult {
  const text = source.replace(/^\uFEFF/, "");
  if (!text.trim()) return { rows: [], issues: [{ code: "empty_file" }] };

  const parsed = parseRecords(text);
  if (parsed.issue) return { rows: [], issues: [parsed.issue] };

  const records = parsed.records.filter((record) => record.values.some((value) => value.trim()));
  if (!records.length) return { rows: [], issues: [{ code: "empty_file" }] };

  const issues: ParticipantCsvIssue[] = [];
  if (records.length > MAX_ROWS) issues.push({ code: "too_many_rows", value: String(MAX_ROWS) });

  const rows: ParticipantCsvRow[] = [];
  const seenEmails = new Set<string>();
  for (const record of records.slice(0, MAX_ROWS)) {
    if (!ALLOWED_COLUMN_COUNTS.has(record.values.length)) {
      issues.push({ code: "invalid_column_count", line: record.line, value: String(record.values.length) });
      continue;
    }

    const [rawFirstName, rawLastName, rawEmail, rawExternalId] = record.values;
    const firstName = rawFirstName.trim();
    const lastName = rawLastName.trim();
    const email = rawEmail.trim().toLowerCase();
    const externalId = (rawExternalId ?? "").trim() || null;
    let rowIsValid = true;

    for (const [field, value] of [["firstName", firstName], ["lastName", lastName], ["email", email]] as const) {
      if (!value) {
        issues.push({ code: "missing_value", line: record.line, field });
        rowIsValid = false;
      }
    }
    for (const [field, value, max] of [["firstName", firstName, 120], ["lastName", lastName, 120], ["email", email, 320], ["externalId", externalId ?? "", 120]] as const) {
      if (value.length > max) {
        issues.push({ code: "too_long", line: record.line, field, value: String(max) });
        rowIsValid = false;
      }
    }
    if (email && !isValidEmail(email)) {
      issues.push({ code: "invalid_email", line: record.line, field: "email", value: email });
      rowIsValid = false;
    }
    if (email && seenEmails.has(email)) {
      issues.push({ code: "duplicate_email", line: record.line, field: "email", value: email });
      rowIsValid = false;
    }
    if (email) seenEmails.add(email);

    if (rowIsValid) rows.push({ line: record.line, firstName, lastName, email, externalId });
  }

  return { rows, issues };
}

function isValidEmail(value: string) {
  return EmailSchema.safeParse(value).success;
}

type CsvRecord = { line: number; values: string[] };

function parseRecords(text: string): { records: CsvRecord[]; issue?: ParticipantCsvIssue } {
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        value += char;
        if (char === "\n") line += 1;
      }
      continue;
    }

    if (closedQuote && char !== "," && char !== "\n" && char !== "\r") {
      if (/\s/.test(char)) continue;
      return { records: [], issue: { code: "malformed_csv", line: recordLine } };
    }
    if (char === '"') {
      if (value.trim()) return { records: [], issue: { code: "malformed_csv", line: recordLine } };
      value = "";
      quoted = true;
      closedQuote = false;
    } else if (char === ",") {
      values.push(value);
      value = "";
      closedQuote = false;
    } else if (char === "\n" || char === "\r") {
      values.push(value);
      records.push({ line: recordLine, values });
      values = [];
      value = "";
      closedQuote = false;
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      recordLine = line;
    } else {
      value += char;
    }
  }

  if (quoted) return { records: [], issue: { code: "unclosed_quote", line: recordLine } };
  if (value || values.length || closedQuote) {
    values.push(value);
    records.push({ line: recordLine, values });
  }
  return { records };
}
