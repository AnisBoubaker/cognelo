import { describe, expect, it } from "vitest";
import { getActivityDefinition, registerActivityPlugin, type ActivityDefinition, type SubmissionStageDefinition } from "./index";
const names = { en: "Files", fr: "Fichiers", zh: "文件", ar: "ملفات" };
const definition: ActivityDefinition = { key: "stage-contract", name: "Stages", description: "Stage contract", studentView: { mode: "read_only" } };
const register = (stages: SubmissionStageDefinition[]) => registerActivityPlugin({ key: "stage-contract-provider", name: "Stages", packageName: "test", db: { namespace: "stage_contract_test", tables: [] }, activities: [{ ...definition, submissionStages: stages }] });
describe("declared submission-stage capabilities", () => {
  it("retains the first stage's localized name and derives the count from the ordered list", () => {
    register([{ id: "files", names }, { id: "answers", names: { ...names, en: "Answers" }, assessment: true }]);
    expect(getActivityDefinition("stage-contract")?.submissionStages).toHaveLength(2);
    expect(getActivityDefinition("stage-contract")?.submissionStages?.[0]).toEqual({ id: "files", names });
  });
  it.each([[], [{ id: "files", names }, { id: "files", names }], [{ id: "first", names, assessment: true }, { id: "second", names, assessment: true }], [{ id: "bad id", names }], [{ id: "files", names: { ...names, fr: "" } }]].map(stages => ({ stages }))) ("rejects invalid or ambiguous stage declarations %j", ({ stages }) => expect(() => register(stages)).toThrow("Invalid submission stages"));
});
