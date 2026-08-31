/*
 * ADG Cipher -> Bloom
 * A faithful port of the original CNS "Flower Bloom Cipher" study published at
 * https://sbay-dev.github.io/sarmadAi/ , with the real numbers applied to it.
 *
 * Nothing here is invented for decoration:
 *   - the lattice is 23 columns by 8 rows, the 184 flag bits of one parsed verse
 *   - a column blooms only where its bit is set
 *   - the petal count of a flower equals the population count of that unit
 *   - the cipher label above a column is that unit's flag byte in hexadecimal
 *
 * The verse itself is never typed into this file. Only the derived byte values
 * are published, and they come from the public Unicode scalar of each classical
 * rasm unit. No proprietary mask table, routing rule, threshold or weight is
 * present. The verse image is reproduced in the annex from a public domain
 * manuscript, never redrawn here.
 */

const LOOP_SECONDS = 5;
const MAX_BACKING_PIXELS = 1024;

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

const PALETTE = {
  rasm: [0.90, 0.97, 1.0],
  clearBit: [0.20, 0.34, 0.52],
  stage: [0.55, 0.75, 0.95],
  packet: [0.96, 0.78, 0.4],
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
  BIT: 1,
  PETAL: 2,
  STAGE: 3,
  PACKET: 4,
  VOID: 5,
  RULE: 6,
  STREAM: 7,
  CELL: 8
};

