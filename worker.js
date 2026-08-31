const NEWSBOY_ORIGIN = "https://newsboy.sbay.sa";
const NEWSBOY_COVERAGE_URL = `${NEWSBOY_ORIGIN}/coverage/leap-2026`;
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
    || !/<main\b[^>]*class=["'][^"']*\bpaper\b/iu.test(html)
  ) {
    console.error("NewsBoy reader upstream was not a complete paper", {
      status: upstream.status,
      contentType
    });
    return unavailableReader(502);
  }

  const response = new Response(
    request.method === "HEAD" ? null : transformNewsboyHtml(html),
    {
      status: 200,
      headers: readerHeaders(
        "public, max-age=0, must-revalidate, no-transform, s-maxage=60"
      )
    }
  );
  response.headers.set("X-SBAY-NewsBoy-Upstream-Status", String(upstream.status));
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
