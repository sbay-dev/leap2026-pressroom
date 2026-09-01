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
  [/تم\s+حل\s+تجمد\s+CPOLY/iu, "unsupported CPOLY resolution claim"],
  [/نشأ\s+من\s+عمل\s+حر|فواتير\s+وتحويلات\s+متفرقة/iu, "obsolete investor framing"],
  [/independent\s+freelance\s+work|scattered\s+invoices\s+and\s+transfers/iu, "obsolete investor framing"]
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
assert.match(index, /platform scope/iu);
assert.match(index, /Independent participation/iu);
assert.match(index, /no general MTEB superiority claim/iu);
assert.match(index, /data-model-graph/u);
assert.match(index, /The authentic engineering graph of the trained model/u);
assert.match(index, /Every point corresponds to an authentic operator/u);
assert.match(index, /There is no imagined surface, unmeasured protrusion, or raw weight disclosure/u);
assert.match(index, /src="\.\/model-graph\.js"/u);
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
assert.match(index, /https:\/\/newsboy\.sbay\.sa\/coverage\/leap-2026/u);
assert.match(index, /src="\/newsboy-reader"/u);
assert.match(index, /data-src="\/newsboy-reader"/u);
assert.match(index, /data-newsboy-open/u);
assert.match(
  index,
  /<a class="newsboy-reader-open" href="https:\/\/newsboy\.sbay\.sa\/coverage\/leap-2026" target="_blank" rel="noopener noreferrer" data-newsboy-open aria-expanded="false">/u
);
assert.match(index, /data-newsboy-close hidden/u);
assert.match(index, /scrolling="no"/u);
assert.match(
  index,
  /sandbox="allow-popups allow-popups-to-escape-sandbox"/u
);
assert.doesNotMatch(
  index,
  /<iframe[^>]+src="https:\/\/newsboy\.sbay\.sa/iu
);
assert.doesNotMatch(
  index,
  /coverage\/leap-2026#article-/u
);
assert.doesNotMatch(index, /newsboy-leap5-paper\.png/u);
assert.match(index, /newsboy-cultural-edition\.png/u);
assert.match(index, /newsboy-classic-editorial\.png/u);
assert.doesNotMatch(index, /آلاف المنتجات|موردون معتمدون|من أيام إلى دقائق/u);
assert.match(index, /without presenting a guaranteed forecast/iu);
assert.match(index, /without a guaranteed savings claim/iu);
assert.match(index, /id="top" aria-labelledby="manuscript-opening-heading"/u);
assert.match(index, /من كلام الله نبدأ/u);
assert.match(index, /We begin with the Qur'an/u);
assert.match(index, /taha-rasm-birmingham\.png/u);
assert.match(index, /Mingana Islamic Arabic 1572a/u);
assert.match(index, /لم تُستخدم الصورة مدخلًا للتعرّف البصري أو لاستخراج النص/u);
assert.match(index, /the image was not used for OCR or text extraction/u);
assert.match(index, /5\/5/u);
assert.match(index, /4\/4/u);
assert.match(
  index,
  /assets\/evidence\/quran-20-13-raw-abstract-equivalence-public\.json/u
);
assert.match(index, /من الشاهد إلى التحكيم البشري/u);
assert.match(index, /From the witness to human adjudication/u);
assert.match(index, /href="https:\/\/adg\.sbay\.sa\/"/u);
assert.match(index, /شارك في التحكيم الآن/u);
assert.match(index, /Join adjudication now/u);
assert.match(index, /تبقى توقعات المحلل مخفية حتى تكتمل المراجعة المستقلة/u);
assert.match(index, /parser predictions remain hidden until independent review is complete/iu);
assert.match(index, /المشاركة دعوة للتحقق، وليست اعتمادًا مسبقًا لهذا البرهان/u);
assert.match(index, /Participation is an invitation to verify, not prior adoption of this proof/u);
assert.ok(
  index.indexOf('id="top"') < index.indexOf('id="presentation"'),
  "the manuscript witness must precede the platform presentation"
);
assert.ok(
  index.indexOf('id="presentation"') < index.indexOf('id="problem"'),
  "the platform presentation must precede the problem narrative"
);

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
assert.equal(
  pressKit.publicSignals.basis,
  "Directly verifiable public operating evidence"
);
assert.equal(pressKit.positioning.investmentStage, "Pre-seed");
assert.match(pressKit.positioning.investmentThesis, /measurable growth/u);
for (const [pattern, label] of [
  [/\d[\d,]*\s*\+?\s*(?:عميل|عملاء)/u, "customer count"],
  [/\b\d+(?:\.\d+)?%\s*(?:uptime|وقت التشغيل)/iu, "uptime promise"],
  [/\b24\s*\/\s*7\b/u, "support availability promise"],
  [/(?:market share|حصة سوقية)[^<]{0,40}\d/iu, "quantified market-share claim"],
  [/\d[^<]{0,40}(?:market share|حصة سوقية)/iu, "quantified market-share claim"]
]) {
  assert.equal(pattern.test(index), false, `${label} in docs/index.html`);
}
assert.match(index, /أطروحة الاستثمار/u);
assert.match(index, /Investment thesis/u);
assert.match(index, /رتّب اجتماعًا استثماريًا/u);
assert.match(index, /Schedule an Investor Meeting/u);
assert.match(index, /محطات نمو قابلة للقياس/u);
assert.match(index, /ناقش فرصة الاستثمار والتوسع المؤسسي/u);
assert.doesNotMatch(index, /شبكة متنامية|Growing network/iu);
assert.doesNotMatch(index, /عمل حر|فواتير وتحويلات|freelance work/iu);

// Numeric-claim gate. Every headline figure rendered in a metric tile must be
// registered in press-kit.json with a basis, so no number reaches the public
// page without a recorded way for a reader to check it.
const ALLOWED_BASES = new Set(["recomputable", "public-link", "declared", "estimate"]);
const registeredClaims = new Map(
  pressKit.numericClaims.entries.map(entry => [entry.value, entry])
);
for (const entry of pressKit.numericClaims.entries) {
  assert.ok(
    ALLOWED_BASES.has(entry.basis),
    `unknown claim basis "${entry.basis}" for ${entry.value}`
  );
  assert.ok(entry.source, `missing source for numeric claim ${entry.value}`);
}
const tileValues = [...index.matchAll(/<div(?: role="listitem")?><strong>(.*?)<\/strong>/gu)]
  .map(match => match[1])
  .filter(value => !value.includes("<span") && /[0-9]/u.test(value));
assert.ok(tileValues.length >= 12, `expected headline figures, found ${tileValues.length}`);
for (const value of tileValues) {
  const entry = registeredClaims.get(value);
  assert.ok(entry, `unregistered headline figure "${value}" in docs/index.html`);
  if (entry.basis === "declared") {
    assert.ok(
      index.includes("· معلن") && index.includes("· declared"),
      `declared figure "${value}" must be labelled as declared on the page`
    );
  }
  if (entry.basis === "estimate") {
    assert.ok(
      index.includes("زمن متوقّع لا مقيس") && index.includes("expected, not measured"),
      `estimate "${value}" must be labelled as an estimate on the page`
    );
  }
}
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
assert.equal(pressKit.claims.kSpaceOriginalEmbeddingCoordinates, false);
assert.equal(pressKit.claims.kSpaceNegativeCurvatureMeasured, false);
assert.equal(pressKit.claims.kSpaceHardwareFirstTouch, false);
assert.equal(pressKit.claims.kSpaceLiveInference, false);
assert.equal(pressKit.claims.kSpaceTrainedV7VectorDisclosure, false);
assert.equal(pressKit.claims.kSpaceAuthenticZeroCheckpointAvailable, false);
assert.equal(pressKit.claims.kSpaceZeroVsTrainedComparison, false);
assert.equal(pressKit.claims.kSpaceTrainingEffectMeasured, false);
assert.equal(pressKit.claims.kSpaceNeuralPersistenceComputed, false);
assert.equal(pressKit.claims.kSpaceExactNodeTopologyPublished, false);
assert.equal(pressKit.claims.culturalWholeCorpusIndependentHoldoutClaim, false);
assert.equal(pressKit.claims.culturalProductionActivation, false);
assert.equal(pressKit.claims.culturalMeasuredGpuPowerDraw, false);
assert.equal(pressKit.claims.culturalCurrentMarketPriceClaim, false);
assert.equal(pressKit.claims.culturalProfitabilityClaim, false);
assert.equal(pressKit.claims.ksarSaudiPhysicalHosting, false);
assert.equal(pressKit.claims.ksarSaudiLegalDataResidency, false);
assert.equal(pressKit.claims.ksarUniversalCrossDeviceAcceptance, false);
assert.equal(pressKit.claims.ksarCpolyFreezeResolved, false);
assert.equal(pressKit.claims.ksarSalesMetricsClaimed, false);
assert.equal(pressKit.claims.ksarAudienceMetricsClaimed, false);
assert.equal(pressKit.claims.quranRasmManuscriptWasMachineInput, false);
assert.equal(pressKit.claims.quranRasmOcrClaim, false);
assert.equal(pressKit.claims.quranRasmAloneRecoversGrammar, false);
assert.equal(pressKit.claims.quranRasmIndependentSyntaxGold, false);
assert.equal(pressKit.claims.quranRasmQuranWideGeneralization, false);
assert.equal(pressKit.claims.quranRasmNeuralModelCapability, false);
assert.equal(pressKit.claims.quranRasmAlreadyIndependentlyAdjudicated, false);

const quranRasmEvidence = JSON.parse(await readFile(
  path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "quran-20-13-raw-abstract-equivalence-public.json"
  ),
  "utf8"
));
assert.equal(
  quranRasmEvidence.schema,
  "sbay.quran-20-13.raw-abstract-equivalence-public.v1"
);
assert.equal(quranRasmEvidence.status, "VERIFIED_VERTICAL_SLICE");
assert.equal(quranRasmEvidence.theorem.id, "T(20:13,E)");
assert.equal(quranRasmEvidence.manuscriptWitness.machineInput, false);
assert.equal(quranRasmEvidence.manuscriptWitness.ocrClaimed, false);
assert.equal(quranRasmEvidence.representation.exactSourceEnvelopeRetained, true);
assert.equal(
  quranRasmEvidence.representation.combiningMarksRemovedOnlyFromRasmProjection,
  true
);
assert.equal(quranRasmEvidence.measuredResult.rawWordBlocks, 5);
assert.equal(quranRasmEvidence.measuredResult.exactSlotMappings, 5);
assert.equal(quranRasmEvidence.measuredResult.localRelations, 4);
assert.equal(quranRasmEvidence.measuredResult.matchedLocalRelations, 4);
assert.equal(quranRasmEvidence.measuredResult.canonicalSignatureMatched, true);
assert.equal(quranRasmEvidence.claimBoundary.quranWideGeneralization, false);
assert.equal(quranRasmEvidence.claimBoundary.rasmAloneRecoversGrammar, false);
assert.equal(quranRasmEvidence.claimBoundary.independentSyntaxGold, false);
assert.equal(quranRasmEvidence.claimBoundary.neuralTrainingClaim, false);
assert.equal(
  pressKit.quranRasm.publicEvidence,
  "https://leap2026.sbay.sa/assets/evidence/quran-20-13-raw-abstract-equivalence-public.json"
);
assert.equal(
  pressKit.quranRasm.sourceProofSha256,
  "918213b976facba45e8796fbe24590cff7ab0ddb17fd0f6cfda0c88301b35849"
);
assert.equal(pressKit.quranRasm.boundedResult.exactSlotMappings, "5/5");
assert.equal(pressKit.quranRasm.boundedResult.matchedLocalRelations, "4/4");
assert.equal(
  pressKit.quranRasm.adjudicationInvitation.url,
  "https://adg.sbay.sa/"
);
assert.equal(
  pressKit.quranRasm.adjudicationInvitation
    .parserPredictionsHiddenUntilIndependentReviewComplete,
  true
);
assert.equal(
  pressKit.quranRasm.adjudicationInvitation.participationImpliesProofAdoption,
  false
);
assert.equal(
  pressKit.quranRasm.adjudicationInvitation.proofAlreadyIndependentlyAdjudicated,
  false
);

