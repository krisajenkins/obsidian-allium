<script lang="ts">
  import { parse } from "../wasm";
  import { buildGraph } from "../allium-ast";
  import { nodeDetail } from "../describe";
  import type { AlliumGraph, AlliumNode, ParseResult } from "../types";
  import {
    faceOf,
    SECTIONS,
    SECTION_BADGE,
    KIND_DESCRIPTION,
  } from "../constants";
  import NodeCard from "./NodeCard.svelte";
  import EdgeLine from "./EdgeLine.svelte";

  interface Props {
    source: string;
    fileVersion?: number;
  }

  let { source, fileVersion = 0 }: Props = $props();

  // Re-parse + rebuild the graph whenever the file content changes.
  let graph = $derived.by<AlliumGraph & { error?: string }>(() => {
    void fileVersion;
    try {
      return buildGraph(JSON.parse(parse(source)) as ParseResult);
    } catch (e) {
      return {
        nodes: [],
        edges: [],
        diagnostics: [],
        version: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });

  let byId = $derived(new Map(graph.nodes.map((n) => [n.id, n])));

  let summonedId = $state<string | null>(null);
  let infoKind = $state<string | null>(null);

  // Drop a stale selection if the node disappeared after an edit.
  let summonedNode = $derived<AlliumNode | null>(
    summonedId ? (byId.get(summonedId) ?? null) : null,
  );

  let connectedNodes = $derived.by<AlliumNode[]>(() => {
    if (!summonedId) return [];
    const ids = new Set<string>();
    for (const e of graph.edges) {
      if (e.from === summonedId) ids.add(e.to);
      if (e.to === summonedId) ids.add(e.from);
    }
    return [...ids].map((id) => byId.get(id)).filter((n): n is AlliumNode => !!n);
  });

  // Shelf: SECTIONS → kinds present → nodes of that kind.
  interface ShelfSection {
    label: string;
    groups: { kind: string; nodes: AlliumNode[] }[];
  }
  let shelf = $derived.by<ShelfSection[]>(() => {
    const out: ShelfSection[] = [];
    for (const section of SECTIONS) {
      const groups: { kind: string; nodes: AlliumNode[] }[] = [];
      for (const kind of section.kinds) {
        const nodes = graph.nodes.filter((n) => n.kind === kind);
        if (nodes.length > 0) groups.push({ kind, nodes });
      }
      if (groups.length > 0) out.push({ label: section.label, groups });
    }
    return out;
  });

  function summon(id: string): void {
    infoKind = null;
    summonedId = summonedId === id ? null : id;
  }
  function dismiss(): void {
    summonedId = null;
    infoKind = null;
  }
  function showKindInfo(kind: string): void {
    summonedId = null;
    infoKind = kind;
  }

  function formatName(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  }

  /** 1-based line:col for a byte offset — the coordinate to jump to in an editor. */
  function lineCol(offset: number): { line: number; col: number } {
    const before = source.slice(0, offset);
    const nl = before.lastIndexOf("\n");
    return { line: before.split("\n").length, col: offset - nl };
  }

  /** Summon the smallest declaration whose span encloses an offset (used to
   *  jump from a diagnostic to the construct it sits in). */
  function revealOffset(offset: number): void {
    let best: AlliumNode | null = null;
    for (const n of graph.nodes) {
      if (n.span.start <= offset && offset < n.span.end) {
        if (!best || n.span.end - n.span.start < best.span.end - best.span.start) {
          best = n;
        }
      }
    }
    if (best) {
      infoKind = null;
      summonedId = best.id;
    }
  }

  let detail = $derived(summonedNode ? nodeDetail(summonedNode, source) : null);

  function fanPosition(index: number, total: number): { x: number; y: number } {
    // Even ring starting at the top; radius grows with count so cards never
    // crowd. A slight vertical squash keeps the orbit clear of the tall centre
    // card on the left/right while staying on screen top/bottom.
    const radius = Math.min(360, 210 + total * 14);
    const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
    return { x: Math.cos(angle) * radius * 1.15, y: Math.sin(angle) * radius * 0.92 };
  }

  // Positions for EdgeLine: centre node at origin, fan nodes around it.
  let positions = $derived.by(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (summonedId) map.set(summonedId, { x: 0, y: 0 });
    connectedNodes.forEach((n, i) => map.set(n.id, fanPosition(i, connectedNodes.length)));
    return map;
  });

  let visibleEdges = $derived(
    graph.edges.filter((e) => positions.has(e.from) && positions.has(e.to)),
  );

  // Zoom-to-fit. Measure the stage and the (variable-height) centre card, then
  // scale + recentre the whole constellation so it fits the viewport with a
  // margin. Coordinates are in orbit space: the centre card sits at (0,0),
  // satellites at their fan positions. clientWidth/Height are unaffected by the
  // CSS scale, so there's no feedback loop.
  let stageW = $state(0);
  let stageH = $state(0);
  let cardW = $state(360);
  let cardH = $state(0);

  const SAT_W = 150;
  const SAT_H = 52;
  const FIT_MARGIN = 96;

  let fit = $derived.by(() => {
    let minX = -cardW / 2,
      maxX = cardW / 2,
      minY = -cardH / 2,
      maxY = cardH / 2;
    for (const n of connectedNodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      minX = Math.min(minX, p.x - SAT_W / 2);
      maxX = Math.max(maxX, p.x + SAT_W / 2);
      minY = Math.min(minY, p.y - SAT_H / 2);
      maxY = Math.max(maxY, p.y + SAT_H / 2);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    let scale = 1;
    if (stageW > 0 && stageH > 0) {
      scale = Math.min(1, (stageW - FIT_MARGIN) / bw, (stageH - FIT_MARGIN) / bh);
    }
    return {
      scale: Math.max(0.3, scale),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  });
</script>

<div class="allium-root">
  {#if graph.error}
    <div class="allium-fatal">Parser error: {graph.error}</div>
  {:else}
    <!-- Shelf -->
    <div class="allium-shelf">
      {#each shelf as section (section.label)}
        {@const badge = SECTION_BADGE[section.label]}
        <div class="allium-section">
          <div
            class="allium-section-head"
            style="background: {badge?.bg}; color: {badge?.fg};"
          >
            {section.label}
          </div>
          {#each section.groups as group (group.kind)}
            {@const face = faceOf(group.kind)}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div class="allium-kind-label" onclick={() => showKindInfo(group.kind)}>
              {face.label}
            </div>
            {#each group.nodes as node (node.id)}
              {@const isActive = summonedId === node.id}
              {@const isConnected = connectedNodes.some((c) => c.id === node.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div
                class="allium-shelf-item"
                class:active={isActive}
                style="
                  background: {face.bg};
                  color: {face.fg};
                  {isActive ? 'outline: 2px solid #7c5cbf;' : ''}
                  {isConnected && !isActive ? 'border-right: 3px solid ' + face.fg + '99;' : ''}
                "
                onclick={() => summon(node.id)}
              >
                {formatName(node.name)}
              </div>
            {/each}
          {/each}
        </div>
      {/each}
    </div>

    <!-- Stage + diagnostics banner -->
    <div class="allium-main">
      {#if graph.diagnostics.length > 0}
        <div class="allium-diags">
          <div class="allium-diags-head">
            {graph.diagnostics.length} diagnostic{graph.diagnostics.length === 1 ? "" : "s"}
          </div>
          {#each graph.diagnostics as d (d.span.start + d.message)}
            {@const loc = lineCol(d.span.start)}
            <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
            <div
              class="allium-diag"
              class:error={d.severity === "Error"}
              title="Jump to the enclosing declaration"
              onclick={() => revealOffset(d.span.start)}
            >
              <span class="allium-diag-loc">{loc.line}:{loc.col}</span>
              <span class="allium-diag-sev">{d.severity}</span>
              <span class="allium-diag-msg">{d.message}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
      <div class="allium-stage" bind:clientWidth={stageW} bind:clientHeight={stageH} onclick={dismiss}>
      {#if summonedNode}
        {@const face = faceOf(summonedNode.kind)}
        <!-- A zero-size anchor pinned to the stage centre. The zoom layer scales
             the whole constellation to fit; the recentre layer shifts its
             bounding-box centre onto the anchor. -->
        <div class="allium-anchor">
          <div class="allium-zoom" style="transform: scale({fit.scale});">
          <div
            class="allium-recenter"
            style="transform: translate({-fit.cx}px, {-fit.cy}px);"
            onclick={(e) => e.stopPropagation()}
          >
          <!-- Edges behind the cards -->
          {#each visibleEdges as edge (edge.from + edge.to + edge.kind)}
            <EdgeLine {edge} {positions} />
          {/each}

          <!-- Centre card -->
          <div class="allium-center" style="border-top: 3px solid {face.fg};" bind:clientWidth={cardW} bind:clientHeight={cardH}>
            <div class="allium-center-head" style="background: {face.bg}; color: {face.fg};">
              <span class="allium-center-kind">{face.label}</span>
              <span class="allium-center-loc" title="Line in source">{lineCol(summonedNode.span.start).line}</span>
            </div>
            <div class="allium-center-body">
              <div class="allium-center-name">{formatName(summonedNode.name)}</div>
              {#if detail}
                {#if detail.type === "text"}
                  <div class="allium-prose">{detail.text}</div>
                {:else if detail.type === "variants"}
                  <div class="allium-chips">
                    {#each detail.names as v}<span class="allium-chip">{v}</span>{/each}
                  </div>
                {:else if detail.type === "fields" || detail.type === "clauses"}
                  <dl class="allium-rows" class:clauses={detail.type === "clauses"}>
                    {#each detail.rows as row}
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    {/each}
                  </dl>
                {/if}
              {/if}
            </div>
          </div>

          <!-- Fan of connected nodes -->
          {#each connectedNodes as conn, i (conn.id)}
            {@const pos = fanPosition(i, connectedNodes.length)}
            <NodeCard node={conn} x={pos.x} y={pos.y} {formatName} onclick={() => summon(conn.id)} />
          {/each}
          </div>
          </div>
        </div>
      {:else if infoKind}
        {@const face = faceOf(infoKind)}
        <div class="allium-overlay">
          <div class="allium-info" onclick={(e) => e.stopPropagation()}>
            <div class="allium-info-badge" style="background: {face.bg}; color: {face.fg};">{face.label}</div>
            <div class="allium-info-desc">{KIND_DESCRIPTION[infoKind] ?? ""}</div>
          </div>
        </div>
      {:else}
        <div class="allium-overlay">
          <div class="allium-empty">
            <div class="allium-empty-title">
              {graph.nodes.length} declarations · language version {graph.version ?? "?"}
            </div>
            <div class="allium-empty-hint">click a declaration to summon it</div>
          </div>
        </div>
      {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .allium-root {
    display: flex;
    width: 100%;
    height: 100%;
    background: #f5f3f0;
    color: #333;
  }
  .allium-fatal {
    padding: 1.5rem;
    color: #b00020;
    font-family: var(--font-monospace, monospace);
  }
  .allium-shelf {
    width: 230px;
    min-width: 230px;
    height: 100%;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-right: 1px solid #e0ddd8;
    background: #edeae5;
  }
  .allium-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .allium-section-head {
    font-size: 0.72em;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 800;
    padding: 5px 8px 5px 16px;
    border-radius: 0 4px 4px 0;
    margin: 6px 0 4px -8px;
  }
  .allium-kind-label {
    font-size: 0.55em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    opacity: 0.5;
    cursor: pointer;
    color: #666;
  }
  .allium-shelf-item {
    font-size: 0.74em;
    font-weight: 500;
    line-height: 1.3;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    border-right: 3px solid transparent;
  }
  .allium-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .allium-diags {
    flex-shrink: 0;
    max-height: 30%;
    overflow-y: auto;
    border-bottom: 1px solid #e0ddd8;
    background: #faf6f2;
  }
  .allium-diags-head {
    font-size: 0.62em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 800;
    padding: 5px 12px;
    color: #8a5a2a;
    background: #f2e4d6;
  }
  .allium-diag {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 5px 12px;
    font-size: 0.74em;
    line-height: 1.35;
    cursor: pointer;
    border-left: 3px solid #d9a441;
  }
  .allium-diag.error {
    border-left-color: #c2452f;
  }
  .allium-diag:hover {
    background: #f0e8e0;
  }
  .allium-diag-loc {
    flex-shrink: 0;
    font-family: var(--font-monospace, monospace);
    opacity: 0.6;
    min-width: 44px;
  }
  .allium-diag-sev {
    flex-shrink: 0;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.85em;
    letter-spacing: 0.04em;
  }
  .allium-diag.error .allium-diag-sev {
    color: #c2452f;
  }
  .allium-diag-msg {
    opacity: 0.85;
    overflow-wrap: anywhere;
  }
  .allium-stage {
    flex: 1;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 42%, #faf8f5 0%, #efece7 70%, #e7e3dd 100%);
  }
  .allium-anchor {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
  }
  .allium-zoom {
    position: absolute;
    transform-origin: 0 0;
    transition: transform 0.18s ease;
  }
  .allium-recenter {
    position: absolute;
  }
  .allium-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .allium-center {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 360px;
    max-height: 64vh;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 10px 34px rgba(40, 30, 20, 0.22);
    overflow: hidden;
    z-index: 3;
  }
  .allium-center-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 14px;
  }
  .allium-center-kind {
    font-size: 0.62em;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.7;
  }
  .allium-center-loc {
    font-size: 0.62em;
    opacity: 0.55;
    font-family: var(--font-monospace, monospace);
  }
  .allium-center-loc::before {
    content: "line ";
    opacity: 0.7;
  }
  .allium-center-body {
    padding: 12px 16px 16px;
    overflow-y: auto;
  }
  .allium-center-name {
    font-size: 1.2em;
    font-weight: 700;
    line-height: 1.25;
    margin-bottom: 10px;
    color: #2a2622;
  }
  .allium-rows {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    row-gap: 3px;
    font-size: 0.78em;
    line-height: 1.45;
  }
  .allium-rows dt {
    font-weight: 600;
    color: #5a5048;
    white-space: nowrap;
  }
  .allium-rows.clauses dt {
    text-transform: uppercase;
    font-size: 0.82em;
    letter-spacing: 0.04em;
    color: #8a6a3a;
  }
  .allium-rows dd {
    margin: 0;
    color: #3a342e;
    font-family: var(--font-monospace, monospace);
    overflow-wrap: anywhere;
  }
  .allium-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .allium-chip {
    font-size: 0.74em;
    padding: 2px 9px;
    border-radius: 11px;
    background: #efeaf6;
    color: #43356a;
    font-family: var(--font-monospace, monospace);
  }
  .allium-prose {
    font-size: 0.84em;
    line-height: 1.5;
    color: #3a342e;
  }
  .allium-info {
    max-width: 360px;
    padding: 20px 24px;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    background: #fff;
  }
  .allium-info-badge {
    display: inline-block;
    font-size: 0.7em;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 4px;
    margin-bottom: 10px;
  }
  .allium-info-desc {
    font-size: 0.86em;
    line-height: 1.5;
    opacity: 0.8;
  }
  .allium-empty {
    text-align: center;
    color: #999;
  }
  .allium-empty-title {
    font-size: 0.9em;
    margin-bottom: 6px;
  }
  .allium-empty-hint {
    font-size: 0.8em;
    font-style: italic;
    opacity: 0.7;
  }
</style>
