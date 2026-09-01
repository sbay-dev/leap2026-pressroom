const NEWSBOY_ORIGIN = "https://newsboy.sbay.sa";
const NEWSBOY_COVERAGE_URL = `${NEWSBOY_ORIGIN}/coverage/leap-2026`;
const NEWSBOY_EDITION_API_URL =
  `${NEWSBOY_ORIGIN}/api/coverage/events/leap-2026/edition`;
const PRESSROOM_ORIGIN = "https://leap2026.sbay.sa";
const READER_PATHS = new Set(["/newsboy-reader", "/newsboy-reader/"]);
const FONT_PROXY_PREFIX = "/newsboy-assets/fonts/";

const EMBED_CSP = [
  "default-src 'none'",
  `base-uri ${NEWSBOY_ORIGIN}`,
  "form-action 'none'",
  "frame-ancestors 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "script-src 'none'",
  "style-src 'self' 'unsafe-inline' https://newsboy.sbay.sa",
  "font-src 'self' data: https://newsboy.sbay.sa",
  "img-src 'self' data: https:",
  "media-src 'none'",
  "connect-src 'none'",
  "sandbox allow-popups allow-popups-to-escape-sandbox"
].join("; ");

function readerHeaders(cacheControl) {
  return new Headers({
    "Cache-Control": cacheControl,
    "Content-Language": "ar",
    "Content-Security-Policy": EMBED_CSP,
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Robots-Tag": "noindex, nofollow",
    "X-SBAY-NewsBoy-Source": NEWSBOY_COVERAGE_URL
  });
}