const modelGraphPath = path.join(
  root,
  "docs",
  "assets",
  "evidence",
  "cns-model-graph-public.json"
);
const modelGraphBytes = await readFile(modelGraphPath);
const modelGraphText = modelGraphBytes.toString("utf8");
const modelGraph = JSON.parse(modelGraphText);
const modelGraphIntegrity = JSON.parse(await readFile(
  path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "cns-model-graph-public.integrity.json"
  ),
  "utf8"
));
assert.equal(
  modelGraph.schema,
  "sbay.cns-model-engineering-graph-public.v1"
);
assert.equal(
  modelGraph.status,
  "TRAINED_ONLY_PUBLIC_ENGINEERING_GRAPH_VERIFIED"
);
assert.equal(
  modelGraph.model.sha256,
  "8847832167ec643c66461ef8c6b7182b48286821d0fd20fd600414bf51f5dfef"
);
assert.equal(modelGraph.model.checker, "PASS");
assert.equal(modelGraph.model.shapeInference, "PASS");
assert.equal(modelGraph.graph.nodeCount, 1953);
assert.equal(modelGraph.graph.directedNodeTensorEdges, 2933);
assert.equal(modelGraph.graph.maximumTopologicalDepth, 143);
assert.equal(modelGraph.initializers.count, 351);
assert.equal(modelGraph.initializers.storedElementCount, 48710171);
assert.equal(modelGraph.graph.outputs[0].name, "sentence_embedding");
assert.deepEqual(modelGraph.graph.outputs[0].shape, ["batch", 768]);
assert.equal(modelGraph.publicLayout.zAxis, "unused");
assert.equal(modelGraph.publicLayout.blocks.length, 6);
assert.equal(modelGraph.publicLayout.depthLayers.length, 144);
assert.equal(
  modelGraph.publicLayout.blocks.reduce(
    (sum, block) => sum + block.nodeCount,
    0
  ),
  modelGraph.graph.nodeCount
);
assert.equal(
  modelGraph.publicLayout.depthLayers.reduce(
    (sum, layer) => sum + layer.nodeCount,
    0
  ),
  modelGraph.graph.nodeCount
);
assert.equal(
  Object.values(modelGraph.graph.operatorCounts)
    .reduce((sum, count) => sum + count, 0),
  modelGraph.graph.nodeCount
);
assert.equal(
  modelGraph.publicLayout.blocks.reduce(
    (sum, block) => sum + block.internalTensorEdges,
    0
  ) + modelGraph.publicLayout.blockEdges.reduce(
    (sum, edge) => sum + edge.count,
    0
  ),
  modelGraph.graph.directedNodeTensorEdges
);
assert.equal(
  modelGraph.canonicalStructure.sha256,
  "51740c50a975b5c510f1685a939abd26fe9ef6ea0ba65fc10b6c59fffb9c67f1"
);
assert.equal(
  modelGraph.comparisonAvailability.authenticZeroCheckpoint,
  "unavailable"
);
assert.equal(
  modelGraph.comparisonAvailability.zeroVsTrainedArchitectureComparison,
  "not_computed"
);
assert.equal(
  modelGraph.comparisonAvailability.trainingEffectMetrics,
  "not_computed"
);
assert.equal(
  modelGraph.comparisonAvailability.neuralPersistence,
  "not_computed"
);
assert.deepEqual(modelGraph.publicSafety, {
  rawInitializerValuesPublished: false,
  initializerIdentitiesPublished: false,
  rawVectorsPublished: false,
  activationsPublished: false,
  exactNodeNamesPublished: false,
  exactTensorNamesPublishedBeyondInterface: false,
  exactNodeConnectionsPublished: false,
  absoluteSourcePathPublished: false
});
assert.equal(
  modelGraphIntegrity.schema,
  "sbay.cns-model-engineering-graph-integrity.v1"
);
assert.equal(modelGraphIntegrity.artifact.bytes, modelGraphBytes.length);
assert.equal(
  modelGraphIntegrity.artifact.sha256,
  createHash("sha256").update(modelGraphBytes).digest("hex")
);
assert.equal(
  modelGraphIntegrity.sourceAudit.sha256,
  modelGraph.sourceAudit.sha256
);
assert.equal(
  modelGraphIntegrity.canonicalStructure.sha256,
  modelGraph.canonicalStructure.sha256
);
assert.equal(
  pressKit.kSpace.publicArtifact,
  "https://leap2026.sbay.sa/assets/evidence/cns-model-graph-public.json"
);
assert.equal(
  pressKit.kSpace.integrityArtifact,
  "https://leap2026.sbay.sa/assets/evidence/cns-model-graph-public.integrity.json"
);
assert.equal(pressKit.kSpace.model.sha256, modelGraph.model.sha256);
assert.equal(
  pressKit.kSpace.model.canonicalStructureSha256,
  modelGraph.canonicalStructure.sha256
);
assert.match(
  pressKit.kSpace.comparisonBoundary,
  /No authentic architecture-matched zero checkpoint is available/u
);
assert.match(
  pressKit.kSpace.disclosureBoundary,
  /Exact node and tensor names, exact wiring/u
);
assert.doesNotMatch(modelGraphText, /[A-Z]:\\/u);
assert.doesNotMatch(modelGraphText, /model\.base\./u);
assert.doesNotMatch(
  modelGraphText,
  /"(?:nodes|edges|items|valueSha256|tensor|source|target)"\s*:/u
);
assert.doesNotMatch(
  modelGraphText,
  /"(?:rawVector|vectorComponents|weights|activations)"\s*:/iu
);

