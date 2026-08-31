import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const baseUrl = String(
  process.env.PRESSROOM_URL || "https://leap2026.sbay.sa"
).replace(/\/+$/u, "");

const page = await fetch(`${baseUrl}/`, { redirect: "follow" });
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /SBAY-LEAP-DEEPFEST-20260831T043818Z/u);
assert.match(html, /<span class="ar">منصة تموين<\/span>/u);
assert.match(html, /<span class="en">SBAY<\/span>/u);
assert.doesNotMatch(html, /SBAY\s+Tamween/iu);
assert.doesNotMatch(html, /منصة تموين\s*<bdi[^>]*>sbay<\/bdi>/iu);
assert.match(html, /id="ksar"/u);
assert.match(html, /السوق المباشر: شاهد المنتج، فاوِض البائع، وأتمم الاتفاق في بث واحد/u);
assert.match(html, /2\.1\.0-leap2026/u);
assert.match(html, /https:\/\/ksar\.store\/live/u);
assert.match(html, /https:\/\/ksar\.store\/documentation/u);
assert.match(html, /does not claim (?:physical Saudi|Saudi physical) hosting/iu);
assert.doesNotMatch(html, /KSAR\s+is\s+(?:fully\s+)?hosted\s+in\s+Saudi\s+Arabia/iu);
assert.doesNotMatch(html, /(?:the\s+)?CPOLY\s+freeze\s+(?:has\s+been\s+)?resolved/iu);
assert.doesNotMatch(html, /\d[\d,]*\s*\+?\s*(?:عميل|عملاء)/u);
assert.doesNotMatch(html, /\b24\s*\/\s*7\b/u);
assert.doesNotMatch(html, /(?:market share|حصة سوقية)[^<]{0,40}\d/iu);
assert.match(html, /NewsBoy/u);
assert.match(html, /DeepFest 2026/u);
assert.match(html, /no general MTEB superiority claim/u);
assert.match(html, /منصّة تحكيم اللغة العربية/u);
assert.match(html, /ADG Arabic Adjudication Platform/u);
assert.match(html, /https:\/\/adg\.sbay\.sa\//u);
assert.match(html, /112/u);
assert.match(html, /not a final correction service/iu);
assert.match(html, /مركز إعلام جامعة الأميرة نورة بنت عبدالرحمن/u);
assert.match(html, /does not mean the material is issued, approved, sponsored or endorsed by the university/iu);
assert.match(html, /https:\/\/newsboy\.sbay\.sa\/#m-citations-section/u);
assert.match(html, /https:\/\/newsboy\.sbay\.sa\/#m-archive-section/u);
assert.match(html, /newsboy-cultural-edition\.png/u);
assert.match(html, /newsboy-classic-editorial\.png/u);
assert.match(html, /id="adg-cipher"[^>]*data-loop-seconds="5"/u);
assert.match(html, /class="cipher-note"/u);
assert.match(html, /annex-intelligence\.html/u);
assert.doesNotMatch(html, /<code>void<\/code>/u);
assert.doesNotMatch(html, /RasmMaskHex|RasmRecordHex/iu);
assert.doesNotMatch(html, /cloudflareinsights|beacon\.min\.js/iu);
const annexResponse = await fetch(`${baseUrl}/annex-intelligence.html`, { redirect: "follow" });
assert.equal(annexResponse.status, 200, "the technical annex must be published");
const annexHtml = await annexResponse.text();
for (const label of ["IF", "ID", "EX", "MEM", "WB", "void"]) {
  assert.ok(annexHtml.includes(`<code>${label}</code>`), `missing ${label} in the annex`);
}
assert.match(annexHtml, /Quran 20:13/u);
assert.match(annexHtml, /Mingana Islamic Arabic 1572a/u);
assert.match(annexHtml, /Public domain via Wikimedia Commons/u);
assert.match(annexHtml, /taha-rasm-birmingham\.png/u);
assert.doesNotMatch(annexHtml, /RasmMaskHex|RasmRecordHex/iu);
const manuscript = await fetch(`${baseUrl}/assets/press/taha-rasm-birmingham.png`, { method: "GET" });
assert.equal(manuscript.status, 200, "the manuscript witness must be published");
assert.ok(html.indexOf('id="problem"') < html.indexOf('id="platform"'));
assert.ok(html.indexOf('id="platform"') < html.indexOf('id="intelligence"'));
assert.ok(html.indexOf('id="intelligence"') < html.indexOf('id="outcomes"'));
assert.ok(html.indexOf('id="outcomes"') < html.indexOf('id="vision"'));
assert.ok(html.indexOf('id="vision"') < html.indexOf('id="ksar"'));
assert.ok(html.indexOf('id="ksar"') < html.indexOf('id="adjudication"'));
assert.ok(html.indexOf('id="adjudication"') < html.indexOf('id="proof"'));

const cacheControl = page.headers.get("cache-control");
assert.match(cacheControl || "", /(?:^|,)\s*no-transform(?:,|$)/u);

const kit = await fetch(`${baseUrl}/press-kit.json`);
assert.equal(kit.status, 200);
const pressKit = await kit.json();
assert.equal(pressKit.auditId, "SBAY-LEAP-DEEPFEST-20260831T043818Z");
assert.equal(pressKit.schema, "sbay.press-kit.v2");
assert.equal(pressKit.tradeName.arabic, "منصة تموين");
assert.equal(pressKit.tradeName.english, "SBAY");
assert.equal(pressKit.publisher, "SBAY");
assert.equal(pressKit.publicSignals.customerCountsPublished, false);
assert.equal(pressKit.publicSignals.marketShareClaimed, false);
assert.equal(pressKit.claims.generalMtebSuperiority, false);
assert.equal(pressKit.claims.officialEventPartnership, false);
assert.equal(pressKit.claims.ksarSaudiPhysicalHosting, false);
assert.equal(pressKit.claims.ksarSaudiLegalDataResidency, false);
assert.equal(pressKit.claims.ksarUniversalCrossDeviceAcceptance, false);
assert.equal(pressKit.claims.ksarCpolyFreezeResolved, false);
assert.equal(pressKit.claims.ksarSalesMetricsClaimed, false);
assert.equal(pressKit.claims.ksarAudienceMetricsClaimed, false);
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
const newsBoy = pressKit.operatingProof.find(item => item.name === "NewsBoy");
assert.ok(newsBoy);
assert.equal(newsBoy.citationsUrl, "https://newsboy.sbay.sa/#m-citations-section");
assert.equal(newsBoy.archiveUrl, "https://newsboy.sbay.sa/#m-archive-section");
const ksar = pressKit.operatingProof.find(item => item.name === "Ksar");
assert.ok(ksar);
assert.equal(ksar.release, "2.1.0-leap2026");
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

for (const [asset, expectedSha256] of [
  [
    "newsboy-cultural-edition.png",
    "a42f7aef65acc12194f6561ab1861d468f703ecea426ef56cc59d1f28dcf0de5"
  ],
  [
    "newsboy-classic-editorial.png",
    "40702e9be92cb5dc850203b2cf3db356f66bd0df80f542a89cc59d3abd5bf178"
  ],
  [
    "ksar-market.png",
    "637f010748d5125ed24826ac37e2d9d57a079d7ebb26b87d27088698936662ac"
  ]
]) {
  const image = await fetch(`${baseUrl}/assets/press/${asset}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") || "", /image\/png/iu);
  const imageBytes = Buffer.from(await image.arrayBuffer());
  assert.equal(
    createHash("sha256").update(imageBytes).digest("hex"),
    expectedSha256
  );
}

const adjudicationImage = await fetch(
  `${baseUrl}/assets/press/adg-adjudication-platform.png`
);
assert.equal(adjudicationImage.status, 200);
assert.match(adjudicationImage.headers.get("content-type") || "", /image\/png/iu);

const releaseResponse = await fetch(`${baseUrl}/release.json`);
assert.equal(releaseResponse.status, 200);
const release = await releaseResponse.json();
const expectedRelease = JSON.parse(await readFile(
  new URL("../docs/release.json", import.meta.url),
  "utf8"
));
assert.equal(release.releaseId, "leap2026-pressroom-2.4.0");
assert.equal(release.releaseRoot, expectedRelease.releaseRoot);
assert.equal(release.fileCount, expectedRelease.fileCount);

const wasm = await fetch(`${baseUrl}/evidence-match.wasm`);
assert.equal(wasm.status, 200);
const bytes = new Uint8Array(await wasm.arrayBuffer());
assert.deepEqual([...bytes.subarray(0, 4)], [0, 97, 115, 109]);
const instance = await WebAssembly.instantiate(bytes);
assert.equal(instance.instance.exports.evidence_match(9, 9), 1);
assert.equal(instance.instance.exports.evidence_match(9, 8), 0);

const csp = page.headers.get("content-security-policy");
if (csp) {
  assert.match(csp, /default-src 'self'/u);
  assert.match(csp, /frame-ancestors 'none'/u);
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/u);
  assert.doesNotMatch(csp, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/u);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  auditId: pressKit.auditId,
  pressroomRelease: release.releaseId,
  ksarRelease: ksar.release,
  wasmBytes: bytes.length,
  contentSecurityPolicy: Boolean(csp),
  noTransform: true,
  analyticsInjection: false
}));
