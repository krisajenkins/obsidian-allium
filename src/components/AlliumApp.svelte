<script lang="ts">
  import { parse } from "../wasm";

  interface Props {
    source: string;
    fileVersion?: number;
  }

  let { source, fileVersion = 0 }: Props = $props();

  interface Diagnostic {
    span: { start: number; end: number };
    message: string;
    severity: string;
  }
  interface ParseResult {
    module: { version?: number; declarations: unknown[] };
    diagnostics: Diagnostic[];
  }

  // Re-parse whenever the file content changes (fileVersion is bumped on edits).
  let parsed = $derived.by<ParseResult | { error: string }>(() => {
    void fileVersion;
    try {
      return JSON.parse(parse(source)) as ParseResult;
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
</script>

<div class="allium-stub">
  <h2>Allium Spec</h2>
  {#if "error" in parsed}
    <p class="allium-stub-error">Parser error: {parsed.error}</p>
  {:else}
    <p>
      Language version {parsed.module.version ?? "?"} —
      {parsed.module.declarations.length} declarations,
      {parsed.diagnostics.length} diagnostics.
    </p>
    {#if parsed.diagnostics.length}
      <ul class="allium-stub-diags">
        {#each parsed.diagnostics as d}
          <li>[{d.severity}] {d.message}</li>
        {/each}
      </ul>
    {/if}
  {/if}
  <p class="allium-stub-note">
    Interactive domain-model view coming next — this stub confirms the vendored
    parser runs inside Obsidian.
  </p>
</div>

<style>
  .allium-stub {
    padding: 1.5rem 2rem;
    max-width: 48rem;
    color: var(--text-normal);
  }
  .allium-stub h2 {
    margin-top: 0;
  }
  .allium-stub-error {
    color: var(--text-error);
  }
  .allium-stub-diags {
    color: var(--text-warning);
    font-family: var(--font-monospace);
    font-size: var(--font-ui-small);
  }
  .allium-stub-note {
    color: var(--text-muted);
    font-style: italic;
  }
</style>
