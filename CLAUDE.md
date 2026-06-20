# obsidian-allium

Obsidian plugin that renders `.allium` specification files as an interactive
domain-model graph. Structurally a sibling of obsidian-strategy, but it parses
with the real Allium parser (bundled WebAssembly) rather than a hand-written one.

## Build & Test

All commands run through Nix:

```sh
nix develop -c pnpm install   # install deps
nix develop -c pnpm run build # produces main.js (component CSS injected, no sidecar)
nix develop -c pnpm run test  # parser + transform tests (vitest)
nix develop -c pnpm run dev   # watch mode
```

## Architecture

- `src/main.ts` — Plugin entry. Registers the view and the `.allium` extension.
- `src/allium-view.svelte.ts` — TextFileView bridge. Mounts/updates the Svelte
  root via `createClassComponent`, passing raw `source` + a `fileVersion` counter.
- `src/wasm/` — the bundled parser:
  - `allium_wasm_bg.wasm` — vendored Rust parser (wasm-bindgen), refreshed via
    `scripts/refresh-wasm.sh`.
  - `allium-wasm.ts` — portable, fs-free bindgen glue: `initAlliumWasm(bytes)` +
    `parse(source): string`. Unit-testable in node.
  - `index.ts` — bundle entry: feeds esbuild-inlined wasm bytes to the glue
    (esbuild `binary` loader) and re-exports `parse`.
- `src/allium-ast.ts` — pure AST→graph transform: `buildGraph(ParseResult)`.
  Imports only types, never the wasm, so it tests without resolving the bundle.
- `src/types.ts` — AST union + the derived `AlliumNode`/`AlliumEdge`/`AlliumGraph`.
- `src/constants.ts` — per-kind palette, shelf sections, edge colours, blurbs.
- `src/components/AlliumApp.svelte` — root UI: shelf + diagnostics banner + stage.
- `src/components/NodeCard.svelte` — satellite/fan card.
- `src/components/EdgeLine.svelte` — connector line.

## How parsing works

`parse()` returns the AST as JSON: `{ module: { version, declarations[] },
diagnostics[] }`. Declarations are an externally-tagged union — `{ Block: {...} }`
(Entity, Enum, Rule, Surface, …), `{ Default }`, `{ Invariant }`,
`{ OpenQuestion }`. Every node carries a byte-offset `span`.

`buildGraph` makes one node per Block / Invariant / OpenQuestion (not Defaults —
those are instance data). Edges come from a single rule: walk a declaration's
subtree, collect every identifier in **expression position** (the `{ Ident }`
wrapper — declaration/field names are bare `{ span, name }`), and emit an edge to
any that names another node. Built-in types (`String`, `Integer`) and local
bindings fall away because they match no node name.

Spans drive jump-to-source: clicking a diagnostic summons the declaration whose
span encloses the error; each card shows its source line.

## The wasm is `parse`-only

The bundled wasm exposes `parse`, not the CLI's `analyse`/`check`. We get
structural diagnostics (faithful to `allium check` — verified byte-for-byte) but
no semantic analysis. Always refresh the wasm and its glue together from the same
`allium-lsp` version (`scripts/refresh-wasm.sh`); the flake pins `allium-lsp`.

## Conventions

- Jujutsu (`jj`) with git colocation for version control.
- esbuild (not `tsc`) is the build. The TS-LSP may flag `.svelte` imports and the
  `createClassComponent` deprecation; both are benign and match obsidian-strategy.
