import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressDialog } from "./progress-dialog";

describe("ProgressDialog", () => {
  it("renders a determinate blocking progress bar and clamps its value", () => {
    const html = renderToStaticMarkup(createElement(ProgressDialog, {
      open: true,
      title: "Importing",
      progressLabel: "Import progress",
      progress: 120,
      progressSummary: "10 of 10"
    }));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('value="100"');
    expect(html).toContain("100%");
    expect(html).toContain("10 of 10");
    expect(html).not.toContain("<button");
  });

  it("uses an indeterminate bar when no measurable progress exists", () => {
    const html = renderToStaticMarkup(createElement(ProgressDialog, {
      open: true,
      title: "Generating",
      progressLabel: "Generation in progress"
    }));

    expect(html).toContain("<progress");
    expect(html).not.toContain("value=");
    expect(html).toContain("Generation in progress");
  });

  it("offers a close action only after the operation has ended", () => {
    const html = renderToStaticMarkup(createElement(ProgressDialog, {
      open: true,
      title: "Complete",
      progressLabel: "Progress",
      progress: 100,
      status: "success",
      closeLabel: "Close",
      onClose: () => undefined
    }));

    expect(html).toContain('aria-busy="false"');
    expect(html).toContain(">Close</button>");
  });
});
