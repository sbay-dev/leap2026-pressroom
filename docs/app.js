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
  { name: "SBAY", color: "#5ff0bb", x: 0, y: 0, z: .15, size: 1.45 },
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

function project(point, width, height) {
  const depth = 4.6 + point.z;
  const scale = Math.min(width, height) * .22 / depth;
  return {
    x: width / 2 + point.x * scale,
    y: height / 2 + point.y * scale,
    scale,
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
  const transformed = nodes.map(node => ({
    ...node,
    point: project(rotate(node), width, height)
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
    context.font = `700 ${Math.max(11, width / 62)}px Consolas, monospace`;
    context.textAlign = "center";
    context.fillText(
      node.name,
      node.point.x,
      node.point.y + Math.max(26, node.point.scale * node.size * .38)
    );
  }
  if (!dragging && !reducedMotion) rotationY += .0022;
  requestAnimationFrame(render);
}

canvas?.addEventListener("pointerdown", event => {
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas?.addEventListener("pointermove", event => {
  if (!dragging || !lastPointer) return;
  rotationY += (event.clientX - lastPointer.x) * .008;
  rotationX += (event.clientY - lastPointer.y) * .008;
  rotationX = Math.max(-1.2, Math.min(1.2, rotationX));
  lastPointer = { x: event.clientX, y: event.clientY };
});
const endDrag = event => {
  dragging = false;
  lastPointer = null;
  if (canvas?.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
};
canvas?.addEventListener("pointerup", endDrag);
canvas?.addEventListener("pointercancel", endDrag);
render();
