import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildScene } from "../docs/adg-cipher.js";

const root = path.resolve(import.meta.dirname, "..");
const relative = value => value.replaceAll("\\", "/");
const hashFile = async file => {
  const sourceBytes = await readFile(path.join(root, file));
  const bytes = [".png", ".wasm", ".webm"].includes(
    path.extname(file).toLowerCase()
  )
    ? sourceBytes
    : Buffer.from(
        sourceBytes.toString("utf8").replace(/\r\n?/gu, "\n"),
        "utf8"
      );
  return {
    path: relative(file),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
};

const wasmBytes = await readFile(path.join(root, "docs", "evidence-match.wasm"));
const wasm = await WebAssembly.instantiate(wasmBytes);
const exports = wasm.instance.exports;
const memoryBefore = new Uint8Array(exports.memory.buffer).slice();
assert.strictEqual(exports.trace_void(), undefined);
assert.deepEqual(new Uint8Array(exports.memory.buffer), memoryBefore);

const analyzer = {
  kind: "wasm-i32",
  flagBit: (flag, bit) => exports.flag_bit(flag, bit),
  flagPopcount: flag => exports.flag_popcount(flag),
  traceVoid: () => exports.trace_void(),
  voidReturn: "none",
  voidMemoryWrites: 0
};
const scene = buildScene(analyzer);
assert.equal(scene.transportBytes, 23);
assert.equal(scene.transportBits, 184);
assert.equal(scene.compute.setBits, 85);
assert.equal(scene.compute.petalInstances, 335);
assert.equal(scene.compute.instances, 753);
assert.equal(scene.compute.verticesPerFrame, 4518);
assert.equal(scene.compute.instanceBufferBytes, 48192);

const sourceFiles = await Promise.all([
  "docs/adg-cipher.js",
  "docs/annex-intelligence.html",
  "docs/index.html",
  "docs/styles.css",
  "wasm/evidence_match.rs",
  "docs/evidence-match.wasm",
  "scripts/build-trace-evidence.mjs",
  "scripts/capture-trace-video.mjs",
  "scripts/check-cipher.mjs",
  "scripts/verify-wasm.mjs"
].map(hashFile));
const video = await hashFile("docs/assets/press/octet-bloom-trace-v270.webm");
const poster = await hashFile("docs/assets/press/octet-bloom-trace-v270-poster.png");

const evidence = {
  schema: "sbay.leap2026.octet-bloom-trace.v1",
  release: JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version,
  reference: scene.reference,
  interpretation: {
    visibleGrain: "one bit",
    deterministic: true,
    aiAccuracyMetricClaimed: false,
    nativeAssemblyTraceClaimed: false,
    privateArabicAnalyzerPublished: false,
    statement: "Atomic refers to the visible one-bit grain, not to a measured AI accuracy score."
  },
  timeline: [
    {
      id: "fetch",
      seconds: [0, 0.9],
      arabic: "قراءة الأوكتتات",
      english: "Read octets",
      humanMeaning: "The 23 published derived octets enter unchanged.",
      callContract: "RASM[index] -> i32",
      compute: { octets: 23 },
      files: ["docs/adg-cipher.js"]
    },
    {
      id: "decode",
      seconds: [0.9, 1.7],
      arabic: "فكّ البتات",
      english: "Decode bits",
      humanMeaning: "Each octet is tested at all eight bit positions.",
      callContract: "flag_bit(i32 flag, i32 bit) -> i32",
      compute: { callsPerMount: scene.compute.flagBitCalls, bitPositions: 184 },
      files: ["wasm/evidence_match.rs", "docs/evidence-match.wasm"]
    },
    {
      id: "execute",
      seconds: [1.7, 3.5],
      arabic: "التفتّح",
      english: "Bloom",
      humanMeaning: "A set bit blooms; a zero bit remains still.",
      callContract: "flag_popcount(i32 flag) -> i32",
      compute: {
        callsPerMount: scene.compute.flagPopcountCalls,
        setBitBlooms: scene.compute.setBits,
        petalInstances: scene.compute.petalInstances
      },
      files: ["wasm/evidence_match.rs", "docs/adg-cipher.js"]
    },
    {
      id: "quiet",
      seconds: [3.5, 4.1],
      arabic: "الهدوء",
      english: "Quiet",
      humanMeaning: "Transient bloom energy reaches zero while the evidence lattice remains.",
      callContract: "WGSL phase envelope -> transient energy 0",
      compute: { transientKinds: ["BIT", "PETAL", "GLOW"] },
      files: ["docs/adg-cipher.js"]
    },
    {
      id: "void",
      seconds: [4.1, 4.8],
      arabic: "void",
      english: "void",
      humanMeaning: "This specific no-argument function returns no value and leaves Wasm linear memory unchanged.",
      callContract: "trace_void() -> ()",
      compute: { returnValues: 0, linearMemoryWritesObserved: 0 },
      files: ["wasm/evidence_match.rs", "scripts/verify-wasm.mjs"]
    },
    {
      id: "reset",
      seconds: [4.8, 5],
      arabic: "إعادة حتمية",
      english: "Deterministic reset",
      humanMeaning: "The stable lattice meets the first frame without a blank cut.",
      callContract: "phase 1 -> phase 0",
      compute: { loopSeconds: 5 },
      files: ["docs/adg-cipher.js", "scripts/check-cipher.mjs"]
    }
  ],
  compute: {
    wasmBinaryBytes: wasmBytes.length,
    wasmLinearMemoryBytes: exports.memory.buffer.byteLength,
    analyzerCallsPerMount: scene.compute.analyserCalls,
    sceneInstances: scene.compute.instances,
    drawCallsPerFrame: 1,
    verticesPerFrame: scene.compute.verticesPerFrame,
    instanceBufferBytes: scene.compute.instanceBufferBytes,
    uniformBytesPerFrame: scene.compute.uniformBytesPerFrame,
    maximumBackingPixels: scene.compute.maxBackingArea,
    renderer: "WebGPU where available; Canvas2D fallback"
  },
  stackBoundary: {
    documented: "Public function signatures and JavaScript-visible input/output contracts.",
    notClaimed: "Native CPU registers, native instruction timing, or a captured hardware stack trace."
  },
  video: {
    ...video,
    durationSeconds: 5,
    codec: "VP8",
    frames: 150,
    framesPerSecond: 30,
    phaseSamples: 25,
    repeatsPerSample: 6,
    width: 1184,
    height: 518,
    capture: {
      sceneRenderer: "Canvas2D verified fallback",
      compositionLayer: "Canvas2D labels over the same explicitly addressed scene phase",
      livePrimaryRenderer: "WebGPU where available",
      screenRecordingUsed: false
    },
    poster
  },
  sourceFiles
};

await writeFile(
  path.join(root, "docs", "trace-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8"
);
console.log(JSON.stringify({
  ok: true,
  schema: evidence.schema,
  stages: evidence.timeline.length,
  compute: evidence.compute,
  video: evidence.video
}, null, 2));
