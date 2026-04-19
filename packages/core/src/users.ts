import type { CurrentUser } from "@cognelo/contracts";

export async function getMe(user: CurrentUser) {
  return user;
}
