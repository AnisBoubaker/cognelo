import { describe, expect, it } from "vitest";
import { markdownImageWidth, readMarkdownImageSize, writeMarkdownImageSize } from "./image-sizing";

describe("Markdown image URI sizing", () => {
  it("round-trips pixel sizing while retaining unrelated URI fragments", () => {
    const source = writeMarkdownImageSize("/image.png#page=2", {
      mode: "pixels",
      originalWidth: null,
      value: 320
    });

    expect(source).toBe("/image.png#page=2&cognelo-size=px:320");
    expect(readMarkdownImageSize(source)).toEqual({ mode: "pixels", originalWidth: null, value: 320 });
    expect(markdownImageWidth(readMarkdownImageSize(source))).toBe("320px");
  });

  it("keeps the original width needed to reproduce intrinsic percentages", () => {
    const source = writeMarkdownImageSize("/image.png", {
      mode: "original-percent",
      originalWidth: 1280,
      value: 62.5
    });

    expect(source).toBe("/image.png#cognelo-size=original:62.5:1280");
    expect(markdownImageWidth(readMarkdownImageSize(source))).toBe("800px");
  });

  it("renders container percentages directly and rejects invalid metadata", () => {
    const source = writeMarkdownImageSize("/image.png", {
      mode: "container-percent",
      originalWidth: null,
      value: 75
    });

    expect(source).toBe("/image.png#cognelo-size=container:75");
    expect(markdownImageWidth(readMarkdownImageSize(source))).toBe("75%");
    expect(readMarkdownImageSize("/image.png#cognelo-size=container:150")).toBeNull();
  });
});
