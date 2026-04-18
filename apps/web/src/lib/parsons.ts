export type ParsonsPrecedenceRule = {
  id: string;
  beforeGroupId: string;
  afterGroupId: string;
};

export type ParsonsGroup = {
  id: string;
  label: string;
  orderSensitive: boolean;
  startLine: number;
  endLine: number;
};

export type ParsonsConfig = {
  prompt: string;
  solution: string;
  language: string;
  stripIndentation: boolean;
  groups: ParsonsGroup[];
  precedenceRules: ParsonsPrecedenceRule[];
};

export type ParsonsSourceLine = {
  sourceIndex: number;
  physicalLineIndex: number;
  text: string;
  unitId: string;
  groupId: string | null;
};

export type ParsonsBlock = {
  id: string;
  displayText: string;
  originalText: string;
  sourceIndex: number;
  physicalLineIndex: number;
  unitId: string;
  groupId: string | null;
  expectedIndent: number;
  currentIndent: number;
};

type LegacyConfig = {
  groups?: Array<{ id?: unknown; label?: unknown; orderSensitive?: unknown }>;
  lineGroupIds?: unknown;
};

export function defaultParsonsConfig(): ParsonsConfig {
  return {
    prompt: "Rebuild the program in the correct order.",
    solution: "print('Hello, Parsons!')",
    language: "python",
    stripIndentation: false,
    groups: [],
    precedenceRules: []
  };
}

export function parseParsonsConfig(value: Record<string, unknown> | undefined): ParsonsConfig {
  const fallback = defaultParsonsConfig();
  const solution = typeof value?.solution === "string" && value.solution.trim() ? value.solution : fallback.solution;
  const lineCount = getSolutionLineCount(solution);
  const groups = normalizeParsonsGroups(value?.groups, lineCount);
  const precedenceRules = normalizePrecedenceRules(value?.precedenceRules, groups);

  if (groups.length > 0) {
    return {
      prompt: typeof value?.prompt === "string" && value.prompt.trim() ? value.prompt : fallback.prompt,
      solution,
      language: typeof value?.language === "string" && value.language.trim() ? value.language : fallback.language,
      stripIndentation: typeof value?.stripIndentation === "boolean" ? value.stripIndentation : fallback.stripIndentation,
      groups,
      precedenceRules
    };
  }

  const legacy = normalizeLegacyGroups(solution, value as LegacyConfig | undefined);

  return {
    prompt: typeof value?.prompt === "string" && value.prompt.trim() ? value.prompt : fallback.prompt,
    solution,
    language: typeof value?.language === "string" && value.language.trim() ? value.language : fallback.language,
    stripIndentation: typeof value?.stripIndentation === "boolean" ? value.stripIndentation : fallback.stripIndentation,
    groups: legacy,
    precedenceRules: normalizePrecedenceRules(value?.precedenceRules, legacy)
  };
}

export function getSolutionLines(solution: string) {
  return solution.replace(/\r\n/g, "\n").split("\n").map((line) => line.replace(/\t/g, "  "));
}

export function getSolutionLineCount(solution: string) {
  return getSolutionLines(solution).length;
}

export function buildParsonsBlocks(seed: string, config: ParsonsConfig): ParsonsBlock[] {
  const sourceLines = getParsonsSourceLines(config);

  const blocks = sourceLines.map((line) => {
    const expectedIndent = Math.max(0, Math.floor(countLeadingSpaces(line.text) / 2));
    return {
      id: `${seed}-${line.sourceIndex}-${hashLine(`${line.unitId}:${line.text}`)}`,
      displayText: config.stripIndentation ? line.text.trimStart() : line.text,
      originalText: line.text,
      sourceIndex: line.sourceIndex,
      physicalLineIndex: line.physicalLineIndex,
      unitId: line.unitId,
      groupId: line.groupId,
      expectedIndent,
      currentIndent: config.stripIndentation ? 0 : expectedIndent
    };
  });

  return shuffleWithSeed(blocks, seed);
}

export function resetParsonsBlocks(config: ParsonsConfig) {
  return buildParsonsBlocks(randomSeed(), config);
}

