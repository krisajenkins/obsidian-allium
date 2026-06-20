# obsidian-allium — Implementation Plan

An Obsidian plugin that renders `.allium` specification files as an interactive
domain-model view, in the same family as `obsidian-strategy`, `obsidian-life`,
`obsidian-landscape`, etc.

> **Status:** the lost original was never pushed to GitHub. This directory
> currently holds only a Nix scaffold (`flake.nix` + empty `overlays/`,
> committed today). Everything below is a from-scratch build that reuses the
> `obsidian-strategy` plugin as a structural template.

---

## 1. Context gathered

- **Template repo:** `~/Work/Tools/obsidian-strategy` — same plugin family,
  different spec. We copy its shape almost wholesale.
- **Skill:** `obsidian-svelte-plugin` — the canonical build/mount/communication
  patterns (Svelte 5 runes, `createClassComponent`, esbuild + esbuild-svelte).
- **Language:** Allium. CLI `allium 3.5.0` (language versions 1, 2, 3) is on
  PATH via Nix (Rust-compiled native binary — *not* importable as a library).
  Rules reference cached at
  `~/.claude/plugins/cache/juxt-plugins/allium/3.3.0/.claude/rules/allium.md`.
- **★ WASM parser:** `allium-lsp` ships a wasm-bindgen build at
  `…-allium-lsp-3.5.0/lib/allium-lsp/allium_wasm{_bg.wasm,.js}` (185K wasm +
  3.4K glue). It exports a single function `parse(source: string): string`
  returning the AST as JSON. **Verified in-process (2026-06-20):** the trimmed,
  fs-free glue instantiates the 3.5.0 wasm and `parse()` round-trips on all
  three examples. This is the integration backbone (see §2).
- **Examples:** `examples/*.allium` — `dictat` (v2, 28 decls), `scenes` (v2, 57
  decls, *2 deliberate parse errors*), `space-cards` (v3, 66 decls). Span both
  language versions and exercise the diagnostics path; these become the step-4
  transform fixtures.

### Allium file structure (fixed section order)

`use` → `given` → external entities → value types → `contract`s →
`enum`s → entities & `variant`s → `config` → `defaults` → `rule`s →
`invariant`s → actor declarations → `surface`s → deferred specs →
`open_question`s. Sections are omitted when empty; headers are `----` comment
dividers; line comments are `-- ...`. First line is always `-- allium: N`.

The pieces worth visualising: **entities** (+ fields, with `Entity`-typed
fields and `with` relationships as edges), **enums/variants**, **rules &
triggers**, **surfaces**, **contracts**, **invariants**, **config**, and
**open questions**.

---

## 2. How to parse `.allium` — RESOLVED: bundle the WASM

This is the one place obsidian-allium should *not* blindly copy strategy. Three
options were considered; the WASM discovery makes the choice clear.

| | A. Shell out to `allium` CLI | B. Hand-write TS parser | **C. Bundle `allium_wasm` ★** |
|---|---|---|---|
| Source of truth | CLI JSON (authoritative) | Re-implement grammar | **Same Rust parser, compiled to WASM (authoritative)** |
| Correctness | Tracks the language | Drifts; grammar is large | **Tracks the language** |
| Effort | Spawn + parse JSON | Large, perpetual | **Small: bundle wasm + walk AST** |
| Platform | Desktop only (`child_process`) | Desktop + mobile | **Desktop + mobile (pure wasm)** |
| Runtime dep | `allium` on PATH | None | **None — wasm vendored in the bundle** |
| Output | Pre-cooked `model` JSON | Whatever we build | **Raw AST (`parse`) — we derive the model** |

**Decision: C — bundle `allium_wasm_bg.wasm` and call `parse()` in-process.**
Rationale:

1. It's the *same Rust parser* as the CLI, so it tracks the language exactly —
   no hand-rolled grammar to drift, no reimplementation.
2. No subprocess, no PATH problem, no `allium` runtime dependency, and
   **`isDesktopOnly` can stay `false`** (pure WASM runs on mobile too). This is
   strictly better than the CLI plan on every axis that bit us.
