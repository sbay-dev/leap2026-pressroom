import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const baseUrl = String(
  process.env.PRESSROOM_URL || "https://leap2026.sbay.sa"
).replace(/\/+$/u, "");

const page = await fetch(`${baseUrl}/`, { redirect: "follow" });
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /SBAY-LEAP-DEEPFEST-20260831T043818Z/u);
assert.match(html, /منصة تموين <bdi lang="en">sbay<\/bdi>/u);
assert.match(html, /SBAY Tamween/u);
assert.match(html, /25\+/u);
assert.match(html, /500\+/u);
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
assert.doesNotMatch(html, /cloudflareinsights|beacon\.min\.js/iu);
assert.ok(html.indexOf('id="problem"') < html.indexOf('id="platform"'));
assert.ok(html.indexOf('id="platform"') < html.indexOf('id="intelligence"'));
assert.ok(html.indexOf('id="intelligence"') < html.indexOf('id="outcomes"'));
assert.ok(html.indexOf('id="outcomes"') < html.indexOf('id="vision"'));
assert.ok(html.indexOf('id="vision"') < html.indexOf('id="adjudication"'));
assert.ok(html.indexOf('id="adjudication"') < html.indexOf('id="proof"'));

const cacheControl = page.headers.get("cache-control");
assert.match(cacheControl || "", /(?:^|,)\s*no-transform(?:,|$)/u);

const kit = await fetch(`${baseUrl}/press-kit.json`);
assert.equal(kit.status, 200);
const pressKit = await kit.json();
assert.equal(pressKit.auditId, "SBAY-LEAP-DEEPFEST-20260831T043818Z");
assert.equal(pressKit.schema, "sbay.press-kit.v2");
assert.equal(pressKit.tradeName.arabic, "منصة تموين sbay");
assert.equal(pressKit.publicSignals.publishedCustomers, "500+");
assert.equal(pressKit.claims.generalMtebSuperiority, false);
assert.equal(pressKit.claims.officialEventPartnership, false);
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

for (const [asset, expectedSha256] of [
  [
    "newsboy-cultural-edition.png",
    "a42f7aef65acc12194f6561ab1861d468f703ecea426ef56cc59d1f28dcf0de5"
  ],
  [
    "newsboy-classic-editorial.png",
    "40702e9be92cb5dc850203b2cf3db356f66bd0df80f542a89cc59d3abd5bf178"
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
  wasmBytes: bytes.length,
  contentSecurityPolicy: Boolean(csp),
  noTransform: true,
  analyticsInjection: false
}));
