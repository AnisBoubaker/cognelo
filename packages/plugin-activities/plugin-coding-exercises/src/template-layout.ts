import { codingFilePrivate, type CodingFilesConfig, type CodingFilesPrivateConfig } from "./coding-files";
import { codingBlankIds } from "./code-blanks";
import { codingExerciseTemplateInsertionToken as studentToken, codingExerciseTestInsertionToken as testToken } from "./coding-exercises";

export function codingTemplateFiles(config: CodingFilesConfig, privateConfig: CodingFilesPrivateConfig) {
  if (!config.files) return [{ id: "main", name: "", templateSource: privateConfig.templateSource || studentToken }];
  return config.files.map((file, index) => ({ id: file.id, name: file.name,
    templateSource: codingFilePrivate(index === 0 || privateConfig.fileSources?.[file.id] ? privateConfig : {}, file.id).templateSource }));
}

export function codingTemplateLayoutIssues(config: CodingFilesConfig, privateConfig: CodingFilesPrivateConfig) {
  const files = codingTemplateFiles(config, privateConfig), issues: string[] = [];
  let students = 0, tests = 0;
  for (const file of files) {
    const studentCount = file.templateSource.split(studentToken).length - 1;
    const testCount = file.templateSource.split(testToken).length - 1;
    students += studentCount; tests += testCount;
    if (studentCount > 1) issues.push(`${file.name || "Template"}: use {{ STUDENT_CODE }} at most once per file.`);
    if (!config.files && studentCount !== 1) issues.push("The template must include {{ STUDENT_CODE }}.");
    const definition = config.files?.find(candidate => candidate.id === file.id);
    if (config.responseMode === "blanks" && definition && codingBlankIds(definition.blankTemplate ?? "").length && !studentCount) {
      issues.push(`${file.name}: include {{ STUDENT_CODE }} to execute the code containing blanks.`);
    }
  }
  if (!students && config.files) issues.push("Include {{ STUDENT_CODE }} in at least one file template.");
  if (tests > 1) issues.push("Place {{ TEST_CODE }} once across the file templates.");
  return issues;
}

export function codingTemplateHasTestCode(config: CodingFilesConfig, privateConfig: CodingFilesPrivateConfig) {
  return codingTemplateFiles(config, privateConfig).some(file => file.templateSource.includes(testToken));
}

/** The marker buttons move a marker to the selected location without duplicating it. */
export function placeCodingTemplateMarker(source: string, token: string, start: number, end: number) {
  const before = source.slice(0, start).replaceAll(token, "");
  const after = source.slice(end).replaceAll(token, "");
  const line = before.slice(before.lastIndexOf("\n") + 1);
  const indentation = line.match(/^[\t ]*/)?.[0] ?? "";
  const prefix = line.trim() ? before + "\n" + indentation : before;
  const suffix = after && !after.startsWith("\n") ? "\n" + after : after;
  return { source: prefix + token + suffix, cursor: prefix.length + token.length };
}
