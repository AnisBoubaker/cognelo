import { ApiError } from "./api";

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
