import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const docs = path.join(root, "docs");
const output = path.join(docs, "assets", "press");
await mkdir(output, { recursive: true });

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
];
let executablePath = null;
for (const candidate of edgeCandidates) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {
    // Try the next installed browser.
  }
}
assert.ok(executablePath, "Microsoft Edge or Google Chrome was not found.");

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check"
  ]
});

async function freshContext(options) {
  return browser.newContext({
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    colorScheme: "dark",
    reducedMotion: "reduce",
    ...options
  });
}

async function openPublic(page, url) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  assert.equal(response?.status(), 200, `${url} did not return HTTP 200.`);
  await page.waitForTimeout(2500);
}

async function selectClassic(page) {
  const button = page.locator('[data-theme-btn="classic"]');
  await button.waitFor({ state: "visible", timeout: 30_000 });
  await button.click();
  await page.waitForFunction(
    () => document.body.dataset.theme === "classic",
    undefined,
    { timeout: 15_000 }
  );
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(800);
}

try {
  const desktop = await freshContext({
    viewport: { width: 1800, height: 1125 },
    deviceScaleFactor: 1.5
  });
  const newsboy = await desktop.newPage();
  await openPublic(newsboy, "https://newsboy.sbay.sa/");
  await selectClassic(newsboy);
  await newsboy.screenshot({
    path: path.join(output, "newsboy-classic-hero.png"),
    animations: "disabled"
  });
  await newsboy.screenshot({
    path: path.join(output, "newsboy-classic-full.png"),
    fullPage: true,
    animations: "disabled"
  });
  await desktop.close();

  const mobile = await freshContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const newsboyMobile = await mobile.newPage();
  await openPublic(newsboyMobile, "https://newsboy.sbay.sa/");
  await selectClassic(newsboyMobile);
  await newsboyMobile.screenshot({
    path: path.join(output, "newsboy-classic-mobile.png"),
    fullPage: false,
    animations: "disabled"
  });
  await mobile.close();

  const productContext = await freshContext({
    viewport: { width: 1800, height: 1125 },
    deviceScaleFactor: 1.5
  });
  const ksar = await productContext.newPage();
  await openPublic(ksar, "https://ksar.store/");
  await ksar.evaluate(() => {
    for (const openDialog of document.querySelectorAll("dialog[open]")) {
      openDialog.close();
    }
    scrollTo(0, 0);
  });
  await ksar.screenshot({
    path: path.join(output, "ksar-market.png"),
    animations: "disabled"
  });

  const cp = await productContext.newPage();
  await openPublic(cp, "https://cp.sbay.sa/");
  await cp.screenshot({
    path: path.join(output, "cp-dashboard.png"),
    animations: "disabled"
  });
  await productContext.close();

  const mime = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".wasm", "application/wasm"],
    [".webmanifest", "application/manifest+json"],
    [".xml", "application/xml; charset=utf-8"]
  ]);
  const server = createServer(async (request, response) => {
    const requested = new URL(request.url, "http://127.0.0.1").pathname;
    const relative = requested === "/" ? "index.html" : requested.slice(1);
    const absolute = path.resolve(docs, relative);
    if (!absolute.startsWith(`${docs}${path.sep}`) && absolute !== docs) {
      response.writeHead(403).end();
      return;
    }
    try {
      const bytes = await readFile(absolute);
      response.writeHead(200, {
        "content-type": mime.get(path.extname(absolute)) || "application/octet-stream"
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const cardContext = await freshContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1
    });
    const card = await cardContext.newPage();
    await openPublic(card, `http://127.0.0.1:${address.port}/`);
    await card.screenshot({
      path: path.join(output, "og-card.png"),
      animations: "disabled"
    });
    await cardContext.close();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  ok: true,
  output,
  browser: executablePath,
  captures: 6
}));
