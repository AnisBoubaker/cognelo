import { createAuthenticatedApi } from "./auth";
import { responseJson } from "./activity-suite";

export async function ensureContentTypePluginEnabled(key: string) {
  const admin = await createAuthenticatedApi("admin");
  try {
    const { plugins } = await responseJson<{ plugins: Array<{ key: string; isActivated: boolean; isEnabled: boolean }> }>(await admin.get("/api/content-type-plugins"));
    const plugin = plugins.find((entry) => entry.key === key);
    if (!plugin) throw new Error(`The content plugin ${key} is not installed.`);
    if (!plugin.isActivated) await responseJson(await admin.patch(`/api/content-type-plugins/${key}`, { data: { action: "activate" } }));
    if (!plugin.isEnabled) await responseJson(await admin.patch(`/api/content-type-plugins/${key}`, { data: { isEnabled: true } }));
  } finally { await admin.dispose(); }
}
