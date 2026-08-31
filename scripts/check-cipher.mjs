/*
 * Local verification for the ADG cipher hero.
 * Serves docs/, opens the page in Edge, checks the WebGPU backend, the loop
 * metadata, the derived facts, console cleanliness and layout overflow,
 * and writes loop frames for visual review.
 *
 * Usage: node scripts/check-cipher.mjs [--out <dir>] [--keep-open]
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const outIndex = process.argv.indexOf("--out");
const outDir = outIndex > -1
  ? process.argv[outIndex + 1]
  : path.join(tmpdir(), "sbay-cipher-check");
mkdirSync(outDir, { recursive: true });

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json"
};

const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url || "/").split("?")[0]);
  let file = path.join(docs, requested);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = path.join(docs, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream"
  });
  createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: existsSync(EDGE) ? EDGE : undefined,
  args: [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--ignore-gpu-blocklist"
  ]
});

const report = { origin, consoleErrors: [], pageErrors: [], views: {} };

for (const view of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
]) {
  const page = await browser.newPage({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: 2
  });
  page.on("console", message => {
    if (message.type() === "error") {
      report.consoleErrors.push(`${view.name}: ${message.text()}`);
    }
  });
  page.on("pageerror", error => {
    report.pageErrors.push(`${view.name}: ${error.message}`);
  });

  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  report.views[view.name] = await page.evaluate(() => {
    const canvas = document.getElementById("adg-cipher");
    const facts = {};
    for (const node of document.querySelectorAll("[data-cipher-fact]")) {
      facts[node.dataset.cipherFact] = node.textContent;
    }
    return {
      gpuAvailable: Boolean(navigator.gpu),
      backend: canvas?.dataset.backend ?? null,
      loopSeconds: canvas?.dataset.loopSeconds ?? null,
      verse: canvas?.dataset.verse ?? null,
      backingWidth: canvas?.width ?? null,
      backingHeight: canvas?.height ?? null,
      frames: canvas?.dataset.frames ?? null,
      phase: canvas?.dataset.phase ?? null,
      gpuError: canvas?.dataset.gpuError ?? null,
      gpuValidation: canvas?.dataset.gpuValidation ?? null,
      instances: canvas?.dataset.instances ?? null,
      facts,
      overflow: document.documentElement.scrollWidth
        - document.documentElement.clientWidth
    };
  });

  const canvas = page.locator("#adg-cipher");
  for (let frame = 0; frame < 8; frame += 1) {
    await page.waitForTimeout(620);
    await canvas.screenshot({
      path: path.join(outDir, `${view.name}-frame-${frame}.png`)
    });
  }
  await page.screenshot({
    path: path.join(outDir, `${view.name}-hero.png`),
    clip: { x: 0, y: 0, width: view.width, height: Math.min(view.height, 1000) }
  });

  await page.locator("#product-space").scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  report.views[`${view.name}-network`] = await page.evaluate(() => {
    const network = document.getElementById("product-space");
    return {
      zoom: network?.dataset.zoom ?? null,
      maximumZoom: network?.dataset.maximumZoom ?? null
    };
  });
  await page.close();
}

const reduced = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce"
});
reduced.on("console", message => {
  if (message.type() === "error") {
    report.consoleErrors.push(`reduced-motion: ${message.text()}`);
  }
});
reduced.on("pageerror", error => {
  report.pageErrors.push(`reduced-motion: ${error.message}`);
});
await reduced.goto(origin, { waitUntil: "networkidle" });
await reduced.waitForTimeout(1500);
const staticFrames = await reduced.evaluate(() =>
  document.getElementById("adg-cipher")?.dataset.frames ?? null);
await reduced.waitForTimeout(1500);
report.reducedMotion = {
  framesAtFirstRead: staticFrames,
  framesAfterWait: await reduced.evaluate(() =>
    document.getElementById("adg-cipher")?.dataset.frames ?? null),
  backend: await reduced.evaluate(() =>
    document.getElementById("adg-cipher")?.dataset.backend ?? null)
};
await reduced.locator("#adg-cipher").screenshot({
  path: path.join(outDir, "reduced-motion.png")
});

for (const language of ["ar", "en"]) {
  await reduced.evaluate(code => {
    if (document.documentElement.lang !== code) {
      document.querySelector("[data-language]")?.click();
    }
  }, language);
  await reduced.waitForTimeout(600);
  report.reducedMotion[`lang_${language}`] = await reduced.evaluate(() =>
    document.documentElement.lang);
  report.reducedMotion[`overflow_${language}`] = await reduced.evaluate(() =>
    document.documentElement.scrollWidth
      - document.documentElement.clientWidth);
  await reduced.screenshot({
    path: path.join(outDir, `hero-${language}.png`),
    clip: { x: 0, y: 0, width: 1280, height: 900 }
  });
}
await reduced.close();

await browser.close();
await new Promise(resolve => server.close(resolve));

report.outputDirectory = outDir;
console.log(JSON.stringify(report, null, 2));

const failures = [
  ...report.consoleErrors,
  ...report.pageErrors,
  ...Object.entries(report.views)
    .filter(([name, value]) =>
      !name.endsWith("-network") && value.overflow > 0)
    .map(([name, value]) => `${name}: horizontal overflow ${value.overflow}px`)
];
if (report.reducedMotion.framesAtFirstRead
  !== report.reducedMotion.framesAfterWait) {
  failures.push("reduced motion still animates");
}
for (const language of ["ar", "en"]) {
  if (report.reducedMotion[`overflow_${language}`] > 0) {
    failures.push(`${language}: horizontal overflow`);
  }
}
if (failures.length) {
  console.error("FAILED:\n" + failures.join("\n"));
  process.exitCode = 1;
}