function unavailableReader(status) {
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>قارئ NewsBoy غير متاح مؤقتًا</title>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:2rem;background:#f6efdc;color:#21180f;font-family:Tahoma,Arial,sans-serif}
    main{width:min(42rem,100%);padding:2rem;border:1px solid #bba989;background:#fffaf0;box-shadow:0 1rem 3rem #3d270f26;text-align:center}
    h1{margin-top:0;font-size:clamp(1.4rem,4vw,2.2rem)}
    p{line-height:1.9;color:#62523e}
    a{display:inline-block;margin-top:.5rem;padding:.7rem 1rem;border:1px solid #8f6f32;border-radius:999px;color:inherit;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>تعذر تحميل العدد الحي بأمان</h1>
    <p>لم يقدّم مصدر NewsBoy صفحة العدد الكاملة الآن. لم تُعرض نسخة قديمة بوصفها أحدث عدد.</p>
    <p lang="en" dir="ltr">The NewsBoy source did not return the complete live edition. No stale capture is presented as current.</p>
    <a href="${NEWSBOY_COVERAGE_URL}" target="_blank" rel="noopener noreferrer">افتح المصدر مباشرة ↗</a>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: readerHeaders("no-store")
  });
}

function transformAnchor(attributes) {
  let next = attributes;
  if (!/\btarget\s*=/iu.test(next)) {
    next += ' target="_blank"';
  }
  if (!/\brel\s*=/iu.test(next)) {
    next += ' rel="noopener noreferrer"';
  }
  return `<a${next}>`;
}

export function transformNewsboyFontCss(css) {
  return css.replace(
    /url\(\s*(["']?)\/fonts\//giu,
    (_match, quote) => `url(${quote}${FONT_PROXY_PREFIX}`
  );
}

export function transformNewsboyHtml(html) {
  let transformed = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, "")
    .replace(
      /<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>/giu,
      ""
    )
    .replace(
      /(["'])\/fonts\//giu,
      `$1${PRESSROOM_ORIGIN}${FONT_PROXY_PREFIX}`
    )
    .replace(/<a\b([^>]*)>/giu, (_match, attributes) =>
      transformAnchor(attributes));

  const additions = [
    `<base href="${NEWSBOY_ORIGIN}/">`,
    '<meta name="robots" content="noindex,nofollow">'
  ].join("");
  if (/<head\b[^>]*>/iu.test(transformed)) {
    transformed = transformed.replace(/<head\b[^>]*>/iu, match =>
      `${match}${additions}`);
  } else {
    transformed = transformed.replace(/<html\b[^>]*>/iu, match =>
      `${match}<head>${additions}</head>`);
  }
  return transformed;
}

export function isModernNewsboyEdition(html) {
  return (
    /<main\b(?=[^>]*\bid=["']view-modern["'])(?=[^>]*\bclass=["'][^"']*\btheme-view\b[^"']*["'])[^>]*>/iu
      .test(html) &&
    /<section\b(?=[^>]*\bid=["']m-culture-section["'])[^>]*>/iu
      .test(html) &&
    /<section\b(?=[^>]*\bid=["']m-archive-section["'])[^>]*>/iu
      .test(html) &&
    /<article\b(?=[^>]*\bclass=["'][^"']*\bm-reader-article\b[^"']*["'])[^>]*>/iu
      .test(html)
  );
}

export function isCompleteNewsboyEdition(html) {
  const hasDocumentBoundary =
    /<html\b[^>]*>/iu.test(html) &&
    /<\/html\s*>/iu.test(html);
  const legacyPaper =
    /<main\b(?=[^>]*\bclass=["'][^"']*\bpaper\b[^"']*["'])[^>]*>/iu
      .test(html);
  return hasDocumentBoundary && (
    legacyPaper ||
    isModernNewsboyEdition(html)
  );
}

export function isCompleteNewsboyEditionRecord(record) {
  return (
    record?.coverage?.event_slug === "leap-2026" &&
    typeof record.coverage.event_name_ar === "string" &&
    typeof record.market?.publication_date === "string" &&
    Array.isArray(record.market.observations) &&
    record.market.observations.some(observation =>
      typeof observation?.title === "string" &&
      observation.title.trim().length > 0 &&
      typeof (observation.publisher_url || observation.url) === "string"
    )
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeHttpsUrl(value, fallback = NEWSBOY_COVERAGE_URL) {
  try {
    const url = new URL(String(value || ""), NEWSBOY_ORIGIN);
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    ) return url.href;
  } catch {
    // Use the fixed coverage route below.
  }
  return fallback;
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return "المصدر الأصلي";
  }
}

export function renderNewsboyEdition(record) {
  if (!isCompleteNewsboyEditionRecord(record)) {
    throw new Error("Unsupported NewsBoy edition record.");
  }

  const coverage = record.coverage;
  const market = record.market;
  const observations = market.observations
    .filter(observation =>
      typeof observation?.title === "string" &&
      observation.title.trim().length > 0 &&
      typeof (observation.publisher_url || observation.url) === "string"
    )
    .sort((left, right) =>
      String(right.published_at_utc || "")
        .localeCompare(String(left.published_at_utc || ""))
    );
  const sections = [];
  const bySection = new Map();

  for (const entry of coverage.sub_editions || []) {
    const id = String(entry?.section_id || "").trim();
    if (!id || bySection.has(id)) continue;
    const section = {
      id,
      name: String(entry?.name_ar || id),
      observations: []
    };
    sections.push(section);
    bySection.set(id, section);
  }
  for (const observation of observations) {
    const id = String(observation.domain_id || "coverage").trim();
    if (!bySection.has(id)) {
      const section = {
        id,
        name: String(observation.domain_name_ar || "مواد التغطية"),
        observations: []
      };
      sections.push(section);
      bySection.set(id, section);
    }
    bySection.get(id).observations.push(observation);
  }

  const sectionNavigation = sections
    .filter(section => section.observations.length > 0)
    .map(section => {
      const safeId = section.id.replace(/[^a-z0-9_-]/giu, "-");
      return `<a href="#section-${escapeHtml(safeId)}">${escapeHtml(section.name)} <bdi>${section.observations.length}</bdi></a>`;
    })
    .join("");
  const sectionMarkup = sections
    .filter(section => section.observations.length > 0)
    .map(section => {
      const safeId = section.id.replace(/[^a-z0-9_-]/giu, "-");
      const stories = section.observations.map(observation => {
        const publisherUrl = safeHttpsUrl(
          observation.publisher_url || observation.source_url
        );
        const storyUrl = safeHttpsUrl(observation.url, publisherUrl);
        const published = String(observation.published_at_utc || "");
        return `<article class="story">
  <p class="story-meta">
    <span>${escapeHtml(observation.country_name_ar || "السعودية")}</span>
    ${published ? `<time datetime="${escapeHtml(published)}">${escapeHtml(published.slice(0, 10))}</time>` : ""}
  </p>
  <h3><a href="${escapeHtml(storyUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(observation.title)}</a></h3>
  ${observation.display_summary ? `<p>${escapeHtml(observation.display_summary)}</p>` : ""}
  <a class="source-link" href="${escapeHtml(publisherUrl)}" target="_blank" rel="noopener noreferrer nofollow">المصدر · ${escapeHtml(sourceLabel(publisherUrl))} ↗</a>
</article>`;
      }).join("");
      return `<section class="edition-section" id="section-${escapeHtml(safeId)}" aria-labelledby="heading-${escapeHtml(safeId)}">
  <header><p>قسم التغطية</p><h2 id="heading-${escapeHtml(safeId)}">${escapeHtml(section.name)}</h2><bdi>${section.observations.length} مادة</bdi></header>
  <div class="story-grid">${stories}</div>
</section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(coverage.event_name_ar)} · NewsBoy</title>
  <style>
    :root{color-scheme:light;--ink:#21180f;--muted:#695d4d;--paper:#fffaf0;--line:#c8b895;--accent:#774b0e;--mint:#087a62}
    *{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:#eee4ce;color:var(--ink);font-family:Tahoma,Arial,sans-serif}
    a{color:inherit}
    .paper{width:min(78rem,100%);margin:auto;padding:clamp(1rem,3vw,2.4rem)}
    .edition-head{padding:clamp(1.4rem,4vw,3.2rem);border:1px solid var(--line);background:var(--paper);box-shadow:0 1rem 3rem #4a35151c}
    .edition-kicker,.edition-boundary,.edition-section header p{margin:0;color:var(--accent);font-weight:800}
    h1{max-width:18ch;margin:.45rem 0;font-size:clamp(2rem,7vw,5rem);line-height:1.05}
    .edition-meta{display:flex;flex-wrap:wrap;gap:.45rem 1rem;color:var(--muted);font-size:.86rem}
    .edition-boundary{margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-weight:600;line-height:1.8}
    nav{display:flex;gap:.55rem;overflow:auto;padding:.9rem 0;scrollbar-width:thin}
    nav a{flex:0 0 auto;padding:.55rem .8rem;border:1px solid var(--line);border-radius:999px;background:#f9f0dc;text-decoration:none;font-size:.76rem;font-weight:800}
    .edition-section{margin-top:1rem;padding:clamp(1rem,2.6vw,1.6rem);border:1px solid var(--line);background:var(--paper)}
    .edition-section>header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:2px solid var(--ink)}
    .edition-section h2{margin:.2rem 0 0;font-size:clamp(1.35rem,3vw,2.1rem)}
    .story-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
    .story{min-width:0;padding:1rem;border:1px solid #d8cbb0;background:#fffdf7}
    .story:first-child{grid-column:1/-1}
    .story-meta{display:flex;justify-content:space-between;gap:1rem;margin:0;color:var(--mint);font-size:.7rem;font-weight:800}
    .story h3{margin:.55rem 0;font-size:clamp(1rem,2vw,1.35rem);line-height:1.55}
    .story h3 a{text-decoration-thickness:.06em;text-underline-offset:.18em}
    .story>p:not(.story-meta){margin:.45rem 0;color:var(--muted);font-size:.83rem;line-height:1.75}
    .source-link{display:inline-block;margin-top:.35rem;color:var(--accent);font-size:.72rem;font-weight:800}
    footer{padding:1.2rem .2rem;color:var(--muted);font-size:.72rem;line-height:1.8;text-align:center}
    @media(max-width:680px){.paper{padding:.65rem}.edition-head{padding:1.15rem}.story-grid{grid-template-columns:1fr}.story:first-child{grid-column:auto}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  </style>
</head>
<body>
  <main class="paper newsboy-relay-paper" data-newsboy-relay="edition-api">
    <header class="edition-head">
      <p class="edition-kicker">NEWSBOY · العدد الحي</p>
      <h1>${escapeHtml(coverage.event_name_ar)}</h1>
      <div class="edition-meta">
        <strong>${escapeHtml(coverage.status_ar || "تغطية موثقة")}</strong>
        <span>تاريخ العدد: <bdi>${escapeHtml(market.publication_date)}</bdi></span>
        <span><bdi>${observations.length}</bdi> مادة</span>
        ${market.generated_at_utc ? `<span>آخر تحديث: <bdi>${escapeHtml(market.generated_at_utc)}</bdi></span>` : ""}
      </div>
      <p class="edition-boundary">عناوين وملخصات منسوبة إلى مصادرها كما نشرها سجل NewsBoy الحي؛ لا تمثل تحققًا مستقلًا من صحة كل مادة. تُفتح المادة ومصدرها في نافذة مستقلة.</p>
    </header>
    <nav aria-label="أقسام عدد التغطية">${sectionNavigation}</nav>
    ${sectionMarkup}
    <footer>مصدر البيانات الحي: <a href="${NEWSBOY_COVERAGE_URL}" target="_blank" rel="noopener noreferrer">newsboy.sbay.sa/coverage/leap-2026 ↗</a></footer>
  </main>
</body>
</html>`;
}

async function fetchNewsboyReader(request) {
  let upstream;
  try {
    upstream = await fetch(NEWSBOY_COVERAGE_URL, {
      headers: {
        Accept: "text/html",
        "Accept-Language": "ar"
      },
      redirect: "follow"
    });
  } catch (error) {
    console.error("NewsBoy reader upstream fetch failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return unavailableReader(502);
  }

  const contentType = upstream.headers.get("content-type") || "";
  const html = await upstream.text();
  if (
    !upstream.ok
    || !contentType.toLowerCase().includes("text/html")
    || !isCompleteNewsboyEdition(html)
  ) {
    console.error("NewsBoy reader upstream was not a supported complete edition", {
      status: upstream.status,
      contentType
    });
    return unavailableReader(502);
  }

  let renderedHtml = transformNewsboyHtml(html);
  let articleCount = "";
  if (isModernNewsboyEdition(html)) {
    let editionResponse;
    let editionRecord;
    try {
      editionResponse = await fetch(NEWSBOY_EDITION_API_URL, {
        headers: { Accept: "application/json" },
        redirect: "follow"
      });
      editionRecord = await editionResponse.json();
    } catch (error) {
      console.error("NewsBoy edition record fetch failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      return unavailableReader(502);
    }
    if (
      !editionResponse.ok ||
      !isCompleteNewsboyEditionRecord(editionRecord)
    ) {
      console.error("NewsBoy edition record was incomplete", {
        status: editionResponse.status
      });
      return unavailableReader(502);
    }
    renderedHtml = renderNewsboyEdition(editionRecord);
    articleCount = String(editionRecord.market.observations.length);
  }

  const response = new Response(
    request.method === "HEAD" ? null : renderedHtml,
    {
      status: 200,
      headers: readerHeaders(
        "public, max-age=0, must-revalidate, no-transform, s-maxage=60"
      )
    }
  );
  response.headers.set("X-SBAY-NewsBoy-Upstream-Status", String(upstream.status));
  if (articleCount) {
    response.headers.set(
      "X-SBAY-NewsBoy-Edition-Source",
      NEWSBOY_EDITION_API_URL
    );
    response.headers.set("X-SBAY-NewsBoy-Article-Count", articleCount);
  }
  return response;
}

async function fetchNewsboyFont(request, url) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  const upstreamPath = url.pathname.slice("/newsboy-assets".length);
  if (
    !upstreamPath.startsWith("/fonts/")
    || upstreamPath.includes("..")
  ) {
    return new Response("Not Found", { status: 404 });
  }

  const upstreamUrl = new URL(upstreamPath, NEWSBOY_ORIGIN);
  upstreamUrl.search = url.search;
  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: request.headers.get("accept") || "*/*" },
      redirect: "follow"
    });
  } catch (error) {
    console.error("NewsBoy font upstream fetch failed", {
      path: upstreamPath,
      message: error instanceof Error ? error.message : String(error)
    });
    return new Response("Bad Gateway", { status: 502 });
  }
  if (!upstream.ok) {
    return new Response("Bad Gateway", { status: 502 });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=86400, immutable, no-transform",
    "Content-Type": contentType,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff"
  });
  const body = request.method === "HEAD"
    ? null
    : contentType.toLowerCase().includes("text/css")
      ? transformNewsboyFontCss(await upstream.text())
      : upstream.body;
  return new Response(body, {
    status: 200,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (READER_PATHS.has(url.pathname)) {
      if (!["GET", "HEAD"].includes(request.method)) {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" }
        });
      }
      return fetchNewsboyReader(request);
    }
    if (url.pathname.startsWith(FONT_PROXY_PREFIX)) {
      return fetchNewsboyFont(request, url);
    }
    return env.ASSETS.fetch(request);
  }
};