export function evaluateParsonsSolution(blocks: ParsonsBlock[], config: ParsonsConfig) {
  const sourceLines = getParsonsSourceLines(config);
  const sourceUnits = getSourceUnits(sourceLines, config.groups);
  const unitOrder = sourceUnits.map((unit) => unit.unitId);
  const groupById = new Map(config.groups.map((group) => [group.id, group]));
  const misplacedUnits = new Set<string>();
  const seenUnits = new Set<string>();
  const firstIndexByUnit = new Map<string, number>();
  const lastIndexByUnit = new Map<string, number>();

  blocks.forEach((block, index) => {
    if (!firstIndexByUnit.has(block.unitId)) {
      firstIndexByUnit.set(block.unitId, index);
    }
    lastIndexByUnit.set(block.unitId, index);
  });

  for (const [unitId, firstIndex] of firstIndexByUnit.entries()) {
    const lastIndex = lastIndexByUnit.get(unitId) ?? firstIndex;
    for (let index = firstIndex; index <= lastIndex; index += 1) {
      if (blocks[index]?.unitId !== unitId) {
        misplacedUnits.add(unitId);
        break;
      }
    }
  }

  const studentUnitOrder = blocks.reduce<string[]>((order, block, index) => {
    if (index === 0 || block.unitId !== blocks[index - 1]?.unitId) {
      order.push(block.unitId);
    }
    return order;
  }, []);

  if (studentUnitOrder.length !== unitOrder.length || studentUnitOrder.some((unitId, index) => unitId !== unitOrder[index])) {
    const expectedIndexByUnit = new Map(unitOrder.map((unitId, index) => [unitId, index]));
    const indexedUnits = studentUnitOrder
      .map((unitId) => ({ unitId, expectedIndex: expectedIndexByUnit.get(unitId) }))
      .filter((entry): entry is { unitId: string; expectedIndex: number } => entry.expectedIndex !== undefined);
    const stableIndexes = longestIncreasingSubsequenceIndices(indexedUnits.map((entry) => entry.expectedIndex));

    indexedUnits.forEach((entry, index) => {
      if (!stableIndexes.has(index)) {
        misplacedUnits.add(entry.unitId);
      }
    });
  }

  config.precedenceRules.forEach((rule) => {
    const beforeIndex = studentUnitOrder.findIndex((unitId) => unitId === rule.beforeGroupId);
    const afterIndex = studentUnitOrder.findIndex((unitId) => unitId === rule.afterGroupId);
    if (beforeIndex !== -1 && afterIndex !== -1 && beforeIndex > afterIndex) {
      misplacedUnits.add(rule.beforeGroupId);
      misplacedUnits.add(rule.afterGroupId);
    }
  });

  blocks.forEach((block, index) => {
    if (seenUnits.has(block.unitId)) {
      return;
    }
    seenUnits.add(block.unitId);

    const group = block.groupId ? groupById.get(block.groupId) : undefined;
    if (group?.orderSensitive === false) {
      return;
    }

    const sourceLineIndexes = sourceLines.filter((line) => line.unitId === block.unitId).map((line) => line.sourceIndex);
    const studentLineIndexes = blocks.filter((candidate) => candidate.unitId === block.unitId).map((candidate) => candidate.sourceIndex);
    if (
      sourceLineIndexes.length !== studentLineIndexes.length ||
      sourceLineIndexes.some((sourceIndex, lineIndex) => sourceIndex !== studentLineIndexes[lineIndex])
    ) {
      misplacedUnits.add(block.unitId);
    }
  });

  const indentationCorrect = blocks.every((block) => block.currentIndent === block.expectedIndent);
  const incorrectIndents = blocks.reduce((count, block) => count + (block.currentIndent === block.expectedIndent ? 0 : 1), 0);

  return {
    orderCorrect: misplacedUnits.size === 0,
    indentationCorrect,
    isCorrect: misplacedUnits.size === 0 && indentationCorrect,
    misplacedBlocks: misplacedUnits.size,
    incorrectIndents
  };
}

export function getParsonsSourceLines(config: ParsonsConfig): ParsonsSourceLine[] {
  const lines = getSolutionLines(config.solution);
  const sourceLines: ParsonsSourceLine[] = [];
  let sourceIndex = 0;

  lines.forEach((line, physicalLineIndex) => {
    if (!line.trim()) {
      return;
    }

    const owningGroup = config.groups.find((group) => physicalLineIndex >= group.startLine && physicalLineIndex <= group.endLine);
    sourceLines.push({
      sourceIndex,
      physicalLineIndex,
      text: line,
      unitId: owningGroup?.id ?? `line-${physicalLineIndex}`,
      groupId: owningGroup?.id ?? null
    });
    sourceIndex += 1;
  });

  return sourceLines;
}

