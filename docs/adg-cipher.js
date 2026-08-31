/*
 * ADG Cipher -> Bloom
 * A deterministic, data-driven adaptation of the CNS "Flower Bloom Cipher"
 * study embedded in the single page at https://sbay-dev.github.io/sarmadAi/ .
 *
 * The public evidence shown here is deliberately narrow:
 *   - 23 published low octets form a 23 by 8 lattice of 184 flag positions
 *   - WebAssembly extracts each bit and computes each octet's population count
 *   - a set bit blooms; its petals equal that octet's population count
 *   - the final trace_void call returns no value and changes no linear memory
 *
 * IF, ID and EX are visual phase labels, not an instrumented hardware trace.
 * The verse is never typed into this file. No proprietary mask table, routing
 * rule, threshold, weight or model artefact is present.
 */

const LOOP_SECONDS = 5;
const MAX_BACKING_AREA = 1_000_000;
const TRACE = Object.freeze({
  fetchEnd: 0.18,
  decodeEnd: 0.34,
  executeEnd: 0.70,
  quietEnd: 0.82,
  voidEnd: 0.96
});

/*
 * Derived byte reality for Quran 20:13. Per word: UTF-8 length, then the low
 * octet of the Unicode scalar of every rasm unit in that word.
 */
const RASM = {
  reference: "20:13",
  words: [
    { utf8: 14, flags: [0x48, 0x27, 0xba, 0x27] },
    { utf8: 22, flags: [0x27, 0x2d, 0xba, 0x31, 0xba, 0x43] },
    { utf8: 22, flags: [0xa1, 0x27, 0x33, 0xba, 0x45, 0x39] },
    { utf8: 10, flags: [0x44, 0x45, 0x27] },
    { utf8: 12, flags: [0x6e, 0x48, 0x2d, 0x49] }
  ]
};

const popcount = byte => {
  let value = byte;
  let bits = 0;
  while (value) { value &= value - 1; bits += 1; }
  return bits;
};

const JS_ANALYZER = Object.freeze({
  kind: "js-fallback",
  flagBit: (flag, bit) => bit >= 0 && bit < 8 ? (flag >> bit) & 1 : 0,
  flagPopcount: popcount,
  traceVoid: () => undefined,
  voidReturn: "none",
  voidMemoryWrites: "not-observed"
});

function createWasmAnalyzer(exports) {
  for (const name of ["flag_bit", "flag_popcount", "trace_void"]) {
    if (typeof exports?.[name] !== "function") {
      throw new TypeError(`Missing WebAssembly export: ${name}`);
    }
  }
  if (!(exports.memory instanceof WebAssembly.Memory)) {
    throw new TypeError("Missing WebAssembly linear memory");
  }

  const before = new Uint8Array(exports.memory.buffer).slice();
  const result = exports.trace_void();
  const after = new Uint8Array(exports.memory.buffer);
  const unchanged = before.length === after.length
    && before.every((value, index) => value === after[index]);
  if (result !== undefined || !unchanged) {
    throw new Error("trace_void changed memory or returned a value");
  }

  return Object.freeze({
    kind: "wasm-i32",
    flagBit: (flag, bit) => exports.flag_bit(flag, bit),
    flagPopcount: flag => exports.flag_popcount(flag),
    traceVoid: () => exports.trace_void(),
    voidReturn: "none",
    voidMemoryWrites: 0
  });
}

async function loadWasmAnalyzer(providedExports) {
  if (providedExports) return createWasmAnalyzer(providedExports);
  const response = await fetch("./evidence-match.wasm");
  if (!response.ok) {
    throw new Error(`WebAssembly analyser HTTP ${response.status}`);
  }
  const module = await WebAssembly.instantiate(await response.arrayBuffer());
  return createWasmAnalyzer(module.instance.exports);
}

function stageForPhase(phase) {
  if (phase < TRACE.fetchEnd) return "fetch";
  if (phase < TRACE.decodeEnd) return "decode";
  if (phase < TRACE.executeEnd) return "execute";
  if (phase < TRACE.quietEnd) return "quiet";
  if (phase < TRACE.voidEnd) return "void";
  return "reset";
}

const PALETTE = {
  rasm: [0.90, 0.97, 1.0],
  clearBit: [0.20, 0.34, 0.52],
  voidLane: [0.62, 0.55, 0.95],
  // Cyan to violet across the five words, carrying the bloom study forward.
  words: [
    [0.33, 0.88, 1.00],
    [0.42, 0.79, 1.00],
    [0.52, 0.69, 1.00],
    [0.59, 0.61, 0.98],
    [0.66, 0.53, 0.95]
  ]
};

