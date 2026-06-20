<script lang="ts">
  import type { AlliumEdge } from "../types";
  import { EDGE_COLORS } from "../constants";

  interface Props {
    edge: AlliumEdge;
    positions: Map<string, { x: number; y: number }>;
  }

  let { edge, positions }: Props = $props();

  let fromPos = $derived(positions.get(edge.from));
  let toPos = $derived(positions.get(edge.to));
  let color = $derived(EDGE_COLORS[edge.kind] ?? "#9ca3af");

  let lineStyle = $derived.by(() => {
    if (!fromPos || !toPos) return "";
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return (
      `position: absolute;` +
      `left: ${fromPos.x}px;` +
      `top: ${fromPos.y}px;` +
      `width: ${length}px;` +
      `height: 0;` +
      `border-top: 2px solid ${color};` +
      `transform-origin: 0 0;` +
      `transform: rotate(${angle}deg);` +
      `opacity: 0.55;` +
      `pointer-events: none;`
    );
  });
</script>

{#if fromPos && toPos}
  <div style={lineStyle}></div>
{/if}
