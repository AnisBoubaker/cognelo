import { handleRoute, json, options, AUTH_COOKIE } from "@/lib/http";

export function OPTIONS() {
  return options();
}

export async function POST() {
  return handleRoute(async () => {
    const response = json({ ok: true });
    response.cookies.set({ name: AUTH_COOKIE, value: "", path: "/", maxAge: 0 });
    return response;
  });
}
