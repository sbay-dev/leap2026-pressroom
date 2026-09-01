import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = process.argv[2] || process.env.CNS_PUBLIC_ARTIFACT;
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, "docs", "assets", "evidence", "cns-k-space-public.json");

assert.ok(
  sourcePath,
  "Pass the CNS public artifact path as the first argument or CNS_PUBLIC_ARTIFACT."
);

const sourceBytes = await readFile(path.resolve(sourcePath));
const source = JSON.parse(sourceBytes.toString("utf8"));
assert.match(
  source.schema,
  /^sarmadai\.cepha\.cns_public_artifact_v\d+$/u,
  "Unexpected CNS artifact schema."
);
assert.ok(source.payload && source.integrity, "Incomplete CNS public artifact.");

const payload = source.payload;
const projectionByNetwork = new Map(
  (payload.networkComparisonProjection?.points || [])
    .map(point => [point.networkId, point])
);

function compactSpan(span) {
  const timeline = span?.efTimeline;
  return {
    status: span?.status || "unavailable",
    sequence: span?.sequence ?? null,
    durationNanoseconds: span?.durationNanoseconds ?? null,
    tickResolutionNanoseconds: span?.tickResolutionNanoseconds ?? null,
    bindingSha256: span?.bindingSha256 ?? null,
    timeline: {
      status: timeline?.status || "unavailable",
      triggerTicks: timeline?.triggerTicks ?? null,
      beforeWriteTicks: timeline?.beforeWriteTicks ?? null,
      observedWriteTicks: timeline?.observedWriteTicks ?? null,
      afterWriteTicks: timeline?.afterWriteTicks ?? null,
      tickFrequency: timeline?.tickFrequency ?? null,
      triggerToBeforeWriteNanoseconds:
        timeline?.triggerToBeforeWriteNanoseconds ?? null,
      beforeWriteToObservedNanoseconds:
        timeline?.beforeWriteToObservedNanoseconds ?? null,
      observedWriteToAfterNanoseconds:
        timeline?.observedWriteToAfterNanoseconds ?? null,
      triggerToAfterNanoseconds:
        timeline?.triggerToAfterNanoseconds ?? null
    }
  };
}

function compactMerkle(merkle) {
  return {
    status: merkle?.status || "unavailable",
    leafPath: merkle?.leafPath || null,
    leafSha256: merkle?.leafSha256 || null,
    root: merkle?.root || null,
    proofPath: (merkle?.proofPath || []).map(step => ({
      level: step.level,
      siblingSide: step.siblingSide,
      siblingHash: step.siblingHash
    }))
  };
}

function mapActualNode(node) {
  return {
    index: node.index,
    label: node.label,
    labelProvenance: node.labelProvenance,
    kind: node.kind,
    referenceKey: node.referenceKey,
    referenceRelation: node.referenceRelation,
    dimensions: node.dimensions,
    l2Norm: node.l2Norm,
    canonicalVectorSha256: node.canonicalVectorSha256,
    differenceCanonicalSha256: node.differenceCanonicalSha256,
    signature: {
      status: "detected",
      bitWidth: 256,
      hex: node.signBits256Hex,
      basis: "Per-dimension sign projection of the locally computed vector."
    },
    coordinates: node.coordinates,
    hammingTransition: node.signHammingTransition,
    efWriteSpan: compactSpan(node.efWriteSpan),
    qdrantUpsertSpan: compactSpan(node.qdrantUpsertSpan),
    merkle: compactMerkle(node.merkle),
    sourceBasis: node.sourceBasis,
    claimBoundary: node.claimBoundary
  };
}

function mapReceiptNode(node) {
  return {
    index: node.index,
    label: node.entityType
      ? `${node.entityType} ${Number(node.index) + 1}`
      : `Observed vector ${Number(node.index) + 1}`,
    labelProvenance: "software write receipt",
    kind: node.kind,
    referenceKey: node.referenceKey,
    referenceRelation: node.referenceRelation,
    dimensions: node.dimensions,
    l2Norm: null,
    canonicalVectorSha256: node.vectorIdentity?.vectorContentSha256 || null,
    differenceCanonicalSha256: null,
    signature: {
      status: node.quantizedRepresentation?.status || "unavailable",
      bitWidth: node.quantizedRepresentation?.packedBitWidth || null,
      hex: node.quantizedRepresentation?.packedHex || null,
      basis: node.quantizedRepresentation?.basis || "unavailable"
    },
    coordinates: node.coordinates,
    hammingTransition: node.hammingTransition,
    efWriteSpan: compactSpan(node.efWriteSpan),
    qdrantUpsertSpan: compactSpan(node.qdrantUpsertSpan),
    merkle: compactMerkle(node.merkle),
    sourceBasis: node.sourceBasis,
    claimBoundary: node.claimBoundary
  };
}

const actualGraph = payload.actualVectorEmbeddingGraph;
const receiptGraph = payload.embeddingNodeGraph;
let graph;
let graphMode;
let nodes;

