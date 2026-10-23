/** Match the active Test runtime: retain the attempt's shuffled order and append new items. */
export function orderedLiveTestItems<T extends { id: string }>(items: T[], metadata: unknown, settings: unknown) {
  if (asRecord(settings).randomizeItems !== true || !metadata) return items;
  const record = asRecord(metadata);
  const manifest = asRecord(record.submissionManifest ?? record.manifest);
  const oldOrder = (Array.isArray(manifest.items) ? manifest.items : []).flatMap((value) => {
    const item = asRecord(value);
    return typeof item.testItemId === "string" ? [item.testItemId] : [];
  });
  return [...items].sort((a, b) => {
    const aIndex = oldOrder.indexOf(a.id), bIndex = oldOrder.indexOf(b.id);
    return (aIndex < 0 ? oldOrder.length : aIndex) - (bIndex < 0 ? oldOrder.length : bIndex);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
