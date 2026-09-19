import { NextRequest } from "next/server";
import { hashAiFeedbackValue, listCourseAiFeedbackResearchEvents } from "@cognelo/core";
import { handleRoute, json, options, requireUser } from "@/lib/http";

type Params = { params: Promise<{ courseId: string }> };

export function OPTIONS() {
  return options();
}

export async function GET(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId } = await params;
    const events = await listCourseAiFeedbackResearchEvents(user, courseId);
    const anonymized = request.nextUrl.searchParams.get("anonymized") !== "false";
    return json({
      events: anonymized
        ? events.map((event) => ({
            ...event,
            participantId: pseudonymize(courseId, "participant", event.participantId),
            userId: pseudonymize(courseId, "user", event.userId),
            actorUserId: pseudonymize(courseId, "actor", event.actorUserId),
            attemptId: pseudonymize(courseId, "attempt", event.attemptId)
          }))
        : events
    });
  });
}

function pseudonymize(courseId: string, namespace: string, value: string | null) {
  if (!value) return null;
  return `${namespace}_${hashAiFeedbackValue({ courseId, namespace, value }).slice(0, 24)}`;
}
