import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = process.argv[2] || process.env.CNS_MODEL_GRAPH_AUDIT;
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "cns-model-graph-public.json"
  );
const integrityPath = process.argv[4]
  ? path.resolve(process.argv[4])
  : outputPath.replace(/\.json$/u, ".integrity.json");
const legacyPath = process.argv[5]
  ? path.resolve(process.argv[5])
  : path.join(
    root,
    "docs",
    "assets",
    "evidence",
    "cns-k-space-public.json"
  );
const replayPath =
  process.argv[6] || process.env.CNS_MODEL_GRAPH_AUDIT_REPLAY;

assert.ok(
  sourcePath,
  "Pass the verified ONNX graph-audit JSON or set CNS_MODEL_GRAPH_AUDIT."
);
assert.ok(
  replayPath,
  "Pass the independent replay audit as argument 5 or set CNS_MODEL_GRAPH_AUDIT_REPLAY."
);

const sourceBytes = await readFile(path.resolve(sourcePath));
const replayBytes = await readFile(path.resolve(replayPath));
const sourceSha256 = sha256(sourceBytes);
const replaySha256 = sha256(replayBytes);
assert.equal(replayBytes.length, sourceBytes.length);
assert.equal(replaySha256, sourceSha256);
assert.ok(replayBytes.equals(sourceBytes), "Graph-audit replay is not byte-identical.");
const source = JSON.parse(sourceBytes.toString("utf8"));

assert.equal(
  source.schema,
  "sarmadai.cepha.onnx_engineering_graph_audit.v1"
);
assert.equal(source.status, "TRAINED_ONLY_GRAPH_AUDIT_VERIFIED");
assert.equal(source.model.checker, "PASS");
assert.equal(source.model.shapeInference, "PASS");
assert.equal(
  source.model.sha256,
  "8847832167ec643c66461ef8c6b7182b48286821d0fd20fd600414bf51f5dfef"
);
assert.equal(
  source.canonicalStructure.sha256,
  "51740c50a975b5c510f1685a939abd26fe9ef6ea0ba65fc10b6c59fffb9c67f1"
);
assert.equal(
  source.comparisonAvailability.authenticZeroCheckpoint,
  "unavailable"
);

const blockPresentation = new Map([
  ["anchor", {
    order: 0,
    nameAr: "مرساة التمثيل",
    nameEn: "Representation anchor",
    color: "#58ddff"
  }],
  ["anchor-transition-0", {
    order: 1,
    nameAr: "انتقال المرساة 0",
    nameEn: "Anchor transition 0",
    color: "#5ff0bb"
  }],
  ["anchor-transition-1", {
    order: 2,
    nameAr: "انتقال المرساة 1",
    nameEn: "Anchor transition 1",
    color: "#f4c767"
  }],
  ["base", {
    order: 3,
    nameAr: "النواة الأساسية",
    nameEn: "Base core",
    color: "#ff7b9d"
  }],
  ["model-head", {
    order: 4,
    nameAr: "رأس النموذج",
    nameEn: "Model head",
    color: "#b28cff"
  }],
  ["exporter-scaffolding", {
    order: 5,
    nameAr: "عمليات التصدير البنيوية",
    nameEn: "Exporter scaffolding",
    color: "#8595a8"
  }]
]);

const nodes = source.graph.nodes;
const edges = source.graph.edges;
const nodeById = new Map(nodes.map(node => [node.id, node]));
const sourceBlocks = new Map(
  source.groupedBlockDag.blocks.map(block => [block.id, block])
);
assert.equal(nodes.length, source.graph.nodeCount);
assert.equal(edges.length, source.graph.directedNodeTensorEdges);
assert.equal(sourceBlocks.size, blockPresentation.size);

const blockMetrics = new Map();
for (const [id, presentation] of blockPresentation) {
  const sourceBlock = sourceBlocks.get(id);
  assert.ok(sourceBlock, `Missing grouped block ${id}.`);
  blockMetrics.set(id, {
    id,
    ...presentation,
    nodeCount: sourceBlock.nodeCount,
    depthRange: sourceBlock.depthRange,
    operatorCounts: sourceBlock.operatorCounts,
    initializerCount: sourceBlock.initializerCount,
    initializerElements: sourceBlock.initializerElements,
    internalTensorEdges: 0,
    incomingCrossBlockEdges: 0,
    outgoingCrossBlockEdges: 0,
    graphInputEdges: 0,
    initializerInputEdges: 0
  });
}

