import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "@cognelo/core";
import { prisma, type Prisma } from "./db-client";
import type { CodingHomeworkSourceFile } from "./algorithm";
import { parseCodingHomeworkSourceFiles, tokenizeCSourceIdentity } from "./parsers";
import { readCodingHomeworkZip } from "./zip";
import { readProvidedAttachmentChunks } from "./attachment-storage";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const baselineSchema = z.object({ version: z.literal(1), sourceVersion: hash,
  files: z.array(hash).max(1000), functions: z.array(z.object({ name: z.string().min(1).max(160), hash })).max(2000) });
export type ProvidedCodeBaseline = z.infer<typeof baselineSchema>;
const cache = new Map<string, Promise<ProvidedCodeBaseline>>();
export function cSourceFingerprint(code: string) { return createHash("sha256").update(JSON.stringify(tokenizeCSourceIdentity(code))).digest("hex"); }
export function readProvidedCodeBaseline(value: unknown): ProvidedCodeBaseline | null {
  if (value === undefined || value === null) return null;
  const parsed = baselineSchema.safeParse(value);
  if (!parsed.success) throw new AppError(409, "HOMEWORK_PROVIDED_BASELINE_INVALID", "The saved provided-code comparison is invalid. Ask your teacher to review this submission.");
  return parsed.data;
}
export function selectLearnerFunctions<T extends { functionName: string; functionCode: string }>(functions: T[], baseline: ProvidedCodeBaseline) {
  const fingerprints = new Set(baseline.functions.map(fn => fn.hash));
  const eligible: T[] = [], excluded: T[] = [];
  for (const fn of functions) (fingerprints.has(cSourceFingerprint(fn.functionCode)) ? excluded : eligible).push(fn);
  return { eligible, excluded };
}
function functionMention(question: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Distinctive identifiers can be recognized in prose. Common names such as
  // "main" need code/call or explicit function context, not "main control flow".
  if (/[_0-9]|[a-z][A-Z]/.test(name)) return new RegExp(`\\b${escaped}\\b`, "i").exec(question)?.index ?? -1;
  return new RegExp(`(?:\\b${escaped}\\s*\\(|\\x60${escaped}\\x60|(?:function|fonction|函数|دالة|الدالة)\\s+${escaped}\\b|\\b${escaped}\\s+(?:function|fonction|函数|دالة)|\\b(?:in|inside|within|dans)\\s+(?:(?:your|the|votre|la)\\s+)?${escaped}\\b)`, "i").exec(question)?.index ?? -1;
}
export function excludesProvidedFunction(question: string, names: string[], targetFunction?: string | null) {
  const targetPosition = targetFunction ? functionMention(question, targetFunction) : -1;
  // A helper name is legitimate when the question first anchors itself in the
  // eligible student's function. Mentioning a helper is not questioning its body.
  return names.some(name => {
    const providedPosition = functionMention(question, name);
    return providedPosition >= 0 && (targetPosition < 0 || providedPosition < targetPosition);
  });
}
export function unchangedProvidedFunctionNames(baseline: ProvidedCodeBaseline, eligible: Array<{ functionName: string }>) {
  const eligibleNames = new Set(eligible.map(fn => fn.functionName));
  return [...new Set(baseline.functions.map(fn => fn.name))].filter(name => !eligibleNames.has(name));
}
export async function baselineFromSources(sources: CodingHomeworkSourceFile[], sourceVersion: string): Promise<ProvidedCodeBaseline> {
  const parsed = await parseCodingHomeworkSourceFiles(sources);
  if (parsed.diagnostics.some(issue => ["SOURCE_ANALYSIS_LIMIT", "FUNCTION_ANALYSIS_LIMIT"].includes(issue.code))) throw new AppError(413, "HOMEWORK_PROVIDED_SOURCE_LIMIT", "Provided C source exceeds the supported comparison limits. Reduce the provided source before opening submissions.");
  return { version: 1, sourceVersion, files: [...new Set(sources.map(file => cSourceFingerprint(file.content)))],
    functions: [...new Map(parsed.functions.map(fn => { const hash = cSourceFingerprint(fn.functionCode); return [hash, { name: fn.functionName, hash }] as const; })).values()] };
}
function sourcePath(path: string) { return /\.(c|h)$/i.test(path) && !path.split(/[\\/]/).some(part => part === "__MACOSX" || part.startsWith("._")); }
function decodeSource(bytes: Buffer, path: string) {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new AppError(409, "HOMEWORK_PROVIDED_SOURCE_INVALID", `Provided source ${path} must use UTF-8 or BOM-marked UTF-16.`); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new AppError(409, "HOMEWORK_PROVIDED_SOURCE_INVALID", `Provided source ${path} contains binary data.`);
  return text;
}

/** Only explicitly provided activity attachments participate, never the private teacher solution or course references. */
export async function snapshotProvidedCode(activityId: string, database: Pick<Prisma.TransactionClient, "pluginCodingHomeworkAttachment"> = prisma): Promise<ProvidedCodeBaseline> {
  const attachments = await database.pluginCodingHomeworkAttachment.findMany({ where: { ownerKind: "course_activity", ownerId: activityId, kind: "provided_file" }, orderBy: { id: "asc" }, take: 1001 });
  if (attachments.length > 1000) throw new AppError(413, "HOMEWORK_PROVIDED_SOURCE_LIMIT", "Too many provided files to compare safely.");
  const sourceVersion = createHash("sha256").update(JSON.stringify([activityId, attachments.map(file => [file.id, file.sha256, file.originalName, file.mimeType])])).digest("hex");
  const existing = cache.get(sourceVersion); if (existing) return existing;
  const pending = (async () => {
    const sources: CodingHomeworkSourceFile[] = [];
    let totalCharacters = 0, totalBytes = 0n;
    const add = (path: string, bytes: Buffer) => {
      const content = decodeSource(bytes, path); totalCharacters += content.length;
      if (totalCharacters > 2_000_000 || sources.length >= 1000) throw new AppError(413, "HOMEWORK_PROVIDED_SOURCE_LIMIT", "Provided C source exceeds the supported comparison limits.");
      sources.push({ path, content, languageKey: "c" });
    };
    for (const attachment of attachments) {
      const zip = /\.zip$/i.test(attachment.originalName) || ["application/zip", "application/x-zip-compressed"].includes(attachment.mimeType ?? "");
      if (!zip && !sourcePath(attachment.originalName)) continue;
      totalBytes += attachment.sizeBytes;
      if (totalBytes > 256n * 1024n * 1024n) throw new AppError(413, "HOMEWORK_PROVIDED_SOURCE_LIMIT", "The provided archives exceed the supported comparison limits.");
      const chunks: Buffer[] = []; for await (const chunk of readProvidedAttachmentChunks(attachment)) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      if (!zip) { add(attachment.originalName, bytes); continue; }
      const archive = readCodingHomeworkZip(bytes, { includeContent: sourcePath });
      if (archive.diagnostics.some(issue => issue.severity === "error")) throw new AppError(409, "HOMEWORK_PROVIDED_SOURCE_INVALID", `Provided archive ${attachment.originalName} cannot be read safely.`, { diagnostics: archive.diagnostics });
      for (const entry of archive.entries) if (!entry.isDirectory && entry.content && sourcePath(entry.path)) add(entry.path, entry.content);
    }
    return baselineFromSources(sources, sourceVersion);
  })().catch(error => { cache.delete(sourceVersion); throw error; });
  cache.set(sourceVersion, pending);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
  return pending;
}
