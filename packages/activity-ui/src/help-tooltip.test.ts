import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateHelpPosition, HelpLabel, HelpProvider, helpLabelText } from "./help-tooltip";
describe("shared contextual help", () => {
  it("preserves form labels and places a non-submitting localized help control after them", () => {
    const html = renderToStaticMarkup(createElement(HelpProvider, { locale: "fr", children: createElement(HelpLabel, { help: "Explication", children: createElement("label", { htmlFor: "field" }, "Échéance") }) }));
    expect(html).toContain('type="button"'); expect(html).toContain('aria-label="Aide: Échéance"');
    expect(html.indexOf("</label>")).toBeLessThan(html.indexOf('<button')); expect(html).not.toContain('role="tooltip"');
  });
  it("keeps headings free of help text and derives names without including form values", () => {
    expect(helpLabelText(createElement("label", null, "Model", createElement("select", null, createElement("option", null, "Private model")), createElement("small", { "aria-hidden": true }, "On")))).toBe("Model");
    const html = renderToStaticMarkup(createElement(HelpLabel, { help: "Details", children: createElement("h3", null, "Reference materials") }));
    expect(html).toContain('<h3>Reference materials</h3>'); expect(html).not.toContain('<h3><button');
  });
  it("omits an empty conditional help control", () => {
    expect(renderToStaticMarkup(createElement(HelpLabel, { help: null, children: createElement("h3", null, "Title") }))).toBe("<h3>Title</h3>");
  });
  it("flips above near the viewport edge and clamps narrow/RTL placements", () => {
    expect(calculateHelpPosition({ left: 12, right: 36, top: 100, bottom: 124 }, 360, 120, 1280, 800)).toEqual({ left: 12, top: 132 });
    expect(calculateHelpPosition({ left: 360, right: 384, top: 720, bottom: 744 }, 360, 120, 390, 844)).toEqual({ left: 18, top: 592 });
    expect(calculateHelpPosition({ left: 800, right: 824, top: 100, bottom: 124 }, 360, 120, 1280, 800, true).left).toBe(464);
  });
});
