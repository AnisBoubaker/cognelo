import { describe, expect, it, vi } from "vitest";
import { registerActivityPlugin, getActivityDefinition, type GradebookActionDefinition } from "./index";
import { validateGradebookActionServerContracts, type ServerActivityPlugin } from "./server";
const labels = { en: "Download", fr: "Télécharger", zh: "下载", ar: "تنزيل" };
const action: GradebookActionDefinition = { id: "download-work", kind: "download", scope: "participant", labels };
const definition = { key: "gradebook-contract-test", name: "Contract", description: "", studentView: { mode: "read_only" as const } };
const register = (gradebookActions: GradebookActionDefinition[]) => registerActivityPlugin({ key: "gradebook-contract", name: "Contract", packageName: "test", db: { namespace: "test", tables: [] }, activities: [{ ...definition, gradebookActions }] });
it("retains activity-owned localized gradebook action metadata", () => { register([action]); expect(getActivityDefinition(definition.key)?.gradebookActions).toEqual([action]); });
it.each([[{ ...action, id: "bad id" }], [action, action], [{ ...action, labels: { ...labels, fr: "" } }]].map(actions => ({ actions })))("rejects ambiguous declarations %j", ({ actions }) => expect(() => register(actions)).toThrow("Invalid gradebook actions"));
describe("server action contract", () => {
  const service: ServerActivityPlugin = { key: "test", gradebookActions: { activityTypeKeys: [definition.key], availability: vi.fn(), execute: vi.fn() } };
  it("requires exactly one service for declared actions", () => {
    expect(() => validateGradebookActionServerContracts([{ ...definition, gradebookActions: [action] }], [service])).not.toThrow();
    expect(() => validateGradebookActionServerContracts([{ ...definition, gradebookActions: [action] }], [])).toThrow("require one server");
    expect(() => validateGradebookActionServerContracts([{ ...definition, gradebookActions: [action] }], [service, service])).toThrow("require one server");
    expect(() => validateGradebookActionServerContracts([definition], [service])).toThrow("no declared actions");
  });
});
