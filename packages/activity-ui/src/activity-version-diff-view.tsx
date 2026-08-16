import type { ReactNode } from "react";

export type ActivityVersionDiffViewModel = {
  fromVersion: { id: string; versionNumber: number; createdAt: string };
  toVersion: { id: string; versionNumber: number; createdAt: string };
  sections: Array<{
    key: string;
    title: string;
    fields: Array<
      | { kind: "text"; key: string; label: string; before: string; after: string }
      | { kind: "list"; key: string; label: string; before: string[]; after: string[] }
      | { kind: "structured"; key: string; label: string; changes: Array<{ path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown }> }
    >;
  }>;
  changeCount: number;
};

export function ActivityVersionDiffView({ diff, labels }: { diff: ActivityVersionDiffViewModel; labels: Record<string, string> }) {
  const label = (key: string, fallback: string) => labels[key] ?? fallback;
  if (!diff.changeCount) return <p className="muted">{label("noChanges", "These versions are identical.")}</p>;
  return (
    <div className="activity-version-diff stack">
      <p className="muted">{label("summary", "Changed fields").replace("{count}", String(diff.changeCount))}</p>
      {diff.sections.map((section) => (
        <section className="activity-version-diff-section stack" key={section.key}>
          <h3>{label(`section.${section.key}`, section.title)}</h3>
          {section.fields.map((field) => (
            <div className="activity-version-diff-field stack" key={field.key}>
              <h4>{label(`field.${field.key}`, field.label)}</h4>
              {field.kind === "structured" ? (
                <div className="activity-version-diff-structured">
                  {field.changes.map((change) => (
                    <div className={`activity-version-diff-change is-${change.kind}`} key={`${change.path}-${change.kind}`}>
                      <div className="activity-version-diff-path"><span className="metadata-badge">{label(`change.${change.kind}`, change.kind)}</span><code>{change.path}</code></div>
                      {change.kind === "changed" && typeof change.before === "string" && typeof change.after === "string"
                        ? <TextDiff before={change.before} after={change.after} labels={labels} />
                        : <DiffColumns before={<pre>{formatValue(change.before)}</pre>} after={<pre>{formatValue(change.after)}</pre>} labels={labels} />}
                    </div>
                  ))}
                </div>
              ) : field.kind === "list" ? (
                <DiffColumns before={<ValueList values={field.before} />} after={<ValueList values={field.after} />} labels={labels} />
              ) : (
                <TextDiff before={field.before} after={field.after} labels={labels} />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function DiffColumns({ before, after, labels }: { before: ReactNode; after: ReactNode; labels: Record<string, string> }) {
  return (
    <div className="activity-version-diff-columns">
      <div className="activity-version-diff-side is-before"><strong>{labels.before ?? "Before"}</strong><div>{before}</div></div>
      <div className="activity-version-diff-side is-after"><strong>{labels.after ?? "After"}</strong><div>{after}</div></div>
    </div>
  );
}

function ValueList({ values }: { values: string[] }) {
  return values.length ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <span>—</span>;
}

function formatValue(value: unknown) {
  if (value === undefined) return "—";
  if (typeof value === "string") return value || '""';
  return JSON.stringify(value, null, 2);
}

type LineDiffOperation = { kind: "context" | "removed" | "added"; text: string };

export function buildContextualLineDiff(before: string, after: string, contextLines = 2): LineDiffOperation[][] {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);
  const operations = lineOperations(beforeLines, afterLines);
  const changedIndexes = operations.flatMap((operation, index) => operation.kind === "context" ? [] : [index]);
  if (!changedIndexes.length) return [];
  const ranges: Array<[number, number]> = [];
  for (const index of changedIndexes) {
    const sectionStart = findSectionStart(operations, index);
    const sectionEnd = sectionStart === null ? null : findSectionEnd(operations, index);
    const start = sectionStart ?? Math.max(0, index - contextLines);
    const end = sectionEnd ?? Math.min(operations.length, index + contextLines + 1);
    const previous = ranges[ranges.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else ranges.push([start, end]);
  }
  return ranges.map(([start, end]) => operations.slice(start, end));
}

function findSectionStart(operations: LineDiffOperation[], index: number) {
  for (let candidate = index; candidate >= 0; candidate -= 1) {
    if (/^##\s+/.test(operations[candidate].text.trim())) return candidate;
  }
  return null;
}

function findSectionEnd(operations: LineDiffOperation[], index: number) {
  for (let candidate = index + 1; candidate < operations.length; candidate += 1) {
    if (/^##\s+/.test(operations[candidate].text.trim())) return candidate;
  }
  return operations.length;
}

function TextDiff({ before, after, labels }: { before: string; after: string; labels: Record<string, string> }) {
  const hunks = buildContextualLineDiff(before, after);
  if (!hunks.length) return <p className="muted">{labels.noChanges ?? "No changes"}</p>;
  return (
    <div className="activity-version-text-diff" aria-label={`${labels.before ?? "Before"} / ${labels.after ?? "After"}`}>
      {hunks.map((hunk, hunkIndex) => (
        <div className="activity-version-text-hunk" key={hunkIndex}>
          {hunkIndex > 0 ? <div className="activity-version-text-gap" aria-hidden="true">•••</div> : null}
          {hunk.map((operation, index) => {
            const paired = pairedLineText(hunk, index);
            return (
              <div className={`activity-version-text-line is-${operation.kind}`} key={`${operation.kind}-${index}`}>
                <span className="activity-version-text-marker" aria-hidden="true">{operation.kind === "removed" ? "−" : operation.kind === "added" ? "+" : " "}</span>
                <code>{highlightedText(operation.text, paired)}</code>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function normalizeLines(value: string) {
  return value.replace(/\r\n?/g, "\n").split("\n");
}

function lineOperations(before: string[], after: string[]): LineDiffOperation[] {
  const lengths = Array.from({ length: before.length + 1 }, () => Array<number>(after.length + 1).fill(0));
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] = before[left] === after[right]
        ? lengths[left + 1][right + 1] + 1
        : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }
  const operations: LineDiffOperation[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length || right < after.length) {
    if (left < before.length && right < after.length && before[left] === after[right]) {
      operations.push({ kind: "context", text: before[left] }); left += 1; right += 1;
    } else if (right >= after.length || (left < before.length && lengths[left + 1][right] >= lengths[left][right + 1])) {
      operations.push({ kind: "removed", text: before[left] }); left += 1;
    } else {
      operations.push({ kind: "added", text: after[right] }); right += 1;
    }
  }
  return operations;
}

function pairedLineText(operations: LineDiffOperation[], index: number) {
  const operation = operations[index];
  if (operation.kind === "context") return null;
  let groupStart = index;
  while (groupStart > 0 && operations[groupStart - 1].kind === operation.kind) groupStart -= 1;
  const offset = index - groupStart;
  if (operation.kind === "removed") {
    let addedStart = index;
    while (addedStart < operations.length && operations[addedStart].kind === "removed") addedStart += 1;
    return operations[addedStart + offset]?.kind === "added" ? operations[addedStart + offset].text : null;
  }
  let removedEnd = groupStart - 1;
  if (removedEnd < 0 || operations[removedEnd].kind !== "removed") return null;
  while (removedEnd > 0 && operations[removedEnd - 1].kind === "removed") removedEnd -= 1;
  return operations[removedEnd + offset]?.kind === "removed" ? operations[removedEnd + offset].text : null;
}

function highlightedText(text: string, paired: string | null) {
  if (paired === null) return <mark>{text || " "}</mark>;
  let prefix = 0;
  while (prefix < text.length && prefix < paired.length && text[prefix] === paired[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < text.length - prefix && suffix < paired.length - prefix && text[text.length - 1 - suffix] === paired[paired.length - 1 - suffix]) suffix += 1;
  const end = text.length - suffix;
  return <>{text.slice(0, prefix)}<mark>{text.slice(prefix, end) || " "}</mark>{text.slice(end)}</>;
}
