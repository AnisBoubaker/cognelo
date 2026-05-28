import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./apps/api/src", import.meta.url).pathname,
      "@cognelo/activity-sdk/server": new URL("./packages/activity-sdk/src/server.ts", import.meta.url).pathname,
      "@cognelo/activity-sdk": new URL("./packages/activity-sdk/src/index.ts", import.meta.url).pathname,
      "@cognelo/content-type-sdk/server": new URL("./packages/content-type-sdk/src/server.ts", import.meta.url).pathname,
      "@cognelo/content-type-sdk": new URL("./packages/content-type-sdk/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-file-content/server": new URL("./packages/plugin-content-types/plugin-file/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-file-content": new URL("./packages/plugin-content-types/plugin-file/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-github-repo/server": new URL("./packages/plugin-content-types/plugin-github-repo/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-github-repo": new URL("./packages/plugin-content-types/plugin-github-repo/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-text-content/server": new URL("./packages/plugin-content-types/plugin-text/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-text-content": new URL("./packages/plugin-content-types/plugin-text/src/index.ts", import.meta.url).pathname,
      "@cognelo/contracts": new URL("./packages/contracts/src/index.ts", import.meta.url).pathname,
      "@cognelo/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@cognelo/db": new URL("./packages/db/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-coding-exercises/server": new URL("./packages/plugin-activities/plugin-coding-exercises/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-coding-exercises": new URL("./packages/plugin-activities/plugin-coding-exercises/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-homework-grader/server": new URL("./packages/plugin-activities/plugin-homework-grader/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-homework-grader": new URL("./packages/plugin-activities/plugin-homework-grader/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-mcq/server": new URL("./packages/plugin-activities/plugin-mcq/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-mcq": new URL("./packages/plugin-activities/plugin-mcq/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-parsons/server": new URL("./packages/plugin-activities/plugin-parsons/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-parsons": new URL("./packages/plugin-activities/plugin-parsons/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-placeholder/server": new URL("./packages/plugin-activities/plugin-placeholder/src/server.ts", import.meta.url).pathname,
      "@cognelo/plugin-placeholder": new URL("./packages/plugin-activities/plugin-placeholder/src/index.ts", import.meta.url).pathname,
      "@cognelo/plugin-web-design-coding-exercises/server": new URL(
        "./packages/plugin-activities/plugin-web-design-coding-exercises/src/server.ts",
        import.meta.url
      ).pathname,
      "@cognelo/plugin-web-design-coding-exercises": new URL(
        "./packages/plugin-activities/plugin-web-design-coding-exercises/src/index.ts",
        import.meta.url
      ).pathname
    }
  },
  test: {
    environment: "node",
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts", "scripts/**/*.test.mjs"],
    restoreMocks: true
  }
});
