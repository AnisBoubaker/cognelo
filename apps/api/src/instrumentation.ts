export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@cognelo/activity-sdk/server");
    const { registerActivityVariationBackgroundJobs } = await import("@/lib/activity-variations");
    registerActivityVariationBackgroundJobs();
    const { startDefaultBackgroundJobWorker } = await import("@cognelo/core");
    startDefaultBackgroundJobWorker();
  }
}
