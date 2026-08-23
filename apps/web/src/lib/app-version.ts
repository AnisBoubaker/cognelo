export function formatCogneloVersion(version: string | undefined) {
  return `Cognelo ver. ${version?.trim() || "unknown"}`;
}

export const COGNELO_VERSION_LABEL = formatCogneloVersion(process.env.NEXT_PUBLIC_COGNELO_VERSION);
