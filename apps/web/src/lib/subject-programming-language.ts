import { subjectProgrammingLanguages, type SubjectProgrammingLanguage } from "@cognelo/contracts";

const labels: Record<SubjectProgrammingLanguage, string> = {
  c: "C",
  cpp: "C++",
  go: "Go",
  java: "Java",
  python: "Python",
  rust: "Rust",
  typescript: "TypeScript"
};

export const subjectProgrammingLanguageOptions = subjectProgrammingLanguages.map((value) => ({
  value,
  label: labels[value]
}));

export function subjectProgrammingLanguageLabel(value: SubjectProgrammingLanguage) {
  return labels[value];
}
