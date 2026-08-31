import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const pageUrl = "https://newsboy.sbay.sa/coverage/leap-2026";
const targetId = "article-editorial_7D8F4B11CCD7DE3A45B07412";
const targetUrl = `${pageUrl}#${targetId}`;
const imagePath = path.join(
  root,
  "docs",
  "assets",
  "press",
  "newsboy-leap5-paper.png"
);

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1
});
const response = await page.goto(targetUrl, { waitUntil: "networkidle" });
const targetArticle = page.locator(`#${targetId}`);
await targetArticle.waitFor({ state: "visible" });
await targetArticle.evaluate(element => {
  element.scrollIntoView({ block: "start" });
  scrollBy(0, -24);
});
await page.waitForTimeout(300);
await page.screenshot({
  path: imagePath,
  animations: "disabled"
});
const facts = await page.evaluate(id => {
  const paper = document.querySelector("main.paper");
  const target = document.getElementById(id);
  return {
    title: document.title,
    language: document.documentElement.lang,
    direction: document.documentElement.dir,
    paperElement: paper?.tagName ?? null,
    articleCount: paper?.querySelectorAll("article.story").length ?? 0,
    targetFound: Boolean(target),
    targetHeading: target?.querySelector("h3")?.textContent?.trim() ?? null,
    printable: [...document.styleSheets].some(sheet => {
      try {
        return [...sheet.cssRules].some(rule =>
          rule.cssText?.includes("@media print"));
      } catch {
        return false;
      }
    }),
    reducedMotion: [...document.styleSheets].some(sheet => {
      try {
        return [...sheet.cssRules].some(rule =>
          rule.cssText?.includes("prefers-reduced-motion"));
      } catch {
        return false;
      }
    })
  };
}, targetId);
await browser.close();

const image = await readFile(imagePath);
const evidence = {
  schema: "sbay.leap2026.newsboy-paper.v1",
  sourceUrl: pageUrl,
  targetUrl,
  httpStatus: response?.status() ?? null,
  screenshot: {
    path: "docs/assets/press/newsboy-leap5-paper.png",
    view: "target-article",
    bytes: image.length,
    sha256: createHash("sha256").update(image).digest("hex"),
    width: 1600,
    height: 1000
  },
  accessibility: {
    semanticMainPaper: facts.paperElement === "MAIN",
    language: facts.language,
    direction: facts.direction,
    printable: facts.printable,
    reducedMotionRule: facts.reducedMotion,
    keyboardNavigation: "Native links and browser scrolling; no custom reader script."
  },
  content: {
    pageTitle: facts.title,
    articleCount: facts.articleCount,
    targetFound: facts.targetFound,
    targetHeading: facts.targetHeading
  }
};
if (evidence.httpStatus !== 200 || !facts.targetFound) {
  throw new Error(`NewsBoy paper evidence failed: ${JSON.stringify(evidence)}`);
}
await writeFile(
  path.join(root, "evidence", "newsboy-leap5-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify(evidence, null, 2));