const KIND = {
  GLYPH: 0,
  CELL: 1,
  BIT: 2,
  PETAL: 3,
  GLOW: 4,
  RULE: 5,
  GRID: 6,
  VOID: 7
};

/** Builds the deterministic scene model shared by both painters. */
export function buildScene(analyzer = JS_ANALYZER) {
  const units = [];
  RASM.words.forEach((word, wordIndex) => {
    word.flags.forEach((flag, glyphIndex) => {
      const bits = Array.from(
        { length: 8 },
        (_, bit) => analyzer.flagBit(flag, bit)
      );
      const petals = analyzer.flagPopcount(flag);
      if (petals !== bits.reduce((sum, value) => sum + value, 0)) {
        throw new Error(`Inconsistent analyser output for flag 0x${flag.toString(16)}`);
      }
      units.push({
        wordIndex,
        glyphIndex,
        flag,
        bits,
        petals,
        label: flag.toString(16).toUpperCase().padStart(2, "0")
      });
    });
  });

  const totalUtf8 = RASM.words.reduce((sum, word) => sum + word.utf8, 0)
    + (RASM.words.length - 1);
  const transportBits = units.length * 8;

  return {
    units,
    words: RASM.words,
    reference: RASM.reference,
    totalUtf8,
    transportBits,
    transportBytes: units.length,
    ratio: totalUtf8 / units.length,
    analyser: analyzer.kind,
    traceMode: "precomputed-replay",
    voidReturn: analyzer.voidReturn,
    voidMemoryWrites: analyzer.voidMemoryWrites
  };
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

/**
 * Places the public octet trace in clip space. Unit zero sits at the right
 * edge. Rows run from the most significant bit downwards.
 */
function layout(scene) {
  const items = [];
  const columns = scene.units.length;
  const rows = 8;
  const halfWidth = 0.94;
  const stepX = (halfWidth * 2) / columns;
  const columnX = index => halfWidth - stepX * (index + 0.5);

  const latticeTop = -0.52;
  const latticeBottom = 0.42;
  const stepY = (latticeBottom - latticeTop) / rows;
  const latticeCenter = (latticeTop + latticeBottom) / 2;

  // The grid is part of the data: 23 octet positions by 8 bit positions.
  for (let boundary = 0; boundary <= columns; boundary += 1) {
    items.push({
      kind: KIND.GRID,
      x: -halfWidth + boundary * stepX,
      y: latticeCenter,
      w: 0.0022,
      h: latticeBottom - latticeTop,
      color: PALETTE.clearBit,
      seed: boundary,
      t0: 0,
      span: 0.001,
      atlas: -1,
      value: 0
    });
  }
  for (let boundary = 0; boundary <= rows; boundary += 1) {
    items.push({
      kind: KIND.GRID,
      x: 0,
      y: latticeTop + boundary * stepY,
      w: halfWidth * 2,
      h: 0.0022,
      color: PALETTE.clearBit,
      seed: columns + boundary,
      t0: 0,
      span: 0.001,
      atlas: -1,
      value: 0
    });
  }

  scene.units.forEach((unit, index) => {
    const x = columnX(index);
    const tint = PALETTE.words[unit.wordIndex];
    const unitOrder = index / Math.max(1, columns - 1);

    // IF: the immutable published low octet enters from right to left.
    items.push({
      kind: KIND.GLYPH,
      x,
      y: latticeTop - stepY * 0.78,
      w: stepX * 0.96,
      h: stepY * 0.54,
      color: PALETTE.rasm, seed: index,
      t0: 0.018 + unitOrder * 0.09,
      span: 0.075,
      atlas: index,
      value: 1
    });

    for (let bit = 7; bit >= 0; bit -= 1) {
      const set = unit.bits[bit];
      const row = 7 - bit;
      const y = latticeTop + (row + 0.5) * stepY;
      const cellOrder = (index * rows + row) / (columns * rows - 1);
      const decodeAt = TRACE.fetchEnd + unitOrder * 0.08 + row * 0.0025;

      // ID: every bit position remains visible; set positions brighten.
      items.push({
        kind: KIND.CELL,
        x,
        y,
        w: stepX * 0.17,
        h: stepX * 0.17,
        color: PALETTE.clearBit, seed: index * 8 + row,
        t0: decodeAt,
        span: 0.07,
        atlas: -1,
        value: set
      });

      if (!set) continue;

      // EX: the set bit becomes the centre of a bounded, translucent bloom.
      const bloomAt = TRACE.decodeEnd + cellOrder * 0.23;
      for (let petal = 0; petal < unit.petals; petal += 1) {
        const angle = (Math.PI * 2 / unit.petals) * petal
          + (index * 0.17 + row * 0.11);
        items.push({
          kind: KIND.PETAL,
          x,
          y,
          w: stepX * 0.56,
          h: stepX * 0.23,
          color: tint, seed: index * 8 + row + petal,
          t0: bloomAt,
          span: 0.075,
          atlas: -1,
          value: 1,
          orbit: stepX * 0.19,
          rotation: angle
        });
      }
      items.push({
        kind: KIND.GLOW,
        x,
        y,
        w: stepX * 0.72,
        h: stepX * 0.72,
        color: tint,
        seed: index * 8 + row,
        t0: bloomAt,
        span: 0.09,
        atlas: -1,
        value: 1
      });
      items.push({
        kind: KIND.BIT,
        x,
        y,
        w: stepX * 0.19,
        h: stepX * 0.19,
        color: tint, seed: index * 8 + row,
        t0: decodeAt,
        span: 0.07,
        atlas: -1,
        value: 1
      });
    }
  });

  // Five public word groups remain visible while the transient blooms settle.
  let cursor = 0;
  scene.words.forEach((word, wordIndex) => {
    const first = cursor;
    const last = cursor + word.flags.length - 1;
    cursor = last + 1;
    const left = columnX(last) - stepX * 0.44;
    const right = columnX(first) + stepX * 0.44;
    items.push({
      kind: KIND.RULE,
      x: (left + right) / 2,
      y: latticeBottom + stepY * 0.38,
      w: right - left, h: 0.006,
      color: PALETTE.words[wordIndex], seed: wordIndex,
      t0: 0.08 + wordIndex * 0.012,
      span: 0.12,
      atlas: -1,
      value: 1
    });
  });

  // A no-op call has no visual payload: only three rings dissipate, leaving
  // the permanent grid behind. The HTML overlay names the verified void state.
  for (let ring = 0; ring < 3; ring += 1) {
    items.push({
      kind: KIND.VOID,
      x: 0,
      y: latticeCenter,
      w: 0.13 + ring * 0.08,
      h: 0.13 + ring * 0.08,
      color: PALETTE.voidLane,
      seed: ring,
      t0: TRACE.quietEnd + ring * 0.018,
      span: 0.09,
      atlas: -1,
      value: ring
    });
  }

  return items;
}
/* ------------------------------------------------------------------ *
 * Glyph atlas
 * ------------------------------------------------------------------ */

const ATLAS_COLS = 8;
const ATLAS_CELL = 128;

function buildAtlas(scene) {
  const rows = Math.ceil(scene.units.length / ATLAS_COLS);
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * ATLAS_CELL;
  canvas.height = rows * ATLAS_CELL;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${ATLAS_CELL * 0.46}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
  scene.units.forEach((unit, index) => {
    const column = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    context.fillText(
      unit.label,
      column * ATLAS_CELL + ATLAS_CELL / 2,
      row * ATLAS_CELL + ATLAS_CELL * 0.54
    );
  });
  return { canvas, rows };
}

function atlasRect(index, rows) {
  const column = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  return [
    column / ATLAS_COLS,
    row / rows,
    (column + 1) / ATLAS_COLS,
    (row + 1) / rows
  ];
}

/* ------------------------------------------------------------------ *
 * WebGPU painter
 * ------------------------------------------------------------------ */

const SHADER = /* wgsl */ `
struct Uniforms {
  phase : f32,
  intensity : f32,
  fade : f32,
  aspect : f32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var atlasSampler : sampler;
@group(0) @binding(2) var atlasTexture : texture_2d<f32>;

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) local : vec2f,
  @location(1) tint : vec4f,
  @location(2) kind : f32,
  @location(3) uv : vec2f,
  @location(4) energy : f32,
};

fn easeOut(x : f32) -> f32 {
  let c = clamp(x, 0.0, 1.0);
  return 1.0 - pow(1.0 - c, 3.0);
}

fn envelope(t0 : f32, span : f32) -> f32 {
  return easeOut((uniforms.phase - t0) / span);
}

fn flowerEnvelope(t0 : f32, span : f32) -> f32 {
  let rise = envelope(t0, span);
  let localFade = 1.0 - smoothstep(
    t0 + span + 0.055,
    t0 + span + 0.20,
    uniforms.phase
  );
  let quiet = 1.0 - smoothstep(0.70, 0.82, uniforms.phase);
  return rise * localFade * quiet;
}

@vertex
fn vertexMain(
  @location(0) corner : vec2f,
  @location(1) center : vec2f,
  @location(2) size : vec2f,
  @location(3) color : vec4f,
  @location(4) timing : vec4f,
  @location(5) rect : vec4f
) -> VertexOut {
  let kind = timing.x;
  let seed = timing.y;
  let t0 = timing.z;
  let span = timing.w;

  let grow = envelope(t0, span);
  var scale = 1.0;
  var offset = vec2f(0.0, 0.0);
  var energy = 1.0;
  let breathe = sin((uniforms.phase * 6.2831853) + seed * 0.45);
  var angle = rect.z;

  if (kind < 0.5) {
    // IF: the published low octet enters from right to left.
    scale = mix(0.76, 1.0, grow);
    energy = grow * (1.0 - smoothstep(0.70, 0.82, uniforms.phase));
  } else if (kind < 1.5) {
    // ID: the full 23 by 8 lattice remains as the stable evidence surface.
    let decode = smoothstep(0.18, 0.34, uniforms.phase)
      * (1.0 - smoothstep(0.70, 0.82, uniforms.phase));
    let voidDip = smoothstep(0.82, 0.88, uniforms.phase)
      * (1.0 - smoothstep(0.94, 1.0, uniforms.phase));
    energy = 0.20 + decode * 0.28 - voidDip * 0.08;
  } else if (kind < 2.5) {
    // A set bit becomes the centre shared by its bloom.
    scale = mix(0.22, 1.0, grow);
    energy = grow * (1.0 - smoothstep(0.68, 0.82, uniforms.phase));
  } else if (kind < 3.5) {
    // EX: the original ellipse grows and rotates around the same bit centre.
    let flower = flowerEnvelope(t0, span);
    angle = rect.z + uniforms.phase * 1.35;
    scale = flower * (1.0 + breathe * 0.045 * uniforms.intensity);
    offset = vec2f(
      cos(angle) * rect.x,
      sin(angle) * rect.x * uniforms.aspect
    ) * flower;
    energy = flower;
  } else if (kind < 4.5) {
    // The low-opacity halo is visual only and carries no additional datum.
    let flower = flowerEnvelope(t0, span);
    scale = mix(0.35, 1.08, flower);
    energy = flower;
  } else if (kind < 5.5) {
    // Word grouping is permanent but recedes during the void call.
    let wordLight = smoothstep(0.08, 0.24, uniforms.phase)
      * (1.0 - smoothstep(0.70, 0.82, uniforms.phase));
    let voidDip = smoothstep(0.82, 0.88, uniforms.phase)
      * (1.0 - smoothstep(0.94, 1.0, uniforms.phase));
    energy = 0.30 + wordLight * 0.44 - voidDip * 0.10;
  } else if (kind < 6.5) {
    // Exact grid lines brighten during decode and dim after execution.
    let decode = smoothstep(0.18, 0.34, uniforms.phase)
      * (1.0 - smoothstep(0.70, 0.82, uniforms.phase));
    let voidDip = smoothstep(0.82, 0.88, uniforms.phase)
      * (1.0 - smoothstep(0.94, 1.0, uniforms.phase));
    energy = 0.22 + decode * 0.28 - voidDip * 0.08;
  } else {
    // trace_void: a dissipating ring, with no data packet or write-back.
    scale = mix(0.30, 1.0 + seed * 0.22, grow);
    energy = grow * (1.0 - smoothstep(0.93, 0.995, uniforms.phase));
  }

  var local = corner * size * scale;
  if (
    (kind > 0.5 && kind < 2.5)
    || (kind > 3.5 && kind < 4.5)
    || kind > 6.5
  ) {
    // Keep dots, halos and void rings circular on a wide canvas.
    local.y = corner.y * size.x * uniforms.aspect * scale;
  }
  if (kind > 2.5 && kind < 3.5) {
    // Rotate each petal in pixel space so the old ellipse is not distorted by
    // the canvas aspect ratio.
    var pixelLocal = vec2f(
      corner.x * size.x * uniforms.aspect,
      corner.y * size.x * uniforms.aspect * 0.42
    ) * scale;
    let c = cos(angle);
    let s = sin(angle);
    pixelLocal = vec2f(
      pixelLocal.x * c - pixelLocal.y * s,
      pixelLocal.x * s + pixelLocal.y * c
    );
    local = vec2f(pixelLocal.x / uniforms.aspect, pixelLocal.y);
  }
  let world = center + offset + local;

  var result : VertexOut;
  result.position = vec4f(world.x, -world.y, 0.0, 1.0);
  result.local = corner;
  result.tint = color;
  result.kind = kind;
  result.uv = mix(rect.xy, rect.zw, vec2f(corner.x * 0.5 + 0.5, corner.y * 0.5 + 0.5));
  result.energy = energy * uniforms.fade;
  return result;
}

fn roundedBox(p : vec2f, radius : f32) -> f32 {
  let q = abs(p) - vec2f(1.0 - radius, 1.0 - radius);
  return length(max(q, vec2f(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - radius;
}

@fragment
fn fragmentMain(input : VertexOut) -> @location(0) vec4f {
  let kind = input.kind;
  // Sampled in uniform control flow, then selected per kind.
  let glyph = textureSample(atlasTexture, atlasSampler, input.uv).a;
  var alpha = 0.0;

  if (kind < 0.5) {
    alpha = glyph;
  } else if (kind < 1.5) {
    let r = length(input.local);
    alpha = 1.0 - smoothstep(0.58, 1.0, r);
  } else if (kind < 2.5) {
    let r = length(input.local);
    alpha = 1.0 - smoothstep(0.45, 1.0, r);
  } else if (kind < 3.5) {
    // The ellipse is exactly one translucent petal.
    let r = length(input.local);
    alpha = (1.0 - smoothstep(0.68, 1.0, r)) * 0.54;
  } else if (kind < 4.5) {
    let r = length(input.local);
    alpha = pow(max(0.0, 1.0 - r), 2.0) * 0.13;
  } else if (kind < 6.5) {
    let d = roundedBox(input.local, 0.48);
    alpha = 1.0 - smoothstep(-0.08, 0.08, d);
  } else {
    let r = length(input.local);
    alpha = (1.0 - smoothstep(0.03, 0.12, abs(r - 0.72))) * 0.55;
  }

  let coverage = alpha * input.energy * input.tint.a;
  if (coverage <= 0.002) { discard; }
  return vec4f(input.tint.rgb * coverage, coverage);
}
`;

const FLOATS_PER_INSTANCE = 16;

function packInstances(items, atlasRows) {
  const data = new Float32Array(items.length * FLOATS_PER_INSTANCE);
  items.forEach((item, index) => {
    const base = index * FLOATS_PER_INSTANCE;
    const rect = item.atlas >= 0
      ? atlasRect(item.atlas, atlasRows)
      : item.kind === KIND.PETAL
        ? [item.orbit ?? 0, 0, item.rotation ?? 0, 0]
        : [0, 0, 0, 0];
    const alpha = item.kind === KIND.GLYPH ? 0.58
      : item.kind === KIND.GRID ? 0.72
        : 1;
    data[base] = item.x;
    data[base + 1] = item.y;
    data[base + 2] = item.w / 2;
    data[base + 3] = item.h / 2;
    data[base + 4] = item.color[0];
    data[base + 5] = item.color[1];
    data[base + 6] = item.color[2];
    data[base + 7] = alpha;
    data[base + 8] = item.kind;
    data[base + 9] = item.seed;
    data[base + 10] = item.t0;
    data[base + 11] = item.span;
    data[base + 12] = rect[0];
    data[base + 13] = rect[1];
    data[base + 14] = rect[2];
    data[base + 15] = rect[3];
  });
  return data;
}

async function createGpuPainter(canvas, scene, items) {
  if (!navigator.gpu) return null;
  let adapter = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
  } catch {
    return null;
  }
  if (!adapter) return null;

  let device = null;
  try {
    device = await adapter.requestDevice();
  } catch {
    return null;
  }
  if (!device) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  const atlas = buildAtlas(scene);
  if (!atlas) {
    device.destroy?.();
    return null;
  }
  const texture = device.createTexture({
    size: [atlas.canvas.width, atlas.canvas.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.RENDER_ATTACHMENT
  });
  device.queue.copyExternalImageToTexture(
    { source: atlas.canvas },
    { texture },
    [atlas.canvas.width, atlas.canvas.height]
  );

  const quad = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]);
  const quadBuffer = device.createBuffer({
    size: quad.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(quadBuffer, 0, quad);

  const instanceData = packInstances(items, atlas.rows);
  const instanceBuffer = device.createBuffer({
    size: instanceData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(instanceBuffer, 0, instanceData);

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const module = device.createShaderModule({ code: SHADER });
  device.pushErrorScope("validation");
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
        },
        {
          arrayStride: FLOATS_PER_INSTANCE * 4,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32x2" },
            { shaderLocation: 3, offset: 16, format: "float32x4" },
            { shaderLocation: 4, offset: 32, format: "float32x4" },
            { shaderLocation: 5, offset: 48, format: "float32x4" }
          ]
        }
      ]
    },
    fragment: {
      module,
      entryPoint: "fragmentMain",
      targets: [{
        format,
        blend: {
          color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
        }
      }]
    },
    primitive: { topology: "triangle-list" }
  });

  // A shader or pipeline fault must never leave an empty hero: report the
  // reason and let the caller fall back to the Canvas2D painter.
  const pipelineError = await device.popErrorScope();
  if (pipelineError) {
    const info = await module.getCompilationInfo?.();
    const messages = (info?.messages ?? [])
      .filter(message => message.type === "error")
      .map(message => `${message.lineNum}:${message.linePos} ${message.message}`);
    canvas.dataset.gpuValidation = messages.join(" | ") || pipelineError.message;
    device.destroy?.();
    return null;
  }

  // The canvas is bound to WebGPU only after the pipeline is known good, so a
  // fault can still fall back to the Canvas2D painter on the same element.
  const context = canvas.getContext("webgpu");
  if (!context) {
    device.destroy?.();
    return null;
  }
  context.configure({ device, format, alphaMode: "premultiplied" });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
      { binding: 2, resource: texture.createView() }
    ]
  });

  const uniforms = new Float32Array(4);
  let lost = false;
  device.lost?.then(() => { lost = true; });
  device.addEventListener?.("uncapturederror", event => {
    canvas.dataset.gpuError = event.error?.message ?? "unknown";
  });

  return {
    backend: "webgpu",
    isLost: () => lost,
    draw(phase, intensity, fade) {
      if (lost) return;
      uniforms[0] = phase;
      uniforms[1] = intensity;
      uniforms[2] = fade;
      uniforms[3] = canvas.width / Math.max(1, canvas.height);
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store"
        }]
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, quadBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.draw(6, items.length);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      try { device.destroy?.(); } catch { /* already gone */ }
    }
  };
}