/** Builds the deterministic scene model shared by both painters. */
export function buildScene() {
  const units = [];
  RASM.words.forEach((word, wordIndex) => {
    word.flags.forEach((flag, glyphIndex) => {
      units.push({
        wordIndex,
        glyphIndex,
        flag,
        // Petals of this unit's flower: the bits that caused the interaction.
        petals: popcount(flag),
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
    ratio: totalUtf8 / units.length
  };
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

/**
 * Places every drawable in clip space. Arabic reads right to left, so unit 0
 * sits at the right edge. Rows run from the most significant bit downwards, so
 * a cell's row is its bit position and its column is its assembly position.
 */
function layout(scene) {
  const items = [];
  const columns = scene.units.length;
  const rows = 8;
  const halfWidth = 0.93;
  const stepX = (halfWidth * 2) / columns;
  const columnX = index => halfWidth - stepX * (index + 0.5);

  const latticeTop = -0.46;
  const stepY = 0.145;
  const cellSize = stepX * 0.34;

  scene.units.forEach((unit, index) => {
    const x = columnX(index);
    const tint = PALETTE.words[unit.wordIndex];

    // Cipher layer: the real flag byte, in the place the original study drew a
    // random character before it resolved into a flower.
    items.push({
      kind: KIND.GLYPH, x, y: latticeTop - stepY * 1.05,
      w: stepX * 1.1, h: stepY * 0.52,
      color: PALETTE.rasm, seed: index,
      t0: 0.01 + index * 0.008, span: 0.18,
      atlas: index, value: 1, to: null
    });

    for (let bit = 7; bit >= 0; bit -= 1) {
      const set = (unit.flag >> bit) & 1;
      const row = 7 - bit;
      const y = latticeTop + row * stepY;

      // Permanent lattice: every one of the 184 flag positions is drawn.
      items.push({
        kind: KIND.CELL, x, y,
        w: cellSize, h: cellSize,
        color: PALETTE.clearBit, seed: index * 8 + row,
        t0: 0, span: 0.001,
        atlas: -1, value: 0, to: null
      });

      if (!set) continue;

      const t0 = 0.16 + index * 0.0155 + row * 0.006;
      // A flower opens only where a bit is set, and only with as many petals
      // as there are set bits in the byte that produced it. Each petal is an
      // ellipse offset outward along its own angle, exactly as the original.
      const reach = stepX * 0.92;
      for (let petal = 0; petal < unit.petals; petal += 1) {
        const angle = (Math.PI * 2 / unit.petals) * petal + (index + row) * 0.21;
        items.push({
          kind: KIND.PETAL, x, y,
          w: reach * 1.2, h: reach * 0.5,
          color: tint, seed: index * 8 + row + petal,
          t0: t0 + 0.02, span: 0.3,
          atlas: -1, value: 1,
          to: [x + Math.cos(angle) * reach * 0.5, y + Math.sin(angle) * reach * 0.5],
          rotation: angle
        });
      }
      items.push({
        kind: KIND.BIT, x, y,
        w: cellSize * 1.15, h: cellSize * 1.15,
        color: tint, seed: index * 8 + row,
        t0, span: 0.16,
        atlas: -1, value: 1, to: null
      });
    }
  });

  // One rule per word: five ordered blocks, the shape the abstraction reads.
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
      y: latticeTop + stepY * 7.7,
      w: right - left, h: 0.006,
      color: PALETTE.words[wordIndex], seed: wordIndex,
      t0: 0.1 + wordIndex * 0.02, span: 0.2,
      atlas: -1, value: 1, to: null
    });
  });

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
  reserved : f32,
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
  var scale = mix(0.35, 1.0, grow);
  var offset = vec2f(0.0, 0.0);
  var energy = grow;
  let breathe = sin((uniforms.phase * 6.2831853) + seed * 0.45);

  if (kind < 0.5) {
    // Rasm glyph: permanent stage, never cycles.
    scale = 1.0;
    energy = 1.0;
  } else if (kind < 1.5) {
    // Lit flag cell: rises, holds, then is consumed by the transport stream.
    scale = mix(0.1, 1.0, grow);
    energy = grow * (1.0 - smoothstep(0.80, 0.96, uniforms.phase));
  } else if (kind < 2.5) {
    // Bloom petal: opens outward along its own angle and keeps a slow breath.
    scale = grow * (1.0 + breathe * 0.06 * uniforms.intensity);
    offset = (vec2f(rect.x, rect.y) - center) * grow;
    energy = grow * (1.0 - smoothstep(0.78, 0.94, uniforms.phase));
  } else if (kind < 3.5) {
    // Pipeline stage: permanent.
    scale = 1.0;
    energy = 1.0;
  } else if (kind < 4.5) {
    // Packet: travels the lane right to left, then leaves through void.
    let travel = easeOut((uniforms.phase - t0) / span);
    offset.x = -travel * seed;
    energy = grow * (1.0 - smoothstep(0.82, 1.0, travel));
  } else if (kind < 5.5) {
    // Void return dashes: light only while the packet leaves.
    scale = mix(0.4, 1.0, grow);
    energy = grow * (1.0 - smoothstep(0.90, 0.995, uniforms.phase));
  } else if (kind < 6.5) {
    // Word rule: permanent.
    scale = 1.0;
    energy = 1.0;
  } else if (kind < 7.5) {
    // Transport stream: the flag columns converge on the pipeline entry.
    let travel = easeOut((uniforms.phase - t0) / span);
    offset = (vec2f(rect.x, rect.y) - center) * travel;
    energy = grow * (1.0 - smoothstep(0.72, 1.0, travel));
    scale = mix(0.5, 1.0, grow);
  } else {
    // Unlit lattice cell: permanent grid.
    scale = 1.0;
    energy = 1.0;
  }

  var local = corner * size * scale;
  // Non glyph instances may carry a rotation in the spare atlas slot.
  if (kind > 0.5 && rect.z != 0.0) {
    let c = cos(rect.z);
    let s = sin(rect.z);
    local = vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
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
    let d = roundedBox(input.local, 0.42);
    alpha = 1.0 - smoothstep(-0.06, 0.06, d);
  } else if (kind > 7.5) {
    let d = roundedBox(input.local, 0.42);
    alpha = 1.0 - smoothstep(-0.06, 0.06, d);
  } else if (kind < 2.5) {
    // One elliptical petal, the shape the original study drew per petal.
    let r = length(input.local);
    alpha = (1.0 - smoothstep(0.55, 1.0, r)) * 0.5;
  } else if (kind < 3.5) {
    let d = roundedBox(input.local, 0.3);
    let border = 1.0 - smoothstep(0.0, 0.05, abs(d + 0.02));
    let fill = (1.0 - smoothstep(-0.05, 0.05, d)) * 0.12;
    alpha = max(border, fill);
  } else if (kind < 4.5) {
    let r = length(input.local);
    alpha = (1.0 - smoothstep(0.1, 0.6, r)) + (1.0 - smoothstep(0.2, 1.0, r)) * 0.5;
  } else {
    let d = roundedBox(input.local, 0.5);
    alpha = 1.0 - smoothstep(-0.1, 0.1, d);
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
      : [item.to?.[0] ?? 0, item.to?.[1] ?? 0, item.rotation ?? 0, 0];
    const alpha = item.kind === KIND.CELL ? 0.5
      : item.kind === KIND.GLYPH ? 0.42
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
    data[base + 9] = item.kind === KIND.PACKET ? item.value : item.seed;
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
    lost = true;
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
  const smoothLoop = (value, from, to) => {
    const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
    return t * t * (3 - 2 * t);
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
      const unit = Math.min(width, height) * 0.5;

      context.clearRect(0, 0, width, height);
      context.textAlign = "center";
      context.textBaseline = "middle";

      for (const item of items) {
        const grow = easeOut((phase - item.t0) / item.span);
        const permanent = item.kind === KIND.GLYPH || item.kind === KIND.STAGE
          || item.kind === KIND.RULE || item.kind === KIND.CELL;
        if (!permanent && grow <= 0.001) continue;
        let energy = permanent ? 1 : grow * fade;
        let x = item.x;
        let y = item.y;
        if (item.kind === KIND.BIT) {
          energy = grow * fade * (1 - smoothLoop(phase, 0.80, 0.96));
        } else if (item.kind === KIND.PETAL) {
          energy = grow * fade * (1 - smoothLoop(phase, 0.78, 0.94));
        } else if (item.kind === KIND.VOID) {
          energy = grow * fade * (1 - smoothLoop(phase, 0.90, 0.995));
        } else if (item.kind === KIND.PACKET) {
          const travel = easeOut((phase - item.t0) / item.span);
          x -= travel * item.value;
          energy = grow * fade * (1 - Math.min(1, Math.max(0, (travel - 0.82) / 0.18)));
        } else if (item.kind === KIND.STREAM && item.to) {
          const travel = easeOut((phase - item.t0) / item.span);
          x += (item.to[0] - item.x) * travel;
          y += (item.to[1] - item.y) * travel;
          energy = grow * fade * (1 - Math.min(1, Math.max(0, (travel - 0.72) / 0.28)));
        }
        if (energy <= 0.001) continue;

        const alpha = item.kind === KIND.CELL ? energy * 0.5
          : item.kind === KIND.GLYPH ? energy * 0.42
            : energy;
        const px = toX(x);
        const py = toY(y);
        const w = item.w * unit;
        const h = item.h * unit;

        if (item.kind === KIND.GLYPH) {
          context.fillStyle = rgba(item.color, alpha);
          context.font = `600 ${h * 0.62}px ui-monospace, Consolas, monospace`;
          context.fillText(scene.units[item.atlas].label, px, py);
        } else if (item.kind === KIND.PETAL) {
          const breathe = 1 + Math.sin(phase * 6.2831853 + item.seed * 0.45) * 0.06 * intensity;
          const spread = grow;
          const cx = toX(item.x + ((item.to?.[0] ?? item.x) - item.x) * spread);
          const cy = toY(item.y + ((item.to?.[1] ?? item.y) - item.y) * spread);
          context.save();
          context.translate(cx, cy);
          context.rotate(item.rotation ?? 0);
          context.fillStyle = rgba(item.color, alpha * 0.5);
          context.beginPath();
          context.ellipse(0, 0, (w / 2) * grow * breathe, (h / 2) * grow * breathe, 0, 0, Math.PI * 2);
          context.fill();
          context.restore();
        } else if (item.kind === KIND.PACKET) {
          const gradient = context.createRadialGradient(px, py, 0, px, py, w / 2);
          gradient.addColorStop(0, rgba(item.color, alpha));
          gradient.addColorStop(1, rgba(item.color, 0));
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(px, py, w / 2, 0, Math.PI * 2);
          context.fill();
        } else if (item.kind === KIND.STAGE) {
          context.strokeStyle = rgba(item.color, alpha);
          context.lineWidth = Math.max(1, unit * 0.004);
          context.strokeRect(px - w / 2, py - h / 2, w, h);
        } else {
          const scale = item.kind === KIND.BIT ? grow : 1;
          context.save();
          context.translate(px, py);
          if (item.rotation) context.rotate(item.rotation);
          context.fillStyle = rgba(item.color, alpha);
          context.fillRect(
            -(w * scale) / 2,
            -(h * scale) / 2,
            w * scale,
            h * scale
          );
          context.restore();
        }
      }
    },
    destroy() { /* nothing retained */ }
  };
}

/* ------------------------------------------------------------------ *
 * Mount
 * ------------------------------------------------------------------ */

export async function mountAdgCipher(canvas) {
  if (!canvas) return null;
  const scene = buildScene();
  const items = layout(scene);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let painter = await createGpuPainter(canvas, scene, items);
  if (!painter) painter = createCanvasPainter(canvas, scene, items);
  if (!painter) return null;

  canvas.dataset.backend = painter.backend;
  canvas.dataset.loopSeconds = String(LOOP_SECONDS);
  canvas.dataset.verse = scene.reference;
  canvas.dataset.instances = String(items.length);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const side = Math.min(
      MAX_BACKING_PIXELS,
      Math.max(320, Math.round(Math.min(rect.width, rect.height || rect.width) * ratio))
    );
    if (canvas.width !== side || canvas.height !== side) {
      canvas.width = side;
      canvas.height = side;
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

  const paint = phase => {
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
    paint(0.62);
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
    if (resize()) paint(0.62);
  }, { passive: true });

  return { scene, painter, start, stop };
}

export const CIPHER_FACTS = buildScene();
