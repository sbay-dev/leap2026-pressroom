import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const wasmPath = path.resolve(
  import.meta.dirname,
  "..",
  "docs",
  "evidence-match.wasm"
);
const bytes = await readFile(wasmPath);
assert.ok(bytes.length > 8, "WASM module is empty.");
assert.ok(bytes.length <= 4096, "WASM proof exceeds the 4 KiB public bound.");
assert.deepEqual([...bytes.subarray(0, 4)], [0, 97, 115, 109]);

const module = await WebAssembly.instantiate(bytes);
const names = Object.keys(module.instance.exports).sort();
assert.deepEqual(names, [
  "__data_end",
  "__heap_base",
  "evidence_match",
  "memory"
]);
const callableExports = Object.entries(module.instance.exports)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name);
assert.deepEqual(callableExports, ["evidence_match"]);
assert.ok(
  module.instance.exports.memory.buffer.byteLength <= 65_536,
  "WASM memory exceeds one page."
);
assert.equal(module.instance.exports.evidence_match(42, 42), 1);
assert.equal(module.instance.exports.evidence_match(42, 41), 0);
assert.equal(module.instance.exports.evidence_match(-7, -7), 1);

console.log(JSON.stringify({
  ok: true,
  bytes: bytes.length,
  callableExports,
  memoryBytes: module.instance.exports.memory.buffer.byteLength
}));
