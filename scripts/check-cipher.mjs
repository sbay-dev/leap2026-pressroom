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
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
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
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json"
};

const CSP = readFileSync(path.join(docs, "_headers"), "utf8")
  .split(/\r?\n/u)
  .find(line => line.trim().startsWith("Content-Security-Policy:"))
  .split("Content-Security-Policy:")[1]
  .trim();

const NEWSBOY_FIXTURE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NewsBoy live reader fixture</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f7efdb;color:#21180f;font-family:Tahoma,Arial,sans-serif}
    main{min-height:2400px;padding:1.25rem;background:linear-gradient(#fffaf0,#eadcbf)}
    header{padding:1rem;border-block:4px double #382b1d;text-align:center}
    h1{margin:.4rem;font-size:clamp(2rem,8vw,5rem)}
    article{margin-top:2rem;padding:1.5rem;border-top:1px solid #8f8068}
  </style>
</head>
<body><main class="paper"><header><p>LEAP × DeepFest</p><h1>صبي الجرائد</h1></header><article><h2>العدد الحي</h2><p>Deterministic browser fixture for reader interaction.</p></article></main></body>
</html>`;
let newsboyFixtureRequests = 0;

const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url || "/").split("?")[0]);
  if (requested === "/newsboy-reader" || requested === "/newsboy-reader/") {
    newsboyFixtureRequests += 1;
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; base-uri https://newsboy.sbay.sa; "
        + "script-src 'none'; style-src 'unsafe-inline'; "
        + "frame-ancestors 'self'; "
        + "sandbox allow-popups allow-popups-to-escape-sandbox",
      "X-Frame-Options": "SAMEORIGIN"
    });
    response.end(NEWSBOY_FIXTURE);
    return;
  }
  let file = path.join(docs, requested);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = path.join(docs, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
    // Mirrors the deployed worker policy so a blocked inline script fails here.
    "Content-Security-Policy": CSP
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
      analyzer: canvas?.dataset.analyzer ?? null,
      analyserCalls: canvas?.dataset.analyserCalls ?? null,
      verticesPerFrame: canvas?.dataset.verticesPerFrame ?? null,
      instanceBufferBytes: canvas?.dataset.instanceBufferBytes ?? null,
      analyzerError: canvas?.dataset.analyzerError ?? null,
      traceMode: canvas?.dataset.traceMode ?? null,
      voidReturn: canvas?.dataset.voidReturn ?? null,
      voidMemoryWrites: canvas?.dataset.voidMemoryWrites ?? null,
      facts,
      stateLabels: [...document.querySelectorAll("[data-cipher-state]")]
        .map(node => node.textContent.replace(/\s+/gu, " ").trim()),
      granularity: document.querySelector(".cipher-precision")?.textContent
        .replace(/\s+/gu, " ").trim() ?? "",
      visibleHeroNoteLinks: [...document.querySelectorAll(".cipher-note a")]
        .filter(node => getComputedStyle(node).display !== "none")
        .map(node => node.textContent.replace(/\s+/gu, " ").trim()),
      hiddenTranscript: document.getElementById("cipher-transcript")?.textContent
        .replace(/\s+/gu, " ").trim() ?? "",
      traceStages: [],
      overflow: document.documentElement.scrollWidth
        - document.documentElement.clientWidth
    };
  });

  const canvas = page.locator("#adg-cipher");
  if (view.name === "desktop") {
    report.views[view.name].traceStages = await page.evaluate(() =>
      new Promise(resolve => {
        const observed = new Set();
        const canvasNode = document.getElementById("adg-cipher");
        const sample = setInterval(() => {
          if (canvasNode?.dataset.traceStage) {
            observed.add(canvasNode.dataset.traceStage);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(sample);
          resolve([...observed]);
        }, 5250);
      }));
  }
  for (let frame = 0; frame < 8; frame += 1) {
    await page.waitForTimeout(620);
    report.views[view.name].traceStages.push(
      await canvas.getAttribute("data-trace-stage")
    );
    await canvas.screenshot({
      path: path.join(outDir, `${view.name}-frame-${frame}.png`)
    });
  }
  report.views[view.name].voidInvocations = Number(
    await canvas.getAttribute("data-void-invocations") || 0
  );
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

  await page.locator(".newsboy-paper-break").scrollIntoViewIfNeeded();
  try {
    await page.waitForFunction(() =>
      document.querySelector("[data-newsboy-reader]")?.dataset.frameState
        === "loaded", null, { timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      frameState: document.querySelector("[data-newsboy-reader]")
        ?.dataset.frameState ?? null,
      frameSource: document.querySelector("[data-newsboy-frame]")
        ?.getAttribute("src") ?? null,
      expanded: document.querySelector("[data-newsboy-reader]")
        ?.dataset.expanded ?? null
    }));
    throw new Error(
      `NewsBoy iframe did not load its preview: ${JSON.stringify(state)}`,
      { cause: error }
    );
  }
  await page.waitForTimeout(250);
  const paperBefore = await page.evaluate(() => {
    const section = document.querySelector(".newsboy-paper-break");
    const shell = section?.querySelector("[data-newsboy-reader]");
    const frame = section?.querySelector("[data-newsboy-frame]");
    return {
      frameState: shell?.dataset.frameState ?? null,
      expanded: shell?.dataset.expanded ?? null,
      mode: shell?.dataset.mode ?? null,
      frameSource: frame?.getAttribute("src") ?? null,
      frameScrolling: frame?.getAttribute("scrolling") ?? null,
      framePointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
      frameTabIndex: frame?.tabIndex ?? null,
      frameAriaHidden: frame?.getAttribute("aria-hidden") ?? null,
      heading: section?.querySelector("h3")?.textContent
        .replace(/\s+/gu, " ").trim() ?? "",
      parentScrollY: window.scrollY,
      overflow: section
        ? Math.max(0, section.scrollWidth - section.clientWidth)
        : null
    };
  });
  await page.locator("[data-newsboy-open]").click();
  await page.waitForFunction(() =>
    document.querySelector("[data-newsboy-reader]")?.dataset.expanded
      === "true");
  await page.waitForTimeout(250);
  const paperExpanded = await page.evaluate(() => {
    const shell = document.querySelector("[data-newsboy-reader]");
    const frame = document.querySelector("[data-newsboy-frame]");
    const close = document.querySelector("[data-newsboy-close]");
    const rect = shell?.getBoundingClientRect();
    return {
      expanded: shell?.dataset.expanded ?? null,
      mode: shell?.dataset.mode ?? null,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      x: rect?.x ?? null,
      y: rect?.y ?? null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      frameScrolling: frame?.getAttribute("scrolling") ?? null,
      framePointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
      frameTabIndex: frame?.tabIndex ?? null,
      frameAriaHidden: frame?.getAttribute("aria-hidden") ?? null,
      closeVisible: close ? !close.hidden : false,
      bodyOverflow: getComputedStyle(document.body).overflow
    };
  });
  paperExpanded.focusTrapped = await page.evaluate(() => {
    document.querySelector("[data-language]")?.focus();
    return document.activeElement?.hasAttribute("data-newsboy-close") ?? false;
  });
  const readerFrame = page.frames().find(frame =>
    frame.url().includes("/newsboy-reader"));
  const frameScrollBeforeClose = readerFrame
    ? await readerFrame.evaluate(() => {
        scrollTo(0, 420);
        return scrollY;
      })
    : -1;
  await page.locator("[data-newsboy-close]").click();
  await page.waitForFunction(() =>
    document.querySelector("[data-newsboy-reader]")?.dataset.expanded
      === "false"
    && Number(document.querySelector("[data-newsboy-frame]")
      ?.dataset.reloadCount || 0) > 0);
  try {
    await page.waitForFunction(() =>
      document.querySelector("[data-newsboy-reader]")?.dataset.frameState
        === "loaded", null, { timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      frameState: document.querySelector("[data-newsboy-reader]")
        ?.dataset.frameState ?? null,
      frameSource: document.querySelector("[data-newsboy-frame]")
        ?.getAttribute("src") ?? null,
      expanded: document.querySelector("[data-newsboy-reader]")
        ?.dataset.expanded ?? null
    }));
    const frameStates = await Promise.all(page.frames().map(async frame => ({
      url: frame.url(),
      readyState: await frame.evaluate(() => document.readyState)
        .catch(() => "unavailable")
    })));
    throw new Error(
      "NewsBoy iframe did not reload after close: "
      + JSON.stringify({ ...state, newsboyFixtureRequests, frameStates }),
      { cause: error }
    );
  }
  await page.waitForTimeout(800);
  const paperAfter = await page.evaluate(() => {
    const section = document.querySelector(".newsboy-paper-break");
    const shell = document.querySelector("[data-newsboy-reader]");
    const frame = document.querySelector("[data-newsboy-frame]");
    const sectionRect = section?.getBoundingClientRect();
    return {
      expanded: shell?.dataset.expanded ?? null,
      mode: shell?.dataset.mode ?? null,
      frameSource: frame?.getAttribute("src") ?? null,
      frameScrolling: frame?.getAttribute("scrolling") ?? null,
      framePointerEvents: frame ? getComputedStyle(frame).pointerEvents : null,
      frameTabIndex: frame?.tabIndex ?? null,
      frameAriaHidden: frame?.getAttribute("aria-hidden") ?? null,
      reloadCount: Number(frame?.dataset.reloadCount || 0),
      parentScrollY: window.scrollY,
      sectionTop: sectionRect?.top ?? null,
      sectionBottom: sectionRect?.bottom ?? null,
      viewportHeight: window.innerHeight,
      openFocused: document.activeElement?.hasAttribute("data-newsboy-open")
        ?? false,
      bodyOverflow: getComputedStyle(document.body).overflow
    };
  });
  const reloadedFrame = page.frames().find(frame =>
    frame.url().includes("/newsboy-reader"));
  const frameScrollAfterClose = reloadedFrame
    ? await reloadedFrame.evaluate(() => scrollY)
    : -1;
  let escapeClose = null;
  if (view.name === "desktop") {
    await page.locator("[data-newsboy-open]").click();
    await page.waitForFunction(() =>
      document.querySelector("[data-newsboy-reader]")?.dataset.expanded
        === "true");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() =>
      document.querySelector("[data-newsboy-reader]")?.dataset.expanded
        === "false"
      && Number(document.querySelector("[data-newsboy-frame]")
        ?.dataset.reloadCount || 0) > 1);
    await page.waitForFunction(() =>
      document.querySelector("[data-newsboy-reader]")?.dataset.frameState
        === "loaded");
    await page.waitForTimeout(800);
    escapeClose = await page.evaluate(() => {
      const section = document.querySelector(".newsboy-paper-break");
      const frame = document.querySelector("[data-newsboy-frame]");
      const rect = section?.getBoundingClientRect();
      return {
        expanded: document.querySelector("[data-newsboy-reader]")
          ?.dataset.expanded ?? null,
        reloadCount: Number(frame?.dataset.reloadCount || 0),
        sectionVisible: Boolean(
          rect && rect.bottom > 0 && rect.top < window.innerHeight
        ),
        openFocused: document.activeElement
          ?.hasAttribute("data-newsboy-open") ?? false
      };
    });
  }
  report.views[`${view.name}-paper`] = {
    preview: paperBefore,
    expanded: paperExpanded,
    closed: paperAfter,
    frameScrollBeforeClose,
    frameScrollAfterClose,
    escapeClose
  };
  await page.locator(".newsboy-paper-break").screenshot({
    path: path.join(outDir, `${view.name}-newsboy-paper.png`)
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
    document.getElementById("adg-cipher")?.dataset.backend ?? null),
  ariaLabel: await reduced.evaluate(() =>
    document.getElementById("adg-cipher")?.getAttribute("aria-label") ?? "")
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

const annexPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
annexPage.on("console", message => {
  if (message.type() === "error") {
    report.consoleErrors.push(`annex: ${message.text()}`);
  }
});
annexPage.on("pageerror", error => {
  report.pageErrors.push(`annex: ${error.message}`);
});
await annexPage.goto(`${origin}annex-intelligence.html`, { waitUntil: "networkidle" });
await annexPage.waitForTimeout(2200);
report.annex = await annexPage.evaluate(() => {
  const canvas = document.getElementById("annex-cipher");
  const image = document.querySelector(".annex-figure img");
  const video = document.querySelector(".trace-video-card video");
  return {
    backend: canvas?.dataset.backend ?? null,
    frames: canvas?.dataset.frames ?? null,
    instances: canvas?.dataset.instances ?? null,
    analyzer: canvas?.dataset.analyzer ?? null,
    traceMode: canvas?.dataset.traceMode ?? null,
    voidReturn: canvas?.dataset.voidReturn ?? null,
    voidMemoryWrites: canvas?.dataset.voidMemoryWrites ?? null,
    manuscriptWidth: image?.naturalWidth ?? 0,
    traceCards: document.querySelectorAll(".trace-kanban > article").length,
    traceVideoSource: video?.querySelector("source")?.getAttribute("src") ?? null,
    traceVideoPoster: video?.getAttribute("poster") ?? null,
    traceEvidenceLink: document.querySelector(
      'a[href="./trace-evidence.json"]'
    )?.getAttribute("href") ?? null,
    overflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth
  };
});
report.annexVideo = await annexPage.evaluate(async () => {
  const video = document.querySelector(".trace-video-card video");
  if (!video) return { error: "missing video" };
  video.preload = "metadata";
  video.load();
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", resolve, { once: true });
      video.addEventListener("error", () => reject(
        new Error(video.error?.message || "video metadata failed")
      ), { once: true });
    });
  }
  return {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight
  };
});
await annexPage.locator("[data-language]").click();
await annexPage.waitForTimeout(500);
report.annex.languageToggle = await annexPage.evaluate(() =>
  `${document.documentElement.lang}/${document.documentElement.dir}`);
await annexPage.screenshot({
  path: path.join(outDir, "annex.png"),
  clip: { x: 0, y: 0, width: 1280, height: 900 }
});
await annexPage.close();

const annexMobilePage = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce"
});
annexMobilePage.on("console", message => {
  if (message.type() === "error") {
    report.consoleErrors.push(`annex-mobile: ${message.text()}`);
  }
});
annexMobilePage.on("pageerror", error => {
  report.pageErrors.push(`annex-mobile: ${error.message}`);
});
await annexMobilePage.goto(`${origin}annex-intelligence.html`, {
  waitUntil: "networkidle"
});
await annexMobilePage.locator('[aria-labelledby="trace-board-heading"]')
  .scrollIntoViewIfNeeded();
await annexMobilePage.waitForTimeout(500);
report.annexMobile = await annexMobilePage.evaluate(() => {
  const board = document.querySelector(".trace-kanban");
  const video = document.querySelector(".trace-video-card video");
  return {
    traceCards: board?.children.length ?? 0,
    columns: board ? getComputedStyle(board).gridTemplateColumns : "",
    videoWidth: video?.getBoundingClientRect().width ?? 0,
    videoContainerWidth: video?.parentElement?.getBoundingClientRect().width ?? 0,
    overflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth
  };
});
await annexMobilePage.locator('[aria-labelledby="trace-board-heading"]')
  .screenshot({ path: path.join(outDir, "annex-mobile-trace.png") });
await annexMobilePage.close();

const fallbackPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await fallbackPage.addInitScript(() => {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: undefined
  });
});
fallbackPage.on("console", message => {
  if (message.type() === "error") {
    report.consoleErrors.push(`canvas2d: ${message.text()}`);
  }
});
fallbackPage.on("pageerror", error => {
  report.pageErrors.push(`canvas2d: ${error.message}`);
});
await fallbackPage.goto(origin, { waitUntil: "networkidle" });
await fallbackPage.locator("#adg-cipher").scrollIntoViewIfNeeded();
await fallbackPage.waitForTimeout(1900);
report.canvas2d = await fallbackPage.evaluate(() => {
  const canvas = document.getElementById("adg-cipher");
  return {
    backend: canvas?.dataset.backend ?? null,
    analyzer: canvas?.dataset.analyzer ?? null,
    traceMode: canvas?.dataset.traceMode ?? null,
    ariaLabel: canvas?.getAttribute("aria-label") ?? "",
    overflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth
  };
});
await fallbackPage.locator("#adg-cipher").screenshot({
  path: path.join(outDir, "canvas2d.png")
});
await fallbackPage.close();

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
if (!report.annex.backend) {
  failures.push("annex cipher did not mount under the production CSP");
}
if (report.annex.manuscriptWidth < 1) {
  failures.push("annex manuscript image did not load");
}
if (report.annex.overflow > 0) {
  failures.push(`annex: horizontal overflow ${report.annex.overflow}px`);
}
if (Math.abs(report.annexVideo.duration - 5) > 0.05
  || report.annexVideo.width !== 1184
  || report.annexVideo.height !== 518) {
  failures.push(`annex: invalid trace video metadata ${JSON.stringify(report.annexVideo)}`);
}
if (report.annexMobile.traceCards !== 5
  || report.annexMobile.columns.split(" ").length !== 1
  || report.annexMobile.videoWidth > report.annexMobile.videoContainerWidth
  || report.annexMobile.overflow > 0) {
  failures.push("annex mobile trace board is not a single responsive column");
}
if (report.annex.languageToggle !== "en/ltr") {
  failures.push(`annex language toggle did not switch: ${report.annex.languageToggle}`);
}
for (const view of ["desktop", "mobile"]) {
  const result = report.views[view];
  if (result.analyzer !== "wasm-i32") {
    failures.push(`${view}: WebAssembly analyser not active (${result.analyzer})`);
  }
  if (result.traceMode !== "precomputed-replay") {
    failures.push(`${view}: trace mode is not the disclosed precomputed replay`);
  }
  if (result.voidReturn !== "none" || result.voidMemoryWrites !== "0") {
    failures.push(`${view}: void contract not verified`);
  }
  if (result.gpuAvailable && result.backend !== "webgpu") {
    failures.push(`${view}: WebGPU was available but the renderer fell back`);
  }
  if (result.gpuError || result.gpuValidation) {
    failures.push(`${view}: GPU error ${result.gpuError || result.gpuValidation}`);
  }
  if (Number(result.frames || 0) < 1) {
    failures.push(`${view}: no animation frame was painted`);
  }
  if (result.analyserCalls !== "207"
    || result.verticesPerFrame !== "4518"
    || result.instanceBufferBytes !== "48192") {
    failures.push(`${view}: published compute metadata does not match the scene`);
  }
  if (result.visibleHeroNoteLinks.length !== 1
    || !result.visibleHeroNoteLinks[0].includes("الملحق التقني")) {
    failures.push(`${view}: the hero footer must expose only the annex link`);
  }
  if (!result.granularity.includes("بت واحد")
    || !result.hiddenTranscript.includes("ليست تسجيلًا لدورات معالج مادي")
    || !result.hiddenTranscript.includes("ليس نسبة دقة لنموذج ذكاء اصطناعي")
    || !result.hiddenTranscript.includes("335 بتلة")) {
    failures.push(`${view}: scene meaning or hidden transcript is incomplete`);
  }
  for (const phrase of [
    "قراءة الأوكتتات",
    "فكّ البتات",
    "التفتّح",
    "الهدوء",
    "trace_void() → () · ΔMEM = 0"
  ]) {
    if (!result.stateLabels.some(label => label.includes(phrase))) {
      failures.push(`${view}: missing scene state ${phrase}`);
    }
  }
  const paper = report.views[`${view}-paper`];
  if (paper.preview.frameState !== "loaded"
    || paper.preview.expanded !== "false"
    || paper.preview.frameSource !== "/newsboy-reader"
    || paper.preview.frameScrolling !== "no"
    || paper.preview.framePointerEvents !== "none"
    || paper.preview.frameTabIndex !== -1
    || paper.preview.frameAriaHidden !== "true"
    || !paper.preview.heading.includes("أعلى العدد")
    || paper.preview.overflow > 0) {
    failures.push(`${view}: NewsBoy preview is not a loaded, still top-of-edition card`);
  }
  if (paper.expanded.expanded !== "true"
    || paper.expanded.mode !== "viewport"
    || Math.abs(paper.expanded.width - paper.expanded.viewportWidth) > 2
    || Math.abs(paper.expanded.height - paper.expanded.viewportHeight) > 2
    || Math.abs(paper.expanded.x) > 2
    || Math.abs(paper.expanded.y) > 2
    || paper.expanded.frameScrolling !== "yes"
    || paper.expanded.framePointerEvents !== "auto"
    || paper.expanded.frameTabIndex !== 0
    || paper.expanded.frameAriaHidden !== "false"
    || !paper.expanded.closeVisible
    || !paper.expanded.focusTrapped
    || paper.expanded.bodyOverflow !== "hidden"
    || paper.frameScrollBeforeClose < 300) {
    failures.push(`${view}: NewsBoy reader did not become a scrollable full-screen view`);
  }
  if (paper.closed.expanded !== "false"
    || paper.closed.mode !== "preview"
    || !paper.closed.frameSource.startsWith("/newsboy-reader?refresh=")
    || paper.closed.frameScrolling !== "no"
    || paper.closed.framePointerEvents !== "none"
    || paper.closed.frameTabIndex !== -1
    || paper.closed.frameAriaHidden !== "true"
    || paper.closed.reloadCount < 1
    || paper.closed.sectionBottom <= 0
    || paper.closed.sectionTop >= paper.closed.viewportHeight
    || !paper.closed.openFocused
    || paper.closed.bodyOverflow === "hidden"
    || paper.frameScrollAfterClose !== 0) {
    failures.push(`${view}: NewsBoy close did not reset the reader and restore the section`);
  }
  if (view === "desktop" && (
    paper.escapeClose?.expanded !== "false"
    || paper.escapeClose?.reloadCount < 2
    || !paper.escapeClose?.sectionVisible
    || !paper.escapeClose?.openFocused
  )) {
    failures.push("desktop: Escape did not close and reset the NewsBoy reader");
  }
}
for (const stage of ["fetch", "decode", "execute", "quiet", "void"]) {
  if (!report.views.desktop.traceStages.includes(stage)) {
    failures.push(`desktop: trace never entered ${stage}`);
  }
}
if (report.views.desktop.voidInvocations < 1) {
  failures.push("desktop: trace_void was never invoked by the loop");
}
if (report.annex.analyzer !== "wasm-i32"
  || report.annex.traceMode !== "precomputed-replay"
  || report.annex.voidReturn !== "none"
  || report.annex.voidMemoryWrites !== "0") {
  failures.push("annex: WebAssembly void contract not active");
}
if (report.annex.traceCards !== 5
  || report.annex.traceVideoSource !== "./assets/press/octet-bloom-trace-v270.webm"
  || report.annex.traceVideoPoster !== "./assets/press/octet-bloom-trace-v270-poster.png"
  || report.annex.traceEvidenceLink !== "./trace-evidence.json") {
  failures.push("annex: trace video or five-card evidence board is incomplete");
}
if (report.canvas2d.backend !== "canvas2d"
  || report.canvas2d.analyzer !== "wasm-i32"
  || report.canvas2d.traceMode !== "precomputed-replay"
  || report.canvas2d.ariaLabel.includes("WebAssembly is unavailable")
  || report.canvas2d.overflow > 0) {
  failures.push("Canvas2D fallback does not match the disclosed trace contract");
}
if (!report.reducedMotion.ariaLabel.startsWith("Static reduced-motion frame")) {
  failures.push("reduced motion accessibility label describes an animation");
}
if (failures.length) {
  console.error("FAILED:\n" + failures.join("\n"));
  process.exitCode = 1;
}
