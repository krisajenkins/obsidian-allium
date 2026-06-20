<script lang="ts">
  import { parse } from "../wasm";
  import { buildGraph } from "../allium-ast";
  import type { AlliumGraph, AlliumNode, Item, ParseResult } from "../types";
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
    /** Reveal a byte offset in the editor (wired by the view). */
    onReveal?: (offset: number) => void;
  }

  let { source, fileVersion = 0, onReveal }: Props = $props();

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

  /** A snippet of raw spec text for a span, collapsed to one tidy line. */
  function snippet(start: number, end: number): string {
    return source.slice(start, end).replace(/\s+/g, " ").trim();
  }

  /** Detail lines for the summoned card: one raw-text line per block item. */
  function itemLines(node: AlliumNode): string[] {
    const decl = node.decl;
    if ("Block" in decl) {
      return decl.Block.items.map((it: Item) => snippet(it.span.start, it.span.end));
    }
    if ("Invariant" in decl) {
      return [snippet(decl.Invariant.body.span?.start ?? node.span.start, decl.Invariant.span.end)];
    }
    return [];
  }

  function fanPosition(index: number, total: number): { x: number; y: number } {
    const radius = 300;
    const start = -Math.PI / 2;
    const spread = Math.min(Math.PI * 2, (total * Math.PI) / 3.5);
    const offset = -spread / 2;
    const angle =
      start + offset + (total === 1 ? spread / 2 : (index / (total - 1)) * spread);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
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

    <!-- Stage -->
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="allium-stage" onclick={dismiss}>
      {#if summonedNode}
        {@const face = faceOf(summonedNode.kind)}
        <div
          class="allium-stage-inner"
          onclick={(e) => e.stopPropagation()}
        >
          <!-- Edges behind the cards -->
          {#each visibleEdges as edge (edge.from + edge.to + edge.kind)}
            <EdgeLine {edge} {positions} />
          {/each}

          <!-- Centre card -->
          <div class="allium-center" style="background: {face.bg}; color: {face.fg};">
            <div class="allium-center-head">
              <span class="allium-center-kind">{face.label}</span>
              {#if onReveal}
                <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                <span
                  class="allium-reveal"
                  title="Reveal in editor"
                  onclick={(e) => { e.stopPropagation(); onReveal?.(summonedNode.span.start); }}
                >↗ reveal</span>
              {/if}
            </div>
            <div class="allium-center-name">{formatName(summonedNode.name)}</div>
            {#if summonedNode.kind === "OpenQuestion"}
              <div class="allium-question">{snippet(summonedNode.span.start, summonedNode.span.end)}</div>
            {:else}
              {@const lines = itemLines(summonedNode)}
              {#if lines.length > 0}
                <ul class="allium-items">
                  {#each lines as line}
                    <li>{line}</li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </div>

          <!-- Fan of connected nodes -->
          {#each connectedNodes as conn, i (conn.id)}
            {@const pos = fanPosition(i, connectedNodes.length)}
            <NodeCard node={conn} x={pos.x} y={pos.y} {formatName} onclick={() => summon(conn.id)} />
          {/each}
        </div>
      {:else if infoKind}
        {@const face = faceOf(infoKind)}
        <div class="allium-info" onclick={(e) => e.stopPropagation()}>
          <div class="allium-info-badge" style="background: {face.bg}; color: {face.fg};">{face.label}</div>
          <div class="allium-info-desc">{KIND_DESCRIPTION[infoKind] ?? ""}</div>
        </div>
      {:else}
        <div class="allium-empty">
          <div class="allium-empty-title">
            {graph.nodes.length} declarations · language version {graph.version ?? "?"}
          </div>
          <div class="allium-empty-hint">click a declaration to summon it</div>
        </div>
      {/if}
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
  .allium-stage {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .allium-stage-inner {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .allium-center {
    width: 340px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 16px 20px;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    z-index: 2;
    position: relative;
  }
  .allium-center-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .allium-center-kind {
    font-size: 0.6em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.55;
  }
  .allium-reveal {
    font-size: 0.62em;
    opacity: 0.6;
    cursor: pointer;
  }
  .allium-reveal:hover {
    opacity: 1;
  }
  .allium-center-name {
    font-size: 1.15em;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  .allium-items {
    margin: 0;
    padding-left: 16px;
    font-size: 0.74em;
    line-height: 1.5;
    opacity: 0.85;
    font-family: var(--font-monospace, monospace);
  }
  .allium-items li {
    margin-bottom: 2px;
    overflow-wrap: anywhere;
  }
  .allium-question {
    font-size: 0.82em;
    line-height: 1.5;
    opacity: 0.85;
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
