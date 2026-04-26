import { createServer, type IncomingMessage } from "node:http";
import { chromium, expect, type Page } from "@playwright/test";
import sharp from "sharp";
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

const screenshotInputSchema = z.object({
  files: z.array(fileSchema).min(1).max(12),
  timeoutMs: z.number().int().min(1000).max(30000).default(8000),
  trimWhitespace: z.boolean().default(false),
  viewport: z
    .object({
      width: z.number().int().min(320).max(1920).default(1024),
      height: z.number().int().min(240).max(2000).default(768)
    })
    .default({ width: 1024, height: 768 })
});

type RunInput = z.infer<typeof runInputSchema>;
type ScreenshotInput = z.infer<typeof screenshotInputSchema>;

const port = Number(process.env.PORT ?? 3456);
const screenshotWhitespacePadding = 150;
const screenshotBackgroundTolerance = 12;

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");

  try {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === "POST" && request.url === "/screenshot") {
      const input = screenshotInputSchema.parse(JSON.parse(await readBody(request)));
      const result = await captureWebDesignScreenshot(input);
      response.writeHead(200);
      response.end(JSON.stringify(result));
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

async function captureWebDesignScreenshot(input: ScreenshotInput) {
  const browser = await chromium.launch({
    headless: true
  });
  const startedAt = Date.now();

  try {
    const context = await browser.newContext({
      javaScriptEnabled: true,
      viewport: input.viewport
    });
    const page = await context.newPage();
    page.setDefaultTimeout(input.timeoutMs);
    await page.setContent(buildPreviewDocument(input.files), {
      waitUntil: "load",
      timeout: input.timeoutMs
    });
    const image = await page.screenshot({
      fullPage: true,
      type: "png"
    });
    const outputImage = input.trimWhitespace ? await trimScreenshotWhitespace(image, screenshotWhitespacePadding) : image;

    return {
      imageDataUrl: `data:image/png;base64,${outputImage.toString("base64")}`,
      durationMs: Date.now() - startedAt,
      viewport: input.viewport
    };
  } finally {
    await browser.close();
  }
}

async function trimScreenshotWhitespace(image: Buffer, padding: number) {
  const source = sharp(image);
  const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = findVisiblePixelBounds(data, info.width, info.height);

  if (!bounds) {
    return image;
  }

  const left = Math.max(0, bounds.left - padding);
  const top = Math.max(0, bounds.top - padding);
  const right = Math.min(info.width - 1, bounds.right + padding);
  const bottom = Math.min(info.height - 1, bounds.bottom + padding);
  const width = Math.max(1, right - left + 1);
  const height = Math.max(1, bottom - top + 1);

  if (left === 0 && top === 0 && width === info.width && height === info.height) {
    return image;
  }

  return sharp(image)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

function findVisiblePixelBounds(data: Buffer, width: number, height: number) {
  const background = readPixel(data, 0);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (!isBackgroundPixel(data, offset, background)) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    return null;
  }

  return { left, top, right, bottom };
}

function readPixel(data: Buffer, offset: number) {
  return {
    red: data[offset],
    green: data[offset + 1],
    blue: data[offset + 2],
    alpha: data[offset + 3]
  };
}

function isBackgroundPixel(data: Buffer, offset: number, background: ReturnType<typeof readPixel>) {
  return (
    Math.abs(data[offset] - background.red) <= screenshotBackgroundTolerance &&
    Math.abs(data[offset + 1] - background.green) <= screenshotBackgroundTolerance &&
    Math.abs(data[offset + 2] - background.blue) <= screenshotBackgroundTolerance &&
    Math.abs(data[offset + 3] - background.alpha) <= screenshotBackgroundTolerance
  );
}

async function runWebDesignTests(input: RunInput) {
  const browser = await chromium.launch({
    headless: true
  });
  const startedAt = Date.now();

  try {
    const context = await browser.newContext({
      javaScriptEnabled: true
    });
    const previewDocument = buildPreviewDocument(input.files);

    const results = [];
    for (const test of input.tests) {
      const testStartedAt = Date.now();
      const page = await context.newPage();
      page.setDefaultTimeout(input.timeoutMs);
      try {
        await page.setContent(previewDocument, {
          waitUntil: "load",
          timeout: input.timeoutMs
        });
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
      } finally {
        await page.close();
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
  if (isFunctionWrappedTestCode(testCode)) {
    throw new Error("Use plain Playwright test code. Do not wrap the test in a function.");
  }

  const execute = new Function("page", "expect", `"use strict"; return (async () => {\n${testCode}\n})();`) as (
    page: Page,
    expectApi: typeof expect
  ) => Promise<unknown>;
  await Promise.race([
    execute(page, expect),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms.`)), timeoutMs + 1000);
    })
  ]);
}

function isFunctionWrappedTestCode(testCode: string) {
  const normalized = testCode.trim().replace(/;+\s*$/, "");
  return /^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/s.test(normalized) || /^async\s+function\b/s.test(normalized);
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
