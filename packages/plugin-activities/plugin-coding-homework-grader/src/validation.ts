import type {
  CodingHomeworkFunctionRequirement,
  CodingHomeworkSourceFile,
  CodingHomeworkStructureValidationSummary,
  CodingHomeworkValidationIssue
} from "./algorithm";
import { codingHomeworkSubmissionRequirementsSchema, type CodingHomeworkSubmissionRequirements } from "./authoring";
import { parseCodingHomeworkSourceFiles } from "./parsers";
import type { CodingHomeworkZipEntry } from "./zip";

export type CodingHomeworkArchiveValidationInput = {
  archiveSizeBytes: number;
  entries: CodingHomeworkZipEntry[];
  requirements: unknown;
  zipDiagnostics?: Array<{
    code: string;
    message: string;
    path?: string;
    severity: "error" | "warning";
  }>;
};

export type CodingHomeworkPreflightValidationSummary = CodingHomeworkStructureValidationSummary & {
  ignoredFiles: string[];
  missingRequired: CodingHomeworkValidationIssue[];
  parserDiagnostics: CodingHomeworkValidationIssue[];
  unexpectedItems: CodingHomeworkValidationIssue[];
  validFiles: string[];
  validFunctions: Array<{
    filePath: string;
    functionName: string;
  }>;
};

export async function validateCodingHomeworkArchive(input: CodingHomeworkArchiveValidationInput): Promise<CodingHomeworkPreflightValidationSummary> {
  const requirements = codingHomeworkSubmissionRequirementsSchema.parse(input.requirements ?? {});
  const allIssues: CodingHomeworkValidationIssue[] = [];
  const zipIssues = (input.zipDiagnostics ?? []).map(toValidationIssue);
  allIssues.push(...zipIssues);

  if (input.archiveSizeBytes > requirements.maxArchiveBytes) {
    allIssues.push({
      code: "archive_too_large",
      message: `Archive exceeds the configured maximum size of ${requirements.maxArchiveBytes} bytes.`,
      severity: "error"
    });
  }

  const fileEntries = input.entries.filter((entry) => !entry.isDirectory && entry.content);
  const directoryPaths = collectDirectoryPaths(input.entries);
  const ignoredFiles = fileEntries.filter((entry) => isIgnored(entry.path, requirements.ignoredPaths)).map((entry) => entry.path);
  const activeFiles = fileEntries.filter((entry) => !isIgnored(entry.path, requirements.ignoredPaths));
  const activeFilePaths = new Set(activeFiles.map((entry) => entry.path));

  if (activeFiles.length > requirements.maxFileCount) {
    allIssues.push({
      code: "file_count_exceeded",
      message: `Archive contains ${activeFiles.length} files, which exceeds the configured maximum of ${requirements.maxFileCount}.`,
      severity: "error"
    });
  }

  for (const file of activeFiles) {
    if (!isAllowedExtension(file.path, requirements.allowedExtensions)) {
      allIssues.push({
        code: "unsupported_extension",
        message: `File extension is not allowed for ${file.path}.`,
        path: file.path,
        severity: "error"
      });
    }
  }

  for (const requirement of requirements.requiredFiles ?? []) {
    if (!activeFilePaths.has(normalizeRequirementPath(requirement.path))) {
      allIssues.push({
        code: "missing_file",
        message: `Required file is missing: ${requirement.path}.`,
        path: requirement.path,
        severity: "error"
      });
    }
  }

  for (const requirement of requirements.requiredFolders ?? []) {
    const path = normalizeRequirementPath(requirement.path);
    if (!directoryPaths.has(path) && ![...activeFilePaths].some((filePath) => filePath.startsWith(`${path}/`))) {
      allIssues.push({
        code: "missing_folder",
        message: `Required folder is missing: ${requirement.path}.`,
        path: requirement.path,
        severity: "error"
      });
    }
  }

  const sourceFiles = activeFiles
    .filter((entry) => entry.content && isLikelySourceForLanguage(entry.path, requirements.languageKey))
    .map(
      (entry): CodingHomeworkSourceFile => ({
        content: (entry.content as Buffer).toString("utf8"),
        languageKey: requirements.languageKey,
        path: entry.path
      })
    );
  const parseResult = await parseCodingHomeworkSourceFiles(sourceFiles);
  const matchedFunctions = parseResult.functions.map((fn) => ({
    filePath: fn.sourcePath,
    functionName: fn.functionName
  }));
  const parserIssues: CodingHomeworkValidationIssue[] = parseResult.diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => ({
      code: "parser_error",
      message: diagnostic.message,
      path: diagnostic.path,
      severity: diagnostic.severity
    }));
  allIssues.push(...parserIssues);

  for (const requirement of requirements.requiredFunctions ?? []) {
    if (requirement.required === false) {
      continue;
    }
    if (!hasRequiredFunction(requirement, matchedFunctions)) {
      allIssues.push({
        code: "missing_function",
        functionName: requirement.name,
        message: `Required function is missing: ${formatFunctionRequirement(requirement)}.`,
        path: requirement.filePath,
        severity: "error"
      });
    }
  }

  const missingRequired = allIssues.filter((issue) => issue.code === "missing_file" || issue.code === "missing_folder" || issue.code === "missing_function");
  const unexpectedItems = allIssues.filter((issue) => issue.code === "unexpected_file" || issue.code === "unsupported_extension" || issue.code === "forbidden_path");
  const parserDiagnostics = allIssues.filter((issue) => issue.code === "parser_error");

  return {
    fileCount: activeFiles.length,
    ignoredFiles,
    issues: allIssues,
    isValid: !allIssues.some((issue) => issue.severity === "error"),
    matchedFunctions,
    missingRequired,
    parserDiagnostics,
    unexpectedItems,
    validFiles: activeFiles.filter((entry) => isAllowedExtension(entry.path, requirements.allowedExtensions)).map((entry) => entry.path),
    validFunctions: matchedFunctions
  };
}

