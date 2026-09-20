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

export function assignmentRequiresSafeExamBrowser(metadata: unknown) {
  return Boolean(metadata) && typeof metadata === "object" &&
    (metadata as Record<string, unknown>).requireSafeExamBrowser === true;
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
