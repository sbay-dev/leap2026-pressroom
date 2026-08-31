import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
assert.match(index, /منصة تموين <bdi lang="en">sbay<\/bdi>/u);
assert.match(index, /SBAY Tamween/u);
assert.match(index, /25\+/u);
assert.match(index, /500\+/u);
assert.match(index, /platform scope/iu);
assert.match(index, /Independent participation/iu);
assert.match(index, /no general MTEB superiority claim/iu);
assert.match(index, /not an official LEAP or DeepFest page/iu);
assert.match(index, /منصّة تحكيم اللغة العربية/u);
assert.match(index, /ADG Arabic Adjudication Platform/u);
assert.match(index, /https:\/\/adg\.sbay\.sa\//u);
assert.match(index, /112/u);
assert.match(index, /not a final correction service/iu);
assert.match(index, /مركز إعلام جامعة الأميرة نورة بنت عبدالرحمن/u);
assert.match(index, /does not mean the material is issued, approved, sponsored or endorsed by the university/iu);
assert.match(index, /https:\/\/newsboy\.sbay\.sa\/#m-citations-section/u);
assert.match(index, /https:\/\/newsboy\.sbay\.sa\/#m-archive-section/u);
assert.match(index, /newsboy-cultural-edition\.png/u);
assert.match(index, /newsboy-classic-editorial\.png/u);
assert.doesNotMatch(index, /آلاف المنتجات|موردون معتمدون|من أيام إلى دقائق/u);
assert.match(index, /without presenting a guaranteed forecast/iu);
assert.match(index, /without a guaranteed savings claim/iu);

const narrativeSections = [
  'id="problem"',
  'id="platform"',
  'id="intelligence"',
  'id="outcomes"',
  'id="vision"',
  'id="adjudication"'
];
let previousSection = -1;
for (const section of narrativeSections) {
  const sectionIndex = index.indexOf(section);
  assert.ok(sectionIndex > previousSection, `Narrative order failed at ${section}`);
  previousSection = sectionIndex;
}

const positioningEvidence = JSON.parse(await readFile(
  path.join(root, "evidence", "tamween-positioning-snapshot-20260831T040937Z.json"),
  "utf8"
));
assert.equal(positioningEvidence.tradeName.arabic, "منصة تموين sbay");
assert.equal(positioningEvidence.publicSource.observedSignals.publishedCustomers, "500+");
assert.equal(positioningEvidence.claimTreatment.costOutcome.includes("no guaranteed"), true);

const adjudicationEvidence = JSON.parse(await readFile(
  path.join(root, "evidence", "adjudication-positioning-snapshot-20260831T043818Z.json"),
  "utf8"
));
assert.equal(adjudicationEvidence.publicPage.httpStatus, 200);
assert.equal(adjudicationEvidence.source.release, "15.3.6");
assert.equal(adjudicationEvidence.publishedPilotFacts.readySamples, 2);
assert.equal(adjudicationEvidence.publishedPilotFacts.arabicSentences, 16);
assert.equal(adjudicationEvidence.publishedPilotFacts.linguisticUnits, 112);
assert.equal(adjudicationEvidence.claimBoundary.finalArabicCorrectionService, false);
assert.equal(adjudicationEvidence.universityMediaChannel.issuedByUniversity, false);

const pressKit = JSON.parse(await readFile(
  path.join(root, "docs", "press-kit.json"),
  "utf8"
));
assert.equal(pressKit.schema, "sbay.press-kit.v2");
assert.equal(pressKit.tradeName.arabic, "منصة تموين sbay");
assert.equal(pressKit.claims.guaranteedCostSaving, false);
assert.equal(pressKit.claims.guaranteedDemandForecast, false);
assert.equal(pressKit.claims.allModulesGenerallyAvailable, false);
assert.equal(pressKit.adjudication.publicRelease, "15.3.6");
assert.equal(pressKit.adjudication.publicPilot.readySamples, 2);
assert.equal(pressKit.adjudication.publicPilot.arabicSentences, 16);
assert.equal(pressKit.adjudication.publicPilot.linguisticUnits, 112);
assert.equal(pressKit.adjudication.mediaCenter.issuedByUniversity, false);
assert.equal(pressKit.claims.officialUniversityPartnership, false);
assert.equal(pressKit.claims.universityEndorsement, false);
assert.equal(pressKit.claims.finalArabicCorrectionService, false);
assert.equal(pressKit.claims.humanLoginCompletionClaimed, false);
const newsBoy = pressKit.operatingProof.find(item => item.name === "NewsBoy");
assert.ok(newsBoy);
assert.equal(newsBoy.citationsUrl, "https://newsboy.sbay.sa/#m-citations-section");
assert.equal(newsBoy.archiveUrl, "https://newsboy.sbay.sa/#m-archive-section");
assert.deepEqual(newsBoy.featuredMedia, [
  "assets/press/newsboy-cultural-edition.png",
  "assets/press/newsboy-classic-editorial.png"
]);

const newsBoyMediaEvidence = JSON.parse(await readFile(
  path.join(root, "evidence", "newsboy-media-snapshot-20260831T055356Z.json"),
  "utf8"
));
assert.equal(newsBoyMediaEvidence.publicPage.httpStatus, 200);
assert.equal(newsBoyMediaEvidence.deepLinks.citations.elementFound, true);
assert.equal(newsBoyMediaEvidence.deepLinks.archive.elementFound, true);
assert.equal(newsBoyMediaEvidence.publishedAssets.length, 2);
for (const asset of newsBoyMediaEvidence.publishedAssets) {
  const bytes = await readFile(path.join(root, asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    asset.sha256
  );
}

const universityBrief = await readFile(
  path.join(root, "PNU-MEDIA-CENTER-BRIEF.md"),
  "utf8"
);
assert.match(universityBrief, /مادة إعلامية معدّة للتقديم إلى مركز إعلام جامعة الأميرة\s+نورة بنت عبدالرحمن/u);
assert.match(universityBrief, /ليست صادرة عن الجامعة/u);
assert.match(universityBrief, /not issued, approved, sponsored or endorsed\s+by the university/iu);

const headers = await readFile(path.join(root, "docs", "_headers"), "utf8");
assert.match(
  headers,
  /Cache-Control: public, max-age=0, must-revalidate, no-transform/u
);
assert.match(headers, /script-src 'self' 'wasm-unsafe-eval'/u);
assert.doesNotMatch(headers, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/u);

for (const asset of [
  "adg-adjudication-platform.png",
  "newsboy-cultural-edition.png",
  "newsboy-classic-editorial.png",
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
