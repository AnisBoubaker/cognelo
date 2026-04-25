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
  const safeStyles = styles.replace(/<\/style/gi, "<\\/style");
  const scriptPayload = jsFiles.map((file) => ({
    path: file.path,
    source: `${file.starterCode}\n//# sourceURL=cognelo-preview/${file.path}`
  }));

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
${buildPreviewScriptRunner(scriptPayload)}
  </script>
</body>
</html>`;
}

function buildPreviewScriptRunner(scripts: Array<{ path: string; source: string }>) {
  return `(function () {
  var scripts = ${JSON.stringify(scripts).replace(/<\/script/gi, "<\\/script")};
  scripts.forEach(function (script) {
    try {
      var scriptElement = document.createElement("script");
      var blob = new Blob([script.source], { type: "text/javascript" });
      var url = URL.createObjectURL(blob);
      window.__cogneloPreviewScriptUrls[url] = script.path;
      scriptElement.src = url;
      scriptElement.addEventListener("error", function () {
        console.error(script.path + ": Unable to load script.");
      });
      document.body.appendChild(scriptElement);
    } catch (error) {
      console.error(window.__cogneloFormatPreviewError(script.path, error));
    }
  });
})();`;
}

function buildPreviewConsoleBridge() {
  return `(function () {
  var messageType = "cognelo:web-design-console";
  window.__cogneloPreviewScriptUrls = {};
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
    if (values.length === 1 && values[0] === "Script error.") {
      values = ["Script error. The browser hid the original error; check syntax and code running from external resources."];
    }
    window.parent.postMessage({
      type: messageType,
      level: level,
      values: Array.prototype.map.call(values, serialize)
    }, "*");
  }
  function getFriendlySource(sourcePath) {
    if (!sourcePath) {
      return "preview";
    }
    if (window.__cogneloPreviewScriptUrls[sourcePath]) {
      return window.__cogneloPreviewScriptUrls[sourcePath];
    }
    var sourceMatch = sourcePath.match(/cognelo-preview\\/([^\\s)]+)$/);
    if (sourceMatch) {
      return sourceMatch[1];
    }
    if (sourcePath.indexOf("blob:") === 0) {
      return "script.js";
    }
    return sourcePath;
  }
  function getStackLocation(stack) {
    var lines = String(stack || "").split("\\n");
    for (var index = 0; index < lines.length; index += 1) {
      var blobMatch = lines[index].match(/(blob:[^\\s)]+):(\\d+):(\\d+)/);
      if (blobMatch) {
        return {
          source: getFriendlySource(blobMatch[1]),
          line: blobMatch[2],
          column: blobMatch[3]
        };
      }

      var sourceMatch = lines[index].match(/cognelo-preview\\/([^\\s)]+):(\\d+):(\\d+)/);
      if (sourceMatch) {
        return {
          source: sourceMatch[1],
          line: sourceMatch[2],
          column: sourceMatch[3]
        };
      }
    }
    return null;
  }
  window.__cogneloFormatPreviewError = function (sourcePath, error, lineNumber, columnNumber) {
    var stack = error && error.stack ? String(error.stack) : "";
    var stackLocation = getStackLocation(stack);
    var friendlySource = getFriendlySource(sourcePath);
    if ((!sourcePath || sourcePath === "preview" || sourcePath === "event handler" || sourcePath === "promise") && stackLocation) {
      friendlySource = stackLocation.source;
    }
    var name = error && error.name ? error.name : "Error";
    var message = error && error.message ? error.message : String(error);
    var displayLine = lineNumber || stackLocation && stackLocation.line;
    var displayColumn = columnNumber || stackLocation && stackLocation.column;
    var location = displayLine ? ":" + displayLine + (displayColumn ? ":" + displayColumn : "") : "";
    var headline = friendlySource + location + ": " + name + ": " + message;
    var stackLines = stack
      .split("\\n")
      .map(function (line) { return line.trim(); })
      .filter(Boolean)
      .filter(function (line) {
        return (
          line !== message &&
          line !== name + ": " + message &&
          line.indexOf("eval@[native code]") === -1 &&
          line.indexOf("forEach@[native code]") === -1 &&
          line.indexOf("global code@about:srcdoc") === -1 &&
          line.indexOf("@about:srcdoc") === -1 &&
          line.indexOf("blob:") === -1
        );
      })
      .map(function (line) {
        return line.replace(/^eval code@/, friendlySource + "@");
      });

    return stackLines.length ? headline + "\\n" + stackLines.join("\\n") : headline;
  };
  (function wrapEventListeners() {
    var originalAddEventListener = EventTarget.prototype.addEventListener;
    var originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    var listenerMap = new WeakMap();

    function getWrappedListener(listener) {
      if (typeof listener !== "function") {
        return listener;
      }

      var wrapped = listenerMap.get(listener);
      if (wrapped) {
        return wrapped;
      }

      wrapped = function () {
        try {
          return listener.apply(this, arguments);
        } catch (error) {
          console.error(window.__cogneloFormatPreviewError("event handler", error));
        }
      };
      listenerMap.set(listener, wrapped);
      return wrapped;
    }

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      return originalAddEventListener.call(this, type, getWrappedListener(listener), options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      return originalRemoveEventListener.call(this, type, getWrappedListener(listener), options);
    };
  })();
  ["debug", "error", "info", "log", "warn"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : console.log.bind(console);
    console[level] = function () {
      emit(level, arguments);
      original.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (event) {
    if (event.error) {
      emit("error", [window.__cogneloFormatPreviewError(event.filename, event.error, event.lineno, event.colno)]);
      return;
    }
    emit("error", [getFriendlySource(event.filename) + (event.lineno ? ":" + event.lineno + ":" + event.colno : "") + ": " + event.message]);
  });
  window.addEventListener("unhandledrejection", function (event) {
    emit("error", [window.__cogneloFormatPreviewError("promise", event.reason)]);
  });
})();`;
}
