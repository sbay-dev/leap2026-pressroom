import assert from "node:assert/strict";

const baseUrl = String(
  process.env.PRESSROOM_URL || "https://leap2026.sbay.sa"
).replace(/\/+$/u, "");

const page = await fetch(`${baseUrl}/`, { redirect: "follow" });
assert.equal(page.status, 200);
const html = await page.text();
assert.match(html, /SBAY-LEAP-DEEPFEST-20260831T020340Z/u);
assert.match(html, /NewsBoy/u);
assert.match(html, /DeepFest 2026/u);
assert.match(html, /no general MTEB superiority claim/u);
assert.doesNotMatch(html, /cloudflareinsights|beacon\.min\.js/iu);

const cacheControl = page.headers.get("cache-control");
assert.match(cacheControl || "", /(?:^|,)\s*no-transform(?:,|$)/u);

const kit = await fetch(`${baseUrl}/press-kit.json`);
assert.equal(kit.status, 200);
const pressKit = await kit.json();
assert.equal(pressKit.auditId, "SBAY-LEAP-DEEPFEST-20260831T020340Z");
assert.equal(pressKit.claims.generalMtebSuperiority, false);
assert.equal(pressKit.claims.officialEventPartnership, false);

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
