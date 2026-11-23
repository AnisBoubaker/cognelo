import { codingBlankAnswer, parseCodingBlankTemplate, type CodingBlankAnswers } from "../code-blanks";

export type AuthoringBlankRange = { id: string; start: number; end: number };
export type AuthoringCodeDocument = { source: string; ranges: AuthoringBlankRange[] };

export function canMarkBlankSelection(document: AuthoringCodeDocument, start: number, end: number) {
  return document.ranges.length < 50 && start >= 0 && end <= document.source.length && end > start
    && !/[\r\n]/.test(document.source.slice(start, end))
    && !document.ranges.some(range => start < range.end && end > range.start);
}

export function projectBlankAuthoring(template: string, answers: CodingBlankAnswers): AuthoringCodeDocument {
  let source = "";
  const ranges: AuthoringBlankRange[] = [];
  for (const part of parseCodingBlankTemplate(template)) {
    if (part.kind === "code") source += part.text;
    else {
      const start = source.length;
      source += codingBlankAnswer(answers, part.id);
      ranges.push({ id: part.id, start, end: source.length });
    }
  }
  return { source, ranges };
}

export function serializeBlankAuthoring({ source, ranges }: AuthoringCodeDocument) {
  let template = "";
  let offset = 0;
  const answers: CodingBlankAnswers = {};
  for (const range of [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (range.start < offset || range.end < range.start || range.end > source.length) throw new Error("Code blanks cannot overlap.");
    template += source.slice(offset, range.start) + `{{ BLANK:${range.id} }}`;
    answers[range.id] = source.slice(range.start, range.end);
    offset = range.end;
  }
  return { template: template + source.slice(offset), answers };
}

/** Monaco supplies exact edit offsets, including paste, indentation and undo/redo. */
export function updateBlankRanges(ranges: AuthoringBlankRange[], changes: Array<{ rangeOffset: number; rangeLength: number; text: string }>) {
  let next = ranges.map(range => ({ ...range }));
  for (const change of [...changes].sort((a, b) => b.rangeOffset - a.rangeOffset)) {
    const start = change.rangeOffset, end = start + change.rangeLength, delta = change.text.length - change.rangeLength;
    next = next.flatMap(range => {
      if (start >= range.start && end <= range.end && (change.rangeLength > 0 || start < range.end || range.start === range.end)) {
        return [{ ...range, end: range.end + delta }];
      }
      if (end <= range.start) return [{ ...range, start: range.start + delta, end: range.end + delta }];
      if (start >= range.end) return [range];
      if (start <= range.start && end >= range.end) return [];
      return [{ ...range, start: start < range.start ? start + change.text.length : range.start,
        end: end > range.end ? start : range.end + delta }];
    });
  }
  return next;
}
