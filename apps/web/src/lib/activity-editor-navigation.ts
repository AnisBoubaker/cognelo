export type ActivityReportReturnContext = {
  origin: "content" | "gradebook";
  report: "overview" | "students";
  groupId?: string;
};

export function activityReportReturnContext(search: Pick<URLSearchParams, "get">): ActivityReportReturnContext | undefined {
  if (search.get("returnTo") !== "report") return undefined;
  return {
    origin: search.get("origin") === "content" ? "content" : "gradebook",
    report: search.get("report") === "students" ? "students" : "overview",
    groupId: search.get("groupId") || undefined
  };
}

function reportParams(context: ActivityReportReturnContext) {
  const params = new URLSearchParams({ origin: context.origin, report: context.report });
  if (context.groupId) params.set("groupId", context.groupId);
  return params;
}

export function activityReportHref(courseId: string, activityId: string, context: ActivityReportReturnContext) {
  return `/courses/${encodeURIComponent(courseId)}/gradebook/activities/${encodeURIComponent(activityId)}?${reportParams(context)}`;
}

export function activityEditorHref(courseId: string, activityId: string, context?: ActivityReportReturnContext, testActivityId?: string) {
  const params = new URLSearchParams();
  if (testActivityId) params.set("testActivityId", testActivityId);
  if (context) {
    params.set("returnTo", "report");
    reportParams(context).forEach((value, key) => params.set(key, value));
  }
  const path = `/courses/${encodeURIComponent(courseId)}/activities/${encodeURIComponent(activityId)}`;
  return params.size ? `${path}?${params}` : path;
}
