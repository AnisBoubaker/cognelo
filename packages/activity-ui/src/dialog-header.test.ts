import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "./confirmation-dialog";
import { DialogCloseButton, DialogCloseLabelProvider, DialogHeader, getDialogCloseLabel } from "./dialog-header";

describe("dialog dismissal", () => {
  it("renders an icon-only, named non-submit button alongside the heading", () => {
    const html = renderToStaticMarkup(createElement(DialogHeader, {
      closeLabel: "Fermer", onClose: vi.fn()
    }, createElement("h2", null, "Modifier")));
    expect(html).toContain('aria-label="Fermer"');
    expect(html).toContain('title="Fermer"');
    expect(html).toContain('type="button"');
    expect(html.replace(/<[^>]*>/g, "")).toBe("Modifier");
  });

  it("invokes the existing dismissal callback, including a guarded async callback", async () => {
    const close = vi.fn(async () => undefined);
    const button = DialogCloseButton({ label: "Close", onClose: close });
    button.props.onClick();
    expect(close).toHaveBeenCalledExactlyOnceWith();
  });

  it("keeps busy dismissal disabled without losing its accessible name", () => {
    const html = renderToStaticMarkup(createElement(DialogCloseButton, { label: "Close", onClose: vi.fn(), disabled: true }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Close"');
  });

  it("distinguishes the localized header cross from the explicit cancel action", () => {
    const html = renderToStaticMarkup(createElement(DialogCloseLabelProvider, { label: "Fermer" },
      createElement(ConfirmationDialog, { open: true, title: "Confirmer", message: "Message", confirmLabel: "Enregistrer",
        cancelLabel: "Annuler", onCancel: vi.fn(), onConfirm: vi.fn(), confirmDisabled: true })));
    expect(html).toContain('aria-label="Fermer"');
    expect(html.match(/<button\b/g)).toHaveLength(3);
    expect(html.replace(/<[^>]*>/g, "")).toContain("Annuler");
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });

  it("uses only the header cross to dismiss an informational alert", () => {
    const html = renderToStaticMarkup(createElement(ConfirmationDialog, { open: true, title: "Information", message: "Done",
      confirmLabel: "Close", confirmIcon: "close", onCancel: vi.fn(), onConfirm: vi.fn() }));
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Close"');
    expect(html.replace(/<[^>]*>/g, "")).not.toContain("Close");
  });

  it.each([["en", "Close"], ["fr", "Fermer"], ["zh", "关闭"], ["ar", "إغلاق"]])("provides the %s plugin dismissal label", (locale, label) => {
    expect(getDialogCloseLabel(locale)).toBe(label);
  });
});
