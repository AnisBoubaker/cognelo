import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditActionBar, getEditActionBarCopy } from "./edit-action-bar";

describe("EditActionBar", () => {
  it("shows the saved state and disables draft actions when clean", () => {
    const html = renderToStaticMarkup(createElement(EditActionBar, {
      isDirty: false,
      savedLabel: "Everything is saved.",
      unsavedLabel: "Unsaved",
      saveLabel: "Save",
      savingLabel: "Saving",
      cancelLabel: "Cancel"
    }));

    expect(html).toContain("Everything is saved.");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("provides localized shared action copy", () => {
    expect(getEditActionBarCopy("fr").unsaved).toContain("non enregistrées");
    expect(getEditActionBarCopy("ar").cancel).toBe("إلغاء");
    expect(getEditActionBarCopy("unsupported")).toEqual(getEditActionBarCopy("en"));
  });
});
