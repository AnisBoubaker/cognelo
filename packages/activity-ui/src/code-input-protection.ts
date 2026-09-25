export const codeInputProtectionAttributes = {
  autoCapitalize: "off",
  autoComplete: "off",
  autoCorrect: "off",
  "data-enable-grammarly": "false",
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-ms-editor": "false",
  spellCheck: false,
  translate: "no" as const,
  writingsuggestions: "false"
};

export function protectCodeInput(element: HTMLElement | null) {
  if (!element) return;

  element.setAttribute("autocapitalize", "off");
  element.setAttribute("autocomplete", "off");
  element.setAttribute("autocorrect", "off");
  element.setAttribute("data-enable-grammarly", "false");
  element.setAttribute("data-gramm", "false");
  element.setAttribute("data-gramm_editor", "false");
  element.setAttribute("data-ms-editor", "false");
  element.setAttribute("spellcheck", "false");
  element.setAttribute("translate", "no");
  element.setAttribute("writingsuggestions", "false");
}
