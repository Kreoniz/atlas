<script lang="ts">
  import { Clock3, LocateFixed, Minus, Plus, RotateCcw } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { cubicInOut } from "svelte/easing";
  import { prefersReducedMotion, Tween } from "svelte/motion";
  import type { CountryCode } from "../data/capitals";
  import world from "../data/world.json";
  import { countryByCode, isCountryCode, matchesCountryFilter, type CountryFilter, type Language } from "./countries";
  import { flagUrl } from "./flags";
  import { messages } from "./messages";

  let {
    marked,
    filter,
    recentCountry,
    language,
    autoZoom = $bindable(),
    showRecent = $bindable(),
  }: {
    marked: ReadonlySet<string>;
    filter: CountryFilter;
    recentCountry?: CountryCode;
    language: Language;
    autoZoom: boolean;
    showRecent: boolean;
  } = $props();

  const { width: mapWidth, height: mapHeight } = world;
  const maxZoom = 8;
  const camera = new Tween({ zoom: 1, x: mapWidth / 2, y: mapHeight / 2 }, { easing: cubicInOut });
  let svg: SVGSVGElement;
  let width = $state(0);
  let height = $state(0);
  const zoom = $derived(camera.current.zoom);
  let drag = $state<{ id: number; x: number; y: number }>();
  let inspectedCode = $state<CountryCode>();
  let inspectPoint = $state({ x: 0, y: 0 });
  let tooltipWidth = $state(232);
  let tooltipHeight = $state(84);

  const t = $derived(messages[language]);
  const inspected = $derived(inspectedCode ? countryByCode.get(inspectedCode) : undefined);
  const tooltipLeft = $derived(tooltipOffset(inspectPoint.x, width, tooltipWidth));
  const tooltipTop = $derived(tooltipOffset(inspectPoint.y, height, tooltipHeight));

  $effect(() => {
    if (inspectedCode && !isVisible(inspectedCode)) clearInspector();
  });

  const aspect = $derived(width && height ? width / height : mapWidth / mapHeight);
  const fitWidth = $derived(Math.max(mapWidth, mapHeight * aspect));
  const viewWidth = $derived(fitWidth / zoom);
  const viewHeight = $derived(viewWidth / aspect);
  const centerX = $derived(boundCenter(camera.current.x, viewWidth, mapWidth));
  const centerY = $derived(boundCenter(camera.current.y, viewHeight, mapHeight));
  const viewBox = $derived(
    `${centerX - viewWidth / 2} ${centerY - viewHeight / 2} ${viewWidth} ${viewHeight}`,
  );

  onMount(() => {
    const element = svg;
    element.addEventListener("wheel", wheelZoom, { passive: false });
    return () => element.removeEventListener("wheel", wheelZoom);
  });

  function boundCenter(center: number, span: number, size: number) {
    if (span >= size) return size / 2;
    return Math.max(span / 2, Math.min(center, size - span / 2));
  }

  function isVisible(code: string | null) {
    return code === null ? filter === "all" : matchesCountryFilter(filter, marked.has(code));
  }

  function tooltipOffset(point: number, span: number, size: number) {
    const edge = 8;
    const gap = 12;
    const offset = point + gap + size <= span - edge ? point + gap : point - gap - size;
    return Math.max(edge, Math.min(offset, span - size - edge));
  }

  function inspect(event: PointerEvent) {
    const code = event.target instanceof SVGElement ? event.target.dataset.country : undefined;
    if (!isCountryCode(code)) {
      clearInspector();
      return;
    }

    const rect = svg.getBoundingClientRect();
    inspectedCode = code;
    inspectPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clearInspector() {
    inspectedCode = undefined;
  }

  function leaveMap(event: PointerEvent) {
    if (event.pointerType !== "touch") clearInspector();
  }

  function moveCamera(zoom: number, x: number, y: number, duration = 0) {
    clearInspector();
    const span = fitWidth / zoom;
    void camera.set(
      { zoom, x: boundCenter(x, span, mapWidth), y: boundCenter(y, span / aspect, mapHeight) },
      { duration: prefersReducedMotion.current ? 0 : duration },
    );
  }

  function zoomTo(value: number, anchor = { x: centerX, y: centerY }, duration = 260) {
    const next = Math.min(maxZoom, Math.max(1, value));
    const ratio = zoom / next;
    moveCamera(
      next,
      anchor.x + (centerX - anchor.x) * ratio,
      anchor.y + (centerY - anchor.y) * ratio,
      duration,
    );
  }

  export function focusCountry(code: CountryCode) {
    const [left, top, right, bottom] = world.focus[code];
    const framingWidth = Math.max(1, (right - left) * 1.5);
    const framingHeight = Math.max(1, (bottom - top) * 1.5);
    const next = Math.max(1.1, Math.min(maxZoom, fitWidth / framingWidth, (fitWidth / aspect) / framingHeight));
    moveCamera(next, (left + right) / 2, (top + bottom) / 2, 440);
  }

  function wheelZoom(event: WheelEvent) {
    if (!event.deltaY || (event.deltaY > 0 && zoom === 1 && !event.ctrlKey)) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;

    event.preventDefault();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    zoomTo(zoom * Math.exp(-event.deltaY * unit * 0.002), point, 0);
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;

    if (zoom > 1) {
      moveCamera(zoom, centerX, centerY);
      svg.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }
    if (event.pointerType === "touch") inspect(event);
  }

  function movePointer(event: PointerEvent) {
    if (!drag) {
      if (event.pointerType !== "touch") inspect(event);
      return;
    }

    if (event.pointerId !== drag.id || !width || (drag.x === event.clientX && drag.y === event.clientY)) return;

    const unitsPerPixel = viewWidth / width;
    moveCamera(
      zoom,
      centerX + (drag.x - event.clientX) * unitsPerPixel,
      centerY + (drag.y - event.clientY) * unitsPerPixel,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  function stopDrag(event: PointerEvent) {
    if (drag?.id === event.pointerId) drag = undefined;
  }

  function cancelPointer(event: PointerEvent) {
    stopDrag(event);
    clearInspector();
  }

  function keyboardPan(event: KeyboardEvent) {
    if (zoom === 1) return;

    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    } as const;
    const direction = directions[event.key as keyof typeof directions];
    if (!direction) return;

    event.preventDefault();
    moveCamera(
      zoom,
      centerX + direction[0] * viewWidth * 0.12,
      centerY + direction[1] * viewHeight * 0.12,
    );
  }
</script>

<div class="map-viewport" bind:clientWidth={width} bind:clientHeight={height}>
  <svg
    class="world"
    class:zoomed={zoom > 1}
    class:dragging={drag !== undefined}
    bind:this={svg}
    {viewBox}
    fill="none"
    role="img"
    aria-label={t.world}
    onpointerdown={startDrag}
    onpointermove={movePointer}
    onpointerup={stopDrag}
    onpointerleave={leaveMap}
    onpointercancel={cancelPointer}
    onlostpointercapture={stopDrag}
  >
    <g aria-hidden="true">
      {#if filter === "all"}
        <path class="land-underlay" d={world.silhouette} fill-rule="evenodd" />
      {/if}
      {#each world.features as { code, d, tone }}
        {#if isVisible(code)}
          <path
            class="land"
            class:context={code === null}
            class:marked={code !== null && marked.has(code)}
            class:recent={code === recentCountry}
            class:inspected={code === inspectedCode}
            data-country={code ?? undefined}
            style:--land-tone={`${tone * 10}%`}
            {d}
            fill-rule="evenodd"
            vector-effect="non-scaling-stroke"
          />
        {/if}
      {/each}
      {#each world.markers as { code, x, y } (code)}
        {#if isVisible(code)}
          <circle
            class="marker"
            class:marked={marked.has(code)}
            class:recent={code === recentCountry}
            class:inspected={code === inspectedCode}
            data-country={code}
            cx={x}
            cy={y}
            r={(marked.has(code) ? 4 : 2.1) / Math.sqrt(zoom)}
            vector-effect="non-scaling-stroke"
          />
        {/if}
      {/each}
    </g>
  </svg>

  {#if inspected && isVisible(inspected.code)}
    {@const found = marked.has(inspected.code)}
    {@const latest = inspected.code === recentCountry}
    <div
      class="map-inspector"
      role="tooltip"
      bind:clientWidth={tooltipWidth}
      bind:clientHeight={tooltipHeight}
      style:left={`${tooltipLeft}px`}
      style:top={`${tooltipTop}px`}
    >
      <div class="inspector-heading">
        <img src={flagUrl(inspected.code)} alt="" width="28" height="21" />
        <strong>{inspected.name[language]}</strong>
      </div>
      <div class="inspector-capital">{t.capitalLabel} · {inspected.capital[language]}</div>
      <span class="inspector-status" class:found class:recent={latest}>
        {latest ? t.mapRecent : found ? t.mapMarked : t.mapUnmarked}
      </span>
    </div>
  {/if}

  <div class="map-controls">
    <button
      type="button"
      class="icon-button map-toggle recent-toggle"
      title={t.recentHighlight}
      aria-label={t.recentHighlight}
      aria-pressed={showRecent}
      onclick={() => (showRecent = !showRecent)}
      onkeydown={keyboardPan}
    >
      <Clock3 size={17} />
      <span>{t.mapRecent}</span>
    </button>
    <button
      type="button"
      class="icon-button map-toggle auto-zoom"
      title={t.autoZoomHint}
      aria-label={t.autoZoomHint}
      aria-pressed={autoZoom}
      onclick={() => (autoZoom = !autoZoom)}
      onkeydown={keyboardPan}
    >
      <LocateFixed size={16} />
      {t.autoZoom}
    </button>
    <button class="icon-button" type="button" title={t.zoomIn} aria-label={t.zoomIn} disabled={camera.target.zoom >= maxZoom} onclick={() => zoomTo(camera.target.zoom * 1.5)} onkeydown={keyboardPan}>
      <Plus size={18} />
    </button>
    <button class="icon-button" type="button" title={t.zoomOut} aria-label={t.zoomOut} disabled={camera.target.zoom <= 1} onclick={() => zoomTo(camera.target.zoom / 1.5)} onkeydown={keyboardPan}>
      <Minus size={18} />
    </button>
    <button class="icon-button" type="button" title={t.resetZoom} aria-label={t.resetZoom} disabled={camera.target.zoom <= 1} onclick={() => zoomTo(1)} onkeydown={keyboardPan}>
      <RotateCcw size={16} />
    </button>
  </div>
</div>

<style>
  .map-viewport {
    position: relative;
    min-height: 0;
    overflow: hidden;
    background: var(--map-ocean);
    border-radius: 0 0 var(--panel-radius) var(--panel-radius);
  }

  .world {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: pan-y;
  }

  .world.zoomed {
    cursor: grab;
    touch-action: none;
  }

  .world.dragging {
    cursor: grabbing;
  }

  .land-underlay {
    fill: color-mix(in srgb, var(--map-land), var(--map-land-alt) 30%);
  }

  .land {
    fill: color-mix(in srgb, var(--map-land), var(--map-land-alt) var(--land-tone));
    stroke: var(--map-border);
    stroke-width: 0.65;
    stroke-linejoin: round;
  }

  .land.context {
    fill: var(--map-context);
  }

  .marker {
    fill: var(--map-dot);
    stroke: var(--map-ocean);
    stroke-width: 0.7;
  }

  .marked {
    fill: var(--map-marked);
  }

  .land.recent,
  .marker.recent {
    fill: var(--map-recent);
  }

  .inspected {
    stroke: var(--map-inspected);
    stroke-width: 1.1;
  }

  .map-inspector {
    position: absolute;
    z-index: 1;
    display: grid;
    gap: 0.3rem;
    width: min(14.5rem, calc(100% - 1rem));
    max-height: calc(100% - 1rem);
    overflow: hidden;
    padding: 0.65rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--control-line);
    border-radius: 0.55rem;
    box-shadow: 0 4px 20px #0003;
    pointer-events: none;
    overflow-wrap: anywhere;
  }

  .inspector-heading {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .inspector-heading img {
    flex: none;
    border-radius: 0.2rem;
  }

  .inspector-capital,
  .inspector-status {
    color: var(--muted);
    font-size: 0.875rem;
  }

  .inspector-status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .inspector-status::before {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--map-dot);
    content: "";
  }

  .inspector-status.found::before {
    background: var(--map-marked);
  }

  .inspector-status.recent::before {
    background: var(--map-recent);
  }

  @media (prefers-reduced-motion: no-preference) {
    .land,
    .marker {
      transition: fill 200ms ease-out, stroke 100ms ease-out;
    }
  }

  .map-controls {
    position: absolute;
    z-index: 2;
    inset-inline-end: 0.65rem;
    inset-block-end: 0.65rem;
    display: flex;
    gap: 0.15rem;
    padding: 0.15rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 0.55rem;
  }

  .map-controls button {
    width: 2.15rem;
    height: 2.15rem;
  }

  .map-controls .map-toggle {
    display: inline-flex;
    gap: 0.35rem;
    width: auto;
    padding-inline: 0.55rem;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .map-controls .map-toggle[aria-pressed="true"] {
    color: var(--accent);
    background: var(--accent-soft);
  }
  @media (max-width: 30rem) {
    .map-controls .recent-toggle {
      width: 2.15rem;
      justify-content: center;
      padding: 0;
    }

    .recent-toggle span {
      display: none;
    }
  }
</style>
