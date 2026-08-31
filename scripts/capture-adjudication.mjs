import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(
  root,
  "docs",
  "assets",
  "press",
  "adg-adjudication-platform.png"
);
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
  args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"]
});
try {
  const context = await browser.newContext({
    viewport: { width: 1800, height: 1125 },
    deviceScaleFactor: 1.5,
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    colorScheme: "light",
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  const response = await page.goto("https://adg.sbay.sa/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  assert.equal(response?.status(), 200);
  await page.waitForTimeout(2500);
  assert.match(await page.title(), /تحكيم اللغة العربية/u);
  await page.evaluate(() => {
    for (const dialog of document.querySelectorAll("dialog[open]")) {
      dialog.close();
    }
    scrollTo(0, 0);
  });
  await page.screenshot({
    path: output,
    animations: "disabled"
  });
  await context.close();
} finally {
  await browser.close();
}

const bytes = await readFile(output);
console.log(JSON.stringify({
  ok: true,
  output,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  browser: executablePath
}));