if (actualGraph?.status === "detected") {
  graph = actualGraph;
  graphMode = "actual-vector-derived-public-evidence";
  nodes = (actualGraph.nodes || []).map(mapActualNode);
} else if (receiptGraph?.status === "detected") {
  graph = receiptGraph;
  graphMode = "write-receipt-identity-evidence";
  nodes = (receiptGraph.nodes || []).map(mapReceiptNode);
} else {
  graph = actualGraph || receiptGraph || {};
  graphMode = actualGraph
    ? "actual-vector-evidence-unavailable"
    : "write-receipt-evidence-unavailable";
  nodes = [];
}

const publicArtifact = {
  schema: "sbay.cns-k-space-public.v1",
  generatedAtUtc: source.generatedAtUtc,
  sourceArtifact: {
    schema: source.schema,
    sha256: createHash("sha256").update(sourceBytes).digest("hex"),
    payloadSha256: source.integrity.payloadSha256,
    merkleRoot: source.integrity.merkleRoot,
    merkleLeafCount: source.integrity.merkleLeafCount
  },
  liveRendering: {
    renderer: "browser-canvas2d-software-3d",
    dataFetch: "same-origin-no-store",
    notVideo: true,
    claimBoundary:
      "Live means the browser redraws and responds to input in real time. It does not mean live model inference, a streaming production database, or a physical processor trace."
  },
  designReference: {
    visualLanguage:
      "Private design reference: illuminated saddle surface, cyan and magenta concept branches, and a gold replay cursor.",
    measuredGeometry: false,
    claimBoundary:
      "The surface is visual staging. Riemannian, geodesic, negative-curvature, and hyperbolic claims remain unavailable unless separately measured."
  },
  networks: (payload.networks || []).map(network => {
    const point = projectionByNetwork.get(network.id);
    return {
      id: network.id,
      displayName: network.displayName,
      role: network.role,
      status: network.status,
      version: network.version,
      modelId: network.modelId || null,
      sourceIdentitySha256: network.sourceIdentitySha256,
      metrics: (network.metrics || []).map(metric => ({
        key: metric.key,
        status: metric.status,
        value: metric.value ?? null,
        unit: metric.unit || null
      })),
      visualAnchor: point
        ? { x: point.x, y: point.y, z: point.z }
        : null,
      claimBoundary: network.claimBoundary
    };
  }),
  nodeGraph: {
    status: graph.status || "unavailable",
    mode: graphMode,
    basis: graph.basis || "No node graph was supplied.",
    runtimeId: graph.runtimeId || null,
    runtimeContract: graph.runtimeContract || null,
    referenceKey: "K_c_n_s",
    referenceNodeContract: graph.referenceNodeContract || null,
    coordinateDerivation: graph.coordinateDerivation || null,
    zAxisDerivation: graph.zAxisDerivation || null,
    merkleRoot: graph.merkleRoot || null,
    nodeCount: nodes.length,
    efSpanBoundNodeCount:
      graph.efSpanBoundNodeCount ?? graph.efSpanCount ?? 0,
    qdrantSpanCount: graph.qdrantSpanCount ?? 0,
    clock: graph.clock || null,
    firstObservedSoftwareEvent:
      graph.firstProgrammaticIndexingEvent || null,
    nodes,
    claimBoundary:
      graph.claimBoundary ||
      "No semantic, neural-geometry, or hardware first-touch claim is made."
  },
  unavailableClaims: {
    nativeV7Zero: payload.networks?.find(network => network.id === "v7-zero")
      ?.status !== "detected",
    negativeCurvature: payload.negativeCurvature?.status !== "detected",
    neuralTreeLikeness: payload.neuralTreeLikeness?.status !== "detected",
    hardwareFirstTouch: true,
    liveModelInference: true
  }
};

assert.equal(
  publicArtifact.nodeGraph.nodeCount,
  publicArtifact.nodeGraph.nodes.length,
  "Node count mismatch."
);
if (publicArtifact.nodeGraph.nodes.length > 0) {
  const origin = publicArtifact.nodeGraph.nodes[0];
  assert.equal(origin.referenceKey, "K_c_n_s");
  assert.deepEqual(
    [origin.coordinates.x, origin.coordinates.y, origin.coordinates.z],
    [0, 0, 0],
    "The first node must be the K_c_n_s origin."
  );
}

await mkdir(path.dirname(outputPath), { recursive: true });
const output = `${JSON.stringify(publicArtifact, null, 2)}\n`;
await writeFile(outputPath, output, "utf8");
console.log(
  JSON.stringify({
    output: path.relative(root, outputPath).replaceAll("\\", "/"),
    bytes: Buffer.byteLength(output),
    nodeCount: publicArtifact.nodeGraph.nodeCount,
    graphStatus: publicArtifact.nodeGraph.status,
    sourceSha256: publicArtifact.sourceArtifact.sha256
  })
);
