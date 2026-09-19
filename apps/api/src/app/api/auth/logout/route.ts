import { handleRoute, json, options, AUTH_COOKIE } from "@/lib/http";
import { SAFE_EXAM_BROWSER_ACCESS_COOKIE } from "@/lib/safe-exam-browser";

export function OPTIONS() {
  return options();
}

export async function POST() {
  return handleRoute(async () => {
    const response = json({ ok: true });
    response.cookies.set({ name: AUTH_COOKIE, value: "", path: "/", maxAge: 0 });
    response.cookies.set({ name: SAFE_EXAM_BROWSER_ACCESS_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
  });
}
