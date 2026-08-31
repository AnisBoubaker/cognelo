import { describe, expect, it } from "vitest";
import { parseParticipantCsv } from "./participant-csv";

describe("participant CSV import", () => {
  it("parses the fixed headerless student format with an optional fourth column", () => {
    const result = parseParticipantCsv([
      "Ada,Lovelace,ADA@example.org,ets-1",
      "Grace,Hopper,grace@example.org,"
    ].join("\r\n"));

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      { line: 1, firstName: "Ada", lastName: "Lovelace", email: "ada@example.org", assignedPassword: null, externalId: "ets-1" },
      { line: 2, firstName: "Grace", lastName: "Hopper", email: "grace@example.org", assignedPassword: null, externalId: null }
    ]);
  });

  it("accepts three columns when the optional external ID is omitted", () => {
    const result = parseParticipantCsv([
      "Ada,Lovelace,ada@example.org",
      "Grace,Hopper,grace@example.org,"
    ].join("\n"));

    expect(result.issues).toEqual([]);
    expect(result.rows.map((row) => row.externalId)).toEqual([null, null]);
  });

  it("supports standard CSV quoting without changing the fixed columns", () => {
    const result = parseParticipantCsv('"Marie, Ève",Tremblay,marie@example.org,"12""3"');

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ firstName: "Marie, Ève", externalId: '12"3' });
  });

  it("parses four mandatory columns and an optional external ID when assigned passwords are enabled", () => {
    const result = parseParticipantCsv([
      "Anonymous,One,anonymous-1@example.invalid,Password-001",
      "Anonymous,Two,anonymous-2@example.invalid,Password-002,student-2"
    ].join("\n"), { includesAssignedPasswords: true });

    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      {
        line: 1,
        firstName: "Anonymous",
        lastName: "One",
        email: "anonymous-1@example.invalid",
        assignedPassword: "Password-001",
        externalId: null
      },
      {
        line: 2,
        firstName: "Anonymous",
        lastName: "Two",
        email: "anonymous-2@example.invalid",
        assignedPassword: "Password-002",
        externalId: "student-2"
      }
    ]);
  });

  it("does not guess whether a fourth column is a password or external ID", () => {
    expect(parseParticipantCsv("Ada,Lovelace,ada@example.org", { includesAssignedPasswords: true }).issues).toEqual([
      { code: "invalid_column_count", line: 1, value: "3", expected: "4 or 5" }
    ]);
    expect(parseParticipantCsv("Ada,Lovelace,ada@example.org,Password-001,ets-1").issues).toEqual([
      { code: "invalid_column_count", line: 1, value: "5", expected: "3 or 4" }
    ]);
  });

  it("requires assigned passwords of at least eight characters", () => {
    const result = parseParticipantCsv([
      "Ada,Lovelace,ada@example.org,",
      "Grace,Hopper,grace@example.org,short"
    ].join("\n"), { includesAssignedPasswords: true });

    expect(result.issues).toEqual([
      expect.objectContaining({ code: "missing_value", line: 1, field: "assignedPassword" }),
      expect.objectContaining({ code: "password_too_short", line: 2, field: "assignedPassword", value: "8" })
    ]);
    expect(result.rows).toEqual([]);
  });

  it("rejects header rows and alternate delimiters instead of guessing", () => {
    const header = parseParticipantCsv("firstName,lastName,email,externalId\nAda,Lovelace,ada@example.org,1");
    expect(header.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid_email", line: 1 })]));

    const semicolon = parseParticipantCsv("Ada;Lovelace;ada@example.org;1");
    expect(semicolon.issues).toEqual([{ code: "invalid_column_count", line: 1, value: "1", expected: "3 or 4" }]);
  });

  it("reports invalid rows and duplicate emails with source line numbers", () => {
    const result = parseParticipantCsv([
      "Ada,Lovelace,not-an-email,1",
      "Grace,Hopper,grace@example.org,2",
      "Duplicate,Student,grace@example.org,3",
      "Missing,,missing@example.org,4"
    ].join("\n"));

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid_email", line: 1 }),
      expect.objectContaining({ code: "duplicate_email", line: 3 }),
      expect.objectContaining({ code: "missing_value", line: 4, field: "lastName" })
    ]));
  });

  it("validates the email in every row", () => {
    const result = parseParticipantCsv([
      "Ada,Lovelace,ada.example.org",
      "Grace,Hopper,grace@",
      "Alan,Turing,alan@example.org"
    ].join("\n"));

    expect(result.issues).toEqual([
      expect.objectContaining({ code: "invalid_email", line: 1, value: "ada.example.org" }),
      expect.objectContaining({ code: "invalid_email", line: 2, value: "grace@" })
    ]);
    expect(result.rows).toEqual([
      expect.objectContaining({ line: 3, email: "alan@example.org" })
    ]);
  });

  it("handles a UTF-8 BOM and rejects malformed quoting", () => {
    expect(parseParticipantCsv('\uFEFF"A""da",Lovelace,ada@example.org,1').rows[0]?.firstName).toBe('A"da');
    expect(parseParticipantCsv('"Ada,Lovelace,ada@example.org,1').issues).toEqual([{ code: "unclosed_quote", line: 1 }]);
    expect(parseParticipantCsv('"Ada"x,Lovelace,ada@example.org,1').issues).toEqual([{ code: "malformed_csv", line: 1 }]);
  });
});
