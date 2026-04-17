import type { CurrentUser } from "@cognara/contracts";

export async function getMe(user: CurrentUser) {
  return user;
}