export function createParsonsGroup(selection: number[], lineCount: number): ParsonsGroup | null {
  if (selection.length === 0) {
    return null;
  }

  const normalized = [...new Set(selection)].sort((left, right) => left - right);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index] !== normalized[index - 1] + 1) {
      return null;
    }
  }

  const startLine = normalized[0];
  const endLine = normalized[normalized.length - 1];

  if (startLine < 0 || endLine >= lineCount) {
    return null;
  }

  return {
    id: createParsonsId("group"),
    label: `Group ${startLine + 1}-${endLine + 1}`,
    orderSensitive: true,
    startLine,
    endLine
  };
}

export function rebaseParsonsGroupsOnSolutionChange(previousSolution: string, nextSolution: string, groups: ParsonsGroup[]) {
  const previousLines = getSolutionLines(previousSolution);
  const nextLines = getSolutionLines(nextSolution);

  let prefix = 0;
  while (
    prefix < previousLines.length &&
    prefix < nextLines.length &&
    previousLines[prefix] === nextLines[prefix]
  ) {
    prefix += 1;
  }

  let previousSuffix = previousLines.length - 1;
  let nextSuffix = nextLines.length - 1;
  while (previousSuffix >= prefix && nextSuffix >= prefix && previousLines[previousSuffix] === nextLines[nextSuffix]) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  const deletedCount = Math.max(0, previousSuffix - prefix + 1);
  const insertedCount = Math.max(0, nextSuffix - prefix + 1);
  const nextGroups = groups
    .map((group) => rebaseParsonsGroup(group, prefix, deletedCount, insertedCount))
    .filter((group): group is ParsonsGroup => group !== null)
    .map((group) => clampParsonsGroup(group, nextLines.length));

  return normalizeParsonsGroups(nextGroups, nextLines.length);
}

export function removeParsonsGroup(groups: ParsonsGroup[], groupId: string) {
  return groups.filter((group) => group.id !== groupId);
}

export function removeParsonsGroupDependencies(rules: ParsonsPrecedenceRule[], groupId: string) {
  return rules.filter((rule) => rule.beforeGroupId !== groupId && rule.afterGroupId !== groupId);
}

export function createParsonsPrecedenceRule(beforeGroupId: string, afterGroupId: string): ParsonsPrecedenceRule {
  return {
    id: createParsonsId("rule"),
    beforeGroupId,
    afterGroupId
  };
}

export function normalizeParsonsGroups(value: unknown, lineCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
      const startLine = typeof candidate.startLine === "number" ? Math.floor(candidate.startLine) : NaN;
      const endLine = typeof candidate.endLine === "number" ? Math.floor(candidate.endLine) : NaN;
      if (!id || !label || seenIds.has(id) || Number.isNaN(startLine) || Number.isNaN(endLine)) {
        return null;
      }
      seenIds.add(id);
      return clampParsonsGroup(
        {
          id,
          label,
          orderSensitive: candidate.orderSensitive === false ? false : true,
          startLine,
          endLine
        },
        lineCount
      );
    })
    .filter((group): group is ParsonsGroup => group !== null)
    .sort((left, right) => left.startLine - right.startLine);
}

export function normalizePrecedenceRules(value: unknown, groups: ParsonsGroup[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const seenIds = new Set<string>();

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const beforeGroupId = typeof candidate.beforeGroupId === "string" ? candidate.beforeGroupId.trim() : "";
      const afterGroupId = typeof candidate.afterGroupId === "string" ? candidate.afterGroupId.trim() : "";
      if (!id || !beforeGroupId || !afterGroupId || beforeGroupId === afterGroupId || seenIds.has(id)) {
        return null;
      }
      if (!groupIds.has(beforeGroupId) || !groupIds.has(afterGroupId)) {
        return null;
      }
      seenIds.add(id);
      return { id, beforeGroupId, afterGroupId };
    })
    .filter((rule): rule is ParsonsPrecedenceRule => rule !== null);
}

