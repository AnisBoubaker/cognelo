import { expect, it } from "vitest";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from "pdf-lib";
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
it("watermarks appended artwork without copying executable PDF actions", async () => {
  const prompt = await PDFDocument.create(); prompt.addPage().drawText("Assignment"); prompt.addPage(); prompt.addJavaScript("unsafe", "app.alert('blocked')");
  const result = await PDFDocument.load(await mergeAnswerPdfParts([{ bytes: await prompt.save(), attachment: true }], "Course", { attachmentWatermark: "Confidential" }));
  for (const page of result.getPages()) {
    const content = page.node.Contents(), refs = content instanceof PDFArray ? content.asArray() : [content];
    const operations = refs.map(ref => result.context.lookup(ref)).filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
      .map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString()).join("\n");
    expect(operations).toContain(Buffer.from("Confidential").toString("hex").toUpperCase());
  }
  expect(result.catalog.get(PDFName.of("Names"))).toBeUndefined();
});
