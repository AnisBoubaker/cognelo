import { describe, expect, it } from "vitest";
import { ContentTypeIcon, resolveContentTypeRenderer, resolveContentTypeSettingsRenderer } from "./content-type-renderers";

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
});
