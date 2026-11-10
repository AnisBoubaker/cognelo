import { ApiError } from "./api";
import type { CurrentUser } from "@cognelo/contracts";

type SessionRefresherOptions<T> = {
  check: () => Promise<T>;
  onAuthenticated: (result: T) => void;
  onUnauthorized: () => void;
  onUnavailable: (error: unknown) => void;
};

export function createSessionRefresher<T>(options: SessionRefresherOptions<T>) {
  let inFlight: Promise<void> | null = null;

  return function refreshSession() {
    if (inFlight) {
      return inFlight;
    }

    const refresh = options.check()
      .then((result) => {
        options.onAuthenticated(result);
      })
      .catch((error: unknown) => {
        if (isUnauthorizedSessionError(error)) {
          options.onUnauthorized();
          return;
        }
        options.onUnavailable(error);
      })
      .finally(() => {
        if (inFlight === refresh) {
          inFlight = null;
        }
      });

    inFlight = refresh;
    return refresh;
  };
}

export function isUnauthorizedSessionError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.code === "UNAUTHORIZED");
}

export function areCurrentUsersEqual(left: CurrentUser | null, right: CurrentUser) {
  return Boolean(
    left &&
    left.id === right.id &&
    left.email === right.email &&
    left.name === right.name &&
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.mustChangePassword === right.mustChangePassword &&
    left.emailVerified === right.emailVerified &&
    left.roles.length === right.roles.length &&
    left.roles.every((role) => right.roles.includes(role))
  );
}

/** A successful password response is insufficient if the browser rejected its cookie. */
export async function establishBrowserSession(
  authenticate: () => Promise<{ user: CurrentUser }>,
  check: () => Promise<{ user: CurrentUser }>
) {
  const result = await authenticate();
  try {
    const confirmed = await check();
    if (confirmed.user.id !== result.user.id) throw new ApiError("The browser did not establish the requested session.", { status: 401, code: "SESSION_NOT_ESTABLISHED" });
    return confirmed;
  } catch (error) {
    if (isUnauthorizedSessionError(error)) throw new ApiError("The browser did not retain the sign-in session.", { status: 401, code: "SESSION_NOT_ESTABLISHED" });
    throw error;
  }
}
