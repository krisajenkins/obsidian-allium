<script lang="ts">
  import type { AlliumNode } from "../types";
  import { faceOf, CARD_WIDTH, CARD_HEIGHT } from "../constants";

  interface Props {
    node: AlliumNode;
    x: number;
    y: number;
    /** The summoned node at the centre — drawn larger and accented. */
    focused?: boolean;
    onclick: () => void;
    formatName: (name: string) => string;
  }

  let { node, x, y, focused = false, onclick, formatName }: Props = $props();
  let face = $derived(faceOf(node.kind));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div
  class="acard"
  class:focused
  style="
    position: absolute;
    left: {x - CARD_WIDTH / 2}px;
    top: {y - CARD_HEIGHT / 2}px;
    width: {CARD_WIDTH}px;
    min-height: {CARD_HEIGHT}px;
    background: {face.bg};
    color: {face.fg};
    {focused ? `box-shadow: 0 0 0 2px ${face.fg}, 0 8px 22px rgba(0,0,0,0.28);` : ''}
  "
  title={focused ? "Click for full detail" : node.name}
  onclick={(e) => { e.stopPropagation(); onclick(); }}
>
  <div class="acard-kind">{face.label}</div>
  <div class="acard-name">{formatName(node.name)}</div>
</div>

<style>
  .acard {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    border-radius: 9px;
    padding: 8px 12px;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
    z-index: 1;
    transition: transform 0.12s, box-shadow 0.12s;
  }
  .acard:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
    z-index: 10;
  }
  .acard.focused {
    z-index: 8;
  }
  .acard-kind {
    font-size: 0.52em;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    opacity: 0.6;
    font-weight: 700;
  }
  .acard.focused .acard-kind {
    opacity: 0.75;
  }
  .acard-name {
    font-size: 0.78em;
    font-weight: 600;
    line-height: 1.2;
  }
  .acard.focused .acard-name {
    font-size: 0.92em;
    font-weight: 700;
  }
</style>
