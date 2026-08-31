import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const docs = path.join(root, "docs");
const output = path.join(docs, "assets", "press", "octet-bloom-trace-v270.webm");
const poster = path.join(docs, "assets", "press", "octet-bloom-trace-v270-poster.png");
const fps = 30;
const encodedFrames = 150;
const phaseSamples = 25;
const repeatsPerSample = encodedFrames / phaseSamples;
if (!Number.isInteger(repeatsPerSample)) {
  throw new Error("Encoded frames must divide evenly across phase samples");
}

const ffmpegRoot = path.join(
  process.env.LOCALAPPDATA || "",
  "ms-playwright"
);
const ffmpegFolder = (await readdir(ffmpegRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory() && entry.name.startsWith("ffmpeg-"))
  .sort((left, right) => right.name.localeCompare(left.name, "en"))[0];
if (!ffmpegFolder) throw new Error("Playwright FFmpeg is not installed");
const ffmpeg = path.join(ffmpegRoot, ffmpegFolder.name, "ffmpeg-win64.exe");
await stat(ffmpeg);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};
const csp = (await readFile(path.join(docs, "_headers"), "utf8"))
  .split(/\r?\n/u)
  .find(line => line.trim().startsWith("Content-Security-Policy:"))
  .split("Content-Security-Policy:")[1]
  .trim();
