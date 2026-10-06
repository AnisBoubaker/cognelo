import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  activityGradeExportContentDisposition,
  createActivityGradeCsv,
  createActivityGradeXlsx,
  sanitizeExportFileName
} from "./activity-grade-export-file";

const rows = [
  { email: "ada@example.test", firstName: "Ada", lastName: "Lovelace", grade: 95.8 },
  { email: "formula@example.test", firstName: "=DANGEROUS()", lastName: "Doe, Jane", grade: 10 }
];

describe("activity grade export files", () => {
  it("writes the exact four CSV columns and protects spreadsheet formulas", () => {
    expect(createActivityGradeCsv(rows)).toBe(
      "\uFEFFemail,first name,last name,grade\r\n" +
      "ada@example.test,Ada,Lovelace,95.8\r\n" +
      "formula@example.test,'=DANGEROUS(),\"Doe, Jane\",10\r\n"
    );
  });

  it("writes a valid XLSX package with string identity cells and numeric grades", () => {
    const workbook = unzipSync(createActivityGradeXlsx(rows, new Date("2026-10-06T12:34:56.000Z")));
    const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]);
    const contentTypes = strFromU8(workbook["[Content_Types].xml"]);

    expect(contentTypes).toContain("spreadsheetml.sheet.main+xml");
    expect(sheet).toContain('<dimension ref="A1:D3"/>');
    expect(sheet).toContain('<autoFilter ref="A1:D3"/>');
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">email</t></is></c>');
    expect(sheet).toContain('<c r="D2" s="2"><v>95.8</v></c>');
    expect(sheet).toContain("=DANGEROUS()");
    expect(sheet).toContain("Doe, Jane");
  });

  it("sanitizes filenames and emits UTF-8 and ASCII download names", () => {
    expect(sanitizeExportFileName('Cours: algèbre/Gr01')).toBe("Cours- algèbre-Gr01");
    expect(activityGradeExportContentDisposition("Résultats", "xlsx")).toBe(
      "attachment; filename=\"R_sultats.xlsx\"; filename*=UTF-8''R%C3%A9sultats.xlsx"
    );
  });
});
