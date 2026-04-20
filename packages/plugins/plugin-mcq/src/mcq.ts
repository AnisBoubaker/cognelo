import type { ReactNode } from "react";

export type McqBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "math"; expression: string; display: boolean }
  | { type: "code"; language: string; code: string };

export type McqChoice = {
  id: string;
  blocks: McqBlock[];
  isCorrect: boolean;
};

export type McqQuestion = {
  id: string;
  title: string;
  promptBlocks: McqBlock[];
  choices: McqChoice[];
  mode: "single" | "multiple";
};

export type McqParseError = {
  line: number;
  message: string;
};

export type ParsedMcq = {
  introBlocks: McqBlock[];
  questions: McqQuestion[];
  errors: McqParseError[];
};

type Section = {
  heading: string | null;
  headingLine: number;
  lines: Array<{ number: number; text: string }>;
};

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "math"; expression: string }
  | { type: "strong"; children: InlineToken[] }
  | { type: "emphasis"; children: InlineToken[] };

export function parseMcqSource(source: string, defaultCodeLanguage: string): ParsedMcq {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const sections = splitSections(lines);
  const errors: McqParseError[] = [];

  const introSection = sections.find((section) => section.heading === null) ?? { heading: null, headingLine: 1, lines: [] };
  const introBlocks = parseMarkdownBlocks(
    introSection.lines.map((line) => line.text),
    defaultCodeLanguage
  );

  const questions = sections
    .filter((section) => section.heading !== null)
    .map((section, index) => parseQuestionSection(section, index, defaultCodeLanguage, errors))
    .filter((question): question is McqQuestion => question !== null);

  return { introBlocks, questions, errors };
}

const languageAliases: Record<string, string> = {
  csharp: "clike",
  cs: "clike",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript"
};

const supportedLanguages = new Set<string>([
  "actionscript",
  "c",
  "coffee",
  "cpp",
  "css",
  "go",
  "graphql",
  "html",
  "javascript",
  "json",
  "jsx",
  "kotlin",
  "markdown",
  "objectivec",
  "python",
  "reason",
  "rust",
  "sql",
  "swift",
  "typescript",
  "tsx",
  "xml",
  "yaml",
  "clike",
  "svg"
]);

function normalizeMcqCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  const mapped = languageAliases[normalized] ?? normalized;
  return supportedLanguages.has(mapped) ? mapped : "text";
}

function splitSections(lines: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { heading: null, headingLine: 1, lines: [] };
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
    }

    if (!inFence && /^##\s+/.test(line)) {
      sections.push(current);
      current = {
        heading: line.replace(/^##\s+/, "").trim(),
        headingLine: index + 1,
        lines: []
      };
      continue;
    }

    current.lines.push({ number: index + 1, text: line });
  }

  sections.push(current);
  return sections;
}

function parseQuestionSection(
  section: Section,
  index: number,
  defaultCodeLanguage: string,
  errors: McqParseError[]
): McqQuestion | null {
  const promptLines: string[] = [];
  const choices: Array<{ line: number; bodyLines: string[]; isCorrect: boolean }> = [];
  let promptInFence = false;
  let currentChoice: { line: number; bodyLines: string[]; isCorrect: boolean; inFence: boolean } | null = null;
  let sawChoice = false;

  for (const line of section.lines) {
    const trimmed = line.text.trim();
    if (!sawChoice) {
      if (trimmed.startsWith("```")) {
        promptInFence = !promptInFence;
      }

      if (!promptInFence) {
        const match = line.text.match(/^\s*[-*]\s+\[(x|X| )\]\s*(.*)$/);
        if (match) {
          sawChoice = true;
          currentChoice = {
            line: line.number,
            bodyLines: match[2] ? [match[2]] : [],
            isCorrect: match[1].toLowerCase() === "x",
            inFence: match[2].trim().startsWith("```")
          };
          continue;
        }
      }

      promptLines.push(line.text);
      continue;
    }

    if (!currentChoice) {
      errors.push({
        line: line.number,
        message: `Question "${section.heading}" could not attach content after the answer list.`
      });
      continue;
    }

    if (!currentChoice.inFence) {
      const match = line.text.match(/^\s*[-*]\s+\[(x|X| )\]\s+(.*)$/);
      if (match) {
        choices.push({
          line: currentChoice.line,
          bodyLines: currentChoice.bodyLines,
          isCorrect: currentChoice.isCorrect
        });
        currentChoice = {
          line: line.number,
          bodyLines: [match[2]],
          isCorrect: match[1].toLowerCase() === "x",
          inFence: match[2].trim().startsWith("```")
        };
        continue;
      }
    }

    currentChoice.bodyLines.push(line.text);
    if (trimmed.startsWith("```")) {
      currentChoice.inFence = !currentChoice.inFence;
    }
  }

  if (currentChoice) {
    choices.push({
      line: currentChoice.line,
      bodyLines: currentChoice.bodyLines,
      isCorrect: currentChoice.isCorrect
    });
  }

  if (!section.heading?.trim()) {
    errors.push({
      line: section.headingLine,
      message: "Each MCQ question heading needs a title after `##`."
    });
    return null;
  }

  if (!choices.length) {
    errors.push({
      line: section.headingLine,
      message: `Question "${section.heading}" needs at least one answer list written with \`- [ ]\` or \`- [x]\`.`
    });
    return null;
  }

  if (choices.length < 2) {
    errors.push({
      line: choices[0]?.line ?? section.headingLine,
      message: `Question "${section.heading}" needs at least two choices.`
    });
  }

  const correctCount = choices.filter((choice) => choice.isCorrect).length;
  if (!correctCount) {
    errors.push({
      line: section.headingLine,
      message: `Question "${section.heading}" must mark at least one correct answer with \`[x]\`.`
    });
  }

  for (const choice of choices) {
    if (!choice.bodyLines.join("\n").trim()) {
      errors.push({
        line: choice.line,
        message: `Question "${section.heading}" contains an empty choice.`
      });
    }
  }

  return {
    id: `question-${index + 1}`,
    title: section.heading,
    promptBlocks: parseMarkdownBlocks(promptLines, defaultCodeLanguage),
    choices: choices.map((choice, choiceIndex) => ({
      id: `question-${index + 1}-choice-${choiceIndex + 1}`,
      blocks: parseMarkdownBlocks(choice.bodyLines, defaultCodeLanguage),
      isCorrect: choice.isCorrect
    })),
    mode: correctCount > 1 ? "multiple" : "single"
  };
}

