import { mountAdgCipher } from "./adg-cipher.js";

const body = document.body;
const languageButton = document.querySelector("[data-language]");
const header = document.querySelector("[data-header]");
const result = document.querySelector("[data-match-result]");
let matchState = "loading";

languageButton?.addEventListener("click", () => {
  const next = body.classList.contains("lang-ar") ? "en" : "ar";
  body.classList.toggle("lang-ar", next === "ar");
  body.classList.toggle("lang-en", next === "en");
  document.documentElement.lang = next;
  document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  renderMatchResult();
});

const updateHeader = () => {
  header?.classList.toggle("is-solid", window.scrollY > 24);
};
updateHeader();
addEventListener("scroll", updateHeader, { passive: true });

const dialog = document.querySelector("[data-dialog]");
const dialogImage = document.querySelector("[data-dialog-image]");
for (const trigger of document.querySelectorAll("[data-lightbox]")) {
  trigger.addEventListener("click", () => {
    if (!dialog || !dialogImage) return;
    dialogImage.src = trigger.dataset.lightbox;
    dialogImage.alt = trigger.querySelector("img")?.alt || "";
    dialog.showModal();
  });
}
document.querySelector("[data-close]")?.addEventListener("click", () => {
  dialog?.close();
});
dialog?.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

let wasmMatch = null;
let wasmExports = null;
function renderMatchResult() {
  if (!result) return;
  const arabic = body.classList.contains("lang-ar");
  if (matchState === "loading") {
    result.textContent = arabic ? "جارٍ تحميل الوحدة…" : "Loading module…";
    return;
  }
  if (matchState === "error") {
    result.textContent = arabic
      ? "تعذر تحميل وحدة WASM."
      : "The WASM module could not be loaded.";
    return;
  }
  result.textContent = matchState === "match"
    ? (arabic ? "مطابقة حتمية: 1" : "Deterministic match: 1")
    : (arabic ? "لا توجد مطابقة: 0" : "No match: 0");
}

const setResult = (matched, ready = true) => {
  matchState = ready ? (matched ? "match" : "mismatch") : "error";
  renderMatchResult();
};

try {
  const response = await fetch("./evidence-match.wasm");
  if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const module = await WebAssembly.instantiate(bytes);
  wasmExports = module.instance.exports;
  wasmMatch = module.instance.exports.evidence_match;
  setResult(true);
} catch (error) {
  console.error("Public WASM proof unavailable", error);
  setResult(false, false);
}

document.querySelector("[data-match]")?.addEventListener("click", () => {
  if (!wasmMatch) {
    setResult(false, false);
    return;
  }
  const expected = Number.parseInt(
    document.querySelector("[data-expected]")?.value || "0",
    10
  );
  const observed = Number.parseInt(
    document.querySelector("[data-observed]")?.value || "0",
    10
  );
  setResult(Boolean(wasmMatch(expected, observed)));
});

const canvas = document.getElementById("product-space");
const context = canvas?.getContext("2d");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const nodes = [
  { name: "SBAY", centerBrand: true, color: "#5ff0bb", x: 0, y: 0, z: .15, size: 1.45 },
  { name: "BUYER", color: "#58ddff", x: -1.45, y: -.65, z: .65, size: 1.05 },
  { name: "SUPPLIER", color: "#f4c767", x: 1.4, y: -.55, z: .8, size: 1.05 },
  { name: "FACTORY", color: "#ff7b9d", x: -1.05, y: 1.2, z: -.6, size: .95 },
  { name: "AI", color: "#a987ff", x: 1.15, y: 1.15, z: -.35, size: .9 },
  { name: "OPS", color: "#1b8cff", x: .1, y: -1.35, z: -1.1, size: .85 }
];
const links = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [2, 3], [3, 5], [4, 5]
];
let rotationX = -.28;
let rotationY = .55;
let dragging = false;
let lastPointer = null;
let zoom = 1;
let maximumZoom = 1;
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let networkVisible = false;
let networkFrame = 0;
const fibonacciZoomLevels = [1, 2, 3, 5, 8];

function rotate(point) {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  return {
    x: x1,
    y: point.y * cosX - z1 * sinX,
    z: point.y * sinX + z1 * cosX
  };
}

