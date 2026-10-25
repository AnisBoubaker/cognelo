import { getActivityDefinition } from "@cognelo/activity-sdk";

/** Explicit transport projection. Never spread database authoring records here. */
export function projectStudentActivity(activity: {
  id: string; title: string; description: string; lifecycle: string;
  config?: unknown; activityType: { key: string; name: string; description: string };
}, includeContent = true) {
  const definition = getActivityDefinition(activity.activityType.key);
  const config = activity.config && typeof activity.config === "object" && !Array.isArray(activity.config)
    ? activity.config as Record<string, unknown> : {};
  return {
    id: activity.id, title: activity.title, description: includeContent ? activity.description : "", lifecycle: activity.lifecycle,
    activityType: { key: activity.activityType.key, name: activity.activityType.name, description: activity.activityType.description },
    config: includeContent ? definition?.studentConfig?.(config) ?? {} : {}, metadata: {}
  };
}