const crossBlockEdgeCounts = new Map();
for (const edge of edges) {
  const sourceNode = nodeById.get(edge.source);
  const targetNode = nodeById.get(edge.target);
  assert.ok(sourceNode && targetNode, "Unresolved public-audit edge.");
  if (sourceNode.blockId === targetNode.blockId) {
    blockMetrics.get(sourceNode.blockId).internalTensorEdges += 1;
    continue;
  }
  const key = `${sourceNode.blockId}\0${targetNode.blockId}`;
  crossBlockEdgeCounts.set(key, (crossBlockEdgeCounts.get(key) || 0) + 1);
  blockMetrics.get(sourceNode.blockId).outgoingCrossBlockEdges += 1;
  blockMetrics.get(targetNode.blockId).incomingCrossBlockEdges += 1;
}

const graphInputNames = new Set(source.graph.inputs.map(item => item.name));
const initializerNames = new Set(
  source.initializers.items.map(item => item.name)
);
for (const node of nodes) {
  const metrics = blockMetrics.get(node.blockId);
  assert.ok(metrics, `Unknown node block ${node.blockId}.`);
  for (const input of node.inputs) {
    if (graphInputNames.has(input)) metrics.graphInputEdges += 1;
    if (initializerNames.has(input)) metrics.initializerInputEdges += 1;
  }
}

const depthLayers = Array.from(
  { length: source.graph.maximumTopologicalDepth + 1 },
  (_, depth) => ({
    depth,
    nodeCount: 0,
    blocks: Object.fromEntries(
      [...blockPresentation.keys()].map(id => [id, 0])
    )
  })
);
for (const node of nodes) {
  const layer = depthLayers[node.topologicalDepth];
  assert.ok(layer, `Invalid topological depth ${node.topologicalDepth}.`);
  layer.nodeCount += 1;
  layer.blocks[node.blockId] += 1;
}

const blocks = [...blockMetrics.values()]
  .sort((left, right) => left.order - right.order)
  .map(({ order, ...block }) => ({
    ...block,
    lane: order
  }));
const blockEdges = [...crossBlockEdgeCounts.entries()]
  .map(([key, count]) => {
    const [sourceBlock, targetBlock] = key.split("\0");
    return { sourceBlock, targetBlock, count };
  })
  .sort((left, right) =>
    left.sourceBlock.localeCompare(right.sourceBlock) ||
    left.targetBlock.localeCompare(right.targetBlock)
  );

assert.equal(
  blocks.reduce((sum, block) => sum + block.nodeCount, 0),
  source.graph.nodeCount
);
assert.equal(
  depthLayers.reduce((sum, layer) => sum + layer.nodeCount, 0),
  source.graph.nodeCount
);
assert.equal(
  Object.values(source.graph.operatorCounts)
    .reduce((sum, count) => sum + count, 0),
  source.graph.nodeCount
);
assert.equal(
  blocks.reduce((sum, block) => sum + block.internalTensorEdges, 0) +
    blockEdges.reduce((sum, edge) => sum + edge.count, 0),
  source.graph.directedNodeTensorEdges
);
assert.equal(
  blocks.reduce((sum, block) => sum + block.graphInputEdges, 0),
  source.graph.externalInputEdges.graph_input_to_node
);
assert.equal(
  blocks.reduce((sum, block) => sum + block.initializerInputEdges, 0),
  source.graph.externalInputEdges.initializer_to_node
);

