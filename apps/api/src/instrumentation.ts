export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Development recompiles plugin modules independently, so cross-registry validation can
    // briefly observe a partial hot-reload graph. Production starts from one complete graph;
    // the same invariant is also exercised directly by the activity SDK test suite.
    if (process.env.NODE_ENV !== "development") {
      const serverActivitySdk = await import("@cognelo/activity-sdk/server");
      const activitySdk = await import("@cognelo/activity-sdk");
      serverActivitySdk.validateStudentPreviewServerContracts(
        activitySdk.listActivityDefinitions(),
        serverActivitySdk.listServerActivityPlugins()
      );
    }
    const { registerActivityVariationBackgroundJobs } = await import("@/lib/activity-variations");
    registerActivityVariationBackgroundJobs();
    const { startDefaultBackgroundJobWorker } = await import("@cognelo/core");
    startDefaultBackgroundJobWorker();
  }
}