/* ------------------------------------------------------------------ *
 * Canvas2D painter — identical composition, used when WebGPU is absent
 * ------------------------------------------------------------------ */

function createCanvasPainter(canvas, scene, items) {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const easeOut = value => {
    const clamped = Math.min(1, Math.max(0, value));
    return 1 - Math.pow(1 - clamped, 3);
  };
  const smoothstep = (value, from, to) => {
    const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  const flowerEnvelope = (phase, item) => {
    const rise = easeOut((phase - item.t0) / item.span);
    const localFade = 1 - smoothstep(
      phase,
      item.t0 + item.span + 0.055,
      item.t0 + item.span + 0.20
    );
    const quiet = 1 - smoothstep(phase, TRACE.executeEnd, TRACE.quietEnd);
    return rise * localFade * quiet;
  };
  const rgba = (color, alpha) =>
    `rgba(${Math.round(color[0] * 255)},${Math.round(color[1] * 255)},${Math.round(color[2] * 255)},${alpha})`;

  return {
    backend: "canvas2d",
    isLost: () => false,
    draw(phase, intensity, fade) {
      const width = canvas.width;
      const height = canvas.height;
      const toX = value => (value * 0.5 + 0.5) * width;
      const toY = value => (value * 0.5 + 0.5) * height;
      const toW = value => Math.abs(value) * width * 0.5;
      const toH = value => Math.abs(value) * height * 0.5;

      context.clearRect(0, 0, width, height);
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (const item of items) {
        const grow = easeOut((phase - item.t0) / item.span);
        let energy = 1;
        let scale = 1;
        let flower = 0;
        if (item.kind === KIND.GLYPH) {
          scale = 0.76 + grow * 0.24;
          energy = grow * (1 - smoothstep(phase, TRACE.executeEnd, TRACE.quietEnd));
        } else if (item.kind === KIND.CELL) {
          const decode = smoothstep(phase, TRACE.fetchEnd, TRACE.decodeEnd)
            * (1 - smoothstep(phase, TRACE.executeEnd, TRACE.quietEnd));
          const voidDip = smoothstep(phase, TRACE.quietEnd, 0.88)
            * (1 - smoothstep(phase, 0.94, 1));
          energy = 0.20 + decode * 0.28 - voidDip * 0.08;
        } else if (item.kind === KIND.BIT) {
          scale = 0.22 + grow * 0.78;
          energy = grow * (1 - smoothstep(phase, 0.68, TRACE.quietEnd));
        } else if (item.kind === KIND.PETAL) {
          flower = flowerEnvelope(phase, item);
          const breathe = 1 + Math.sin(phase * Math.PI * 2 + item.seed * 0.45)
            * 0.045 * intensity;
          scale = flower * breathe;
          energy = flower;
        } else if (item.kind === KIND.GLOW) {
          flower = flowerEnvelope(phase, item);
          scale = 0.35 + flower * 0.73;
          energy = flower;
        } else if (item.kind === KIND.RULE) {
          const active = smoothstep(phase, 0.08, 0.24)
            * (1 - smoothstep(phase, TRACE.executeEnd, TRACE.quietEnd));
          const voidDip = smoothstep(phase, TRACE.quietEnd, 0.88)
            * (1 - smoothstep(phase, 0.94, 1));
          energy = 0.30 + active * 0.44 - voidDip * 0.10;
        } else if (item.kind === KIND.GRID) {
          const decode = smoothstep(phase, TRACE.fetchEnd, TRACE.decodeEnd)
            * (1 - smoothstep(phase, TRACE.executeEnd, TRACE.quietEnd));
          const voidDip = smoothstep(phase, TRACE.quietEnd, 0.88)
            * (1 - smoothstep(phase, 0.94, 1));
          energy = 0.22 + decode * 0.28 - voidDip * 0.08;
        } else if (item.kind === KIND.VOID) {
          scale = 0.30 + grow * (0.70 + item.seed * 0.22);
          energy = grow * (1 - smoothstep(phase, 0.93, 0.995));
        }
        energy *= fade;
        if (energy <= 0.001) continue;

        const alpha = item.kind === KIND.GLYPH ? energy * 0.58
          : item.kind === KIND.GRID ? energy * 0.72
            : energy;
        const px = toX(item.x);
        const py = toY(item.y);
        const w = toW(item.w);
        const h = toH(item.h);

        if (item.kind === KIND.GLYPH) {
          context.fillStyle = rgba(item.color, alpha);
          context.font = `600 ${h * 0.72 * scale}px ui-monospace, Consolas, monospace`;
          context.fillText(scene.units[item.atlas].label, px, py);
        } else if (item.kind === KIND.PETAL) {
          const angle = (item.rotation ?? 0) + phase * 1.35;
          const orbit = toW(item.orbit ?? 0) * flower;
          const cx = px + Math.cos(angle) * orbit;
          const cy = py + Math.sin(angle) * orbit;
          const major = (w / 2) * scale * 0.84;
          context.save();
          context.translate(cx, cy);
          context.rotate(angle);
          context.fillStyle = rgba(item.color, alpha * 0.54);
          context.beginPath();
          context.ellipse(0, 0, major, major * 0.42, 0, 0, Math.PI * 2);
          context.fill();
          context.restore();
        } else if (item.kind === KIND.GLOW) {
          const radius = (w / 2) * scale;
          const gradient = context.createRadialGradient(px, py, 0, px, py, radius);
          gradient.addColorStop(0, rgba(item.color, alpha * 0.13));
          gradient.addColorStop(1, rgba(item.color, 0));
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(px, py, radius, 0, Math.PI * 2);
          context.fill();
        } else if (item.kind === KIND.RULE || item.kind === KIND.GRID) {
          context.fillStyle = rgba(item.color, alpha);
          context.fillRect(px - w / 2, py - h / 2, w, h);
        } else if (item.kind === KIND.VOID) {
          const radius = (w / 2) * scale * 0.72;
          context.strokeStyle = rgba(item.color, alpha * 0.55);
          context.lineWidth = Math.max(1, radius * 0.24);
          context.beginPath();
          context.arc(px, py, radius, 0, Math.PI * 2);
          context.stroke();
        } else {
          context.fillStyle = rgba(item.color, alpha);
          context.beginPath();
          const radiusFactor = item.kind === KIND.CELL ? 0.78 : 0.72;
          context.arc(px, py, (w / 2) * scale * radiusFactor, 0, Math.PI * 2);
          context.fill();
        }
      }
    },
    destroy() { /* nothing retained */ }
  };
}

/* ------------------------------------------------------------------ *
 * Mount
 * ------------------------------------------------------------------ */

export async function mountAdgCipher(canvas, providedWasmExports = null) {
  if (!canvas) return null;
  let analyzer = JS_ANALYZER;
  try {
    analyzer = await loadWasmAnalyzer(providedWasmExports);
  } catch (error) {
    canvas.dataset.analyzerError = error instanceof Error
      ? error.message
      : String(error);
  }

  const scene = buildScene(analyzer);
  const items = layout(scene);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stageRoot = canvas.closest(".cipher-stage");

  let painter = await createGpuPainter(canvas, scene, items);
  if (!painter) painter = createCanvasPainter(canvas, scene, items);
  if (!painter) return null;

  canvas.dataset.backend = painter.backend;
  canvas.dataset.loopSeconds = String(LOOP_SECONDS);
  canvas.dataset.verse = scene.reference;
  canvas.dataset.instances = String(items.length);
  canvas.dataset.analyzer = analyzer.kind;
  canvas.dataset.traceMode = scene.traceMode;
  canvas.dataset.voidReturn = analyzer.voidReturn;
  canvas.dataset.voidMemoryWrites = String(analyzer.voidMemoryWrites);
  if (stageRoot) stageRoot.dataset.analyzer = analyzer.kind;

  if (reduceMotion) {
    canvas.setAttribute(
      "aria-label",
      analyzer.kind === "wasm-i32"
        ? "Static reduced-motion frame of the WebAssembly-derived set-bit bloom. Animation is disabled; the verified trace_void contract is documented in the technical annex."
        : "Static reduced-motion fallback of the published flag pattern. WebAssembly is unavailable, so no trace_void memory claim is presented."
    );
  } else {
    canvas.setAttribute(
      "aria-label",
      analyzer.kind === "wasm-i32"
        ? "A deterministic five second replay: published flag octets are read, WebAssembly-derived bits bloom, the scene settles, then trace_void runs without changing WebAssembly linear memory or returning a value."
        : "A five second local fallback replay of the published flag pattern. WebAssembly is unavailable, so no trace_void memory claim is presented."
    );
  }

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    let width = Math.max(320, Math.round(rect.width * pixelRatio));
    let height = Math.max(140, Math.round(rect.height * pixelRatio));
    const areaScale = Math.min(
      1,
      Math.sqrt(MAX_BACKING_AREA / Math.max(1, width * height))
    );
    width = Math.max(320, Math.round(width * areaScale));
    height = Math.max(140, Math.round(height * areaScale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  };
  resize();

  let frame = 0;
  let visible = true;
  let running = false;
  let startedAt = 0;
  let painted = 0;
  let lastStage = "";
  let voidInvocations = 0;

  const paint = phase => {
    const stage = stageForPhase(phase);
    if (stage !== lastStage) {
      lastStage = stage;
      canvas.dataset.traceStage = stage;
      if (stageRoot) stageRoot.dataset.traceStage = stage;
      if (stage === "void") {
        const result = analyzer.traceVoid();
        if (result !== undefined) {
          canvas.dataset.voidError = "trace_void returned a value";
        }
        voidInvocations += 1;
        canvas.dataset.voidInvocations = String(voidInvocations);
      }
    }
    painter.draw(phase, reduceMotion ? 0 : 1, 1);
    painted += 1;
    canvas.dataset.frames = String(painted);
    canvas.dataset.phase = phase.toFixed(3);
  };

  const tick = now => {
    if (!running) return;
    if (painter.isLost()) { stop(); return; }
    if (!startedAt) startedAt = now;
    resize();
    const phase = ((now - startedAt) / (LOOP_SECONDS * 1000)) % 1;
    paint(phase);
    frame = requestAnimationFrame(tick);
  };

  function start() {
    if (running || reduceMotion || !visible) return;
    running = true;
    startedAt = 0;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  if (reduceMotion) {
    resize();
    paint(0.56);
  } else {
    start();
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) start(); else stop();
  }, { threshold: 0.01 });
  observer.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  addEventListener("resize", () => {
    if (!reduceMotion) return;
    if (resize()) paint(0.56);
  }, { passive: true });

  return { scene, painter, analyzer, start, stop };
}

export const CIPHER_FACTS = buildScene();
