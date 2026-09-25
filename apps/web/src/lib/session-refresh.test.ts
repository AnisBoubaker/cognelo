import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { createSessionRefresher } from "./session-refresh";

describe("session refresher", () => {
  it("keeps a valid user when a temporary server failure occurs", async () => {
    const onAuthenticated = vi.fn();
    const onUnauthorized = vi.fn();
    const onUnavailable = vi.fn();
    const refresh = createSessionRefresher({
      check: vi.fn().mockRejectedValue(new ApiError("Temporary failure", { status: 503, code: "INTERNAL_ERROR" })),
      onAuthenticated,
      onUnauthorized,
      onUnavailable
    });

    await refresh();

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("treats a network interruption as unavailable rather than unauthorized", async () => {
    const onUnauthorized = vi.fn();
    const onUnavailable = vi.fn();
    const refresh = createSessionRefresher({
      check: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      onAuthenticated: vi.fn(),
      onUnauthorized,
      onUnavailable
    });

    await refresh();

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("ends the local session after a confirmed unauthorized response", async () => {
    const onUnauthorized = vi.fn();
    const onUnavailable = vi.fn();
    const refresh = createSessionRefresher({
      check: vi.fn().mockRejectedValue(new ApiError("Sign in", { status: 401, code: "UNAUTHORIZED" })),
      onAuthenticated: vi.fn(),
      onUnauthorized,
      onUnavailable
    });

    await refresh();

    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("deduplicates overlapping checks and allows a later retry", async () => {
    let resolveCheck!: (value: { user: { id: string } }) => void;
    const firstCheck = new Promise<{ user: { id: string } }>((resolve) => {
      resolveCheck = resolve;
    });
    const check = vi.fn()
      .mockReturnValueOnce(firstCheck)
      .mockResolvedValueOnce({ user: { id: "user-1" } });
    const onAuthenticated = vi.fn();
    const refresh = createSessionRefresher({
      check,
      onAuthenticated,
      onUnauthorized: vi.fn(),
      onUnavailable: vi.fn()
    });

    const first = refresh();
    const overlapping = refresh();
    expect(overlapping).toBe(first);
    expect(check).toHaveBeenCalledOnce();

    resolveCheck({ user: { id: "user-1" } });
    await first;
    await refresh();

    expect(check).toHaveBeenCalledTimes(2);
    expect(onAuthenticated).toHaveBeenCalledTimes(2);
  });
});
