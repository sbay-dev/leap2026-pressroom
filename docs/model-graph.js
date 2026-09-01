const stage = document.querySelector("[data-model-graph]");

if (stage) {
  mountModelGraph(stage).catch(error => {
    console.error("Measured model graph failed", error);
    stage.dataset.state = "failed";
    const status = stage.querySelector("[data-graph-status]");
    const fallback = stage.querySelector("[data-graph-fallback]");
    if (status) {
      status.textContent = document.body.classList.contains("lang-ar")
        ? "تعذر تحميل الرسم الهندسي المقاس. لم تُعرض بيانات بديلة على أنها دليل."
        : "The measured engineering graph could not be loaded. No substitute data was presented as evidence.";
    }
    fallback?.removeAttribute("hidden");
  });
}

async function mountModelGraph(root) {
  const canvas = root.querySelector("[data-graph-canvas]");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) throw new Error("Canvas2D is unavailable.");

  const [artifactResponse, integrityResponse] = await Promise.all([
    fetch("./assets/evidence/cns-model-graph-public.json", { cache: "no-store" }),
    fetch(
      "./assets/evidence/cns-model-graph-public.integrity.json",
      { cache: "no-store" }
    )
  ]);
  if (!artifactResponse.ok) {
    throw new Error(`Engineering graph HTTP ${artifactResponse.status}`);
  }
  if (!integrityResponse.ok) {
    throw new Error(`Engineering integrity HTTP ${integrityResponse.status}`);
  }

  const artifactBytes = await artifactResponse.arrayBuffer();
  const artifact = JSON.parse(new TextDecoder().decode(artifactBytes));
  const integrity = await integrityResponse.json();
  if (artifact.schema !== "sbay.cns-model-engineering-graph-public.v1") {
    throw new Error(`Unsupported graph schema ${artifact.schema}`);
  }
  if (integrity.schema !== "sbay.cns-model-engineering-graph-integrity.v1") {
    throw new Error(`Unsupported integrity schema ${integrity.schema}`);
  }

  const elements = {
    status: root.querySelector("[data-graph-status]"),
    frame: root.querySelector("[data-graph-frame]"),
    fps: root.querySelector("[data-graph-fps]"),
    count: root.querySelector("[data-graph-node-count]"),
    depth: root.querySelector("[data-graph-depth-count]"),
    proof: root.querySelector("[data-graph-proof-state]"),
    play: root.querySelector("[data-graph-play]"),
    reset: root.querySelector("[data-graph-reset]"),
    edges: root.querySelector("[data-graph-edges]"),
    timeline: root.querySelector("[data-graph-timeline]"),
    selectedDepth: root.querySelector("[data-graph-selected-depth]"),
    select: root.querySelector("[data-graph-block-select]"),
    verify: root.querySelector("[data-graph-verify]"),
    verification: root.querySelector("[data-graph-verification]"),
    name: root.querySelector("[data-graph-detail-name]"),
    operators: root.querySelector("[data-graph-detail-operators]"),
    depthRange: root.querySelector("[data-graph-detail-depth]"),
    initializers: root.querySelector("[data-graph-detail-initializers]"),
    edgesValue: root.querySelector("[data-graph-detail-edges]"),
    hash: root.querySelector("[data-graph-detail-hash]"),
    basis: root.querySelector("[data-graph-detail-basis]"),
    operatorList: root.querySelector("[data-graph-operator-list]"),
    fallback: root.querySelector("[data-graph-fallback]")
  };

  const blocks = artifact.publicLayout.blocks;
  const blockById = new Map(blocks.map(block => [block.id, block]));
  const points = buildPoints(artifact.publicLayout.depthLayers, blocks);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    paused: reducedMotion,
    visible: false,
    showEdges: true,
    zoom: 1,
    pan: 0,
    dragging: false,
    pointerX: 0,
    selectedBlockId: "all",
    selectedDepth: 0,
    frame: 0,
    frameHandle: 0,
    startedAt: performance.now(),
    lastFpsAt: performance.now(),
    framesSinceFps: 0,
    fps: 0
  };

  assertArtifact();
  root.dataset.state = "measured-engineering-graph";
  populateBlockSelect();
  updateStaticText();
  updateDetails();
  updatePlayButton();
  updateEdgesButton();

  elements.play?.addEventListener("click", () => {
    state.paused = !state.paused;
    updatePlayButton();
    requestRender();
  });
  elements.reset?.addEventListener("click", () => {
    state.zoom = 1;
    state.pan = 0;
    state.selectedDepth = 0;
    state.selectedBlockId = "all";
    if (elements.select) elements.select.value = "all";
    syncDepthControl();
    updateDetails();
    requestRender();
  });
  elements.edges?.addEventListener("click", () => {
    state.showEdges = !state.showEdges;
    updateEdgesButton();
    requestRender();
  });
  elements.timeline?.addEventListener("input", () => {
    state.paused = true;
    state.selectedDepth = Number(elements.timeline.value);
    syncDepthControl();
    updatePlayButton();
    updateDetails();
    requestRender();
  });
  elements.select?.addEventListener("change", () => {
    state.selectedBlockId = elements.select.value;
    updateDetails();
    requestRender();
  });
  elements.verify?.addEventListener("click", verifyArtifact);

  canvas.addEventListener("pointerdown", event => {
    state.dragging = true;
    state.pointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!state.dragging) return;
    const bounds = canvas.getBoundingClientRect();
    const delta = (event.clientX - state.pointerX) / Math.max(1, bounds.width);
    state.pan = clamp(state.pan - delta / state.zoom, 0, 1 - 1 / state.zoom);
    state.pointerX = event.clientX;
    requestRender();
  });
  canvas.addEventListener("pointerup", event => {
    state.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const previousZoom = state.zoom;
    state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * .001), 1, 5);
    if (state.zoom === 1) state.pan = 0;
    else {
      const bounds = canvas.getBoundingClientRect();
      const ratio = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      const worldAtPointer = state.pan + ratio / previousZoom;
      state.pan = clamp(
        worldAtPointer - ratio / state.zoom,
        0,
        1 - 1 / state.zoom
      );
    }
    requestRender();
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    const handled = new Set([
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "+", "=", "-", "0", " "
    ]);
    if (!handled.has(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") selectDepth(state.selectedDepth - 1);
    if (event.key === "ArrowRight") selectDepth(state.selectedDepth + 1);
    if (event.key === "ArrowUp") selectAdjacentBlock(-1);
    if (event.key === "ArrowDown") selectAdjacentBlock(1);
    if (event.key === "+" || event.key === "=") {
      state.zoom = clamp(state.zoom * 1.2, 1, 5);
    }
    if (event.key === "-") {
      state.zoom = clamp(state.zoom / 1.2, 1, 5);
      if (state.zoom === 1) state.pan = 0;
    }
    if (event.key === "0") {
      state.zoom = 1;
      state.pan = 0;
    }
    if (event.key === " ") {
      state.paused = !state.paused;
      updatePlayButton();
    }
    requestRender();
  });

  new IntersectionObserver(entries => {
    state.visible = entries.some(entry => entry.isIntersecting);
    requestRender();
  }, { threshold: .01 }).observe(canvas);
  document.addEventListener("visibilitychange", requestRender);
  new MutationObserver(() => {
    populateBlockSelect();
    updateStaticText();
    updateDetails();
    requestRender();
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });

  syncDepthControl();
  requestRender();

  function isArabic() {
    return document.body.classList.contains("lang-ar");
  }

  function text(arabic, english) {
    return isArabic() ? arabic : english;
  }

  function assertArtifact() {
    const operatorTotal = Object.values(artifact.graph.operatorCounts)
      .reduce((sum, count) => sum + count, 0);
    const blockTotal = blocks.reduce((sum, block) => sum + block.nodeCount, 0);
    const depthTotal = artifact.publicLayout.depthLayers
      .reduce((sum, layer) => sum + layer.nodeCount, 0);
    if (
      operatorTotal !== artifact.graph.nodeCount ||
      blockTotal !== artifact.graph.nodeCount ||
      depthTotal !== artifact.graph.nodeCount ||
      points.length !== artifact.graph.nodeCount
    ) {
      throw new Error("Engineering graph count contract failed.");
    }
    if (
      artifact.comparisonAvailability.authenticZeroCheckpoint !== "unavailable" ||
      artifact.comparisonAvailability.trainingEffectMetrics !== "not_computed" ||
      artifact.comparisonAvailability.neuralPersistence !== "not_computed"
    ) {
      throw new Error("Unsupported comparison claim in public artifact.");
    }
  }

  function updateStaticText() {
    const graph = artifact.graph;
    if (elements.status) {
      elements.status.textContent = text(
        `تم تحميل إسقاط هندسي مقاس من ONNX الحقيقي: ${formatInteger(graph.nodeCount)} عملية، ${formatInteger(graph.directedNodeTensorEdges)} حافة موتر، وعمق طوبولوجي أقصى ${formatInteger(graph.maximumTopologicalDepth)}.`,
        `Measured projection loaded from the authentic ONNX: ${formatInteger(graph.nodeCount)} operators, ${formatInteger(graph.directedNodeTensorEdges)} tensor edges, and maximum topological depth ${formatInteger(graph.maximumTopologicalDepth)}.`
      );
    }
    if (elements.count) {
      elements.count.textContent =
        `${formatInteger(graph.nodeCount)} ONNX OPS`;
    }
    if (elements.depth) {
      elements.depth.textContent =
        `DEPTH 0–${formatInteger(graph.maximumTopologicalDepth)}`;
    }
    if (elements.proof) {
      elements.proof.textContent =
        `STRUCT ${shortHash(artifact.canonicalStructure.sha256)}`;
    }
  }

  function populateBlockSelect() {
    if (!elements.select) return;
    const selected = state.selectedBlockId;
    const entries = [
      { id: "all", label: text("الرسم الكامل", "Full graph") },
      ...blocks.map(block => ({
        id: block.id,
        label: isArabic() ? block.nameAr : block.nameEn
      }))
    ];
    elements.select.replaceChildren(...entries.map(entry => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      return option;
    }));
    elements.select.value = entries.some(entry => entry.id === selected)
      ? selected
      : "all";
  }

  function updateDetails() {
    const selected = blockById.get(state.selectedBlockId);
    const depthLayer = artifact.publicLayout.depthLayers[state.selectedDepth];
    const nodeCount = selected?.nodeCount ?? artifact.graph.nodeCount;
    const depthRange = selected?.depthRange ??
      [0, artifact.graph.maximumTopologicalDepth];
    const initializerCount = selected?.initializerCount ??
      artifact.initializers.count;
    const initializerElements = selected?.initializerElements ??
      artifact.initializers.storedElementCount;

    setDetail(
      elements.name,
      selected
        ? (isArabic() ? selected.nameAr : selected.nameEn)
        : text("النموذج المدرّب V33", "Trained V33 model")
    );
    setDetail(
      elements.operators,
      text(
        `${formatInteger(nodeCount)} عملية · ${formatInteger(depthLayer.nodeCount)} عند العمق المحدد`,
        `${formatInteger(nodeCount)} operators · ${formatInteger(depthLayer.nodeCount)} at selected depth`
      )
    );
    setDetail(
      elements.depthRange,
      `${formatInteger(depthRange[0])}–${formatInteger(depthRange[1])}`
    );
    setDetail(
      elements.initializers,
      text(
        `${formatInteger(initializerCount)} موترًا · ${formatInteger(initializerElements)} عنصرًا مخزنًا`,
        `${formatInteger(initializerCount)} tensors · ${formatInteger(initializerElements)} stored elements`
      )
    );
    setDetail(
      elements.edgesValue,
      selected
        ? text(
          `داخلي ${formatInteger(selected.internalTensorEdges)} · داخل ${formatInteger(selected.incomingCrossBlockEdges)} · خارج ${formatInteger(selected.outgoingCrossBlockEdges)}`,
          `internal ${formatInteger(selected.internalTensorEdges)} · in ${formatInteger(selected.incomingCrossBlockEdges)} · out ${formatInteger(selected.outgoingCrossBlockEdges)}`
        )
        : text(
          `${formatInteger(artifact.graph.directedNodeTensorEdges)} حافة عقدية · ${formatInteger(artifact.graph.externalInputEdges.initializer_to_node)} من initializers`,
          `${formatInteger(artifact.graph.directedNodeTensorEdges)} node edges · ${formatInteger(artifact.graph.externalInputEdges.initializer_to_node)} from initializers`
        )
    );
    setDetail(elements.hash, shortHash(artifact.canonicalStructure.sha256, 20));
    setDetail(
      elements.basis,
      selected
        ? text(
          `كتلة عرض مشتقة من عضوية DAG الحقيقية وبادئات الأسماء داخل التدقيق الخاص. اللون يعرّف الكتلة فقط، ولا يمثل جودة أو تغيرًا بالتدريب.`,
          `Renderer block derived from authentic DAG membership and private-audit name prefixes. Color identifies the block only; it is not quality or training-change magnitude.`
        )
        : text(
          `كل نقطة تقابل عملية ONNX حقيقية عند عمقها الطوبولوجي. التوصيلات الدقيقة والأسماء محجوبة؛ الخطوط تنشر أعداد الحواف المجمعة بين الكتل فقط.`,
          `Every point corresponds to an authentic ONNX operator at its topological depth. Exact names and wiring are withheld; lines publish only aggregate block-edge counts.`
        )
    );
    if (elements.operatorList) {
      const counts = selected?.operatorCounts ?? artifact.graph.operatorCounts;
      const entries = Object.entries(counts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 8);
      elements.operatorList.replaceChildren(...entries.map(([name, count]) => {
        const item = document.createElement("li");
        const label = document.createElement("span");
        const value = document.createElement("strong");
        label.textContent = name;
        value.textContent = formatInteger(count);
        item.append(label, value);
        return item;
      }));
    }
  }

  function setDetail(element, value) {
    if (element) element.textContent = value || "—";
  }

  function updatePlayButton() {
    if (!elements.play) return;
    elements.play.setAttribute("aria-pressed", String(!state.paused));
    elements.play.textContent = state.paused
      ? text("تشغيل مسح العمق", "Start depth scan")
      : text("إيقاف المسح", "Pause scan");
  }

  function updateEdgesButton() {
    if (!elements.edges) return;
    elements.edges.setAttribute("aria-pressed", String(state.showEdges));
    elements.edges.textContent = state.showEdges
      ? text("إخفاء الحواف المجمعة", "Hide aggregate edges")
      : text("إظهار الحواف المجمعة", "Show aggregate edges");
  }

  function selectDepth(depth) {
    state.paused = true;
    state.selectedDepth = clamp(
      depth,
      0,
      artifact.graph.maximumTopologicalDepth
    );
    syncDepthControl();
    updatePlayButton();
    updateDetails();
  }

  function selectAdjacentBlock(delta) {
    const ids = ["all", ...blocks.map(block => block.id)];
    const index = ids.indexOf(state.selectedBlockId);
    state.selectedBlockId = ids[
      (index + delta + ids.length) % ids.length
    ];
    if (elements.select) elements.select.value = state.selectedBlockId;
    updateDetails();
  }

  function syncDepthControl() {
    if (elements.timeline) {
      elements.timeline.max = String(artifact.graph.maximumTopologicalDepth);
      elements.timeline.value = String(state.selectedDepth);
    }
    if (elements.selectedDepth) {
      elements.selectedDepth.textContent = text(
        `العمق ${formatInteger(state.selectedDepth)}`,
        `Depth ${formatInteger(state.selectedDepth)}`
      );
    }
  }

  function requestRender() {
    if (state.frameHandle || !state.visible || document.hidden) return;
    state.frameHandle = requestAnimationFrame(render);
  }

  function render(now) {
    state.frameHandle = 0;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    if (!state.paused) {
      const elapsed = now - state.startedAt;
      state.selectedDepth = Math.floor(elapsed / 120) %
        (artifact.graph.maximumTopologicalDepth + 1);
      syncDepthControl();
      updateDetails();
    }

    context.clearRect(0, 0, width, height);
    drawBackdrop(width, height);
    const plot = plotBounds(width, height);
    drawDepthGrid(plot);
    drawLanes(plot);
    if (state.showEdges) drawAggregateEdges(plot);
    drawOperatorPoints(plot, now);
    drawDepthScan(plot);
    drawInterface(plot);
    drawLegend(width, height);

    state.frame += 1;
    state.framesSinceFps += 1;
    if (now - state.lastFpsAt >= 1000) {
      state.fps = state.framesSinceFps * 1000 / (now - state.lastFpsAt);
      state.framesSinceFps = 0;
      state.lastFpsAt = now;
    }
    if (elements.frame) {
      elements.frame.textContent = `DRAW ${String(state.frame).padStart(6, "0")}`;
    }
    if (elements.fps) {
      elements.fps.textContent = state.paused
        ? "DEPTH SCAN PAUSED"
        : `${Math.round(state.fps || 0)} FPS · MEASURED LAYOUT`;
    }
    if (state.visible && !document.hidden && !state.paused) requestRender();
  }

  function plotBounds(width, height) {
    const compact = width < 760;
    return {
      left: compact ? 82 : 132,
      right: width - (compact ? 18 : 36),
      top: compact ? 62 : 72,
      bottom: height - (compact ? 58 : 72)
    };
  }

  function drawBackdrop(width, height) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#071226");
    gradient.addColorStop(.55, "#091a31");
    gradient.addColorStop(1, "#040815");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  function drawDepthGrid(plot) {
    context.save();
    context.strokeStyle = "rgba(121, 218, 255, .09)";
    context.fillStyle = "#7893aa";
    context.font = `${Math.max(10, canvas.width / 105)}px Consolas, monospace`;
    context.textAlign = "center";
    context.textBaseline = "top";
    const interval = canvas.width < 760 ? 24 : 12;
    for (
      let depth = 0;
      depth <= artifact.graph.maximumTopologicalDepth;
      depth += interval
    ) {
      const x = depthToX(depth, plot);
      context.beginPath();
      context.moveTo(x, plot.top);
      context.lineTo(x, plot.bottom);
      context.stroke();
      context.fillText(String(depth), x, plot.bottom + 10);
    }
    context.restore();
  }

  function drawLanes(plot) {
    const laneHeight = (plot.bottom - plot.top) / blocks.length;
    context.save();
    for (const block of blocks) {
      const y = plot.top + laneHeight * block.lane;
      const selected =
        state.selectedBlockId === "all" ||
        state.selectedBlockId === block.id;
      context.fillStyle = hexAlpha(block.color, selected ? .055 : .018);
      context.fillRect(
        plot.left,
        y,
        plot.right - plot.left,
        laneHeight
      );
      context.strokeStyle = "rgba(121, 218, 255, .08)";
      context.beginPath();
      context.moveTo(plot.left, y + laneHeight);
      context.lineTo(plot.right, y + laneHeight);
      context.stroke();
      context.fillStyle = selected ? block.color : "#607689";
      context.font = `700 ${Math.max(10, canvas.width / 105)}px "Segoe UI", Tahoma, sans-serif`;
      context.textAlign = "right";
      context.textBaseline = "middle";
      const label = isArabic() ? block.nameAr : block.nameEn;
      context.fillText(
        shorten(label, canvas.width < 760 ? 12 : 20),
        plot.left - 10,
        y + laneHeight / 2
      );
    }
    context.restore();
  }

  function drawAggregateEdges(plot) {
    const laneHeight = (plot.bottom - plot.top) / blocks.length;
    context.save();
    context.globalCompositeOperation = "screen";
    for (const [index, edge] of artifact.publicLayout.blockEdges.entries()) {
      const source = blockById.get(edge.sourceBlock);
      const target = blockById.get(edge.targetBlock);
      if (!source || !target) continue;
      const selected =
        state.selectedBlockId === "all" ||
        state.selectedBlockId === source.id ||
        state.selectedBlockId === target.id;
      const sourceY = plot.top + laneHeight * (source.lane + .5);
      const targetY = plot.top + laneHeight * (target.lane + .5);
      const x = plot.left + (plot.right - plot.left) *
        (.08 + (index % 6) * .145);
      const width = 1 + Math.log2(edge.count + 1) * .42;
      context.strokeStyle = hexAlpha(source.color, selected ? .24 : .055);
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(x, sourceY);
      context.bezierCurveTo(
        x + (plot.right - plot.left) * .055,
        sourceY,
        x + (plot.right - plot.left) * .055,
        targetY,
        x,
        targetY
      );
      context.stroke();
    }
    context.restore();
  }

  function drawOperatorPoints(plot, now) {
    const laneHeight = (plot.bottom - plot.top) / blocks.length;
    const activeDepth = state.selectedDepth;
    context.save();
    for (const point of points) {
      const block = blockById.get(point.blockId);
      const selected =
        state.selectedBlockId === "all" ||
        state.selectedBlockId === point.blockId;
      const active = point.depth === activeDepth;
      const x = depthToX(point.depth + point.offsetX, plot);
      if (x < plot.left - 5 || x > plot.right + 5) continue;
      const y = plot.top + laneHeight *
        (block.lane + .5 + point.offsetY * .72);
      const radius = active
        ? Math.max(2.5, canvas.width / 390)
        : Math.max(1, canvas.width / 1300);
      context.fillStyle = hexAlpha(
        block.color,
        active ? 1 : selected ? .72 : .12
      );
      if (active) {
        context.shadowColor = block.color;
        context.shadowBlur = radius * (4 + Math.sin(now * .004) * .7);
      } else {
        context.shadowBlur = 0;
      }
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawDepthScan(plot) {
    const x = depthToX(state.selectedDepth, plot);
    const layer = artifact.publicLayout.depthLayers[state.selectedDepth];
    context.save();
    const gradient = context.createLinearGradient(x, plot.top, x, plot.bottom);
    gradient.addColorStop(0, "rgba(244, 199, 103, 0)");
    gradient.addColorStop(.2, "rgba(244, 199, 103, .85)");
    gradient.addColorStop(.8, "rgba(244, 199, 103, .85)");
    gradient.addColorStop(1, "rgba(244, 199, 103, 0)");
    context.strokeStyle = gradient;
    context.lineWidth = Math.max(1.5, canvas.width / 720);
    context.beginPath();
    context.moveTo(x, plot.top);
    context.lineTo(x, plot.bottom);
    context.stroke();
    context.fillStyle = "#f4c767";
    context.font = `700 ${Math.max(10, canvas.width / 95)}px Consolas, monospace`;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(
      `D${state.selectedDepth} · ${layer.nodeCount} OPS`,
      x,
      plot.top - 10
    );
    context.restore();
  }

  function drawInterface(plot) {
    context.save();
    context.fillStyle = "rgba(88, 221, 255, .12)";
    context.strokeStyle = "rgba(88, 221, 255, .45)";
    context.lineWidth = 1;
    roundedRect(context, plot.left + 8, plot.top + 8, 98, 30, 8);
    context.fill();
    context.stroke();
    context.fillStyle = "#bdeeff";
    context.font = `700 ${Math.max(9, canvas.width / 115)}px Consolas, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("4 INPUTS · 128", plot.left + 57, plot.top + 23);

    const outputWidth = 124;
    roundedRect(
      context,
      plot.right - outputWidth - 8,
      plot.bottom - 38,
      outputWidth,
      30,
      8
    );
    context.fillStyle = "rgba(178, 140, 255, .12)";
    context.strokeStyle = "rgba(178, 140, 255, .55)";
    context.fill();
    context.stroke();
    context.fillStyle = "#ddcfff";
    context.fillText(
      "OUTPUT · [B,768]",
      plot.right - outputWidth / 2 - 8,
      plot.bottom - 23
    );
    context.restore();
  }

  function drawLegend(width, height) {
    context.save();
    context.fillStyle = "rgba(4, 8, 21, .78)";
    context.fillRect(16, 14, Math.min(width - 32, 620), 34);
    context.fillStyle = "#9cb4c8";
    context.font = `${Math.max(9, width / 115)}px Consolas, monospace`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      "AUTHENTIC ONNX · AGGREGATE PUBLIC PROJECTION · Z UNUSED",
      28,
      31
    );
    context.fillStyle = "#f4c767";
    context.fillRect(18, height - 18, Math.max(34, width * .07), 2);
    context.fillStyle = "#9cb4c8";
    context.fillText(
      "gold = topological-depth scan, not inference",
      28 + Math.max(34, width * .07),
      height - 17
    );
    context.restore();
  }

  function depthToX(depth, plot) {
    const normalized = depth / artifact.graph.maximumTopologicalDepth;
    const visible = (normalized - state.pan) * state.zoom;
    return plot.left + visible * (plot.right - plot.left);
  }

  async function verifyArtifact() {
    elements.verify?.setAttribute("disabled", "");
    if (elements.verification) {
      elements.verification.textContent = text(
        "جارٍ إعادة حساب SHA-256 واتساق العدّ داخل المتصفح…",
        "Recomputing SHA-256 and count consistency in the browser…"
      );
    }
    try {
      const digest = await sha256Hex(artifactBytes);
      assertArtifact();
      const valid =
        digest === integrity.artifact.sha256 &&
        artifactBytes.byteLength === integrity.artifact.bytes &&
        artifact.sourceAudit.sha256 === integrity.sourceAudit.sha256 &&
        artifact.canonicalStructure.sha256 ===
          integrity.canonicalStructure.sha256;
      if (elements.verification) {
        elements.verification.textContent = valid
          ? text(
            "نجح: ملف العرض وبصمة التدقيق والبنية والعدّ متطابقة.",
            "Passed: the display artifact, audit identity, structure hash, and counts match."
          )
          : text(
            "فشل التحقق؛ لا تُعامل اللوحة بوصفها دليلًا سليمًا.",
            "Verification failed; do not treat this panel as valid evidence."
          );
      }
      if (elements.proof) {
        elements.proof.textContent = valid ? "ARTIFACT OK" : "ARTIFACT FAIL";
      }
    } catch (error) {
      console.error("Engineering graph verification failed", error);
      if (elements.verification) {
        elements.verification.textContent = text(
          "تعذر إكمال التحقق في هذا المتصفح.",
          "This browser could not complete verification."
        );
      }
      if (elements.proof) elements.proof.textContent = "ARTIFACT ERROR";
    } finally {
      elements.verify?.removeAttribute("disabled");
    }
  }
}

function buildPoints(depthLayers, blocks) {
  const points = [];
  for (const layer of depthLayers) {
    for (const block of blocks) {
      const count = layer.blocks[block.id] || 0;
      for (let index = 0; index < count; index += 1) {
        const seed = hashSeed(layer.depth, block.lane, index);
        points.push({
          blockId: block.id,
          depth: layer.depth,
          offsetX: (pseudo(seed) - .5) * .72,
          offsetY: pseudo(seed + 1) - .5
        });
      }
    }
  }
  return points;
}

function hashSeed(depth, lane, index) {
  return (depth + 1) * 73856093 ^
    (lane + 1) * 19349663 ^
    (index + 1) * 83492791;
}

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatInteger(value) {
  const locale = document.body.classList.contains("lang-ar")
    ? "ar-SA"
    : "en";
  return Number(value).toLocaleString(locale);
}

function shortHash(value, length = 12) {
  if (!value) return "—";
  return `${value.slice(0, length)}…${value.slice(-6)}`;
}

function shorten(value, length) {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(1, length - 1))}…`;
}

function hexAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const bigint = Number.parseInt(value, 16);
  const red = bigint >> 16 & 255;
  const green = bigint >> 8 & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}
