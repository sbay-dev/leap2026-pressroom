import assert from "node:assert/strict";
import worker from "../worker.js";

const originalFetch = globalThis.fetch;
const calls = [];
let readerStatus = 200;
let readerBody = `<!doctype html>
<html lang="ar" dir="rtl">
<head><link rel="stylesheet" href="/fonts/fonts.css"></head>
<body>
  <main class="paper"><a href="/stories/example">مثال</a></main>
  <script>globalThis.untrusted = true;</script>
</body>
</html>`;

globalThis.fetch = async input => {
  const url = input instanceof URL
    ? input
    : new URL(typeof input === "string" ? input : input.url);
  calls.push(url.href);
  if (url.pathname === "/coverage/leap-2026") {
    return new Response(readerBody, {
      status: readerStatus,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  if (url.pathname === "/fonts/fonts.css") {
    return new Response("@font-face{font-family:test;src:url(test.woff2)}", {
      status: 200,
      headers: { "Content-Type": "text/css; charset=utf-8" }
    });
  }
  throw new Error(`Unexpected upstream fetch: ${url.href}`);
};

let assetRequests = 0;
const env = {
  ASSETS: {
    fetch: async () => {
      assetRequests += 1;
      return new Response("asset", { status: 200 });
    }
  }
};

try {
  const reader = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-reader"),
    env
  );
  assert.equal(reader.status, 200);
  assert.equal(
    reader.headers.get("x-sbay-newsboy-source"),
    "https://newsboy.sbay.sa/coverage/leap-2026"
  );
  assert.match(
    reader.headers.get("content-security-policy") || "",
    /frame-ancestors 'self'/u
  );
  assert.match(
    reader.headers.get("content-security-policy") || "",
    /script-src 'none'/u
  );
  assert.equal(reader.headers.get("x-frame-options"), "SAMEORIGIN");
  const html = await reader.text();
  assert.match(html, /<base href="https:\/\/newsboy\.sbay\.sa\/">/u);
  assert.match(html, /href="\/newsboy-assets\/fonts\/fonts\.css"/u);
  assert.match(
    html,
    /<a href="\/stories\/example" target="_blank" rel="noopener noreferrer">/u
  );
  assert.doesNotMatch(html, /<script\b/iu);

  const head = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-reader", {
      method: "HEAD"
    }),
    env
  );
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");

  const font = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-assets/fonts/fonts.css"),
    env
  );
  assert.equal(font.status, 200);
  assert.match(font.headers.get("content-type") || "", /text\/css/u);
  assert.match(await font.text(), /@font-face/u);
  assert.ok(calls.includes("https://newsboy.sbay.sa/fonts/fonts.css"));

  const method = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-reader", {
      method: "POST"
    }),
    env
  );
  assert.equal(method.status, 405);

  const asset = await worker.fetch(
    new Request("https://leap2026.sbay.sa/styles.css"),
    env
  );
  assert.equal(await asset.text(), "asset");
  assert.equal(assetRequests, 1);

  readerStatus = 503;
  readerBody = "<html><body>temporary failure</body></html>";
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...values) => loggedErrors.push(values);
  let unavailable;
  try {
    unavailable = await worker.fetch(
      new Request("https://leap2026.sbay.sa/newsboy-reader"),
      env
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  assert.equal(loggedErrors.length, 1);
  assert.match(
    await unavailable.text(),
    /No stale capture is presented as current/u
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("PASS_NEWSBOY_EMBED_WORKER");
