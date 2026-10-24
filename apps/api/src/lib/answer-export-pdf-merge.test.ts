import { expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { mergeAnswerPdfParts } from "./answer-export-pdf-merge";
it("keeps prompt pages with the attempt and drops original document scripts", async () => {
  const answer = await PDFDocument.create(); answer.addPage().drawText("Student answer");
  const prompt = await PDFDocument.create(); prompt.addPage([800, 500]).drawText("Assignment diagram"); prompt.addJavaScript("unsafe", "app.alert('never execute')");
  const result = await PDFDocument.load(await mergeAnswerPdfParts([{ bytes: await answer.save() }, { bytes: await prompt.save(), attachment: true }], "Exam"));
  expect(result.getPageCount()).toBe(2);
  expect(result.getTitle()).toBe("Exam");
  expect(result.catalog.get(PDFName.of("Names"))).toBeUndefined();
  expect(result.getPage(1).getSize()).toEqual({ width: 595.28, height: 841.89 });
});
