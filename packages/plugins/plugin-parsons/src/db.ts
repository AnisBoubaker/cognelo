export const parsonsDatabaseModule = {
  namespace: "plugin_parsons",
  tables: ["PluginParsonsAttempt", "PluginParsonsAttemptEvent"],
  notes: [
    "Parsons owns its attempt persistence under the plugin namespace so behavioral analytics and research instrumentation stay isolated from core activity tables."
  ]
} as const;