function project(point, width, height, zoomLevel = 1) {
  const depth = 4.6 + point.z;
  const scale = Math.min(width, height) * .22 / depth;
  return {
    x: width / 2 + point.x * scale * zoomLevel,
    y: height / 2 + point.y * scale * zoomLevel,
    scale: scale * zoomLevel,
    z: point.z
  };
}

function drawCube(point, color, size, scale) {
  const cube = Math.max(14, scale * size * .24);
  context.save();
  context.translate(point.x, point.y);
  context.strokeStyle = color;
  context.fillStyle = `${color}20`;
  context.lineWidth = Math.max(1, cube * .04);
  const offset = cube * .32;
  context.beginPath();
  context.rect(-cube / 2, -cube / 2, cube, cube);
  context.moveTo(-cube / 2, -cube / 2);
  context.lineTo(-cube / 2 + offset, -cube / 2 - offset);
  context.lineTo(cube / 2 + offset, -cube / 2 - offset);
  context.lineTo(cube / 2, -cube / 2);
  context.moveTo(cube / 2, cube / 2);
  context.lineTo(cube / 2 + offset, cube / 2 - offset);
  context.lineTo(cube / 2 + offset, -cube / 2 - offset);
  context.moveTo(-cube / 2 + offset, -cube / 2 - offset);
  context.lineTo(-cube / 2 + offset, cube / 2 - offset);
  context.lineTo(cube / 2 + offset, cube / 2 - offset);
  context.stroke();
  context.fillRect(-cube / 2, -cube / 2, cube, cube);
  context.restore();
}

function frameMaximumZoom(points, width, height) {
  const xValues = points.map(point => point.x);
  const yValues = points.map(point => point.y);
  const spanX = Math.max(...xValues) - Math.min(...xValues);
  const spanY = Math.max(...yValues) - Math.min(...yValues);
  if (spanX <= 0 || spanY <= 0) return 1;
  const frameWidth = width * .82;
  const frameHeight = height * .82;
  return Math.max(1, Math.min(8, frameWidth / spanX, frameHeight / spanY));
}

function clampZoom(value) {
  return Math.max(1, Math.min(maximumZoom, value));
}

function nearestFibonacciZoom(value) {
  const levels = [
    ...fibonacciZoomLevels.filter(level => level <= maximumZoom),
    maximumZoom
  ].filter((level, index, values) =>
    index === 0 || Math.abs(level - values[index - 1]) > .01);
  return levels.reduce((nearest, level) =>
    Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest);
}

function drawCenterBrand(node, width) {
  const y = node.point.y + Math.max(27, node.point.scale * node.size * .4);
  if (!document.body.classList.contains("lang-ar")) {
    context.font = `800 ${Math.max(12, width / 58)}px "Segoe UI", Tahoma, Arial, sans-serif`;
    context.fillText("SBAY", node.point.x, y);
    return;
  }

  const largeSize = Math.max(13, width / 55);
  const smallSize = largeSize * .58;
  const gap = largeSize * .25;
  context.font = `800 ${largeSize}px "Segoe UI", Tahoma, Arial, sans-serif`;
  const tamweenWidth = context.measureText("تموين").width;
  context.font = `700 ${smallSize}px "Segoe UI", Tahoma, Arial, sans-serif`;
  const platformWidth = context.measureText("منصة").width;
  const start = node.point.x - (tamweenWidth + gap + platformWidth) / 2;

  context.font = `800 ${largeSize}px "Segoe UI", Tahoma, Arial, sans-serif`;
  context.fillText("تموين", start + tamweenWidth / 2, y);
  context.font = `700 ${smallSize}px "Segoe UI", Tahoma, Arial, sans-serif`;
  context.fillText(
    "منصة",
    start + tamweenWidth + gap + platformWidth / 2,
    y - largeSize * .08
  );
}

