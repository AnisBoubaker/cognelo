import { createServer, type IncomingMessage } from "node:http";
import { chromium, expect, type Page } from "@playwright/test";
import { z } from "zod";

const fileSchema = z.object({
  path: z.string().min(1).max(120),
  language: z.enum(["html", "css", "javascript"]),
  starterCode: z.string().max(120000)
});

const testSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  testCode: z.string().min(1).max(80000),
  weight: z.number().int().min(0).default(1)
});

const runInputSchema = z.object({
  files: z.array(fileSchema).min(1).max(12),
  tests: z.array(testSchema).max(80),
  timeoutMs: z.number().int().min(1000).max(30000).default(8000)
});

type RunInput = z.infer<typeof runInputSchema>;

const port = Number(process.env.PORT ?? 3456);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");

  try {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method !== "POST" || request.url !== "/run") {
      response.writeHead(404);
      response.end(JSON.stringify({ error: { message: "Not found." } }));
      return;
    }

    const input = runInputSchema.parse(JSON.parse(await readBody(request)));
    const result = await runWebDesignTests(input);
    response.writeHead(200);
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(400);
    response.end(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : "Runner request failed."
        }
      })
    );
  }
});

server.listen(port, () => {
  console.log(`Web design runner listening on ${port}`);
});

async function runWebDesignTests(input: RunInput) {
  const browser = await chromium.launch({
    headless: true
  });
  const startedAt = Date.now();

  try {
    const context = await browser.newContext({
      javaScriptEnabled: true
    });
    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);
    await page.setContent(buildPreviewDocument(input.files), {
      waitUntil: "load",
      timeout: input.timeoutMs
    });

    const results = [];
    for (const test of input.tests) {
      const testStartedAt = Date.now();
      try {
        await runSingleTest(page, test.testCode, input.timeoutMs);
        results.push({
          id: test.id,
          name: test.name,
          status: "completed",
          weight: test.weight,
          score: test.weight,
          durationMs: Date.now() - testStartedAt,
          message: null,
          details: {}
        });
      } catch (error) {
        results.push({
          id: test.id,
          name: test.name,
          status: "failed",
          weight: test.weight,
          score: 0,
          durationMs: Date.now() - testStartedAt,
          message: error instanceof Error ? error.message : "Test failed.",
          details: {}
        });
      }
    }

    const maxScore = results.reduce((sum, result) => sum + result.weight, 0);
    const score = results.reduce((sum, result) => sum + result.score, 0);
    return {
      status: results.every((result) => result.status === "completed") ? "completed" : "failed",
      score,
      maxScore,
      durationMs: Date.now() - startedAt,
      tests: results
    };
  } finally {
    await browser.close();
  }
}

async function runSingleTest(page: Page, testCode: string, timeoutMs: number) {
  const execute = new Function("page", "expect", `"use strict"; return (async () => {\n${testCode}\n})();`);
  await Promise.race([
    execute(page, expect),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms.`)), timeoutMs);
    })
  ]);
}

function buildPreviewDocument(files: RunInput["files"]) {
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const htmlFile = sortedFiles.find((file) => file.language === "html");
  const css = sortedFiles
    .filter((file) => file.language === "css")
    .map((file) => `/* ${file.path} */\n${file.starterCode}`)
    .join("\n\n")
    .replace(/<\/style/gi, "<\\/style");
  const js = sortedFiles
    .filter((file) => file.language === "javascript")
    .map((file) => `// ${file.path}\n${file.starterCode}`)
    .join("\n\n")
    .replace(/<\/script/gi, "<\\/script");
  const html = htmlFile?.starterCode.trim() || "<main></main>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>
${html}
  <script>${js}</script>
</body>
</html>`;
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