const publicArtifact = {
  schema: "sbay.cns-model-engineering-graph-public.v1",
  status: "TRAINED_ONLY_PUBLIC_ENGINEERING_GRAPH_VERIFIED",
  sourceAudit: {
    schema: source.schema,
    sha256: sourceSha256,
    replaySha256,
    deterministicReplayMatched: true
  },
  model: {
    id: source.model.id,
    release: source.model.release,
    fileName: source.model.fileName,
    byteLength: source.model.byteLength,
    sha256: source.model.sha256,
    checker: source.model.checker,
    shapeInference: source.model.shapeInference,
    claimBoundary: source.model.claimBoundary
  },
  graph: {
    irVersion: source.graph.irVersion,
    opsets: source.graph.opsets,
    inputs: source.graph.inputs,
    outputs: source.graph.outputs,
    nodeCount: source.graph.nodeCount,
    operatorCounts: source.graph.operatorCounts,
    directedNodeTensorEdges: source.graph.directedNodeTensorEdges,
    graphOutputEdges: source.graph.graphOutputEdges,
    externalInputEdges: source.graph.externalInputEdges,
    maximumTopologicalDepth: source.graph.maximumTopologicalDepth
  },
  publicLayout: {
    contract: "aggregate-topological-depth-lanes-v1",
    nodeRepresentation:
      "One anonymous rendered point per authentic ONNX operator, counted by exact topological depth and renderer block.",
    edgeRepresentation:
      "Only aggregate cross-block and internal tensor-edge counts are published; exact node-to-node wiring is withheld.",
    zAxis: "unused",
    blocks,
    blockEdges,
    depthLayers
  },
  initializers: {
    count: source.initializers.count,
    storedElementCount: source.initializers.storedElementCount,
    storedElementsByDtype: source.initializers.storedElementsByDtype,
    trainableParameterCount: source.initializers.trainableParameterCount,
    claimBoundary:
      "Initializer names, hashes, shapes, and values are withheld from this public projection."
  },
  canonicalStructure: source.canonicalStructure,
  computeEstimate: source.computeEstimate,
  comparisonAvailability: source.comparisonAvailability,
  unavailableClaims: [
    "Authentic zero-versus-trained comparison",
    "Architecture equality or isomorphism between zero and trained",
    "Training-effect tensor deltas",
    "Neural Persistence or delta Neural Persistence",
    "Representation-topology change",
    "Riemannian or sectional curvature",
    "Live model inference"
  ],
  publicSafety: {
    rawInitializerValuesPublished: false,
    initializerIdentitiesPublished: false,
    rawVectorsPublished: false,
    activationsPublished: false,
    exactNodeNamesPublished: false,
    exactTensorNamesPublishedBeyondInterface: false,
    exactNodeConnectionsPublished: false,
    absoluteSourcePathPublished: false
  }
};

const publicBytes = Buffer.from(
  `${JSON.stringify(publicArtifact, null, 2)}\n`,
  "utf8"
);
const publicSha256 = sha256(publicBytes);
const integrity = {
  schema: "sbay.cns-model-engineering-graph-integrity.v1",
  artifact: {
    path: "assets/evidence/cns-model-graph-public.json",
    bytes: publicBytes.length,
    sha256: publicSha256
  },
  sourceAudit: publicArtifact.sourceAudit,
  canonicalStructure: publicArtifact.canonicalStructure
};
const legacyPointer = {
  schema: "sbay.cns-k-space-public-superseded.v1",
  status: "SUPERSEDED_BY_MEASURED_ENGINEERING_GRAPH",
  replacement: "./cns-model-graph-public.json",
  integrity: "./cns-model-graph-public.integrity.json",
  conceptualFallback: "../../cepha-k-space-concept/",
  claimBoundary:
    "The former deterministic concept scene is preserved only as a clearly labelled Cepha visual template. Scientific claims use the trained-only measured engineering graph."
};

const serialized = publicBytes.toString("utf8");
assert.doesNotMatch(serialized, /[A-Z]:\\/u);
assert.doesNotMatch(serialized, /model\.base\./u);
assert.doesNotMatch(
  serialized,
  /"(?:valueSha256|tensor|source|target)"\s*:/u
);
assert.doesNotMatch(
  serialized,
  /"(?:nodes|edges|items)"\s*:/u
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, publicBytes);
await writeFile(integrityPath, `${JSON.stringify(integrity, null, 2)}\n`, "utf8");
await writeFile(legacyPath, `${JSON.stringify(legacyPointer, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: path.relative(root, outputPath).replaceAll("\\", "/"),
  bytes: publicBytes.length,
  sha256: publicSha256,
  modelSha256: publicArtifact.model.sha256,
  structuralSha256: publicArtifact.canonicalStructure.sha256,
  nodes: publicArtifact.graph.nodeCount,
  depthLayers: publicArtifact.publicLayout.depthLayers.length,
  blocks: publicArtifact.publicLayout.blocks.length,
  aggregateBlockEdges: publicArtifact.publicLayout.blockEdges.length
}, null, 2));

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
