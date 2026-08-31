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
  [/\bSBAY\s+Tamween\b/iu, "noncanonical English brand name"],
  [/منصة تموين\s+sbay\b/iu, "noncanonical Arabic brand name"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/u, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/u, "AWS access key"],
  [/\b(?:CPOLY_BACKUP_MASTER_KEY|ENTITYCRYPT_MASTER_KEY)\b/u, "private key name"],
  [/\bcomponent root\s*(?:→|->)\s*availability mask/iu, "private claim chain"],
  [/\bforced[- ]zero routing\b/iu, "private routing detail"],
  [/\broute[- ]bound receipt\b/iu, "private receipt detail"],
  [/[A-Z]:\\Patents\\CNS/iu, "private patent path"],
  [/[A-Z]:\\source\\(?:CNS|QdrantServer)(?:\\|$)/iu, "private source path"],
  [/\bpostgres(?:ql)?:\/\/[^/\s]+:[^@\s]+@/iu, "database credential"],
  [/KSAR\s+is\s+(?:fully\s+)?hosted\s+in\s+Saudi\s+Arabia/iu, "unsupported KSAR hosting claim"],
  [/كسار\s+مستضاف(?:ة)?\s+(?:بالكامل\s+)?داخل\s+السعودية/iu, "unsupported KSAR hosting claim"],
  [/(?:the\s+)?CPOLY\s+freeze\s+(?:has\s+been\s+)?resolved/iu, "unsupported CPOLY resolution claim"],
  [/تم\s+حل\s+تجمد\s+CPOLY/iu, "unsupported CPOLY resolution claim"]
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
assert.match(index, /<span class="ar">منصة تموين<\/span>/u);
assert.match(index, /<span class="en">SBAY<\/span>/u);
assert.doesNotMatch(index, /SBAY\s+Tamween/iu);
assert.doesNotMatch(index, /منصة تموين\s*<bdi[^>]*>sbay<\/bdi>/iu);
assert.match(index, /id="ksar"/u);
assert.match(index, /السوق المباشر: شاهد المنتج، فاوِض البائع، وأتمم الاتفاق في بث واحد/u);
assert.match(index, /2\.1\.0-leap2026/u);
assert.match(index, /https:\/\/ksar\.store\/live/u);
assert.match(index, /https:\/\/ksar\.store\/documentation/u);
assert.match(index, /بيانات توضيحية وليست مؤشرات مبيعات أو جمهور/u);
assert.match(index, /does not claim (?:physical Saudi|Saudi physical) hosting/iu);
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
  'id="ksar"',
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
assert.equal(positioningEvidence.tradeName.arabic, "منصة تموين");
assert.equal(positioningEvidence.tradeName.englishPresentation, "SBAY");
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
assert.equal(pressKit.tradeName.arabic, "منصة تموين");
assert.equal(pressKit.tradeName.english, "SBAY");
assert.equal(pressKit.publisher, "SBAY");
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
assert.equal(pressKit.claims.ksarSaudiPhysicalHosting, false);
assert.equal(pressKit.claims.ksarSaudiLegalDataResidency, false);
assert.equal(pressKit.claims.ksarUniversalCrossDeviceAcceptance, false);
assert.equal(pressKit.claims.ksarCpolyFreezeResolved, false);
assert.equal(pressKit.claims.ksarSalesMetricsClaimed, false);
assert.equal(pressKit.claims.ksarAudienceMetricsClaimed, false);
const newsBoy = pressKit.operatingProof.find(item => item.name === "NewsBoy");
assert.ok(newsBoy);
assert.equal(newsBoy.citationsUrl, "https://newsboy.sbay.sa/#m-citations-section");
assert.equal(newsBoy.archiveUrl, "https://newsboy.sbay.sa/#m-archive-section");
assert.deepEqual(newsBoy.featuredMedia, [
  "assets/press/newsboy-cultural-edition.png",
  "assets/press/newsboy-classic-editorial.png"
]);
const ksar = pressKit.operatingProof.find(item => item.name === "Ksar");
assert.ok(ksar);
assert.equal(ksar.release, "2.1.0-leap2026");
assert.equal(ksar.url, "https://ksar.store/");
assert.equal(ksar.liveMarketUrl, "https://ksar.store/live");
assert.equal(ksar.documentationUrl, "https://ksar.store/documentation");
assert.equal(
  ksar.deployedSourceMerkleRoot,
  "ff3e47c0b30f29a9e8f4e32be7ff9c1fcd99809a85085b265b708966d3670f89"
);
assert.equal(
  ksar.deploymentDossierMerkleRoot,
  "d60527d959bccc0614297b8d714243c530c2a787edb9658990e7347e01afb8ae"
);
assert.deepEqual(ksar.featuredMedia, ["assets/press/ksar-market.png"]);
assert.equal(ksar.verifiedContracts.sourceAndEdge, 236);
assert.equal(ksar.verifiedContracts.focusedCommercialContent, 8);
assert.equal(ksar.verifiedContracts.failed, 0);

