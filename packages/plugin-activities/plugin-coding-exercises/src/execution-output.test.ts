import { describe, expect, it } from "vitest";
import {
  capExecutionResultSummary,
  capExecutionText,
  capJudge0Output,
  MAX_EXECUTION_MESSAGE_BYTES,
  MAX_EXECUTION_OUTPUT_BYTES
} from "./execution-output";

describe("coding exercise output limits", () => {
  it("caps by UTF-8 bytes without splitting a character", () => {
    const source = "é".repeat(MAX_EXECUTION_OUTPUT_BYTES / 2 + 1);
    const capped = capExecutionText(source);
    expect(capped.truncated).toBe(true);
    expect(capped.value).toBe("é".repeat(MAX_EXECUTION_OUTPUT_BYTES / 2));
    expect(Buffer.byteLength(capped.value ?? "", "utf8")).toBeLessThanOrEqual(MAX_EXECUTION_OUTPUT_BYTES);
    expect(capExecutionText("small")).toEqual({ value: "small", truncated: false });
  });

  it("caps all Judge0 diagnostic streams and nested legacy summary messages", () => {
    const huge = "x".repeat(1024 * 1024);
    const output = capJudge0Output({ token: "token", stdout: huge, stderr: huge, compile_output: huge, message: huge });
    expect(output.outputTruncated).toBe(true);
    for (const value of [output.stdout, output.stderr, output.compileOutput]) {
      expect(Buffer.byteLength(value ?? "", "utf8")).toBe(MAX_EXECUTION_OUTPUT_BYTES);
    }
    expect(Buffer.byteLength(output.message ?? "", "utf8")).toBe(MAX_EXECUTION_MESSAGE_BYTES);

    const legacy = { tests: [{ message: huge, stdout: huge, expectedOutput: huge }] };
    const capped = capExecutionResultSummary(legacy);
    const test = (capped.value as typeof legacy).tests[0];
    expect(capped.truncated).toBe(true);
    expect(test.message).toHaveLength(MAX_EXECUTION_MESSAGE_BYTES);
    expect(test.stdout).toHaveLength(MAX_EXECUTION_OUTPUT_BYTES);
    expect(test.expectedOutput).toHaveLength(huge.length);
    expect(legacy.tests[0].stdout).toHaveLength(huge.length);
  });
});
