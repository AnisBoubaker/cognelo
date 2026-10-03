export function excludeAiGradingTemplateTargets<T extends { attempt: { id: string } }>(
  targets: readonly T[],
  templateAttemptIds: readonly string[]
) {
  const templateIds = new Set(templateAttemptIds);
  return targets.filter(({ attempt }) => !templateIds.has(attempt.id));
}