function render() {
  if (!canvas || !context) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  const rotated = nodes.map(node => ({ ...node, rotated: rotate(node) }));
  const basePoints = rotated.map(node =>
    project(node.rotated, width, height));
  maximumZoom = frameMaximumZoom(basePoints, width, height);
  zoom = clampZoom(zoom);
  canvas.dataset.zoom = zoom.toFixed(3);
  canvas.dataset.maximumZoom = maximumZoom.toFixed(3);
  const transformed = rotated.map(node => ({
    ...node,
    point: project(node.rotated, width, height, zoom)
  }));
  context.save();
  context.lineWidth = Math.max(1, width / 700);
  for (const [from, to] of links) {
    const a = transformed[from].point;
    const b = transformed[to].point;
    const gradient = context.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, `${transformed[from].color}80`);
    gradient.addColorStop(1, `${transformed[to].color}50`);
    context.strokeStyle = gradient;
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  }
  context.restore();
  for (const node of transformed.sort((a, b) => a.point.z - b.point.z)) {
    drawCube(node.point, node.color, node.size, node.point.scale);
    context.fillStyle = "#f2f7fb";
    context.textAlign = "center";
    if (node.centerBrand) {
      drawCenterBrand(node, width);
    } else {
      context.font = `700 ${Math.max(11, width / 62)}px Consolas, monospace`;
      context.fillText(
        node.name,
        node.point.x,
        node.point.y + Math.max(26, node.point.scale * node.size * .38)
      );
    }
  }
  if (!dragging && !reducedMotion) rotationY += .0022;
  networkFrame = networkVisible && !document.hidden
    ? requestAnimationFrame(render)
    : 0;
}

function startNetwork() {
  if (networkFrame || !networkVisible || document.hidden) return;
  networkFrame = requestAnimationFrame(render);
}

canvas?.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch") return;
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas?.addEventListener("pointermove", event => {
  if (event.pointerType === "touch") return;
  if (!dragging || !lastPointer) return;
  rotationY += (event.clientX - lastPointer.x) * .008;
  rotationX += (event.clientY - lastPointer.y) * .008;
  rotationX = Math.max(-1.2, Math.min(1.2, rotationX));
  lastPointer = { x: event.clientX, y: event.clientY };
});
const endDrag = event => {
  if (event.pointerType === "touch") return;
  dragging = false;
  lastPointer = null;
  if (canvas?.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};
canvas?.addEventListener("pointerup", endDrag);
canvas?.addEventListener("pointercancel", endDrag);

function touchDistance(touches) {
  return Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY
  );
}

canvas?.addEventListener("touchstart", event => {
  if (event.touches.length === 1) {
    dragging = true;
    lastPointer = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
    return;
  }
  if (event.touches.length === 2) {
    pinchStartDistance = touchDistance(event.touches);
    pinchStartZoom = zoom;
    dragging = false;
    lastPointer = null;
  }
}, { passive: true });

canvas?.addEventListener("touchmove", event => {
  if (event.touches.length === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    zoom = clampZoom(
      pinchStartZoom * touchDistance(event.touches) / pinchStartDistance
    );
    return;
  }
  if (event.touches.length !== 1 || !dragging || !lastPointer) return;
  event.preventDefault();
  const touch = event.touches[0];
  rotationY += (touch.clientX - lastPointer.x) * .008;
  rotationX += (touch.clientY - lastPointer.y) * .008;
  rotationX = Math.max(-1.2, Math.min(1.2, rotationX));
  lastPointer = { x: touch.clientX, y: touch.clientY };
}, { passive: false });

const endTouch = event => {
  if (pinchStartDistance > 0 && event.touches.length < 2) {
    zoom = nearestFibonacciZoom(zoom);
    pinchStartDistance = 0;
  }
  if (event.touches.length === 1) {
    dragging = true;
    lastPointer = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  } else {
    dragging = false;
    lastPointer = null;
  }
};
canvas?.addEventListener("touchend", endTouch);
canvas?.addEventListener("touchcancel", endTouch);

if (canvas) {
  new IntersectionObserver(entries => {
    networkVisible = entries.some(entry => entry.isIntersecting);
    if (networkVisible) startNetwork();
  }, { threshold: .01 }).observe(canvas);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startNetwork();
  });
}

const cipherCanvas = document.getElementById("adg-cipher");
if (cipherCanvas) {
  mountAdgCipher(cipherCanvas, wasmExports).then(instance => {
    if (!instance) return;
    const facts = {
      reference: instance.scene.reference,
      bytes: String(instance.scene.totalUtf8),
      units: String(instance.scene.transportBytes),
      flags: String(instance.scene.transportBits)
    };
    for (const node of document.querySelectorAll("[data-cipher-fact]")) {
      const value = facts[node.dataset.cipherFact];
      if (value) node.textContent = value;
    }
  }).catch(() => {
    cipherCanvas.dataset.backend = "unavailable";
  });
}
