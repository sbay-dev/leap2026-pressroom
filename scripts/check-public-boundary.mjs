import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  ".wrangler",
  "node_modules",
  "dist"
]);
const forbiddenExtensions = new Set([
  ".7z",
  ".bin",
  ".ckpt",
  ".gguf",
  ".gz",
  ".key",
  ".npy",
  ".npz",
  ".onnx",
  ".p12",
  ".pem",
  ".pkl",
  ".pt",
  ".pth",
  ".safetensors",
  ".tar",
  ".zip"
]);
const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".rs",
  ".svg",
  ".toml",
  ".txt",
  ".webmanifest",
  ".xml"
]);
const forbiddenPatterns = [
  [/®/u, "unverified registered-trademark symbol"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/u, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/u, "AWS access key"],
  [/\b(?:CPOLY_BACKUP_MASTER_KEY|ENTITYCRYPT_MASTER_KEY)\b/u, "private key name"],
  [/\bcomponent root\s*(?:→|->)\s*availability mask/iu, "private claim chain"],
  [/\bforced[- ]zero routing\b/iu, "private routing detail"],
  [/\broute[- ]bound receipt\b/iu, "private receipt detail"],
  [/[A-Z]:\\Patents\\CNS/iu, "private patent path"],
  [/[A-Z]:\\source\\(?:CNS|QdrantServer)(?:\\|$)/iu, "private source path"],
  [/\bpostgres(?:ql)?:\/\/[^/\s]+:[^@\s]+@/iu, "database credential"]
];

async function collect(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collect(absolute, relative));
    } else if (entry.isFile()) {
      files.push({ absolute, relative });
    }
  }
  return files;
}

const files = await collect(root);
assert.ok(files.length > 0, "No release files were found.");

for (const file of files) {
  const extension = path.extname(file.relative).toLowerCase();
  assert.equal(
    forbiddenExtensions.has(extension),
    false,
    `Forbidden public artifact: ${file.relative}`
  );
  const details = await stat(file.absolute);
  const maxBytes = extension === ".png" ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  assert.ok(details.size <= maxBytes, `Oversized public file: ${file.relative}`);
  if (!textExtensions.has(extension)) continue;
  if (file.relative === "scripts/check-public-boundary.mjs") continue;
  const text = await readFile(file.absolute, "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `${label} in ${file.relative}`);
  }
}

const index = await readFile(path.join(root, "docs", "index.html"), "utf8");
assert.doesNotMatch(index, /<script[^>]+src=["']https?:/iu);
assert.doesNotMatch(index, /<link[^>]+href=["']https?:[^"']+\.(?:css|woff2?)/iu);
assert.doesNotMatch(index, /<form\b/iu);
assert.match(index, /Independent participation/iu);
assert.match(index, /no general MTEB superiority claim/iu);
assert.match(index, /not an official LEAP or DeepFest page/iu);

const headers = await readFile(path.join(root, "docs", "_headers"), "utf8");
assert.match(
  headers,
  /Cache-Control: public, max-age=0, must-revalidate, no-transform/u
);
assert.match(headers, /script-src 'self' 'wasm-unsafe-eval'/u);
assert.doesNotMatch(headers, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/u);

for (const asset of [
  "newsboy-classic-hero.png",
  "newsboy-classic-full.png",
  "newsboy-classic-mobile.png",
  "ksar-market.png",
  "cp-dashboard.png",
  "og-card.png"
]) {
  await stat(path.join(root, "docs", "assets", "press", asset));
}

console.log(JSON.stringify({
  ok: true,
  filesScanned: files.length,
  disclosureBoundary: "public-non-enabling"
}));
