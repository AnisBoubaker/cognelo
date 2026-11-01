import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AppError } from "./errors";

/** Shared bounded PDF utility; the material plugin decides when/how to extract and index. */
export async function extractMaterialPdfText(bytes: Buffer, signal?: AbortSignal) {
  if (bytes.length > 25 * 1024 * 1024 || !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new AppError(422, "MATERIAL_PDF_INVALID", "The PDF is invalid or too large.");
  const directory = await mkdtemp(path.join(tmpdir(), "cognelo-pdf-"));
  try {
    const filename = path.join(directory, "input.pdf");
    await writeFile(filename, bytes, { mode: 0o600 });
    const text = await new Promise<string>((resolve, reject) => {
      execFile("pdftotext", ["-enc", "UTF-8", "-layout", filename, "-"], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024, signal }, (error, stdout) => {
        if (error) reject(new AppError(422, "MATERIAL_PDF_EXTRACTION_FAILED", "PDF text extraction failed. The server requires Poppler pdftotext and a readable, unencrypted PDF."));
        else resolve(stdout.trim());
      });
    });
    if (!text) throw new AppError(422, "MATERIAL_PDF_TEXT_MISSING", "This PDF has no extractable text. Upload a text-based PDF; scanned pages need OCR first.");
    return text;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
