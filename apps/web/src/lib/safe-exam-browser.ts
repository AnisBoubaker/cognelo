import { getActivityDefinition } from "@cognelo/activity-sdk";
export type SafeExamBrowserWindow = {
  SafeExamBrowser?: {
    version?: string;
    security?: {
      configKey?: string;
      updateKeys?: (callback: () => void) => void;
    };
  };
  setTimeout: (callback: () => void, delay: number) => number;
};

export function assignmentRequiresSafeExamBrowser(metadata: unknown, activityTypeKey?: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const definition = activityTypeKey ? getActivityDefinition(activityTypeKey) : undefined;
  if (definition?.supportsSafeExamBrowser === false) return false;
  const value = metadata as Record<string, unknown>;
  const stages = value.submissionStages && typeof value.submissionStages === "object" && !Array.isArray(value.submissionStages) ? value.submissionStages as Record<string, unknown> : {};
  const assessment = definition?.submissionStages?.find(stage => stage.assessment);
  return value.requireSafeExamBrowser === true && assessment?.supportsSafeExamBrowser !== false || value.assessmentMode === "summative" && Object.entries(stages).some(([id, stage]) => definition?.submissionStages?.find(item => item.id === id)?.supportsSafeExamBrowser !== false && stage && typeof stage === "object" && (stage as Record<string, unknown>).requireSafeExamBrowser === true);
}

export async function readSafeExamBrowserProof(browserWindow: SafeExamBrowserWindow) {
  const seb = browserWindow.SafeExamBrowser;
  const security = seb?.security;
  if (!security?.configKey && security?.updateKeys) {
    const update = new Promise<void>((resolve) => {
      try {
        security.updateKeys?.(resolve);
      } catch {
        resolve();
      }
    });
    const timeout = new Promise<void>((resolve) => browserWindow.setTimeout(resolve, 2000));
    await Promise.race([update, timeout]);
  }
  return {
    configKeyHash: security?.configKey,
    version: seb?.version
  };
}
