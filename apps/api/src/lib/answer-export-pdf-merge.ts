import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage } from "pdf-lib";
import { AppError } from "@cognelo/core";

/** Imported prompt pages are embedded as page artwork, never copied with actions/scripts. */
export async function mergeAnswerPdfParts(parts: Array<{ bytes: Uint8Array; attachment?: boolean }>, title: string, options?: { attachmentWatermark?: string; attachmentNoticePdf?: Uint8Array }) {
  const output = await PDFDocument.create(); output.setTitle(title); output.setCreator("Cognelo");
  const watermarkFont = options?.attachmentWatermark ? await output.embedFont(StandardFonts.HelveticaBold) : null;
  const noticeDocument = options?.attachmentNoticePdf ? await PDFDocument.load(options.attachmentNoticePdf) : null;
  const notice = noticeDocument ? await output.embedPage(noticeDocument.getPage(0), { left: 0, right: 595.28, bottom: 0, top: 80 }) : null;
  const decorate = (page: PDFPage) => { if (notice) page.drawPage(notice, { x: 0, y: 0 }); watermark(page); };
  const watermark = (page: PDFPage) => {
    if (!watermarkFont || !options?.attachmentWatermark) return;
    const size = 68, width = watermarkFont.widthOfTextAtSize(options.attachmentWatermark, size), angle = 35 * Math.PI / 180;
    page.drawText(options.attachmentWatermark, { font: watermarkFont, size, x: (page.getWidth() - width * Math.cos(angle)) / 2, y: (page.getHeight() - width * Math.sin(angle)) / 2, rotate: degrees(35), opacity: 0.12, color: rgb(.4, .4, .4) });
  };
  for (const part of parts) {
    const input = await PDFDocument.load(part.bytes);
    if (input.getPageCount() > 200 || output.getPageCount() + input.getPageCount() > 2000) throw new AppError(413, "ANSWER_EXPORT_TOO_LARGE", "Select fewer students or use a smaller assignment PDF.");
    if (!part.attachment) {
      for (const page of await output.copyPages(input, input.getPageIndices())) output.addPage(page);
    } else {
      for (const source of input.getPages()) {
        const page = output.addPage([595.28, 841.89]);
        if (!source.node.Contents()) { decorate(page); continue; }
        const embedded = await output.embedPage(source);
        const rotation = ((source.getRotation().angle % 360) + 360) % 360;
        const sideways = rotation === 90 || rotation === 270;
        const width = sideways ? embedded.height : embedded.width, height = sideways ? embedded.width : embedded.height;
        const bottomInset = notice ? 90 : 30;
        const scale = Math.min((page.getWidth() - 50) / width, (page.getHeight() - bottomInset - 30) / height);
        const left = (page.getWidth() - width * scale) / 2, bottom = bottomInset + (page.getHeight() - bottomInset - 30 - height * scale) / 2;
        page.drawPage(embedded, { x: left + (rotation === 180 || rotation === 270 ? width * scale : 0),
          y: bottom + (rotation === 90 || rotation === 180 ? height * scale : 0), xScale: scale, yScale: scale, rotate: degrees(-rotation) });
        decorate(page);
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