3. **Verified in-process (2026-06-20).** A trimmed glue (`init(bytes)` +
   `parse(source)`, no `fs`/`__dirname`/`exports`) instantiates the 3.5.0 wasm
   and round-trips all three examples. `space-cards` → 66 decls / 0 diagnostics.
   Crucially, the wasm's parse diagnostics are *byte-for-byte identical* to the
   authoritative `allium check` CLI on the same files (`scenes`'s 2 errors
   reproduce at the same lines) — the parser is faithful, so the red-squiggle
   case is covered. The CLI additionally emits semantic diagnostics (e.g.
   `allium.surface.unusedBinding`) that the parse-only wasm does **not** —
   confirming the `parse`-only scope below is real.

**The one wrinkle — replace the shipped loader.** The vendored `allium_wasm.js`
glue is Node/CommonJS: it does `require('fs').readFileSync(`${__dirname}/…`)`
and `exports.parse = …`. That won't work bundled into Obsidian (esp. mobile).
**It's smaller than feared:** only the *bottom 5 lines* are Node-specific; all
the marshalling helpers (`passStringToWasm0`, `getStringFromWasm0`,
`__wbg_get_imports`, the `parse` wrapper) are portable as-is, and the imports
object is trivial (just `__wbindgen_init_externref_table`). We keep those and
swap the bottom: feed the wasm bytes from a **bundled source** instead of `fs`.
Two ways:
  - esbuild binary loader: `loader: { ".wasm": "binary" }` → `import wasmBytes
    from "./wasm/allium_wasm_bg.wasm"`, then
    `new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), imports)`; or
  - base64-inline the 185K wasm into a `.ts` constant (simplest, no loader
    config; ~250K of source).
Either keeps everything in one `main.js` — no sidecar files to lose.

**Cost of C vs the old CLI plan:** `parse` returns the *raw AST*, not the
pre-digested `model` the CLI's `allium model` emits. So our transform walks the
AST itself (see §3) rather than a flat model. That's modestly more work, but the
AST carries strictly more (every node has a source `span` → click-to-jump to the
definition in the editor, for free). No `analyse`/`check` from WASM, but `parse`
returns structural `diagnostics`, which covers the red-squiggle case.

**Versioning:** vendor the `allium_wasm_bg.wasm` for a pinned language version
(currently 3.5.0) into the repo. The flake exposes `allium-lsp` so `nix build`
can refresh the vendored wasm when the language bumps.

---

## 3. Architecture (mirrors obsidian-strategy)

```
obsidian-allium/
├── flake.nix              # nodejs_22, pnpm, esbuild + allium-lsp (to refresh wasm)
├── manifest.json          # id: obsidian-allium, isDesktopOnly: FALSE
├── package.json           # same devDeps as strategy (+ vitest, fast-check)
├── tsconfig.json          # verbatimModuleSyntax: true
├── esbuild.config.mjs     # strategy's + { loader: { ".wasm": "binary" } }
├── main.css               # adapt strategy's; Obsidian CSS vars
└── src/
    ├── main.ts                  # Plugin: registerView + registerExtensions(["allium"])
    ├── allium-view.svelte.ts    # TextFileView → createClassComponent bridge
    ├── wasm/
    │   ├── allium_wasm_bg.wasm  # vendored 3.5.0 wasm (185K), refreshed via flake
    │   └── allium-wasm.ts       # trimmed bindgen glue: parse(src):string, bundled bytes  ← NEW
    ├── allium-ast.ts            # parse() JSON → { nodes, edges } graph transform  ← NEW
    ├── types.ts                 # TS types for the AST + AlliumNode/AlliumEdge
    ├── constants.ts             # icons, colours, per-construct metadata
    ├── allium-ast.test.ts       # vitest over the AST→graph transform
    └── components/
        ├── AlliumApp.svelte     # root: shelf (by construct kind) + stage
        ├── NodeCard.svelte      # entity / enum / rule / surface card
        └── EdgeLine.svelte      # relationship / trigger / reference line
```