function parseMarkdownBlocks(lines: string[], defaultCodeLanguage: string): McqBlock[] {
  const blocks: McqBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```(.*)$/);
    if (fenceMatch) {
      const info = fenceMatch[1].trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "code",
        language: normalizeMcqCodeLanguage(info || defaultCodeLanguage),
        code: codeLines.join("\n")
      });
      continue;
    }

    if (trimmed.startsWith("$$")) {
      const singleLineMath = trimmed.match(/^\$\$(.+)\$\$$/);
      if (singleLineMath) {
        blocks.push({
          type: "math",
          expression: singleLineMath[1].trim(),
          display: true
        });
        index += 1;
        continue;
      }

      const mathLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "$$") {
        mathLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({
        type: "math",
        expression: mathLines.join("\n").trim(),
        display: true
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim()
      });
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (unorderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*[-*]\s+(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1].trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*\d+\.\s+(.*)$/);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1].trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const next = lines[index];
      const nextTrimmed = next.trim();
      if (!nextTrimmed) {
        break;
      }
      if (/^```/.test(nextTrimmed) || /^\$\$/.test(nextTrimmed) || /^(#{1,6})\s+/.test(next) || /^\s*[-*]\s+/.test(next) || /^\s*\d+\.\s+/.test(next)) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

export function renderInlineMarkdown(text: string): InlineToken[] {
  return parseInline(text);
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let index = 0;

  while (index < text.length) {
    if (text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        tokens.push({
          type: "strong",
          children: parseInline(text.slice(index + 2, end))
        });
        index = end + 2;
        continue;
      }
    }

    if (text[index] === "*" || text[index] === "_") {
      const marker = text[index];
      const end = text.indexOf(marker, index + 1);
      if (end !== -1) {
        tokens.push({
          type: "emphasis",
          children: parseInline(text.slice(index + 1, end))
        });
        index = end + 1;
        continue;
      }
    }

    if (text[index] === "`") {
      const end = text.indexOf("`", index + 1);
      if (end !== -1) {
        tokens.push({ type: "code", text: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (text[index] === "$") {
      const end = text.indexOf("$", index + 1);
      if (end !== -1 && end > index + 1) {
        tokens.push({ type: "math", expression: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    const nextSpecial = findNextSpecial(text, index);
    if (nextSpecial === index) {
      tokens.push({ type: "text", text: text[index] });
      index += 1;
      continue;
    }
    tokens.push({ type: "text", text: text.slice(index, nextSpecial) });
    index = nextSpecial;
  }

  return tokens;
}

function findNextSpecial(text: string, start: number) {
  let next = text.length;
  for (const marker of ["**", "*", "_", "`", "$"]) {
    const index = text.indexOf(marker, start);
    if (index !== -1) {
      next = Math.min(next, index);
    }
  }
  return next;
}

export function renderInlineTokens(tokens: InlineToken[], render: (token: InlineToken, index: number) => ReactNode) {
  return tokens.map(render);
}