const server = createServer((request, response) => {
  const requested = decodeURIComponent((request.url || "/").split("?")[0]);
  let file = path.join(docs, requested);
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = path.join(docs, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Content-Security-Policy": csp
  });
  createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}/`;
console.error(`[trace-capture] serving ${origin}`);

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  args: [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--ignore-gpu-blocklist"
  ]
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1
});
await page.addInitScript(() => {
  Object.defineProperty(navigator, "gpu", {
    configurable: true,
    value: undefined
  });
});
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
  if (message.type() === "error") errors.push(message.text());
});
await page.goto(origin, { waitUntil: "networkidle" });
console.error("[trace-capture] page loaded");
await page.locator(
  "#adg-cipher[data-backend][data-analyzer][data-trace-mode]"
).waitFor({ state: "attached", timeout: 15_000 });
console.error("[trace-capture] runtime ready");
await page.evaluate(async () => {
  await document.fonts.ready;
  const stage = document.querySelector(".cipher-stage");
  document.body.replaceChildren(stage);
  document.body.className = "lang-ar trace-capture";
  document.documentElement.lang = "ar";
  document.documentElement.dir = "rtl";
});
const canvas = page.locator("#adg-cipher");
await canvas.waitFor({ state: "visible" });
const runtime = await canvas.evaluate(node => ({
  backend: node.dataset.backend,
  analyzer: node.dataset.analyzer,
  traceMode: node.dataset.traceMode
}));
if (runtime.backend !== "canvas2d"
  || runtime.analyzer !== "wasm-i32"
  || runtime.traceMode !== "precomputed-replay") {
  throw new Error(`Unexpected capture runtime: ${JSON.stringify(runtime)}`);
}

const encoder = spawn(ffmpeg, [
  "-hide_banner",
  "-loglevel", "error",
  "-y",
  "-f", "image2pipe",
  "-framerate", String(fps),
  "-vcodec", "mjpeg",
  "-i", "pipe:0",
  "-an",
  "-c:v", "libvpx",
  "-pix_fmt", "yuv420p",
  "-crf", "30",
  "-b:v", "0",
  "-deadline", "realtime",
  "-cpu-used", "6",
  "-threads", "4",
  output
], { stdio: ["pipe", "ignore", "pipe"] });
let encoderError = "";
let encoderExitCode = null;
let encoderStdinError = null;
encoder.stdin.on("error", error => {
  encoderStdinError = error;
});
encoder.stderr.on("data", chunk => {
  const message = chunk.toString();
  encoderError += message;
  console.error(`[trace-capture:ffmpeg] ${message.trim()}`);
});
const encoderClosed = new Promise((resolve, reject) => {
  encoder.once("error", reject);
  encoder.once("close", code => {
    encoderExitCode = code;
    resolve(code);
  });
});
const writeFrame = async image => {
  if (encoderStdinError) {
    throw new Error(`FFmpeg input failed: ${encoderStdinError.message}`);
  }
  if (encoderExitCode !== null) {
    throw new Error(`FFmpeg exited early (${encoderExitCode}): ${encoderError}`);
  }
  if (encoder.stdin.write(image)) return;
  const result = await Promise.race([
    once(encoder.stdin, "drain").then(() => "drain"),
    encoderClosed.then(() => "closed")
  ]);
  if (result === "closed") {
    throw new Error(`FFmpeg exited before drain (${encoderExitCode}): ${encoderError}`);
  }
};

await page.evaluate(() => {
  const source = document.getElementById("adg-cipher");
  const target = document.createElement("canvas");
  target.width = 1184;
  target.height = 518;
  const context = target.getContext("2d");
  if (!source || !context) throw new Error("Capture canvas is unavailable");

  const states = {
    fetch: ["قراءة الأوكتتات", "القيم المنشورة تدخل كما هي", "23 OCTETS · RASM[0…22]"],
    decode: ["فكّ البتات", "كل أوكتت ينفتح إلى ثمانية مواضع", "184 CALLS · flag_bit"],
    execute: ["التفتّح", "البت المضاء يزهر، والصفر يبقى ساكنًا", "85 BLOOMS · 335 PETALS"],
    quiet: ["الهدوء", "تختفي العناصر المؤقتة وتبقى الشبكة", "TRANSIENT ENERGY → 0"],
    void: ["void", "لا قيمة عائدة، وذاكرة WASM لا تتغيّر", "trace_void() → () · ΔMEM = 0"]
  };
  const stageForPhase = phase => {
    if (phase < 0.18) return "fetch";
    if (phase < 0.34) return "decode";
    if (phase < 0.70) return "execute";
    if (phase < 0.82) return "quiet";
    return "void";
  };
  const label = (text, x, y, font, color, align = "center", direction = "rtl") => {
    context.save();
    context.font = font;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.direction = direction;
    context.fillText(text, x, y);
    context.restore();
  };

  window.__sbayCaptureTraceFrame = async phase => {
    source.dispatchEvent(new CustomEvent("sbay:trace-frame", { detail: phase }));
    await new Promise(resolve => requestAnimationFrame(resolve));

    context.clearRect(0, 0, target.width, target.height);
    context.save();
    context.beginPath();
    context.roundRect(1, 1, target.width - 2, target.height - 2, 28);
    context.clip();
    context.fillStyle = "#040815";
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(source, 0, 0, target.width, target.height);
    context.restore();

    context.strokeStyle = "rgba(88, 221, 255, .26)";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(.5, .5, target.width - 1, target.height - 1, 28);
    context.stroke();

    label(
      "حبيبة التمثيل المرئية: بت واحد",
      1136,
      25,
      "14px 'Segoe UI', Tahoma, Arial, sans-serif",
      "#9cb4c8",
      "right"
    );
    label(
      "DETERMINISTIC",
      48,
      25,
      "700 13px Consolas, monospace",
      "#5ff0bb",
      "left",
      "ltr"
    );

    const stage = stageForPhase(phase);
    const state = states[stage];
    label(
      state[0],
      target.width / 2,
      58,
      "700 24px 'Segoe UI', Tahoma, Arial, sans-serif",
      "#f2f7fb",
      "center",
      stage === "void" ? "ltr" : "rtl"
    );
    label(
      state[1],
      target.width / 2,
      83,
      "16px 'Segoe UI', Tahoma, Arial, sans-serif",
      "#9cb4c8"
    );
    label(
      state[2],
      target.width / 2,
      107,
      "700 14px Consolas, monospace",
      "#58ddff",
      "center",
      "ltr"
    );

    const lane = [
      ["WB", 119, null],
      ["MEM", 355, null],
      ["EX", 592, "execute"],
      ["ID", 829, "decode"],
      ["IF", 1065, "fetch"]
    ];
    for (const [text, x, activeStage] of lane) {
      label(
        text,
        x,
        438,
        "700 15px Consolas, monospace",
        activeStage === stage ? "#58ddff" : "rgba(88, 221, 255, .15)",
        "center",
        "ltr"
      );
    }
    if (stage === "void") {
      label(
        "void · ذاكرة WASM لم تتغيّر · لا قيمة عائدة",
        target.width / 2,
        486,
        "16px 'Segoe UI', Tahoma, Arial, sans-serif",
        "#b7a8ff"
      );
    }

    return target.toDataURL("image/jpeg", .94).split(",")[1];
  };
  window.__sbayCaptureTracePoster = () =>
    target.toDataURL("image/png").split(",")[1];
});

for (let index = 0; index < phaseSamples; index += 1) {
  const phase = index / phaseSamples;
  const encoded = await page.evaluate(value =>
    window.__sbayCaptureTraceFrame(value), phase);
  const image = Buffer.from(encoded, "base64");
  if (index === 13) {
    const encodedPoster = await page.evaluate(() =>
      window.__sbayCaptureTracePoster());
    await writeFile(poster, Buffer.from(encodedPoster, "base64"));
  }
  for (let repeat = 0; repeat < repeatsPerSample; repeat += 1) {
    await writeFrame(image);
  }
  if ((index + 1) % 5 === 0) {
    console.error(`[trace-capture] ${index + 1}/${phaseSamples} phase samples`);
  }
}
encoder.stdin.end();
const exitCode = await encoderClosed;
await browser.close();
await new Promise(resolve => server.close(resolve));

if (exitCode !== 0) {
  throw new Error(`FFmpeg failed (${exitCode}): ${encoderError}`);
}
if (errors.length) throw new Error(errors.join(" | "));

const video = await readFile(output);
const posterBytes = await readFile(poster);
console.log(JSON.stringify({
  ok: true,
  path: path.relative(root, output).replaceAll("\\", "/"),
  bytes: video.length,
  sha256: createHash("sha256").update(video).digest("hex"),
  durationSeconds: encodedFrames / fps,
  codec: "VP8",
  fps,
  frames: encodedFrames,
  phaseSamples,
  repeatsPerSample,
  width: 1184,
  height: 518,
  poster: {
    path: path.relative(root, poster).replaceAll("\\", "/"),
    bytes: posterBytes.length,
    sha256: createHash("sha256").update(posterBytes).digest("hex")
  },
  runtime
}, null, 2));