function normalizeLegacyGroups(solution: string, value: LegacyConfig | undefined) {
  const lineGroupIds = Array.isArray(value?.lineGroupIds) ? value?.lineGroupIds : [];
  const legacyGroups =
    Array.isArray(value?.groups) && value?.groups.length > 0
      ? value.groups
      : [{ id: "main", label: "Main sequence", orderSensitive: true }];
  const groupMeta = new Map(
    legacyGroups
      .map((group) => {
        const id = typeof group.id === "string" ? group.id.trim() : "";
        const label = typeof group.label === "string" ? group.label.trim() : "";
        if (!id || !label) {
          return null;
        }
        return [
          id,
          {
            id,
            label,
            orderSensitive: group.orderSensitive === false ? false : true
          }
        ] as const;
      })
      .filter((entry): entry is readonly [string, { id: string; label: string; orderSensitive: boolean }] => entry !== null)
  );

  const lines = getSolutionLines(solution);
  const ranges: ParsonsGroup[] = [];
  let currentGroupId: string | null = null;
  let startLine = 0;

  lines.forEach((line, lineIndex) => {
    const candidateId =
      line.trim() && typeof lineGroupIds[lineIndex] === "string" && groupMeta.has(lineGroupIds[lineIndex] as string)
        ? (lineGroupIds[lineIndex] as string)
        : null;

    if (candidateId !== currentGroupId) {
      if (currentGroupId) {
        const meta = groupMeta.get(currentGroupId);
        if (meta) {
          ranges.push({
            ...meta,
            startLine,
            endLine: lineIndex - 1
          });
        }
      }
      currentGroupId = candidateId;
      startLine = lineIndex;
    }
  });

  if (currentGroupId) {
    const meta = groupMeta.get(currentGroupId);
    if (meta) {
      ranges.push({
        ...meta,
        startLine,
        endLine: lines.length - 1
      });
    }
  }

  return ranges;
}

function getSourceUnits(sourceLines: ParsonsSourceLine[], groups: ParsonsGroup[]) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const units: Array<{ unitId: string; orderSensitive: boolean }> = [];
  const seenUnits = new Set<string>();

  sourceLines.forEach((line) => {
    if (seenUnits.has(line.unitId)) {
      return;
    }
    seenUnits.add(line.unitId);
    units.push({
      unitId: line.unitId,
      orderSensitive: line.groupId ? (groupById.get(line.groupId)?.orderSensitive ?? true) : true
    });
  });

  return units;
}

function rebaseParsonsGroup(group: ParsonsGroup, changeStart: number, deletedCount: number, insertedCount: number) {
  const changeEnd = changeStart + deletedCount - 1;
  const delta = insertedCount - deletedCount;

  if (deletedCount === 0 && insertedCount === 0) {
    return group;
  }

  if (deletedCount === 0) {
    if (changeStart < group.startLine) {
      return {
        ...group,
        startLine: group.startLine + delta,
        endLine: group.endLine + delta
      };
    }
    if (changeStart >= group.startLine && changeStart <= group.endLine + 1) {
      return {
        ...group,
        endLine: group.endLine + delta
      };
    }
    return group;
  }

  const deletedBeforeStart = Math.max(0, Math.min(changeStart + deletedCount, group.startLine) - changeStart);
  const deletedBeforeOrWithinEnd = Math.max(0, Math.min(changeStart + deletedCount, group.endLine + 1) - changeStart);
  const nextStart = group.startLine - deletedBeforeStart;
  const nextEnd = group.endLine - deletedBeforeOrWithinEnd + insertedCount;

  if (nextEnd < nextStart) {
    return null;
  }

  if (changeEnd < group.startLine) {
    return {
      ...group,
      startLine: group.startLine + delta,
      endLine: group.endLine + delta
    };
  }

  if (changeStart > group.endLine) {
    return group;
  }

  return {
    ...group,
    startLine: Math.max(0, nextStart),
    endLine: Math.max(0, nextEnd)
  };
}

function clampParsonsGroup(group: ParsonsGroup, lineCount: number) {
  if (lineCount <= 0) {
    return null;
  }

  const startLine = Math.max(0, Math.min(group.startLine, lineCount - 1));
  const endLine = Math.max(startLine, Math.min(group.endLine, lineCount - 1));
  return {
    ...group,
    startLine,
    endLine
  };
}

function createParsonsId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

function longestIncreasingSubsequenceIndices(values: number[]) {
  if (values.length === 0) {
    return new Set<number>();
  }

  const predecessors = new Array<number>(values.length).fill(-1);
  const tails: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    let left = 0;
    let right = tails.length;

    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (values[tails[middle]] < values[index]) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    if (left > 0) {
      predecessors[index] = tails[left - 1];
    }

    if (left === tails.length) {
      tails.push(index);
    } else {
      tails[left] = index;
    }
  }

  const lisIndices = new Set<number>();
  let cursor = tails[tails.length - 1] ?? -1;
  while (cursor !== -1) {
    lisIndices.add(cursor);
    cursor = predecessors[cursor];
  }

  return lisIndices;
}
