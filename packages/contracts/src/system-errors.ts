// Stable support codes. Add new entries to docs/SYSTEM_ERRORS.md and all UI locales.
export const SYSTEM_ERRORS = {
  "SYS-001": "Unexpected server error. Check the API logs for the original exception.",
  "SYS-002": "Database unavailable. Check that PostgreSQL is running and DATABASE_URL is reachable. For local Docker development, start Docker and run docker compose up -d db.",
  "SYS-003": "Database configuration rejected. Check DATABASE_URL, database credentials, database existence, permissions and TLS settings.",
  "SYS-004": "Database schema is incompatible with this application version. Run npm run db:migrate:all against the intended database and restart the development servers.",
  "SYS-005": "Database request timed out or the connection pool is full. Check database health, load and connection limits before retrying.",
  "SYS-006": "A server operation or dependency failed. Check the API logs and the configured service's availability and credentials.",
  "SYS-007": "Cannot reach the API. Check that the API server is running, NEXT_PUBLIC_API_URL is correct, and the network, CORS and proxy settings allow the request.",
  "SYS-008": "The API returned an invalid response. Check the API/proxy logs and that web and API versions match. Startup also requires a valid server timestamp and IANA timezone."
} as const;

export type SystemErrorCode = keyof typeof SYSTEM_ERRORS;

export function isSystemErrorCode(value: unknown): value is SystemErrorCode {
  return typeof value === "string" && Object.hasOwn(SYSTEM_ERRORS, value);
}

export function systemErrorMessage(code: SystemErrorCode, development = false) {
  const message = `System error (${code}).`;
  return development ? `${message} ${SYSTEM_ERRORS[code]}` : message;
}
