import { describe, expect, it } from "vitest";
import { ContentTypeIcon, resolveContentTypeRenderer, resolveContentTypeSettingsRenderer } from "./content-type-renderers";
import { fileIconKindForMimeType } from "../components/app-icon";

describe("content type renderer registry", () => {
  it("returns null for unregistered renderer keys", () => {
    expect(resolveContentTypeRenderer("missing-renderer")).toBeNull();
    expect(resolveContentTypeSettingsRenderer("missing-settings-renderer")).toBeNull();
    expect(resolveContentTypeRenderer(undefined)).toBeNull();
  });

  it("registers concrete content type settings renderers", () => {
    expect(resolveContentTypeSettingsRenderer("file-content-settings")).toBeTypeOf("function");
    expect(resolveContentTypeSettingsRenderer("github-repo-settings")).toBeTypeOf("function");
    expect(resolveContentTypeSettingsRenderer("text-content-settings")).toBeTypeOf("function");
  });

  it("renders a generic icon element for content type icon names", () => {
    const element = ContentTypeIcon({ iconName: "github" });

    expect(element).toMatchObject({
      props: {
        className: "activity-type-icon"
      }
    });
  });

  it("selects file icons from normalized MIME types", () => {
    expect(fileIconKindForMimeType("application/pdf")).toBe("pdf");
    expect(fileIconKindForMimeType("image/png")).toBe("image");
    expect(fileIconKindForMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("spreadsheet");
    expect(fileIconKindForMimeType("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("presentation");
    expect(fileIconKindForMimeType("application/json; charset=utf-8")).toBe("code");
    expect(fileIconKindForMimeType("application/octet-stream")).toBe("file");
  });
});
