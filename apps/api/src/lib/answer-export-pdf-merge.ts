import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { AppError } from "@cognelo/core";

/** Imported prompt pages are embedded as page artwork, never copied with actions/scripts. */
export async function mergeAnswerPdfParts(parts: Array<{ bytes: Uint8Array; attachment?: boolean }>, title: string) {
  const output = await PDFDocument.create(); output.setTitle(title); output.setCreator("Cognelo");
  for (const part of parts) {
    const input = await PDFDocument.load(part.bytes);
    if (input.getPageCount() > 200 || output.getPageCount() + input.getPageCount() > 2000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or use a smaller assignment PDF.");
    if (!part.attachment) {
      for (const page of await output.copyPages(input, input.getPageIndices())) output.addPage(page);
    } else {
      for (const source of input.getPages()) {
        const embedded = await output.embedPage(source);
        const page = output.addPage([595.28, 841.89]);
        const rotation = ((source.getRotation().angle % 360) + 360) % 360;
        const sideways = rotation === 90 || rotation === 270;
        const width = sideways ? embedded.height : embedded.width, height = sideways ? embedded.width : embedded.height;
        const scale = Math.min((page.getWidth() - 50) / width, (page.getHeight() - 60) / height);
        const left = (page.getWidth() - width * scale) / 2, bottom = (page.getHeight() - height * scale) / 2;
        page.drawPage(embedded, { x: left + (rotation === 180 || rotation === 270 ? width * scale : 0),
          y: bottom + (rotation === 90 || rotation === 180 ? height * scale : 0), xScale: scale, yScale: scale, rotate: degrees(-rotation) });
      }
    }
  }
  const font = await output.embedFont(StandardFonts.Helvetica);
  for (const [index, page] of output.getPages().entries()) {
    const text = `${index + 1} / ${output.getPageCount()}`;
    page.drawText(text, { font, size: 8, x: (page.getWidth() - font.widthOfTextAtSize(text, 8)) / 2, y: 14, color: rgb(.4, .44, .5) });
  }
  return output.save();
}