### Data flow

1. `main.ts` registers the view and the `allium` extension (one-liner, copy of
   strategy's `main.ts`).
2. `allium-view.svelte.ts` is a `TextFileView` (copy of `strategy-view`):
   `setViewData(data)` hands the raw file text to `AlliumApp` and bumps a
   `fileVersion` counter on edits. (Simpler than strategy: no path/`app`
   round-trip needed — parsing is pure text-in, so we can pass `data` directly.)
3. `AlliumApp.svelte` receives `{ source, fileVersion }`. On mount / version
   bump it calls `parseAllium(source)` → graph.
4. **`wasm/allium-wasm.ts` (new):** the trimmed wasm-bindgen glue. Instantiates
   `allium_wasm_bg.wasm` from bundled bytes (no `fs`), exposes
   `parse(source: string): string`. One-time module instantiation, memoised.
5. **`allium-ast.ts` (new):** `JSON.parse(parse(source))` → walk the AST →
   `{ nodes: Map<string, AlliumNode>, edges: AlliumEdge[] }`, the same shape
   the strategy UI consumes, so the components are near-identical. Also surfaces
   `diagnostics[]` for a banner.

### AST shape (from `parse`, verified on the sample)

Top level: `{ module: { span, version, declarations[] }, diagnostics[] }`.
`declarations` is an **externally-tagged union** — each item is one of:
  - `{ Block: { kind, name, items[], span } }` — the workhorse (33/66 in the
    sample). `kind` ∈ `Enum | Entity | Variant | Rule | Trigger | Surface |
    Contract | Config | …`; `items[]` are fields / enum-variants / clauses, each
    with its own inner `kind` (e.g. `EnumVariant`, field defs, `with`/`where`).
  - `{ Default: { … } }` — defaults (25/66).
  - `{ Invariant: { … } }` — top-level invariants (4/66).
  - `{ OpenQuestion: { … } }` — open questions (4/66).
Every node carries a `span: {start,end}` → byte offsets for click-to-source.

### Node/edge model (derived by walking the AST)

- **Nodes:** one per `Block` (keyed by inner `kind`), plus `Invariant` and
  `OpenQuestion` declarations. Carry `kind`, `name`, raw items for the card, and
  `span` for jump-to-source.
- **Edges:**
  - entity field whose type names another entity → reference edge,
  - `with` relationship clauses → relationship edge,
  - `Variant` → base entity → "is-a" edge,
  - rule/trigger clauses referencing entity names → behaviour edges,
  - surface `exposes`/`provides` → boundary edges,
  - contract `demands`/`fulfils` → contract edges.
  (Edge derivation is name-resolution over the AST; unit-tested in isolation.)

### UI interaction (reuse strategy's "summon" model)

- **Shelf** groups nodes by construct kind (Entities, Enums, Rules, Surfaces…).
- Click a node → summoned centre-stage with full detail; connected nodes fan out
  around it; edges drawn with `EdgeLine`.
- Reuse strategy's amber/indicator pattern for `invariant`s and
  `open_question`s. **Bonus from spans:** a "reveal in editor" action on each
  card via `leaf.openFile(file, { eState: { line } })`.

---

## 4. Build order (incremental, each step verifiable)

1. **Nix + deps.** Flesh out `flake.nix` (nodejs_22, pnpm, esbuild; expose
   `allium-lsp` for the wasm-refresh step). Copy `package.json`, `tsconfig.json`,
   `esbuild.config.mjs` (+ the `.wasm` binary loader), `.gitignore` from
   strategy. `nix develop -c pnpm install`.
2. **Vendor + wire the WASM.** Copy `allium_wasm_bg.wasm` (3.5.0) into
   `src/wasm/`. Write `src/wasm/allium-wasm.ts` (trimmed bindgen glue, bundled
   bytes) exporting `parse`. Smoke-test from a vitest over `examples/*.allium`:
   `space-cards` → 66 decls / 0 diags, `scenes` → 2 diags at lines 443/459.
   **Round-trip already proven in-process (2026-06-20) with the fs-free glue;**
   this step just lands it in the repo build and locks it with a regression test.
3. **Empty plugin.** `manifest.json` (`isDesktopOnly: false`), `main.ts`
   registering the `allium` extension + a stub view. Build, sideload into a test
   vault, confirm `.allium` files open the custom view (blank).
4. **Types + transform.** `types.ts` for the AST union (`Block`/`Default`/
   `Invariant`/`OpenQuestion` + item kinds) and `AlliumNode`/`AlliumEdge`.
   `allium-ast.ts`: AST → nodes + edges. Capture the sample's parse JSON as a
   fixture; unit-test the transform in `allium-ast.test.ts`. **This is the bulk
   of the real work.**
5. **UI.** Copy `StrategyApp/NodeCard/EdgeLine`, retarget props to Allium
   nodes/edges, adjust `constants.ts` (per-kind icon/colour/label) and
   `main.css`. Render entities first; add enums/rules/surfaces incrementally.
6. **Diagnostics + jump-to-source.** Render `diagnostics[]` as a banner; add a
   "reveal in editor" card action using each node's `span`.
7. **Polish.** Icon (`getIcon`), display text, README + CLAUDE.md mirroring
   strategy's. (No settings tab needed — nothing to configure.)
8. **Ship.** `jj desc`, create the GitHub repo `krisajenkins/obsidian-allium`,
   push — *so this never gets lost again.*

---

## 5. Direct copies vs. genuinely new work

**Copy near-verbatim from obsidian-strategy:**
`esbuild.config.mjs`, `tsconfig.json`, `package.json` (devDeps), `main.ts`
(swap extension/view names), `*-view.svelte.ts` (swap names), the
`createClassComponent` mount pattern, the shelf/stage/summon UX, `EdgeLine`,
the `fileVersion` reactivity, CLAUDE.md/README structure.

**New for obsidian-allium:**
- `src/wasm/allium_wasm_bg.wasm` + `allium-wasm.ts` — vendored parser + trimmed,
  bundle-friendly bindgen glue (replaces strategy's hand parser).
- `allium-ast.ts` — AST→graph transform and its edge-derivation rules.
- `types.ts` — the (much larger) Allium AST + graph types.
- `constants.ts` — metadata for ~10 construct kinds (strategy has ~8).
- `esbuild.config.mjs` — one extra line: `loader: { ".wasm": "binary" }`.
- `flake.nix` — exposes `allium-lsp` so the vendored wasm can be refreshed.

---

## 6. Risks / things to verify early

- **Bundling the wasm:** confirm esbuild's `binary` loader yields a `Uint8Array`
  that `new WebAssembly.Module()` accepts. *The glue's fs/`__dirname`-free shape
  is already proven (2026-06-20) — `new WebAssembly.Module(readFileSync(...))`
  works in-process; the only remaining unknown is the esbuild `binary`-loader
  hand-off, validated when step 2 lands in the build.*
- **wasm-bindgen ABI:** the glue's pointer marshalling
  (`passStringToWasm0`/`getStringFromWasm0`/`__wbindgen_*`) must match the
  vendored `.wasm` exactly — always regenerate glue and wasm *together* from the
  same `allium-lsp` version. Pin both via the flake.
- **`parse`-only surface:** WASM exposes `parse`, not `analyse`/`check`. We get
  structural `diagnostics` but no reachability/conflict analysis. Acceptable for
  v1; if wanted later, add an *optional* desktop-only CLI path for `analyse`.
- **Large specs / layout:** strategy's radial "summon" layout sidesteps
  full-graph layout; keep that to avoid a layout-engine rabbit hole.
- **Language version drift:** spec files declare `-- allium: N`; the WASM is the
  same Rust parser as the CLI, so refreshing the vendored wasm (one flake build)
  keeps us current — no hand-maintained grammar.
