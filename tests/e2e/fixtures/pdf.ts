import { deflateSync } from "node:zlib";

/** Small synthetic text PDF; no private binary fixture is committed. */
export function textPdf(text: string) {
  const stream = deflateSync(Buffer.from(`BT /F1 14 Tf 50 740 Td (${text}) Tj ET`));
  const objects = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'), Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'), Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'), Buffer.concat([Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`), stream, Buffer.from('\nendstream')])];
  const chunks = [Buffer.from('%PDF-1.4\n')], offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(chunks.reduce((sum, chunk) => sum + chunk.length, 0)); chunks.push(Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')); }
  const xref = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return Buffer.concat(chunks);
}
