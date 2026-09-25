import { subjectMultipleProgrammingLanguages, type SubjectProgrammingLanguage } from "@cognelo/contracts";

const labels: Record<string, string> = {
  c: "C",
  cpp: "C++",
  csharp: "C#",
  fsharp: "F#",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  "common-lisp": "Common Lisp",
  objectivec: "Objective-C",
  python: "Python 3",
  python2: "Python 2",
  rust: "Rust",
  typescript: "TypeScript",
  vbnet: "VB.Net"
};

export { subjectMultipleProgrammingLanguages };

export function subjectProgrammingLanguageLabel(value: SubjectProgrammingLanguage) {
  return labels[value] ?? value.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
}
