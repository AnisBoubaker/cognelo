import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const coursePageFiles = [
  "apps/web/src/app/courses/[courseId]/page.tsx",
  "apps/web/src/app/courses/[courseId]/groups/[groupId]/page.tsx"
];

describe("content type UI boundaries", () => {
  it("keeps concrete content type keys out of course page branching", () => {
    const banned = [`github${"_"}repo`, `kind === "file"`, `kind === "text"`, `contentTypeKey === "file"`, `contentTypeKey === "text"`];

    for (const file of coursePageFiles) {
      const source = readFileSync(file, "utf8");
      for (const pattern of banned) {
        expect(source, `${file} should not branch on ${pattern}`).not.toContain(pattern);
      }
    }
  });
});
