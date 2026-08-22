import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, API_UNAUTHORIZED_EVENT } from "./api";

describe("web API client", () => {
  const expectedApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds JSON headers, credentials, and parses JSON responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "user-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(api.login("teacher@example.test", "secret")).resolves.toEqual({ user: { id: "user-1" } });
    expect(fetch).toHaveBeenCalledWith(
      `${expectedApiUrl}/api/auth/login`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: "teacher@example.test", password: "secret" })
      })
    );
  });

  it("throws ApiError instances with code and details from error bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message: "Bad input.",
            details: { field: "title" }
          }
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    );

    const error = await api.me().catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: "ApiError",
      message: "Bad input.",
      code: "VALIDATION_ERROR",
      details: { field: "title" }
    });
  });

  it("sends password changes to the dedicated account endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const input = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      confirmNewPassword: "NewPassword456!"
    };

    await expect(api.changeMyPassword(input)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      `${expectedApiUrl}/api/users/me/password`,
      expect.objectContaining({ method: "PUT", body: JSON.stringify(input) })
    );
  });

  it("sends admin email tests to the settings endpoint without restricting the address", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    const input = { recipientEmail: "outside@gmail.com" };

    await expect(api.sendEmailDeliveryTest(input)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      `${expectedApiUrl}/api/settings/email/test`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) })
    );
  });

  it("dispatches the unauthorized event on 401 responses", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Sign in." } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(api.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: API_UNAUTHORIZED_EVENT }));
  });

  it("returns an empty object for empty successful responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.logout()).resolves.toEqual({});
  });
});
