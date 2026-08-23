import { describe, expect, it } from "vitest";
import { formatCogneloVersion } from "./app-version";

describe("application version label", () => {
  it("formats a supplied build version", () => {
    expect(formatCogneloVersion(" 0.6.0 ")).toBe("Cognelo ver. 0.6.0");
  });

  it("makes missing build metadata explicit", () => {
    expect(formatCogneloVersion(undefined)).toBe("Cognelo ver. unknown");
  });
});
