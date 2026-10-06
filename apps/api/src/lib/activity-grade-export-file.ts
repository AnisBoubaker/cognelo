import { strToU8, zipSync } from "fflate";
import type { ActivityGradeExportRow } from "./activity-grade-export";

export type ActivityGradeExportFormat = "csv" | "xlsx";

const headers = ["email", "first name", "last name", "grade"] as const;

export function createActivityGradeCsv(rows: ActivityGradeExportRow[]) {
  const values: Array<Array<string | number>> = [
    [...headers],
    ...rows.map((row) => [row.email, row.firstName, row.lastName, row.grade])
  ];
  return `\uFEFF${values.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function createActivityGradeXlsx(rows: ActivityGradeExportRow[], createdAt = new Date()) {
  const rowCount = rows.length + 1;
  const sheetRows = [
    worksheetRow(1, headers, true),
    ...rows.map((row, index) => worksheetRow(index + 2, [row.email, row.firstName, row.lastName, row.grade]))
  ].join("");
  const created = createdAt.toISOString();

  return zipSync({
    "[Content_Types].xml": xmlFile(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
        <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
      </Types>`),
    "_rels/.rels": xmlFile(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
        <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
      </Relationships>`),
    "docProps/core.xml": xmlFile(`
      <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <dc:creator>Cognelo</dc:creator>
        <cp:lastModifiedBy>Cognelo</cp:lastModifiedBy>
        <dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created>
        <dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified>
      </cp:coreProperties>`),
    "docProps/app.xml": xmlFile(`
      <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
        <Application>Cognelo</Application>
      </Properties>`),
    "xl/workbook.xml": xmlFile(`
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Grades" sheetId="1" r:id="rId1"/></sheets>
      </workbook>`),
    "xl/_rels/workbook.xml.rels": xmlFile(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>`),
    "xl/styles.xml": xmlFile(`
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="2">
          <font><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
          <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
        </fonts>
        <fills count="3">
          <fill><patternFill patternType="none"/></fill>
          <fill><patternFill patternType="gray125"/></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF2547B8"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="3">
          <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
          <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
          <xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
        </cellXfs>
        <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
      </styleSheet>`),
    "xl/worksheets/sheet1.xml": xmlFile(`
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <dimension ref="A1:D${rowCount}"/>
        <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
        <sheetFormatPr defaultRowHeight="15"/>
        <cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="3" width="22" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/></cols>
        <sheetData>${sheetRows}</sheetData>
        <autoFilter ref="A1:D${rowCount}"/>
      </worksheet>`)
  }, { level: 6 });
}

export function sanitizeExportFileName(value: string, fallback = "grades") {
  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 160);
  return sanitized || fallback;
}

export function activityGradeExportContentDisposition(fileName: string, format: ActivityGradeExportFormat) {
  const baseName = sanitizeExportFileName(fileName);
  const fullName = `${baseName}.${format}`;
  const asciiName = fullName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(fullName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

function csvCell(value: string | number) {
  if (typeof value === "number") return String(value);
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safeValue) ? `"${safeValue.replace(/"/g, '""')}"` : safeValue;
}

function worksheetRow(rowNumber: number, values: readonly (string | number)[], header = false) {
  const cells = values.map((value, index) => {
    const reference = `${String.fromCharCode(65 + index)}${rowNumber}`;
    if (typeof value === "number") {
      return `<c r="${reference}" s="2"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
    }
    return `<c r="${reference}" t="inlineStr"${header ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }).join("");
  return `<row r="${rowNumber}"${header ? ' ht="22" customHeight="1"' : ""}>${cells}</row>`;
}

function xmlFile(xml: string) {
  return strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml.replace(/>\s+</g, "><").trim()}`);
}

function xmlEscape(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
