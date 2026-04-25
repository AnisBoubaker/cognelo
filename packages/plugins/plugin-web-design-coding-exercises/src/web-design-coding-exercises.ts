import { z } from "zod";

export const webDesignFileLanguageSchema = z.enum(["html", "css", "javascript"]);

export type WebDesignFileLanguage = z.infer<typeof webDesignFileLanguageSchema>;

export const webDesignExerciseFileSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1).max(120),
  language: webDesignFileLanguageSchema,
  starterCode: z.string().max(120000),
  isEditable: z.boolean().default(true),
  orderIndex: z.number().int().min(0).default(0)
});

export type WebDesignExerciseFile = z.infer<typeof webDesignExerciseFileSchema>;

export const webDesignExerciseConfigSchema = z.object({
  prompt: z.string().max(20000).default(""),
  files: z.array(webDesignExerciseFileSchema).min(1).max(12),
  previewEntry: z.string().min(1).max(120).default("index.html"),
  maxEditorSeconds: z.number().int().min(60).max(24 * 60 * 60).default(1800)
});

export type WebDesignExerciseConfig = z.infer<typeof webDesignExerciseConfigSchema>;

export const defaultWebDesignExerciseFiles: WebDesignExerciseFile[] = [
  {
    id: "index-html",
    path: "index.html",
    language: "html",
    starterCode:
      '<main class="page">\n  <h1>Design a profile card</h1>\n  <article class="card">\n    <h2>Ada Lovelace</h2>\n    <p>Build a polished card with layout, color, and interaction.</p>\n    <button>Follow</button>\n  </article>\n</main>',
    isEditable: true,
    orderIndex: 0
  },
  {
    id: "styles-css",
    path: "styles.css",
    language: "css",
    starterCode:
      "body {\n  margin: 0;\n  font-family: system-ui, sans-serif;\n  background: #f4f7fb;\n  color: #162033;\n}\n\n.page {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  gap: 1rem;\n}\n\n.card {\n  width: min(320px, 90vw);\n  padding: 1.25rem;\n  border: 1px solid #d7deea;\n  border-radius: 8px;\n  background: white;\n}\n\nbutton {\n  border: 0;\n  border-radius: 6px;\n  padding: 0.65rem 1rem;\n  background: #2454d6;\n  color: white;\n}",
    isEditable: true,
    orderIndex: 1
  },
  {
    id: "script-js",
    path: "script.js",
    language: "javascript",
    starterCode:
      'const button = document.querySelector("button");\n\nbutton?.addEventListener("click", () => {\n  button.textContent = button.textContent === "Follow" ? "Following" : "Follow";\n});',
    isEditable: true,
    orderIndex: 2
  }
];

export const defaultWebDesignExerciseConfig: WebDesignExerciseConfig = {
  prompt: "Create a responsive profile card. Use HTML for structure, CSS for layout and polish, and JavaScript for the button interaction.",
  files: defaultWebDesignExerciseFiles,
  previewEntry: "index.html",
  maxEditorSeconds: 1800
};

export function parseWebDesignExerciseConfig(value: unknown): WebDesignExerciseConfig {
  const parsed = webDesignExerciseConfigSchema.safeParse(value);
  if (parsed.success) {
    return normalizeWebDesignExerciseConfig(parsed.data);
  }

  return defaultWebDesignExerciseConfig;
}

export function normalizeWebDesignExerciseConfig(config: WebDesignExerciseConfig): WebDesignExerciseConfig {
  const seenPaths = new Set<string>();
  const files = config.files
    .map((file, index) => ({
      ...file,
      id: file.id.trim() || `file-${index + 1}`,
      path: normalizeWebDesignFilePath(file.path),
      orderIndex: Number.isInteger(file.orderIndex) ? file.orderIndex : index
    }))
    .filter((file) => {
      if (!file.path || seenPaths.has(file.path)) {
        return false;
      }
      seenPaths.add(file.path);
      return true;
    })
    .sort((left, right) => left.orderIndex - right.orderIndex || left.path.localeCompare(right.path));

  return {
    ...config,
    files: files.length ? files : defaultWebDesignExerciseFiles,
    previewEntry: normalizeWebDesignFilePath(config.previewEntry || "index.html")
  };
}

export function normalizeWebDesignFilePath(path: string) {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

export function inferWebDesignFileLanguage(path: string): WebDesignFileLanguage {
  const normalized = normalizeWebDesignFilePath(path).toLowerCase();
  if (normalized.endsWith(".css")) {
    return "css";
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".mjs")) {
    return "javascript";
  }
  return "html";
}

export function buildWebDesignPreviewDocument(files: readonly Pick<WebDesignExerciseFile, "path" | "language" | "starterCode">[]) {
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const htmlFile = sortedFiles.find((file) => file.language === "html");
  const cssFiles = sortedFiles.filter((file) => file.language === "css");
  const jsFiles = sortedFiles.filter((file) => file.language === "javascript");
  const html = htmlFile?.starterCode.trim() || "<main></main>";
  const styles = cssFiles.map((file) => `/* ${file.path} */\n${file.starterCode}`).join("\n\n");
  const scripts = jsFiles.map((file) => `// ${file.path}\n${file.starterCode}`).join("\n\n");
  const safeStyles = styles.replace(/<\/style/gi, "<\\/style");
  const safeScripts = scripts.replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script>
${buildPreviewConsoleBridge()}
  </script>
  <style>
${safeStyles}
  </style>
</head>
<body>
${html}
  <script>
${safeScripts}
  </script>
</body>
</html>`;
}

function buildPreviewConsoleBridge() {
  return `(function () {
  var messageType = "cognelo:web-design-console";
  function serialize(value) {
    try {
      if (value instanceof Error) {
        return value.name + ": " + value.message;
      }
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "undefined") {
        return "undefined";
      }
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  function emit(level, values) {
    window.parent.postMessage({
      type: messageType,
      level: level,
      values: Array.prototype.map.call(values, serialize)
    }, "*");
  }
  ["debug", "error", "info", "log", "warn"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : console.log.bind(console);
    console[level] = function () {
      emit(level, arguments);
      original.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (event) {
    emit("error", [event.message + (event.lineno ? " (" + event.lineno + ":" + event.colno + ")" : "")]);
  });
  window.addEventListener("unhandledrejection", function (event) {
    emit("error", ["Unhandled promise rejection: " + serialize(event.reason)]);
  });
})();`;
}