const legacyKSpace = JSON.parse(await readFile(
  path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "cns-k-space-public.json"
  ),
  "utf8"
));
assert.equal(
  legacyKSpace.status,
  "SUPERSEDED_BY_MEASURED_ENGINEERING_GRAPH"
);
assert.equal(legacyKSpace.replacement, "./cns-model-graph-public.json");
assert.equal(legacyKSpace.conceptualFallback, "../../cepha-k-space-concept/");
assert.match(index, /data-model-graph/u);
assert.match(index, /src="\.\/model-graph\.js"/u);
assert.doesNotMatch(index, /src="\.\/k-space\.js"/u);
assert.match(index, /الرسم الهندسي الحقيقي للنموذج المدرّب/u);
assert.match(index, /The authentic engineering graph of the trained model/u);
assert.match(index, /checkpoint الصفري الأصيل المطابق غير متاح/u);
assert.match(index, /An authentic architecture-matched zero checkpoint is unavailable/u);
assert.doesNotMatch(index, /السطح السرجي لغة عرض/u);

const culturalEvidence = JSON.parse(await readFile(
  path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "cns-cultural-newsboy-a3-20260819.json"
  ),
  "utf8"
));
assert.equal(
  culturalEvidence.schema,
  "sbay.cns-cultural-newsboy-a3-public.v1"
);
assert.equal(culturalEvidence.status, "DOCUMENTED_COMPUTED_COSTS");
assert.equal(
  culturalEvidence.source.commit,
  "0ebf9988eff77078ea61e99d500092e10cd8baef"
);
assert.equal(
  culturalEvidence.source.visibility,
  "authenticated_access_required"
);
assert.equal(culturalEvidence.source.unauthenticatedFetchStatusObserved, 404);
assert.equal(culturalEvidence.source.sourceRecordByteIdentityVerified, true);
assert.equal(
  culturalEvidence.source.workloadIndependentlyRerunByPressroom,
  false
);
assert.equal(
  culturalEvidence.source.humanReport.gitBlobSha,
  "d0efd1e2129187e83a6f09216d8f63913ed9c537"
);
assert.equal(
  culturalEvidence.source.machineRecord.gitBlobSha,
  "a964909f2e172f68f5f1f3c0a45ca8c7d7ccceb0"
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords.humanReport.gitBlobSha,
  culturalEvidence.source.humanReport.gitBlobSha
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords.humanReport.sha256,
  "ec8c377023749655404d02372f5681478e7cca9e542d8ac0be8e5cd6591e9b6b"
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords.humanReport.gitBlobMatched,
  true
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords
    .tokenAccountingLedgerRules.gitBlobSha,
  "48bcc3265aad9793bf4c86e31af8443f92897b3b"
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords
    .tokenAccountingLedgerRules.sha256,
  "767e71f032da2dd52211ef813f9c0f3b82ae9f362e197b9d44f0cc50e7e8a364"
);
assert.equal(
  culturalEvidence.source.localByteIdenticalRecords
    .tokenAccountingLedgerRules.gitBlobMatched,
  true
);
assert.equal(culturalEvidence.input.articleCount, 10800);
assert.equal(culturalEvidence.input.pairedNonPaddingR9TokenCount, 2053810);
assert.equal(culturalEvidence.input.rawFeatureSidecarMismatchCount, 0);
assert.equal(
  culturalEvidence.tokenAccountingStandard.billingUnit,
  "1M paired title/full non-padding R9 model-input tokens"
);
assert.equal(culturalEvidence.tokenAccountingStandard.rules.length, 6);
assert.equal(
  culturalEvidence.tokenAccountingStandard.sourceRecord.sha256,
  culturalEvidence.source.localByteIdenticalRecords
    .tokenAccountingLedgerRules.sha256
);
assert.equal(
  culturalEvidence.classification.r9PlusA3.accuracy,
  0.7805555555555556
);
assert.equal(
  culturalEvidence.classification.delta.accuracy,
  0.10240740740740739
);
assert.equal(
  culturalEvidence.classification.r9PlusA3.focusMacroF1,
  0.9427878001428764
);
assert.equal(
  culturalEvidence.classification.delta.focusMacroF1,
  0.16752492464937996
);
assert.equal(culturalEvidence.classification.changes.corrections, 1106);
assert.equal(culturalEvidence.classification.changes.regressions, 0);
assert.equal(
  culturalEvidence.classification.changes.precision,
  0.9972948602344455
);
assert.equal(
  culturalEvidence.classification.changes
    .protectedDeskPredictionVectorsByteIdentical,
  true
);
assert.equal(
  culturalEvidence.throughputTokensPerSecond.preparedR9A3AndPolicy,
  4667230.240299575
);
assert.equal(
  culturalEvidence.throughputTokensPerSecond.rawTextToPrediction,
  83931.06374559269
);
assert.equal(
  culturalEvidence.measuredCostPerMillionPairedTokens
    .rawToPredictionMicrosecondsPerToken,
  11.914539806514856
);
assert.equal(
  culturalEvidence.measuredCostPerMillionPairedTokens.stagedGpuHours,
  0.00005951662195262689
);
assert.equal(
  culturalEvidence.measuredCostPerMillionPairedTokens.cpuCoreHours,
  0.003064257539781079
);
assert.equal(
  culturalEvidence.energyUpperBoundPerMillionPairedTokens
    .stagedGpuKwhMaximum,
  0.0000029758310976313445
);
assert.equal(
  culturalEvidence.energyUpperBoundPerMillionPairedTokens
    .measuredPowerDrawClaim,
  false
);
assert.equal(culturalEvidence.activation.candidateEnabled, false);
assert.equal(culturalEvidence.activation.productionEnabled, false);
assert.equal(
  culturalEvidence.classification.wholeCorpusDescriptive,
  true
);
assert.equal(
  culturalEvidence.classification.freshIndependentHoldoutRemainsAuthority,
  true
);
assert.equal(pressKit.culturalCns.sourceCommit, culturalEvidence.source.commit);
assert.equal(
  pressKit.culturalCns.scope.pairedNonPaddingR9Tokens,
  culturalEvidence.input.pairedNonPaddingR9TokenCount
);
assert.equal(
  pressKit.culturalCns.classification.r9PlusA3Accuracy,
  culturalEvidence.classification.r9PlusA3.accuracy
);
assert.equal(
  pressKit.culturalCns.energy.measuredPowerDraw,
  false
);
assert.equal(
  pressKit.culturalCns.boundaries.productionActivationEnabled,
  false
);
assert.equal(
  pressKit.culturalCns.sourceVisibility,
  "authenticated access required; unauthenticated fetch returned 404"
);
assert.equal(pressKit.culturalCns.recordByteIdentityVerified, true);
assert.equal(
  pressKit.culturalCns.workloadIndependentlyRerunByPressroom,
  false
);
assert.equal(
  pressKit.culturalCns.localReportSha256,
  culturalEvidence.source.localByteIdenticalRecords.humanReport.sha256
);
assert.equal(
  pressKit.culturalCns.tokenAccountingRulesSha256,
  culturalEvidence.source.localByteIdenticalRecords
    .tokenAccountingLedgerRules.sha256
);
assert.equal(
  pressKit.culturalCns.tokenAccountingStandard.billingUnit,
  culturalEvidence.tokenAccountingStandard.billingUnit
);
assert.equal(
  pressKit.culturalCns.tokenAccountingStandard.nonPaddingModelInputs,
  true
);
assert.equal(
  pressKit.culturalCns.tokenAccountingStandard
    .rawPreprocessingDisclosedSeparately,
  true
);
assert.equal(
  pressKit.culturalCns.tokenAccountingStandard
    .gpuCpuMemoryAndPowerSeparated,
  true
);
assert.equal(
  pressKit.culturalCns.tokenAccountingStandard
    .unavailablePowerTelemetryUsesUpperBound,
  true
);
for (const value of [
  "10,800",
  "2,053,810",
  "0.780556",
  "0.942788",
  "99.729%",
  "4,667,230",
  "83,931",
  "11.914540",
  "161.063 MiB",
  "0.0000595166 GPU-h / 1M",
  "0.00306426 core-h / 1M",
  "≤ 0.00000297583 kWh / 1M"
]) {
  assert.equal(
    registeredClaims.get(value)?.basis,
    "declared",
    `Cultural CNS claim ${value} must remain declared`
  );
}
assert.match(index, /CNS CULTURAL NEWSBOY A3 \/ MEASURED 2026-08-19/u);
assert.match(index, /قياسات عبء العمل الثقافي الموثقة/u);
assert.match(index, /Documented measurements from the cultural workload/u);
assert.match(index, /2,053,810 paired non-padding R9 tokens/u);
assert.match(index, /0\.678148 → 0\.780556 · Δ \+0\.102407/u);
assert.match(index, /1,106 corrections · 0 regressions/u);
assert.match(index, /83,931/u);
assert.match(index, /≤ 0\.00000297583 kWh \/ 1M/u);
assert.match(index, /الاختبار الجديد المستقل مرجع الجودة/u);
assert.match(index, /معلن · نسخة مطابقة · التفعيل معطّل/u);
assert.match(index, /declared · record matched · activation disabled/u);
assert.match(index, /طابقت النسخة المحلية التقرير وقواعد معيار التوكن/u);
assert.match(index, /matched their Git blob identities byte-for-byte/u);
assert.match(index, /مليون رمز إدخال R9 مزدوج غير محشو، لا كلمات تقديرية/u);
assert.match(index, /one million paired non-padding R9 model-input tokens, not estimated words/u);
assert.match(index, /href="\.\/annex-intelligence#token-accounting-standard"/u);
assert.match(
  index,
  /CNSEmbedding\/blob\/0ebf9988eff77078ea61e99d500092e10cd8baef/u
);

