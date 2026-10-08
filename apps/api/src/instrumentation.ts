export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const serverActivitySdk = await import("@cognelo/activity-sdk/server");
    const activitySdk = await import("@cognelo/activity-sdk");
    serverActivitySdk.validateStudentPreviewServerContracts(
      activitySdk.listActivityDefinitions(),
      serverActivitySdk.listServerActivityPlugins()
    );
    const { registerActivityVariationBackgroundJobs } = await import("@/lib/activity-variations");
    registerActivityVariationBackgroundJobs();
    const { startDefaultBackgroundJobWorker } = await import("@cognelo/core");
    startDefaultBackgroundJobWorker();
  }
}