const ksarEvidence = JSON.parse(await readFile(
  path.join(root, "evidence", "ksar-leap2026-release-20260831T081610Z.json"),
  "utf8"
));
assert.equal(ksarEvidence.schema, "sbay.leap2026.ksar-public-evidence.v1");
assert.equal(ksarEvidence.release.id, "2.1.0-leap2026");
assert.equal(ksarEvidence.publicPage.httpStatus, 200);
assert.equal(ksarEvidence.publicPage.bytes, 100320);
assert.equal(
  ksarEvidence.publicPage.sha256,
  "df99eb59a7e0b73f264f555bfe868e88885c0140233bfbb3937e0b5abaa42d03"
);
assert.equal(ksarEvidence.automation.failed, 0);
assert.equal(ksarEvidence.browserAcceptance.pageExceptions, 0);
assert.equal(ksarEvidence.browserAcceptance.horizontalOverflowPixels, 0);
assert.equal(ksarEvidence.claimBoundary.saudiPhysicalHosting, false);
assert.equal(ksarEvidence.claimBoundary.cpolyFreezeResolved, false);
const ksarMedia = await readFile(path.join(root, ksarEvidence.media.path));
assert.equal(ksarMedia.length, ksarEvidence.media.bytes);
assert.equal(
  createHash("sha256").update(ksarMedia).digest("hex"),
  ksarEvidence.media.sha256
);

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

const brandCorrection = JSON.parse(await readFile(
  path.join(root, "evidence", "brand-name-correction-20260831T060552Z.json"),
  "utf8"
));
assert.equal(brandCorrection.canonical.arabic, "منصة تموين");
assert.equal(brandCorrection.canonical.english, "SBAY");
assert.equal(brandCorrection.rules.combineArabicAndEnglishNames, false);
assert.equal(brandCorrection.rules.transliterateBrandNames, false);

const app = await readFile(path.join(root, "docs", "app.js"), "utf8");
assert.match(app, /\{ name: "SBAY", centerBrand: true, color:/u);
assert.doesNotMatch(app, /\{ name: "TAMWEEN", color:/u);
assert.match(app, /fillText\("تموين"/u);
assert.match(app, /fillText\(\s*"منصة"/u);
assert.match(app, /smallSize = largeSize \* \.58/u);
assert.match(app, /fibonacciZoomLevels = \[1, 2, 3, 5, 8\]/u);
assert.match(app, /nearestFibonacciZoom/u);
assert.match(app, /event\.touches\.length === 2/u);
assert.match(app, /touchDistance\(event\.touches\)/u);
assert.match(app, /frameMaximumZoom/u);

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

const cipher = await readFile(path.join(root, "docs", "adg-cipher.js"), "utf8");
assert.match(cipher, /codePointAt\(0\) & 0xff/u, "flag bits must be derived from public Unicode scalars");
assert.match(cipher, /const LOOP_SECONDS = 5/u);
assert.match(cipher, /createCanvasPainter/u, "a non-WebGPU fallback painter is mandatory");
for (const [pattern, label] of [
  [/RasmMaskHex|RasmRecordHex/iu, "proprietary rasm mask table"],
  [/0x8003|0x0817/u, "proprietary rasm mask value"],
  [/routingThreshold|expertWeight|availabilityMask/iu, "protected routing internals"]
]) {
  assert.equal(pattern.test(cipher), false, `${label} in docs/adg-cipher.js`);
  assert.equal(pattern.test(index), false, `${label} in docs/index.html`);
}
assert.match(index, /id="adg-cipher"/u);
assert.match(index, /data-loop-seconds="5"/u);
assert.match(index, /20:13/u, "the hero must cite its public verse reference");
assert.match(index, /class="cipher-note"/u, "the disclosure note must stay on the page");
for (const label of ["IF", "ID", "EX", "MEM", "WB", "void"]) {
  assert.ok(index.includes(`>${label}<`), `missing pipeline label ${label}`);
}

console.log(JSON.stringify({
  ok: true,
  filesScanned: files.length,
  disclosureBoundary: "public-non-enabling"
}));
