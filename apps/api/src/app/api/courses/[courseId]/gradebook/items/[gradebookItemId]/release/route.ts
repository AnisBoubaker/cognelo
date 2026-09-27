import { NextRequest } from "next/server";
import { AppError, getCourseGradebook, setGradebookItemRelease } from "@cognelo/core";
import { handleRoute, json, options, readJson, requireUser } from "@/lib/http";
import { resolveCourseGradebookCompletions } from "@/lib/gradebook-completion";

type Params = { params: Promise<{ courseId: string; gradebookItemId: string }> };

export function OPTIONS() {
  return options();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handleRoute(async () => {
    const user = await requireUser();
    const { courseId, gradebookItemId } = await params;
    const body = await readJson(request);
    const released = Boolean((body as { released?: unknown }).released);
    if (released) {
      const gradebook = await resolveCourseGradebookCompletions(user, courseId, await getCourseGradebook(user, courseId));
      const item = gradebook.items.find((candidate) => candidate.gradebookItemId === gradebookItemId);
      if (item && !item.gradesReleased && !item.canReleaseGrades) {
        throw new AppError(
          409,
          "GRADEBOOK_ITEM_INCOMPLETE",
          `Grades cannot be released while ${item.incompleteGradeCount} submitted grade${item.incompleteGradeCount === 1 ? " is" : "s are"} incomplete.`,
          { incompleteGradeCount: item.incompleteGradeCount }
        );
      }
    }
    return json({ gradebookItem: await setGradebookItemRelease(user, courseId, gradebookItemId, { released }) });
  });
}