export function normalizeCodingHomeworkSubmissionRequirements(value: unknown): CodingHomeworkSubmissionRequirements {
  return codingHomeworkSubmissionRequirementsSchema.parse(value ?? {});
}

function toValidationIssue(diagnostic: { code: string; message: string; path?: string; severity: "error" | "warning" }): CodingHomeworkValidationIssue {
  return {
    code: diagnostic.code === "ZIP_FORBIDDEN_PATH" || diagnostic.code === "ZIP_SYMLINK_ENTRY" ? "forbidden_path" : "archive_error",
    message: diagnostic.message,
    path: diagnostic.path,
    severity: diagnostic.severity
  };
}

function collectDirectoryPaths(entries: CodingHomeworkZipEntry[]) {
  const directories = new Set<string>();
  for (const entry of entries) {
    const parts = entry.path.split("/");
    if (entry.isDirectory) {
      directories.add(entry.path);
    }
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return directories;
}

function isAllowedExtension(path: string, allowedExtensions: string[]) {
  if (!allowedExtensions.length) {
    return true;
  }
  const lowerPath = path.toLowerCase();
  return allowedExtensions.map(normalizeExtension).some((extension) => lowerPath.endsWith(extension));
}

function normalizeExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

function isIgnored(path: string, ignoredPaths: string[]) {
  return ignoredPaths.map(normalizeRequirementPath).some((ignored) => path === ignored || path.startsWith(`${ignored}/`));
}

function isLikelySourceForLanguage(path: string, languageKey: string) {
  if (languageKey === "c") {
    return /\.(c|h)$/i.test(path);
  }
  return true;
}

function normalizeRequirementPath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function hasRequiredFunction(
  requirement: CodingHomeworkFunctionRequirement,
  matchedFunctions: Array<{
    filePath: string;
    functionName: string;
  }>
) {
  const requiredFilePath = requirement.filePath ? normalizeRequirementPath(requirement.filePath) : null;
  return matchedFunctions.some(
    (fn) => fn.functionName === requirement.name && (!requiredFilePath || normalizeRequirementPath(fn.filePath) === requiredFilePath)
  );
}

function formatFunctionRequirement(requirement: CodingHomeworkFunctionRequirement) {
  return requirement.filePath ? `${requirement.filePath}:${requirement.name}` : requirement.name;
}
