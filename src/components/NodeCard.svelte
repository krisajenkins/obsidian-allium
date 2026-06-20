<script lang="ts">
  import type { AlliumNode } from "../types";
  import { faceOf, CARD_WIDTH } from "../constants";

  interface Props {
    node: AlliumNode;
    x: number;
    y: number;
    onclick: () => void;
    formatName: (name: string) => string;
  }

  let { node, x, y, onclick, formatName }: Props = $props();
  let face = $derived(faceOf(node.kind));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="acard"
  style="
    position: absolute;
    left: {x - CARD_WIDTH / 2}px;
    top: {y - 26}px;
    width: {CARD_WIDTH}px;
    background: {face.bg};
    color: {face.fg};
  "
  onclick={(e) => { e.stopPropagation(); onclick(); }}
>
  <div class="acard-kind">{face.label}</div>
  <div class="acard-name">{formatName(node.name)}</div>
</div>

<style>
  .acard {
    border-radius: 8px;
    padding: 7px 10px;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    z-index: 1;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .acard:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
    z-index: 10;
  }
  .acard-kind {
    font-size: 0.5em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.55;
  }
  .acard-name {
    font-size: 0.74em;
    font-weight: 600;
    line-height: 1.25;
  }
</style>