assert.match(index, /href="\.\/cepha-k-space-concept\/"/u);
const cephaTemplateRoot = path.join(root, "docs", "cepha-k-space-concept");
const cephaTemplateIndex = await readFile(
  path.join(cephaTemplateRoot, "index.html"),
  "utf8"
);
const cephaTemplateRenderer = await readFile(
  path.join(cephaTemplateRoot, "k-space.js"),
  "utf8"
);
const cephaTemplateSample = await readFile(
  path.join(cephaTemplateRoot, "assets", "evidence", "cns-k-space-public.json")
);
const cephaSnapshotRoot = path.join(
  root,
  "cepha-templates",
  "k-space-concept-v1"
);
const cephaSnapshotManifest = JSON.parse(await readFile(
  path.join(cephaSnapshotRoot, "SNAPSHOT-MANIFEST.json"),
  "utf8"
));
assert.equal(
  cephaSnapshotManifest.classification,
  "conceptual-visual-template"
);
assert.equal(cephaSnapshotManifest.policy.evidenceUseAllowed, false);
assert.equal(cephaSnapshotManifest.deployment.includedInWorkerAssets, false);
for (const entry of cephaSnapshotManifest.files) {
  const bytes = await readFile(path.join(
    cephaSnapshotRoot,
    ...entry.path.split("/")
  ));
  assert.equal(bytes.length, entry.bytes, `Cepha snapshot size: ${entry.path}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    entry.sha256,
    `Cepha snapshot hash: ${entry.path}`
  );
}
assert.match(
  cephaTemplateIndex,
  /<meta name="robots" content="noindex,nofollow,noarchive">/u
);
const robots = await readFile(path.join(root, "docs", "robots.txt"), "utf8");
assert.match(robots, /Disallow: \/cepha-k-space-concept\//u);
assert.match(cephaTemplateIndex, /قالب Cepha التصوري المحفوظ، وليس قياسًا للنموذج/u);
assert.match(cephaTemplateIndex, /Preserved Cepha concept template, not a model measurement/u);
assert.match(cephaTemplateIndex, /الرسم الهندسي المقاس يبقى هو مرجع الادعاءات العلمية/u);
assert.match(cephaTemplateIndex, /Measured evidence remains authoritative/u);
assert.doesNotMatch(cephaTemplateIndex, /<script[^>]+src=["']https?:/iu);
assert.match(cephaTemplateRenderer, /function drawSurface\(/u);
assert.match(cephaTemplateRenderer, /function saddleHeight\(/u);
assert.match(cephaTemplateRenderer, /SAMPLE OK/u);
assert.doesNotMatch(cephaTemplateRenderer, /\bmeasured nodes\b/iu);
assert.equal(
  createHash("sha256").update(cephaTemplateSample).digest("hex"),
  cephaSnapshotManifest.files.find(entry =>
    entry.path.endsWith("cns-k-space-public.sample.json")
  ).sha256
);

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
  "https://leap2026.sbay.sa/newsboy-reader"
);
assert.match(newsBoy.embeddedReaderBoundary, /Read-only same-origin reader/u);
assert.match(newsBoy.embeddedReaderBoundary, /edition-record API/u);
assert.equal(
  newsBoy.featuredArticleUrl,
  "https://newsboy.sbay.sa/coverage/leap-2026#article-editorial_7D8F4B11CCD7DE3A45B07412"
);
assert.equal(
  newsBoy.leap5PaperUrl,
  "https://newsboy.sbay.sa/coverage/leap-2026#article-editorial_7D8F4B11CCD7DE3A45B07412"
);
assert.deepEqual(newsBoy.featuredMedia, [
  "assets/press/newsboy-leap5-paper.png",
  "assets/press/newsboy-cultural-edition.png",
  "assets/press/newsboy-classic-editorial.png"
]);
const newsBoyLeap5Evidence = JSON.parse(await readFile(
  path.join(root, "evidence", "newsboy-leap5-evidence.json"),
  "utf8"
));
assert.equal(newsBoyLeap5Evidence.httpStatus, 200);
assert.equal(newsBoyLeap5Evidence.content.targetFound, true);
assert.equal(newsBoyLeap5Evidence.accessibility.semanticMainPaper, true);
assert.equal(newsBoyLeap5Evidence.accessibility.printable, true);
assert.equal(newsBoyLeap5Evidence.accessibility.reducedMotionRule, true);
assert.equal(newsBoyLeap5Evidence.screenshot.view, "target-article");
const newsBoyLeap5Image = await readFile(
  path.join(root, newsBoyLeap5Evidence.screenshot.path)
);
assert.equal(newsBoyLeap5Image.length, newsBoyLeap5Evidence.screenshot.bytes);
assert.equal(
  createHash("sha256").update(newsBoyLeap5Image).digest("hex"),
  newsBoyLeap5Evidence.screenshot.sha256
);
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
assert.match(app, /setNewsboyReaderState\(true, "viewport"\)/u);
assert.match(app, /event\.preventDefault\(\);\s*openNewsboyReader\(\);/u);
assert.doesNotMatch(app, /requestFullscreen|document\.exitFullscreen/u);
assert.match(app, /setAttribute\("scrolling", expanded \? "yes" : "no"\)/u);
assert.match(app, /reloadNewsboyAtTop/u);
assert.match(app, /window\.scrollTo\(0, newsboyRestoreY\)/u);
assert.match(app, /newsboyOpen\?\.focus\(\{ preventScroll: true \}\)/u);

const headers = await readFile(path.join(root, "docs", "_headers"), "utf8");
assert.match(
  headers,
  /Cache-Control: public, max-age=0, must-revalidate, no-transform/u
);
assert.match(headers, /script-src 'self' 'wasm-unsafe-eval'/u);
assert.match(headers, /frame-src 'self'/u);
assert.doesNotMatch(headers, /(?:^|\s)'unsafe-eval'(?:\s|;|$)/u);

const worker = await readFile(path.join(root, "worker.js"), "utf8");
assert.match(worker, /const READER_PATHS = new Set/u);
assert.match(worker, /const FONT_PROXY_PREFIX = "\/newsboy-assets\/fonts\/"/u);
assert.match(worker, /frame-ancestors 'self'/u);
assert.match(worker, /script-src 'none'/u);
assert.match(worker, /sandbox allow-popups allow-popups-to-escape-sandbox/u);
assert.match(worker, /function isCompleteNewsboyEdition/u);
assert.match(worker, /function isModernNewsboyEdition/u);
assert.match(worker, /function isCompleteNewsboyEditionRecord/u);
assert.match(worker, /function renderNewsboyEdition/u);
assert.match(worker, /const legacyPaper/u);
assert.match(worker, /view-modern/u);
assert.match(worker, /m-culture-section/u);
assert.match(worker, /m-archive-section/u);
assert.match(worker, /api\/coverage\/events\/leap-2026\/edition/u);
assert.match(worker, /data-newsboy-relay="edition-api"/u);
assert.match(worker, /\|\| !isCompleteNewsboyEdition\(html\)/u);
assert.match(worker, /No stale capture is presented as current/u);
assert.doesNotMatch(worker, /url\.searchParams\.get\(["']url["']\)/u);

const wrangler = await readFile(path.join(root, "wrangler.toml"), "utf8");
assert.match(wrangler, /^main = "worker\.js"$/mu);
assert.match(wrangler, /^binding = "ASSETS"$/mu);
assert.match(wrangler, /run_worker_first = \[/u);
for (const route of [
  '"/newsboy-reader"',
  '"/newsboy-reader/"',
  '"/newsboy-assets/fonts/*"'
]) {
  assert.ok(wrangler.includes(route), `missing Worker-first route ${route}`);
}

for (const asset of [
  "adg-adjudication-platform.png",
  "newsboy-cultural-edition.png",
  "newsboy-classic-editorial.png",
  "newsboy-classic-hero.png",
  "newsboy-classic-full.png",
  "newsboy-classic-mobile.png",
  "newsboy-leap5-paper.png",
  "ksar-market.png",
  "cp-dashboard.png",
  "taha-rasm-birmingham.png",
  "octet-bloom-trace-v270-poster.png",
  "og-card.png"
]) {
  await stat(path.join(root, "docs", "assets", "press", asset));
}
await stat(path.join(root, "docs", "assets", "press", "octet-bloom-trace-v270.webm"));

const cipher = await readFile(path.join(root, "docs", "adg-cipher.js"), "utf8");
await stat(path.join(root, "docs", "annex.js"));
const annex = await readFile(path.join(root, "docs", "annex-intelligence.html"), "utf8");
const wasmSource = await readFile(path.join(root, "wasm", "evidence_match.rs"), "utf8");
const disclosureBoundary = await readFile(
  path.join(root, "PUBLIC-DISCLOSURE-BOUNDARY.md"),
  "utf8"
);
assert.match(cipher, /const LOOP_SECONDS = 5/u);
assert.match(cipher, /createCanvasPainter/u, "a non-WebGPU fallback painter is mandatory");
assert.match(cipher, /popcount\(flag\)/u, "petal count must be the population count of the flag byte");
// The verse text is never typed into the shipped source. Only derived byte
// values may appear, and the manuscript image is the authorised embedding.
assert.equal(
  /[\u0600-\u06FF]/u.test(cipher),
  false,
  "no Arabic script may be embedded in docs/adg-cipher.js"
);
const publishedFlags = [
  0x48, 0x27, 0xba, 0x27, 0x27, 0x2d, 0xba, 0x31, 0xba, 0x43, 0xa1, 0x27,
  0x33, 0xba, 0x45, 0x39, 0x44, 0x45, 0x27, 0x6e, 0x48, 0x2d, 0x49
];
assert.equal(publishedFlags.length, 23, "the rasm must stay at 23 units");
assert.equal(publishedFlags.length * 8, 184, "the lattice must stay at 184 bits");
for (const [pattern, label] of [
  [/RasmMaskHex|RasmRecordHex/iu, "proprietary rasm mask table"],
  [/0x8003|0x0817/u, "proprietary rasm mask value"],
  [/routingThreshold|expertWeight|availabilityMask/iu, "protected routing internals"]
]) {
  assert.equal(pattern.test(cipher), false, `${label} in docs/adg-cipher.js`);
  assert.equal(pattern.test(index), false, `${label} in docs/index.html`);
}
assert.match(index, /أطروحة الاستثمار/u);
assert.match(index, /measurable growth milestones/u);
assert.match(index, /id="adg-cipher"/u);
assert.match(index, /data-loop-seconds="5"/u);
assert.match(index, /class="cipher-note"/u, "the disclosure note must stay on the page");
assert.match(index, /href="\.\/annex-intelligence"/u, "the hero must link to the technical annex");
assert.match(index, /إعادة عرض حتمية/u);
assert.match(index, /deterministic replay/u);
assert.match(index, /ليست تسجيلًا لدورات معالج مادي/u);
assert.match(index, /not a recording of physical processor cycles/u);
assert.match(index, /Wasm memory unchanged · no return value/u);
assert.match(index, /id="cipher-transcript" class="cipher-transcript visually-hidden"/u);
assert.match(index, /حبيبة التمثيل المرئية: بت واحد/u);
assert.match(index, /Visible representation grain: one bit/u);
assert.match(index, /وهذا وصف للعرض وليس نسبة دقة لنموذج ذكاء اصطناعي/u);
assert.match(index, /تقرأ الدورة 23 أوكتتًا، وتفك 184 موضع بت، وتمثل 85 بتًا مضاءً في 335 بتلة/u);
for (const phrase of [
  "قراءة الأوكتتات",
  "فكّ البتات",
  "التفتّح",
  "الهدوء",
  "trace_void() → () · ΔMEM = 0"
]) {
  assert.ok(index.includes(phrase), `missing scene phrase: ${phrase}`);
}
assert.match(
  index,
  /<p class="cipher-note">\s*<a href="\.\/annex-intelligence"><span class="ar">الملحق التقني ↗<\/span><span class="en">Technical annex ↗<\/span><\/a>\s*<\/p>/u,
  "only the technical-annex link may remain visibly below the hero trace"
);
assert.match(index, /class="newsboy-paper-break"/u);
const newsboySectionStart = index.indexOf(
  '<article class="newsboy-paper-break"'
);
const newsboySectionEnd = index.indexOf("</article>", newsboySectionStart);
assert.ok(newsboySectionStart >= 0 && newsboySectionEnd > newsboySectionStart);
const newsboySectionHtml = index.slice(
  newsboySectionStart,
  newsboySectionEnd
);
assert.match(index, /أعلى العدد أولًا، والتصفح الكامل عند الطلب/u);
assert.match(index, /لا تلتقط المعاينة التمرير أو لوحة المفاتيح/u);
assert.match(index, /عند النقر يفتح القارئ بملء الشاشة/u);
assert.match(index, /The edition masthead first, full browsing on demand/u);
assert.match(index, /clicking opens the reader full screen/u);
assert.match(index, /closing returns to the same card position/u);
assert.match(index, /scrolling is enabled only in full-screen mode/u);
assert.match(index, /src="\/newsboy-reader"/u);
assert.doesNotMatch(newsboySectionHtml, /طبعة اليوم|Today's edition/u);
assert.doesNotMatch(
  newsboySectionHtml,
  /31 أغسطس 2026|31 August 2026/u
);
assert.doesNotMatch(index, /octet-bloom-trace-v270\.webm/u);

// The hero names the route; all interpretation and limitations stay here.
for (const label of ["IF", "ID", "EX", "MEM", "WB", "void"]) {
  assert.ok(annex.includes(`<code>${label}</code>`), `missing pipeline label ${label} in the annex`);
}
assert.match(annex, /20:13/u, "the annex must cite its public verse reference");
assert.match(annex, /taha-rasm-birmingham\.png/u, "the authorised manuscript embedding must stay");
assert.match(annex, /Mingana Islamic Arabic 1572a/u, "the manuscript attribution is mandatory");
assert.match(annex, /Public domain via Wikimedia Commons/u, "the licence statement is mandatory");
assert.match(annex, /ما الذي تطابق فعلًا؟/u);
assert.match(annex, /What actually matched\?/u);
assert.match(
  annex,
  /quran-20-13-raw-abstract-equivalence-public\.json/u
);
assert.match(annex, /codePoint &amp; 0xFF/u, "the annex must publish the derivation");
assert.match(annex, /flag_bit/u);
assert.match(annex, /flag_popcount/u);
assert.match(annex, /trace_void/u);
assert.match(annex, /ليست قياسًا أو تسجيلًا لمراحل معالج مادي/u);
assert.match(annex, /not a measurement or recording of physical processor stages/u);
assert.match(annex, /void<\/code> لا يعني عمومًا/u);
assert.match(annex, /does not generally mean that a function cannot write memory/u);
assert.match(annex, /https:\/\/sbay-dev\.github\.io\/sarmadAi\//u);
assert.doesNotMatch(annex, /نقلٌ أمين|faithful port/iu);
assert.match(annex, /id="trace-board-heading"/u);
assert.match(annex, /class="trace-kanban"/u);
assert.match(annex, /octet-bloom-trace-v270\.webm/u);
assert.match(annex, /<video controls muted playsinline preload="none"/u);
assert.match(annex, /trace-evidence\.json/u);
assert.match(annex, /ليست نسبة دقة لنموذج ذكاء اصطناعي/u);
assert.match(annex, /How the authentic engineering graph is derived/u);
assert.match(
  annex,
  /8847832167ec643c66461ef8c6b7182b48286821d0fd20fd600414bf51f5dfef/u
);
assert.match(
  annex,
  /51740c50a975b5c510f1685a939abd26fe9ef6ea0ba65fc10b6c59fffb9c67f1/u
);
assert.match(annex, /d\(v\) = 0 if v has no produced-tensor parent/u);
assert.match(annex, /The Z axis is unused/u);
assert.match(annex, /Measured quality, throughput, and cost values/u);
assert.match(annex, /2,053,810 paired non-padding R9 tokens/u);
assert.match(annex, /0\.780556/u);
assert.match(annex, /0\.942788/u);
assert.match(annex, /99\.729%/u);
assert.match(annex, /0\.0000595166/u);
assert.match(annex, /0\.00000297583/u);
assert.match(annex, /independent fresh-holdout evaluation remains the quality authority/u);
assert.match(annex, /candidate and production activation are both disabled/u);
assert.match(annex, /معيار التوكن المحاسبي/u);
assert.match(annex, /Token-accounting standard/u);
assert.match(annex, /id="token-accounting-standard"/u);
assert.match(annex, /Unavailable power telemetry yields an explicit upper bound/u);
assert.match(annex, /Git blob hashes computed from the local report and token-accounting rules matched/u);
assert.match(
  annex,
  /ec8c377023749655404d02372f5681478e7cca9e542d8ac0be8e5cd6591e9b6b/u
);
assert.match(
  annex,
  /767e71f032da2dd52211ef813f9c0f3b82ae9f362e197b9d44f0cc50e7e8a364/u
);
assert.match(
  annex,
  /CNSEmbedding\/blob\/0ebf9988eff77078ea61e99d500092e10cd8baef/u
);
// Content Security Policy allows no inline script: the annex must load a module file.
assert.equal(/<script(?![^>]*\ssrc=)/u.test(annex), false, "no inline script in the annex");
assert.match(annex, /<script type="module" src="\.\/annex\.js">/u);

// The manuscript witness is public domain; the Commons credit must stay with it
// and must sit above the image, not after it.
const commonsFile =
  "https://commons.wikimedia.org/wiki/File:Birmingham_Quran_manuscript_full.jpg";
assert.ok(annex.includes(commonsFile), "the annex must link the Commons source file");
assert.match(annex, /Public domain, via Wikimedia Commons/u);
assert.match(annex, /عامة الملكية، عبر ويكيميديا كومنز/u);
assert.match(annex, /Mingana Islamic Arabic 1572a/u);
const creditIndex = annex.indexOf("annex-credit");
const manuscriptIndex = annex.indexOf("taha-rasm-birmingham.png");
assert.ok(creditIndex > -1 && manuscriptIndex > creditIndex,
  "the Wikimedia credit must precede the manuscript image");
for (const figure of ["84", "23", "184", "85"]) {
  assert.ok(annex.includes(figure), `missing derived figure ${figure} in the annex`);
}
assert.match(cipher, /loadWasmAnalyzer/u);
assert.match(cipher, /flagBit/u);
assert.match(cipher, /flagPopcount/u);
assert.match(cipher, /voidMemoryWrites/u);
assert.match(cipher, /stageForPhase/u);
assert.match(cipher, /traceMode: "precomputed-replay"/u);
assert.match(cipher, /stageRoot\.dataset\.analyzer = analyzer\.kind/u);
assert.match(cipher, /analyserCalls/u);
assert.match(cipher, /verticesPerFrame/u);
assert.match(cipher, /instanceBufferBytes/u);
assert.doesNotMatch(cipher, /faithful port/iu);
assert.match(wasmSource, /fn flag_bit/u);
assert.match(wasmSource, /fn flag_popcount/u);
assert.match(wasmSource, /fn trace_void\(\) \{\}/u);
assert.match(disclosureBoundary, /not measured\s+hardware pipeline stages/u);
assert.match(disclosureBoundary, /`void` type generally proves absence of\s+memory side effects/u);
for (const [pattern, label] of [
  [/RasmMaskHex|RasmRecordHex/iu, "proprietary rasm mask table"],
  [/0x8003|0x0817/u, "proprietary rasm mask value"],
  [/routingThreshold|expertWeight|availabilityMask/iu, "protected routing internals"]
]) {
  assert.equal(pattern.test(annex), false, `${label} in docs/annex-intelligence.html`);
}

const traceEvidence = JSON.parse(await readFile(
  path.join(root, "docs", "trace-evidence.json"),
  "utf8"
));
const packageMetadata = JSON.parse(await readFile(
  path.join(root, "package.json"),
  "utf8"
));
assert.equal(traceEvidence.schema, "sbay.leap2026.octet-bloom-trace.v1");
assert.equal(traceEvidence.release, packageMetadata.version);
assert.equal(traceEvidence.interpretation.visibleGrain, "one bit");
assert.equal(traceEvidence.interpretation.aiAccuracyMetricClaimed, false);
assert.equal(traceEvidence.interpretation.nativeAssemblyTraceClaimed, false);
assert.equal(traceEvidence.compute.analyzerCallsPerMount, 207);
assert.equal(traceEvidence.compute.sceneInstances, 753);
assert.equal(traceEvidence.compute.drawCallsPerFrame, 1);
assert.equal(traceEvidence.compute.verticesPerFrame, 4518);
assert.equal(traceEvidence.compute.instanceBufferBytes, 48192);
assert.equal(traceEvidence.video.durationSeconds, 5);
assert.equal(traceEvidence.video.codec, "VP8");
assert.equal(traceEvidence.video.frames, 150);
assert.equal(traceEvidence.video.framesPerSecond, 30);
assert.equal(traceEvidence.video.phaseSamples, 25);
assert.equal(traceEvidence.video.repeatsPerSample, 6);
assert.equal(traceEvidence.video.capture.sceneRenderer, "Canvas2D verified fallback");
assert.equal(traceEvidence.video.capture.livePrimaryRenderer, "WebGPU where available");
assert.equal(traceEvidence.video.capture.screenRecordingUsed, false);
for (const media of [traceEvidence.video, traceEvidence.video.poster]) {
  const bytes = await readFile(path.join(root, media.path));
  assert.equal(bytes.length, media.bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    media.sha256
  );
}
assert.deepEqual(
  traceEvidence.sourceFiles.map(file => file.path).sort(),
  [
    "docs/adg-cipher.js",
    "docs/annex-intelligence.html",
    "docs/evidence-match.wasm",
    "docs/index.html",
    "docs/styles.css",
    "scripts/build-trace-evidence.mjs",
    "scripts/capture-trace-video.mjs",
    "scripts/check-cipher.mjs",
    "scripts/verify-wasm.mjs",
    "wasm/evidence_match.rs"
  ].sort()
);
for (const source of traceEvidence.sourceFiles) {
  const sourceBytes = await readFile(path.join(root, source.path));
  const bytes = path.extname(source.path).toLowerCase() === ".wasm"
    ? sourceBytes
    : Buffer.from(
        sourceBytes.toString("utf8").replace(/\r\n?/gu, "\n"),
        "utf8"
      );
  assert.equal(bytes.length, source.bytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    source.sha256,
    `stale trace evidence for ${source.path}`
  );
}

console.log(JSON.stringify({
  ok: true,
  filesScanned: files.length,
  disclosureBoundary: "public-non-enabling"
}));
