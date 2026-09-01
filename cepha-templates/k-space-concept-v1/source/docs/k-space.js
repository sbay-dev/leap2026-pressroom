const stage = document.querySelector("[data-k-space]");

if (stage) {
  mountKSpace(stage).catch(error => {
    console.error("K-space live renderer failed", error);
    stage.dataset.state = "failed";
    const status = stage.querySelector("[data-k-status]");
    if (status) {
      status.textContent = document.body.classList.contains("lang-ar")
        ? "تعذر تحميل دليل K-space؛ لم تُعرض بيانات بديلة."
        : "K-space evidence could not be loaded; no substitute data was shown.";
    }
  });
}

async function mountKSpace(root) {
  const canvas = root.querySelector("[data-k-canvas]");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) throw new Error("Canvas2D is unavailable.");

  const response = await fetch(
    "./assets/evidence/cns-k-space-public.json",
    { cache: "no-store" }
  );
  if (!response.ok) throw new Error(`K-space evidence HTTP ${response.status}`);
  const evidence = await response.json();
  if (evidence.schema !== "sbay.cns-k-space-public.v1") {
    throw new Error(`Unsupported K-space schema ${evidence.schema}`);
  }

  const elements = {
    status: root.querySelector("[data-k-status]"),
    frame: root.querySelector("[data-k-frame]"),
    fps: root.querySelector("[data-k-fps]"),
    count: root.querySelector("[data-k-node-count]"),
    proofState: root.querySelector("[data-k-proof-state]"),
    play: root.querySelector("[data-k-play]"),
    reset: root.querySelector("[data-k-reset]"),
    surface: root.querySelector("[data-k-surface]"),
    timeline: root.querySelector("[data-k-timeline]"),
    select: root.querySelector("[data-k-node-select]"),
    verify: root.querySelector("[data-k-verify]"),
    verification: root.querySelector("[data-k-verification]"),
    name: root.querySelector("[data-k-detail-name]"),
    type: root.querySelector("[data-k-detail-type]"),
    coordinates: root.querySelector("[data-k-detail-coordinates]"),
    hamming: root.querySelector("[data-k-detail-hamming]"),
    timing: root.querySelector("[data-k-detail-timing]"),
    merkle: root.querySelector("[data-k-detail-merkle]"),
    basis: root.querySelector("[data-k-detail-basis]")
  };

  const colors = {
    "v7-zero": "#8595a8",
    "v7-trained": "#f35bd5",
    cgn: "#f4c767",
    cns: "#55ead7",
    vector: "#71e6ff",
    origin: "#ffffff"
  };
  const networkNames = {
    "v7-zero": ["مرجع V7 الصفري", "V7 zero reference"],
    "v7-trained": ["V7/P33 المدرّب", "V7/P33 trained"],
    cgn: ["شبكة CGN", "CGN network"],
    cns: ["عقد CNS v2.1", "CNS v2.1 contract"]
  };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    rotationX: -.44,
    rotationY: .58,
    zoom: 1,
    dragging: false,
    moved: false,
    pointer: null,
    paused: reducedMotion,
    showSurface: true,
    visible: false,
    frame: 0,
    frameHandle: 0,
    startedAt: performance.now(),
    lastFpsAt: performance.now(),
    framesSinceFps: 0,
    fps: 0,
    selectedKey: null,
    projectedItems: []
  };
  const rotate = point =>
    rotatePoint(point, state.rotationX, state.rotationY);
  const project = (point, width, height) => {
    const depth = Math.max(2.4, 7.5 + point.z);
    const scale = Math.min(width, height) * .9 / depth * state.zoom;
    return {
      x: width / 2 + point.x * scale,
      y: height * .47 + point.y * scale,
      z: point.z,
      scale
    };
  };

  const networks = (evidence.networks || []).map((network, index) => {
    const anchor = network.visualAnchor || {
      x: Math.cos(index * Math.PI / 2),
      y: Math.sin(index * Math.PI / 2),
      z: 0
    };
    return {
      key: `network:${network.id}`,
      type: "network",
      id: network.id,
      label: network.displayName,
      status: network.status,
      metrics: network.metrics || [],
      claimBoundary: network.claimBoundary,
      basis: network.claimBoundary,
      color: colors[network.id] || "#b28cff",
      unavailable: network.status === "unavailable",
      world: {
        x: anchor.x * 2.45,
        y: anchor.y * 1.15 + .35,
        z: anchor.z * 2.1
      }
    };
  });

  const vectorNodes = (evidence.nodeGraph?.nodes || []).map(node => {
    const x = Number(node.coordinates?.x || 0);
    const y = Number(node.coordinates?.y || 0);
    const z = Number(node.coordinates?.z || 0);
    const worldX = x * 3.4 - 1.7;
    const worldZ = y * 3.4 - 1.7;
    return {
      key: `node:${node.index}`,
      type: "node",
      id: String(node.index),
      label: node.label || `Vector ${Number(node.index) + 1}`,
      status: evidence.nodeGraph.status,
      color: node.index === 0 ? colors.origin : colors.vector,
      unavailable: false,
      node,
      basis: node.sourceBasis,
      world: {
        x: worldX,
        y: saddleHeight(worldX, worldZ) + .28 + z * 1.8,
        z: worldZ
      }
    };
  });
  const selectable = vectorNodes.length > 0 ? vectorNodes : networks;

  root.dataset.state = evidence.nodeGraph?.status === "detected"
    ? "measured"
    : "network-evidence";
  updateStaticStatus();
  populateSelect();
  selectItem(
    vectorNodes[0]?.key ||
    networks.find(network => network.id === "v7-trained")?.key ||
    networks[0]?.key
  );

  elements.play?.addEventListener("click", () => {
    state.paused = !state.paused;
    updatePlayButton();
    requestRender();
  });
  elements.reset?.addEventListener("click", () => {
    state.rotationX = -.44;
    state.rotationY = .58;
    state.zoom = 1;
    requestRender();
  });
  elements.surface?.addEventListener("click", () => {
    state.showSurface = !state.showSurface;
    elements.surface.setAttribute("aria-pressed", String(state.showSurface));
    updateSurfaceButton();
    requestRender();
  });
  elements.timeline?.addEventListener("input", () => {
    const index = Number(elements.timeline.value);
    selectItem(selectable[index]?.key);
  });
  elements.select?.addEventListener("change", () => {
    selectItem(elements.select.value);
  });
  elements.verify?.addEventListener("click", verifySelection);

  canvas.addEventListener("pointerdown", event => {
    state.dragging = true;
    state.moved = false;
    state.pointer = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!state.dragging || !state.pointer) return;
    const dx = event.clientX - state.pointer.x;
    const dy = event.clientY - state.pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
    state.rotationY += dx * .007;
    state.rotationX = clamp(state.rotationX + dy * .007, -1.15, 1.15);
    state.pointer = { x: event.clientX, y: event.clientY };
    requestRender();
  });
  canvas.addEventListener("pointerup", event => {
    if (!state.moved) pickItem(event.clientX, event.clientY);
    state.dragging = false;
    state.pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointercancel", () => {
    state.dragging = false;
    state.pointer = null;
  });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    state.zoom = clamp(state.zoom * Math.exp(-event.deltaY * .001), .72, 2.25);
    requestRender();
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    const handled = new Set([
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", " "
    ]);
    if (!handled.has(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") state.rotationY -= .08;
    if (event.key === "ArrowRight") state.rotationY += .08;
    if (event.key === "ArrowUp") state.rotationX -= .08;
    if (event.key === "ArrowDown") state.rotationX += .08;
    if (event.key === "+" || event.key === "=") {
      state.zoom = clamp(state.zoom * 1.12, .72, 2.25);
    }
    if (event.key === "-") state.zoom = clamp(state.zoom / 1.12, .72, 2.25);
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
    updateStaticStatus();
    populateSelect();
    selectItem(state.selectedKey);
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  updatePlayButton();
  updateSurfaceButton();
  requestRender();

  function isArabic() {
    return document.body.classList.contains("lang-ar");
  }

  function text(arabic, english) {
    return isArabic() ? arabic : english;
  }

  function updateStaticStatus() {
    const count = vectorNodes.length;
    if (elements.status) {
      elements.status.textContent = count > 0
        ? text(
          `تم تحميل ${count.toLocaleString("ar-SA")} عقدة من runtime محلي حتمي موثق (${evidence.nodeGraph.runtimeId || "runtime-id unavailable"}).`,
          `${count.toLocaleString("en")} nodes loaded from a documented deterministic local runtime (${evidence.nodeGraph.runtimeId || "runtime id unavailable"}).`
        )
        : text(
          "العرض حي الآن على مراسي الأدلة؛ عقد receipts الفعلية تبقى غير متاحة ولا تُستبدل ببيانات مصطنعة.",
          "The evidence anchors are live now; actual receipt nodes remain unavailable and are not replaced with synthetic data."
        );
    }
    if (elements.count) {
      elements.count.textContent = count > 0
        ? text(`${count} عقدة مقيسة`, `${count} measured nodes`)
        : text("العقد المقيسة: غير متاحة", "Measured nodes: unavailable");
    }
  }

  function populateSelect() {
    if (!elements.select) return;
    const current = state.selectedKey;
    elements.select.replaceChildren(...selectable.map(item => {
      const option = document.createElement("option");
      option.value = item.key;
      option.textContent = displayName(item);
      return option;
    }));
    if (selectable.some(item => item.key === current)) {
      elements.select.value = current;
    }
    if (elements.timeline) {
      elements.timeline.max = String(Math.max(0, selectable.length - 1));
      elements.timeline.disabled = selectable.length < 2;
    }
  }

  function displayName(item) {
    if (item.type === "node") {
      return `${item.node.index === 0 ? "K_c_n_s · " : ""}${item.label}`;
    }
    return networkNames[item.id]?.[isArabic() ? 0 : 1] || item.label;
  }

  function selectItem(key) {
    const item = selectable.find(candidate => candidate.key === key) || selectable[0];
    if (!item) return;
    state.selectedKey = item.key;
    if (elements.select) elements.select.value = item.key;
    if (elements.timeline) {
      elements.timeline.value = String(selectable.indexOf(item));
    }
    if (elements.name) elements.name.textContent = displayName(item);
    if (elements.type) {
      elements.type.textContent = item.type === "node"
        ? text("عقدة متجه مستقلة", "Independent vector node")
        : text(
          item.unavailable ? "مرساة حالة غير متاحة" : "مرساة دليل شبكي",
          item.unavailable ? "Unavailable-state anchor" : "Network evidence anchor"
        );
    }
    if (item.type === "node") {
      const node = item.node;
      const coordinates = node.coordinates || {};
      const hamming = node.hammingTransition || {};
      const timing = node.efWriteSpan || {};
      const merkle = node.merkle || {};
      setDetail(
        elements.coordinates,
        `(${formatCoordinate(coordinates.x)}, ${formatCoordinate(coordinates.y)}, ${formatCoordinate(coordinates.z)})`
      );
      setDetail(
        elements.hamming,
        hamming.distanceBits == null
          ? text("مرجع الأصل", "Reference origin")
          : `${hamming.distanceBits}/${hamming.bitWidth} bits`
      );
      setDetail(
        elements.timing,
        timing.status === "detected"
          ? `${formatNanoseconds(timing.durationNanoseconds)} · ${text("محول إلى ns", "ns-scaled")}`
          : text("غير متاح", "Unavailable")
      );
      setDetail(
        elements.merkle,
        merkle.root ? shortHash(merkle.root) : text("غير متاح", "Unavailable")
      );
      setDetail(elements.basis, node.claimBoundary || item.basis);
      elements.verify?.removeAttribute("disabled");
      if (elements.proofState) {
        elements.proofState.textContent = merkle.root
          ? "PROOF READY"
          : "PROOF —";
      }
    } else {
      const metric = item.metrics.find(entry => entry.status === "detected");
      setDetail(
        elements.coordinates,
        text("مرساة عرض فقط", "Visual anchor only")
      );
      setDetail(
        elements.hamming,
        text("غير مقيس", "Not measured")
      );
      setDetail(
        elements.timing,
        text("غير مطبق", "Not applicable")
      );
      setDetail(
        elements.merkle,
        shortHash(evidence.sourceArtifact?.merkleRoot)
      );
      setDetail(
        elements.basis,
        metric
          ? `${metric.value} ${metric.unit || ""} · ${item.claimBoundary}`
          : item.claimBoundary
      );
      elements.verify?.setAttribute("disabled", "");
      if (elements.proofState) elements.proofState.textContent = "PROOF —";
    }
    if (elements.verification) elements.verification.textContent = "";
    requestRender();
  }

  function setDetail(element, value) {
    if (element) element.textContent = value || "—";
  }

  function updatePlayButton() {
    if (!elements.play) return;
    elements.play.setAttribute("aria-pressed", String(!state.paused));
    elements.play.textContent = state.paused
      ? text("تشغيل الحركة", "Start motion")
      : text("إيقاف مؤقت", "Pause");
  }

  function updateSurfaceButton() {
    if (!elements.surface) return;
    elements.surface.textContent = state.showSurface
      ? text("إخفاء سطح العرض", "Hide visual surface")
      : text("إظهار سطح العرض", "Show visual surface");
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
    context.clearRect(0, 0, width, height);
    drawBackdrop(width, height);
    if (state.showSurface) drawSurface(width, height);
    drawNetworkAnchors(width, height, now);
    drawVectorGraph(width, height, now);
    drawLiveCursor(width, height, now);
    drawCanvasLegend(width, height);

    state.frame += 1;
    state.framesSinceFps += 1;
    if (now - state.lastFpsAt >= 1000) {
      state.fps = state.framesSinceFps * 1000 / (now - state.lastFpsAt);
      state.framesSinceFps = 0;
      state.lastFpsAt = now;
    }
    if (elements.frame) {
      elements.frame.textContent = `FRAME ${String(state.frame).padStart(6, "0")}`;
    }
    if (elements.fps) {
      elements.fps.textContent = state.paused
        ? "RENDER PAUSED"
        : `${Math.round(state.fps || 0)} FPS · BROWSER`;
    }
    if (!state.paused && !state.dragging) state.rotationY += .0015;
    if (state.visible && !document.hidden && !state.paused) requestRender();
  }

  function drawBackdrop(width, height) {
    const gradient = context.createRadialGradient(
      width * .52, height * .43, 0,
      width * .52, height * .43, Math.max(width, height) * .7
    );
    gradient.addColorStop(0, "rgba(25, 55, 86, .72)");
    gradient.addColorStop(.45, "rgba(7, 18, 38, .88)");
    gradient.addColorStop(1, "rgba(4, 8, 21, 1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const elapsed = performance.now() - state.startedAt;
    for (let index = 0; index < 46; index += 1) {
      const seed = pseudo(index + 19);
      const x = ((seed * 997 + index * 83) % 1000) / 1000 * width;
      const y = ((seed * 577 + index * 47) % 1000) / 1000 * height;
      const pulse = state.paused
        ? .5
        : .42 + Math.sin(elapsed * .001 + index) * .18;
      context.fillStyle = `rgba(190, 232, 255, ${Math.max(.08, pulse)})`;
      context.beginPath();
      context.arc(x, y, index % 7 === 0 ? 1.6 : .8, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSurface(width, height) {
    const faces = [];
    const steps = 18;
    const extent = 3;
    for (let row = 0; row < steps; row += 1) {
      for (let column = 0; column < steps; column += 1) {
        const x0 = -extent + column * extent * 2 / steps;
        const x1 = -extent + (column + 1) * extent * 2 / steps;
        const z0 = -extent + row * extent * 2 / steps;
        const z1 = -extent + (row + 1) * extent * 2 / steps;
        const world = [
          { x: x0, y: saddleHeight(x0, z0), z: z0 },
          { x: x1, y: saddleHeight(x1, z0), z: z0 },
          { x: x1, y: saddleHeight(x1, z1), z: z1 },
          { x: x0, y: saddleHeight(x0, z1), z: z1 }
        ];
        const rotated = world.map(rotate);
        faces.push({
          depth: rotated.reduce((sum, point) => sum + point.z, 0) / 4,
          points: rotated.map(point => project(point, width, height)),
          mix: (column + row) / (steps * 2)
        });
      }
    }
    faces.sort((a, b) => a.depth - b.depth);
    context.save();
    context.globalCompositeOperation = "screen";
    for (const face of faces) {
      const cyan = Math.round(54 + face.mix * 140);
      const magenta = Math.round(214 - face.mix * 80);
      context.fillStyle = `rgba(${magenta}, ${cyan}, 205, .055)`;
      context.strokeStyle = face.mix < .5
        ? "rgba(61, 232, 221, .105)"
        : "rgba(244, 87, 213, .105)";
      context.lineWidth = 1;
      context.beginPath();
      face.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  function drawNetworkAnchors(width, height, now) {
    const projected = networks.map(item => ({
      item,
      point: project(rotate(item.world), width, height)
    })).sort((a, b) => a.point.z - b.point.z);

    context.save();
    context.setLineDash([5, 9]);
    context.lineWidth = Math.max(1, width / 1100);
    for (const entry of projected) {
      const point = entry.point;
      const satellites = 11;
      for (let index = 0; index < satellites; index += 1) {
        const angle = index / satellites * Math.PI * 2 +
          (state.paused ? 0 : now * .00008 * (entry.item.id === "cgn" ? -1 : 1));
        const radius = Math.max(18, point.scale * (.24 + pseudo(index + entry.item.id.length) * .16));
        const x = point.x + Math.cos(angle) * radius;
        const y = point.y + Math.sin(angle) * radius * .55;
        context.strokeStyle = hexAlpha(entry.item.color, .12);
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(x, y);
        context.stroke();
        context.fillStyle = hexAlpha(entry.item.color, entry.item.unavailable ? .28 : .72);
        context.beginPath();
        context.arc(x, y, Math.max(1.5, point.scale * .012), 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();

    state.projectedItems = [];
    for (const entry of projected) {
      drawNode(entry.item, entry.point, width, entry.item.unavailable);
      state.projectedItems.push(entry);
    }
  }

  function drawVectorGraph(width, height, now) {
    if (vectorNodes.length === 0) return;
    const projected = vectorNodes.map(item => ({
      item,
      point: project(rotate(item.world), width, height)
    }));
    context.save();
    context.lineCap = "round";
    for (let index = 1; index < projected.length; index += 1) {
      const previous = projected[index - 1].point;
      const current = projected[index].point;
      const gradient = context.createLinearGradient(
        previous.x, previous.y, current.x, current.y
      );
      gradient.addColorStop(0, "rgba(244, 199, 103, .18)");
      gradient.addColorStop(1, "rgba(113, 230, 255, .64)");
      context.strokeStyle = gradient;
      context.lineWidth = Math.max(1.4, width / 650);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      const bend = Math.sin(index * 1.7) * Math.min(width, height) * .025;
      context.quadraticCurveTo(
        (previous.x + current.x) / 2,
        (previous.y + current.y) / 2 - bend,
        current.x,
        current.y
      );
      context.stroke();
    }
    context.restore();

    projected.sort((a, b) => a.point.z - b.point.z);
    for (const entry of projected) {
      drawNode(entry.item, entry.point, width, false, now);
      state.projectedItems.push(entry);
    }
  }

  function drawNode(item, point, width, unavailable, now = 0) {
    const selected = item.key === state.selectedKey;
    const phase = item.type === "node"
      ? Number(item.id)
      : item.id.length * 1.7;
    const pulse = state.paused
      ? 1
      : 1 + Math.sin(now * .0026 + phase) * .08;
    const radius = Math.max(
      item.type === "node" ? 5 : 8,
      point.scale * (item.type === "node" ? .055 : .09) * pulse
    );
    context.save();
    context.shadowColor = item.color;
    context.shadowBlur = selected ? radius * 3.4 : radius * 1.8;
    context.fillStyle = unavailable ? "rgba(4, 8, 21, .78)" : item.color;
    context.strokeStyle = selected ? "#ffffff" : item.color;
    context.lineWidth = selected ? Math.max(2, width / 480) : Math.max(1, width / 850);
    if (unavailable) context.setLineDash([3, 4]);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();

    if (selected || item.type === "network" || item.node?.index === 0) {
      context.save();
      context.fillStyle = "#f2f7fb";
      context.font = `${selected ? 700 : 600} ${Math.max(10, width / 70)}px "Segoe UI", Tahoma, Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.shadowColor = "#040815";
      context.shadowBlur = 8;
      context.fillText(displayName(item), point.x, point.y + radius + 7);
      context.restore();
    }
  }

  function drawLiveCursor(width, height, now) {
    const sequence = vectorNodes.length > 1 ? vectorNodes : networks;
    if (sequence.length < 2) return;
    const cycle = state.paused ? 0 : (now - state.startedAt) / 1850;
    const index = Math.floor(cycle) % sequence.length;
    const progress = state.paused ? 0 : smooth(cycle - Math.floor(cycle));
    const from = project(rotate(sequence[index].world), width, height);
    const to = project(
      rotate(sequence[(index + 1) % sequence.length].world),
      width,
      height
    );
    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress -
      Math.sin(progress * Math.PI) * Math.min(width, height) * .035;
    const radius = Math.max(4, width / 190);
    context.save();
    context.shadowColor = "#f4c767";
    context.shadowBlur = radius * 4;
    context.fillStyle = "#fff2b8";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawCanvasLegend(width, height) {
    context.save();
    context.fillStyle = "rgba(4, 8, 21, .62)";
    context.fillRect(16, 16, Math.min(width * .48, 430), 46);
    context.fillStyle = "#9cb4c8";
    context.font = `${Math.max(10, width / 92)}px Consolas, monospace`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
      vectorNodes.length
        ? "LIVE REPLAY · OBSERVED ORDER · K_c_n_s"
        : "LIVE RENDER · EVIDENCE ANCHORS · NO FAKE NODES",
      28,
      39
    );
    context.fillStyle = "#f4c767";
    context.fillRect(18, height - 23, Math.max(36, width * .08), 2);
    context.fillStyle = "#9cb4c8";
    context.fillText(
      vectorNodes.length
        ? "gold = write-order replay"
        : "gold = renderer replay cursor",
      28 + Math.max(36, width * .08),
      height - 22
    );
    context.restore();
  }

  function pickItem(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    const ratioX = canvas.width / bounds.width;
    const ratioY = canvas.height / bounds.height;
    const x = (clientX - bounds.left) * ratioX;
    const y = (clientY - bounds.top) * ratioY;
    const nearest = state.projectedItems
      .map(entry => ({
        entry,
        distance: Math.hypot(entry.point.x - x, entry.point.y - y)
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance <= Math.max(26, canvas.width / 28)) {
      selectItem(nearest.entry.item.key);
    }
  }

  async function verifySelection() {
    const item = vectorNodes.find(candidate => candidate.key === state.selectedKey);
    if (!item) return;
    elements.verify?.setAttribute("disabled", "");
    if (elements.verification) {
      elements.verification.textContent = text(
        "جارٍ إعادة الحساب داخل المتصفح…",
        "Recomputing in the browser…"
      );
    }
    try {
      const merkleValid = await verifyMerkle(item.node.merkle);
      const hammingValid = verifyHamming(item.node);
      const valid = merkleValid && hammingValid;
      if (elements.verification) {
        elements.verification.textContent = valid
          ? text(
            "نجح: مسار Merkle وانتقال Hamming يطابقان الحقول المنشورة.",
            "Passed: the Merkle path and Hamming transition match the published fields."
          )
          : text(
            "فشل التحقق؛ لا تُعامل العقدة بوصفها سليمة.",
            "Verification failed; do not treat this node as valid."
          );
      }
      if (elements.proofState) {
        elements.proofState.textContent = valid ? "PROOF OK" : "PROOF FAIL";
      }
    } catch (error) {
      console.error("K-space proof verification failed", error);
      if (elements.verification) {
        elements.verification.textContent = text(
          "تعذر تنفيذ التحقق في هذا المتصفح.",
          "This browser could not complete verification."
        );
      }
      if (elements.proofState) elements.proofState.textContent = "PROOF ERROR";
    } finally {
      elements.verify?.removeAttribute("disabled");
    }
  }

  async function verifyMerkle(merkle) {
    if (
      !merkle?.leafPath ||
      !merkle.leafSha256 ||
      !merkle.root ||
      !Array.isArray(merkle.proofPath)
    ) return false;
    let hash = await sha256Hex(
      `leaf\0${merkle.leafPath}\0${merkle.leafSha256.toLowerCase()}`
    );
    for (const step of merkle.proofPath) {
      const sibling = String(step.siblingHash).toLowerCase();
      hash = String(step.siblingSide).toLowerCase() === "left"
        ? await sha256Hex(`node\0${sibling}\0${hash}`)
        : await sha256Hex(`node\0${hash}\0${sibling}`);
    }
    return hash === String(merkle.root).toLowerCase();
  }

  function verifyHamming(node) {
    if (node.index === 0) {
      return node.hammingTransition?.distanceBits == null;
    }
    const previous = vectorNodes.find(item => item.node.index === node.index - 1)?.node;
    if (!previous?.signature?.hex || !node.signature?.hex) return false;
    const left = hexBytes(previous.signature.hex);
    const right = hexBytes(node.signature.hex);
    if (left.length !== right.length) return false;
    let distance = 0;
    for (let index = 0; index < left.length; index += 1) {
      distance += popcount(left[index] ^ right[index]);
    }
    return distance === node.hammingTransition?.distanceBits;
  }
}

function saddleHeight(x, z) {
  return .19 * (x * x - z * z) +
    .11 * Math.sin(x * 1.35) * Math.cos(z * 1.1) - .45;
}

function rotatePoint(point, rotationX, rotationY) {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const x = point.x * cosY - point.z * sinY;
  const z = point.x * sinY + point.z * cosY;
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  return {
    x,
    y: point.y * cosX - z * sinX,
    z: point.y * sinX + z * cosX
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function pseudo(seed) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function hexAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function shortHash(value) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—";
}

function formatCoordinate(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(4) : "—";
}

function formatNanoseconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (number >= 1e6) return `${(number / 1e6).toFixed(3)} ms`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(3)} μs`;
  return `${number.toFixed(1)} ns`;
}

function hexBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0) return new Uint8Array();
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function popcount(value) {
  let count = 0;
  for (let byte = value & 0xff; byte; byte &= byte - 1) count += 1;
  return count;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
