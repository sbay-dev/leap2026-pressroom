import assert from "node:assert/strict";
import worker, {
  isCompleteNewsboyEdition,
  isCompleteNewsboyEditionRecord,
  renderNewsboyEdition
} from "../worker.js";

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
const editionRecord = {
  coverage: {
    event_slug: "leap-2026",
    event_name_ar: "ليب وديبفست 2026",
    status_ar: "تغطية نشطة",
    sub_editions: [
      {
        section_id: "deepfest_ai",
        name_ar: "ديبفست والذكاء الاصطناعي"
      }
    ]
  },
  market: {
    publication_date: "2026-09-01",
    generated_at_utc: "2026-09-01T17:44:23.075Z",
    observations: [
      {
        id: "editorial_example",
        title: "عنوان مادة موثقة",
        display_summary: "ملخص منسوب إلى المصدر.",
        publisher_url: "https://example.com/source",
        url: "/stories/editorial_example",
        published_at_utc: "2026-09-01T15:00:00Z",
        domain_id: "deepfest_ai",
        domain_name_ar: "ديبفست والذكاء الاصطناعي",
        country_name_ar: "السعودية"
      }
    ]
  }
};

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
  if (url.pathname === "/api/coverage/events/leap-2026/edition") {
    return Response.json(editionRecord);
  }
  if (url.pathname === "/fonts/fonts.css") {
    return new Response(
      "@font-face{font-family:test;src:url('/fonts/test.woff2')}",
      {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" }
      }
    );
  }
  if (url.pathname === "/fonts/test.woff2") {
    return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]), {
      status: 200,
      headers: { "Content-Type": "font/woff2" }
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
  assert.equal(isCompleteNewsboyEdition(readerBody), true);
  assert.equal(isCompleteNewsboyEditionRecord(editionRecord), true);
  assert.match(renderNewsboyEdition(editionRecord), /data-newsboy-relay/u);
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
  assert.match(
    html,
    /href="https:\/\/leap2026\.sbay\.sa\/newsboy-assets\/fonts\/fonts\.css"/u
  );
  assert.doesNotMatch(
    html,
    /href="https:\/\/newsboy\.sbay\.sa\/newsboy-assets\/fonts\//u
  );
  assert.match(
    html,
    /<a href="\/stories\/example" target="_blank" rel="noopener noreferrer">/u
  );
  assert.doesNotMatch(html, /<script\b/iu);

  readerBody = `<!doctype html>
<html lang="ar" dir="rtl">
<head><link rel="stylesheet" href="/fonts/fonts.css"></head>
<body class="theme-modern">
  <main id="view-modern" class="theme-view">
    <section id="m-culture-section"><article class="m-reader-article"></article></section>
    <section id="m-archive-section"></section>
  </main>
  <script>globalThis.untrusted = true;</script>
</body>
</html>`;
  assert.equal(isCompleteNewsboyEdition(readerBody), true);
  const modernReader = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-reader"),
    env
  );
  assert.equal(modernReader.status, 200);
  assert.equal(
    modernReader.headers.get("x-sbay-newsboy-edition-source"),
    "https://newsboy.sbay.sa/api/coverage/events/leap-2026/edition"
  );
  assert.equal(modernReader.headers.get("x-sbay-newsboy-article-count"), "1");
  const modernHtml = await modernReader.text();
  assert.match(modernHtml, /data-newsboy-relay="edition-api"/u);
  assert.match(modernHtml, /ليب وديبفست 2026/u);
  assert.match(modernHtml, /عنوان مادة موثقة/u);
  assert.match(modernHtml, /ملخص منسوب إلى المصدر/u);
  assert.match(
    modernHtml,
    /href="https:\/\/newsboy\.sbay\.sa\/stories\/editorial_example"/u
  );
  assert.match(modernHtml, /href="https:\/\/example\.com\/source"/u);
  assert.doesNotMatch(modernHtml, /<script\b/iu);
  assert.ok(calls.includes(
    "https://newsboy.sbay.sa/api/coverage/events/leap-2026/edition"
  ));

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
  assert.equal(font.headers.get("access-control-allow-origin"), "*");
  assert.equal(
    font.headers.get("cross-origin-resource-policy"),
    "cross-origin"
  );
  const fontCss = await font.text();
  assert.match(fontCss, /@font-face/u);
  assert.match(
    fontCss,
    /src:url\('\/newsboy-assets\/fonts\/test\.woff2'\)/u
  );
  assert.doesNotMatch(fontCss, /url\(['"]?\/fonts\//u);
  assert.ok(calls.includes("https://newsboy.sbay.sa/fonts/fonts.css"));

  const fontBinary = await worker.fetch(
    new Request("https://leap2026.sbay.sa/newsboy-assets/fonts/test.woff2"),
    env
  );
  assert.equal(fontBinary.status, 200);
  assert.equal(fontBinary.headers.get("content-type"), "font/woff2");
  assert.equal(fontBinary.headers.get("access-control-allow-origin"), "*");
  assert.equal(
    fontBinary.headers.get("cross-origin-resource-policy"),
    "cross-origin"
  );
  assert.deepEqual(
    [...new Uint8Array(await fontBinary.arrayBuffer())],
    [0x77, 0x4f, 0x46, 0x32]
  );
  assert.ok(calls.includes("https://newsboy.sbay.sa/fonts/test.woff2"));

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
  assert.equal(isCompleteNewsboyEdition(readerBody), false);
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

  readerStatus = 200;
  readerBody = "<!doctype html><html><body><main>partial</main></body></html>";
  const originalConsoleErrorForPartial = console.error;
  const partialErrors = [];
  console.error = (...values) => partialErrors.push(values);
  let partial;
  try {
    partial = await worker.fetch(
      new Request("https://leap2026.sbay.sa/newsboy-reader"),
      env
    );
  } finally {
    console.error = originalConsoleErrorForPartial;
  }
  assert.equal(isCompleteNewsboyEdition(readerBody), false);
  assert.equal(partial.status, 502);
  assert.equal(partial.headers.get("cache-control"), "no-store");
  assert.equal(partialErrors.length, 1);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("PASS_NEWSBOY_EMBED_WORKER");
