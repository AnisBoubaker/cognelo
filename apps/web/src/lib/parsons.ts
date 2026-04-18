export type ParsonsConfig = {
  prompt: string;
  solution: string;
  language: string;
  stripIndentation: boolean;
};

export type ParsonsBlock = {
  id: string;
  displayText: string;
  originalText: string;
  expectedIndent: number;
  currentIndent: number;
};

export function defaultParsonsConfig(): ParsonsConfig {
  return {
    prompt: "Rebuild the program in the correct order.",
    solution: "print('Hello, Parsons!')",
    language: "python",
    stripIndentation: false
  };
}

export function parseParsonsConfig(value: Record<string, unknown> | undefined): ParsonsConfig {
  const fallback = defaultParsonsConfig();
  return {
    prompt: typeof value?.prompt === "string" && value.prompt.trim() ? value.prompt : fallback.prompt,
    solution: typeof value?.solution === "string" && value.solution.trim() ? value.solution : fallback.solution,
    language: typeof value?.language === "string" && value.language.trim() ? value.language : fallback.language,
    stripIndentation: typeof value?.stripIndentation === "boolean" ? value.stripIndentation : fallback.stripIndentation
  };
}

export function buildParsonsBlocks(seed: string, config: ParsonsConfig): ParsonsBlock[] {
  const normalizedLines = config.solution
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => line.trim().length > 0);

  const blocks = normalizedLines.map((line, index) => {
    const expectedIndent = Math.max(0, Math.floor(countLeadingSpaces(line) / 2));
    return {
      id: `${seed}-${index}-${hashLine(line)}`,
      displayText: config.stripIndentation ? line.trimStart() : line,
      originalText: line,
      expectedIndent,
      currentIndent: config.stripIndentation ? 0 : expectedIndent
    };
  });

  return shuffleWithSeed(blocks, seed);
}

export function resetParsonsBlocks(config: ParsonsConfig) {
  return buildParsonsBlocks(randomSeed(), config);
}

export function evaluateParsonsSolution(blocks: ParsonsBlock[]) {
  const orderCorrect = blocks.every((block, index) => block.id.includes(`-${index}-`));
  const indentationCorrect = blocks.every((block) => block.currentIndent === block.expectedIndent);
  const misplacedBlocks = blocks.reduce((count, block, index) => count + (block.id.includes(`-${index}-`) ? 0 : 1), 0);
  const incorrectIndents = blocks.reduce((count, block) => count + (block.currentIndent === block.expectedIndent ? 0 : 1), 0);

  return {
    orderCorrect,
    indentationCorrect,
    isCorrect: orderCorrect && indentationCorrect,
    misplacedBlocks,
    incorrectIndents
  };
}

function hashLine(line: string) {
  let hash = 0;
  for (let index = 0; index < line.length; index += 1) {
    hash = (hash * 31 + line.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function countLeadingSpaces(line: string) {
  let count = 0;
  while (count < line.length && line[count] === " ") {
    count += 1;
  }
  return count;
}

function shuffleWithSeed<T>(items: T[], seed: string) {
  const shuffled = [...items];
  let state = seedToNumber(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextSeed(state);
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function seedToNumber(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function nextSeed(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function randomSeed() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}
