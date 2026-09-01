import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isCompleteNewsboyEdition } from "../worker.js";

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
assert.match(html, /أطروحة الاستثمار/u);
assert.match(html, /Investment thesis/u);
assert.match(html, /رتّب اجتماعًا استثماريًا/u);
assert.match(html, /Schedule an Investor Meeting/u);
assert.match(html, /محطات نمو قابلة للقياس/u);
assert.doesNotMatch(
  html,
  /عمل حر|فواتير وتحويلات|freelance work|scattered invoices/iu
);
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
assert.match(
  html,
  /https:\/\/newsboy\.sbay\.sa\/coverage\/leap-2026/u
);
assert.match(html, /src="\/newsboy-reader"/u);
assert.match(html, /scrolling="no"/u);
assert.match(html, /clicking opens the reader full screen/u);
assert.match(html, /closing returns to the same card position/u);
assert.match(html, /scrolling is enabled only in full-screen mode/u);
assert.match(
  html,
  /sandbox="allow-popups allow-popups-to-escape-sandbox"/u
);
assert.doesNotMatch(html, /coverage\/leap-2026#article-/u);
assert.doesNotMatch(html, /newsboy-leap5-paper\.png/u);
assert.match(html, /class="newsboy-paper-break"/u);
assert.match(html, /newsboy-cultural-edition\.png/u);
assert.match(html, /newsboy-classic-editorial\.png/u);
assert.match(html, /id="adg-cipher"[^>]*data-loop-seconds="5"/u);
assert.match(html, /class="cipher-note"/u);
assert.match(
  html,
  /<p class="cipher-note">\s*<a href="\.\/annex-intelligence"><span class="ar">الملحق التقني ↗<\/span><span class="en">Technical annex ↗<\/span><\/a>\s*<\/p>/u
);
assert.match(html, /id="cipher-transcript" class="cipher-transcript visually-hidden"/u);
assert.match(html, /حبيبة التمثيل المرئية: بت واحد/u);
assert.match(html, /184 CALLS · flag_bit/u);
assert.match(html, /85 BLOOMS · 335 PETALS/u);
assert.doesNotMatch(html, /octet-bloom-trace-v270\.webm/u);
assert.match(html, /<code>void<\/code>/u);
assert.match(html, /deterministic replay/u);
assert.match(html, /not a recording of physical processor cycles/u);
assert.match(html, /Wasm memory unchanged · no return value/u);
assert.doesNotMatch(html, /RasmMaskHex|RasmRecordHex/iu);
assert.doesNotMatch(html, /cloudflareinsights|beacon\.min\.js/iu);
const annexResponse = await fetch(`${baseUrl}/annex-intelligence`, { redirect: "error" });
assert.equal(annexResponse.status, 200, "the technical annex must be published");
const annexHtml = await annexResponse.text();
for (const label of ["IF", "ID", "EX", "MEM", "WB", "void"]) {
  assert.ok(annexHtml.includes(`<code>${label}</code>`), `missing ${label} in the annex`);
}
assert.match(annexHtml, /Quran 20:13/u);
assert.match(annexHtml, /Mingana Islamic Arabic 1572a/u);
assert.match(annexHtml, /Public domain via Wikimedia Commons/u);
assert.match(annexHtml, /taha-rasm-birmingham\.png/u);
assert.match(annexHtml, /flag_bit/u);
assert.match(annexHtml, /flag_popcount/u);
assert.match(annexHtml, /trace_void/u);
assert.match(annexHtml, /id="trace-board-heading"/u);
assert.match(annexHtml, /octet-bloom-trace-v270\.webm/u);
assert.match(annexHtml, /trace-evidence\.json/u);
assert.match(annexHtml, /ليست نسبة دقة لنموذج ذكاء اصطناعي/u);
assert.match(annexHtml, /not a measurement or recording of physical processor stages/u);
assert.match(annexHtml, /does not generally mean that a function cannot write memory/u);
assert.doesNotMatch(annexHtml, /faithful port/iu);
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

const embeddedReader = await fetch(`${baseUrl}/newsboy-reader`, {
  redirect: "error",
  headers: {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin"
  }
});
assert.equal(embeddedReader.status, 200, "the live NewsBoy reader must load");
assert.equal(
  embeddedReader.headers.get("x-sbay-newsboy-source"),
  "https://newsboy.sbay.sa/coverage/leap-2026"
);
assert.equal(
  embeddedReader.headers.get("x-sbay-newsboy-upstream-status"),
  "200"
);
assert.match(
  embeddedReader.headers.get("content-security-policy") || "",
  /frame-ancestors 'self'/u
);
assert.match(
  embeddedReader.headers.get("content-security-policy") || "",
  /script-src 'none'/u
);
assert.equal(embeddedReader.headers.get("x-frame-options"), "SAMEORIGIN");
const embeddedHtml = await embeddedReader.text();
assert.equal(
  isCompleteNewsboyEdition(embeddedHtml),
  true,
  "the embedded NewsBoy response must match a supported complete edition"
);
if (/data-newsboy-relay="edition-api"/u.test(embeddedHtml)) {
  assert.equal(
    embeddedReader.headers.get("x-sbay-newsboy-edition-source"),
    "https://newsboy.sbay.sa/api/coverage/events/leap-2026/edition"
  );
  assert.match(
    embeddedReader.headers.get("x-sbay-newsboy-article-count") || "",
    /^[1-9]\d*$/u
  );
  assert.match(embeddedHtml, /عناوين وملخصات منسوبة إلى مصادرها/u);
  assert.match(embeddedHtml, /class="story-grid"/u);
} else {
  assert.match(
    embeddedHtml,
    /<base href="https:\/\/newsboy\.sbay\.sa\/">/u
  );
  assert.match(
    embeddedHtml,
    /href="https:\/\/leap2026\.sbay\.sa\/newsboy-assets\/fonts\/fonts\.css/iu
  );
  assert.doesNotMatch(
    embeddedHtml,
    /href="https:\/\/newsboy\.sbay\.sa\/newsboy-assets\/fonts\//iu
  );
}
assert.doesNotMatch(embeddedHtml, /<script\b/iu);

async function verifyPublishedFile(relativePath) {
  const response = await fetch(`${baseUrl}/${relativePath}`, {
    redirect: "error"
  });
  assert.equal(response.status, 200, `${relativePath} must be published`);
  const published = Buffer.from(await response.arrayBuffer());
  const local = await readFile(new URL(`../docs/${relativePath}`, import.meta.url));
  assert.equal(
    createHash("sha256").update(published).digest("hex"),
    createHash("sha256").update(local).digest("hex"),
    `${relativePath} must match the local release byte-for-byte`
  );
  return published;
}

const graphBytes = await verifyPublishedFile(
  "assets/evidence/cns-model-graph-public.json"
);
const graphIntegrityBytes = await verifyPublishedFile(
  "assets/evidence/cns-model-graph-public.integrity.json"
);
const culturalBytes = await verifyPublishedFile(
  "assets/evidence/cns-cultural-newsboy-a3-20260819.json"
);
const graph = JSON.parse(graphBytes.toString("utf8"));
const graphIntegrity = JSON.parse(graphIntegrityBytes.toString("utf8"));
const cultural = JSON.parse(culturalBytes.toString("utf8"));
assert.equal(graph.graph.nodeCount, 1953);
assert.equal(graph.graph.maximumTopologicalDepth, 143);
assert.equal(graph.publicLayout.blocks.length, 6);
assert.equal(
  createHash("sha256").update(graphBytes).digest("hex"),
  graphIntegrity.artifact.sha256
);
assert.equal(cultural.source.sourceRecordByteIdentityVerified, true);
assert.equal(cultural.source.workloadIndependentlyRerunByPressroom, false);
assert.equal(cultural.input.pairedNonPaddingR9TokenCount, 2053810);
assert.equal(
  cultural.tokenAccountingStandard.billingUnit,
  "1M paired title/full non-padding R9 model-input tokens"
);

const cepha = await fetch(`${baseUrl}/cepha-k-space-concept/`, {
  redirect: "error"
});
assert.equal(cepha.status, 200, "the preserved Cepha fallback must load");
const cephaHtml = await cepha.text();
assert.match(
  cephaHtml,
  /<meta name="robots" content="noindex,nofollow,noarchive">/u
);
assert.match(
  cephaHtml,
  /Preserved Cepha concept template, not a model measurement/u
);

const embeddedFontCssResponse = await fetch(
  `${baseUrl}/newsboy-assets/fonts/fonts.css?v=20260816-advanced-archive-r4`,
  {
    redirect: "error",
    headers: {
      Accept: "text/css,*/*;q=0.1",
      Origin: "null",
      "Sec-Fetch-Dest": "style",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "same-origin"
    }
  }
);
assert.equal(
  embeddedFontCssResponse.status,
  200,
  "the embedded NewsBoy font stylesheet must load"
);
assert.equal(
  embeddedFontCssResponse.headers.get("access-control-allow-origin"),
  "*"
);
assert.equal(
  embeddedFontCssResponse.headers.get("cross-origin-resource-policy"),
  "cross-origin"
);
const embeddedFontCss = await embeddedFontCssResponse.text();
assert.match(
  embeddedFontCss,
  /url\(['"]?\/newsboy-assets\/fonts\/Amiri-Regular-400\.ttf/iu
);
assert.doesNotMatch(embeddedFontCss, /url\(['"]?\/fonts\//iu);

const embeddedFont = await fetch(
  `${baseUrl}/newsboy-assets/fonts/Amiri-Regular-400.ttf`,
  {
    redirect: "error",
    headers: {
      Accept: "font/ttf,*/*;q=0.1",
      Origin: "null",
      "Sec-Fetch-Dest": "font",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin"
    }
  }
);
assert.equal(embeddedFont.status, 200, "an embedded NewsBoy font must load");
assert.equal(embeddedFont.headers.get("access-control-allow-origin"), "*");
assert.equal(
  embeddedFont.headers.get("cross-origin-resource-policy"),
  "cross-origin"
);
assert.match(
  embeddedFont.headers.get("content-type") || "",
  /^(?:font\/|application\/(?:octet-stream|x-font-ttf|font-sfnt))/iu
);

const directNewsboy = await fetch(
  "https://newsboy.sbay.sa/coverage/leap-2026",
  { redirect: "error" }
);
assert.equal(directNewsboy.status, 200);
assert.match(
  directNewsboy.headers.get("content-security-policy") || "",
  /frame-ancestors 'none'/u
);

const kit = await fetch(`${baseUrl}/press-kit.json`);
assert.equal(kit.status, 200);
const pressKit = await kit.json();
assert.equal(pressKit.auditId, "SBAY-LEAP-DEEPFEST-20260831T043818Z");
assert.equal(pressKit.schema, "sbay.press-kit.v2");
assert.equal(pressKit.tradeName.arabic, "منصة تموين");
assert.equal(pressKit.tradeName.english, "SBAY");
assert.equal(pressKit.publisher, "SBAY");
assert.equal(
  pressKit.publicSignals.basis,
  "Directly verifiable public operating evidence"
);
assert.equal(pressKit.positioning.investmentStage, "Pre-seed");
assert.match(pressKit.positioning.investmentThesis, /measurable growth/u);
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
assert.equal(
  newsBoy.liveCoverageUrl,
  "https://newsboy.sbay.sa/coverage/leap-2026"
);
assert.equal(
  newsBoy.embeddedReaderUrl,
  `${baseUrl}/newsboy-reader`
);
assert.match(newsBoy.embeddedReaderBoundary, /fails visibly/u);
assert.equal(
  newsBoy.featuredArticleUrl,
  "https://newsboy.sbay.sa/coverage/leap-2026#article-editorial_7D8F4B11CCD7DE3A45B07412"
);
assert.equal(
  newsBoy.leap5PaperUrl,
  "https://newsboy.sbay.sa/coverage/leap-2026#article-editorial_7D8F4B11CCD7DE3A45B07412"
);
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
    "newsboy-leap5-paper.png",
    "effd3269f640b3885763703b248712fe91b2fd660a4ce798f11ab65176052d2c"
  ],
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

const expectedTraceEvidence = JSON.parse(await readFile(
  new URL("../docs/trace-evidence.json", import.meta.url),
  "utf8"
));
const traceEvidenceResponse = await fetch(`${baseUrl}/trace-evidence.json`);
assert.equal(traceEvidenceResponse.status, 200);
const traceEvidence = await traceEvidenceResponse.json();
assert.deepEqual(traceEvidence, expectedTraceEvidence);
assert.equal(traceEvidence.interpretation.visibleGrain, "one bit");
assert.equal(traceEvidence.interpretation.aiAccuracyMetricClaimed, false);
assert.equal(traceEvidence.compute.analyzerCallsPerMount, 207);
assert.equal(traceEvidence.compute.verticesPerFrame, 4518);
assert.equal(traceEvidence.video.phaseSamples, 25);
assert.equal(traceEvidence.video.codec, "VP8");
assert.equal(traceEvidence.video.repeatsPerSample, 6);
assert.equal(traceEvidence.video.capture.screenRecordingUsed, false);
for (const media of [traceEvidence.video, traceEvidence.video.poster]) {
  const response = await fetch(`${baseUrl}/${media.path.replace(/^docs\//u, "")}`);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") || "",
    media.path.endsWith(".webm") ? /video\/webm/iu : /image\/png/iu
  );
  const mediaBytes = Buffer.from(await response.arrayBuffer());
  assert.equal(mediaBytes.length, media.bytes);
  assert.equal(
    createHash("sha256").update(mediaBytes).digest("hex"),
    media.sha256
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
assert.equal(release.releaseId, expectedRelease.releaseId);
assert.match(release.releaseId, /^leap2026-pressroom-\d+\.\d+\.\d+$/u);
assert.equal(release.releaseRoot, expectedRelease.releaseRoot);
assert.equal(release.fileCount, expectedRelease.fileCount);

const wasm = await fetch(`${baseUrl}/evidence-match.wasm`);
assert.equal(wasm.status, 200);
const bytes = new Uint8Array(await wasm.arrayBuffer());
assert.deepEqual([...bytes.subarray(0, 4)], [0, 97, 115, 109]);
const instance = await WebAssembly.instantiate(bytes);
assert.equal(instance.instance.exports.evidence_match(9, 9), 1);
assert.equal(instance.instance.exports.evidence_match(9, 8), 0);
assert.equal(instance.instance.exports.flag_bit(0x48, 6), 1);
assert.equal(instance.instance.exports.flag_bit(0x48, 3), 1);
assert.equal(instance.instance.exports.flag_bit(0x48, 0), 0);
assert.equal(instance.instance.exports.flag_popcount(0x48), 2);
const memoryBeforeVoid = new Uint8Array(
  instance.instance.exports.memory.buffer
).slice();
assert.equal(instance.instance.exports.trace_void(), undefined);
assert.deepEqual(
  new Uint8Array(instance.instance.exports.memory.buffer),
  memoryBeforeVoid
);

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
  wasmTrace: {
    flagBit: true,
    flagPopcount: true,
    voidReturn: "none",
    voidMemoryWrites: 0
  },
  contentSecurityPolicy: Boolean(csp),
  noTransform: true,
  analyticsInjection: false
}));
