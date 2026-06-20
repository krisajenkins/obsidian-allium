# Obsidian Allium

An Obsidian plugin that renders [Allium](https://github.com/juxt) `.allium`
specification files as an interactive domain-model explorer — the same
shelf-and-stage family as [obsidian-strategy](https://github.com/krisajenkins/obsidian-strategy).

Allium is a language for specifying a domain: its entities, values, enums and
variants; the rules and triggers that govern behaviour; the surfaces, actors
and contracts at its boundary; and the invariants and open questions that keep
it honest. This plugin parses `.allium` files **in-process** (the real Rust
parser, compiled to WebAssembly and bundled into the plugin) and presents the
result as a navigable graph.

## How it works

- `.allium` files appear in the Obsidian file browser and open directly in the
  visualizer.
- A **shelf** on the left lists every declaration, grouped into sections —
  Types (entities, values, enums, variants, externals), Behaviour (rules,
  triggers), Boundaries (surfaces, actors, contracts), Config, Constraints
  (invariants) and Questions.
- Click any declaration to **summon** it to the central **stage**, where its
  source detail is shown and the declarations it references fan out around it,
  connected by coloured edges.
- Click a fanned card to hop to it, walking the reference graph.
- Parse **diagnostics** appear as a banner with `line:col` coordinates; click
  one to jump to the declaration it sits in.
- Click the background to dismiss.

## Construct types

| Section     | Kinds                                            |
| ----------- | ------------------------------------------------ |
| Types       | Entity · Value · External · Enum · Variant       |
| Behaviour   | Rule · Trigger                                   |
| Boundaries  | Surface · Actor · Contract                       |
| Config      | Config                                           |
| Constraints | Invariant                                        |
| Questions   | Open Question                                    |

Edges are derived by walking the AST: an identifier in expression position
(an entity-typed field, a rule's `when`/`ensures`, a surface's `exposes`, an
actor's `identified_by`, an invariant body) that names another declaration
becomes an edge, coloured by the referring construct.

## The parser

The plugin bundles `allium_wasm_bg.wasm` — the same Rust parser as the `allium`
CLI, compiled with wasm-bindgen — and calls `parse()` in-process. No subprocess,
no `allium` on `PATH`, and it runs on mobile (`isDesktopOnly: false`). The
parser is `parse`-only: it returns the AST and **structural** diagnostics, but
not the CLI's semantic analysis (reachability, conflicts, unused bindings).

To refresh the vendored wasm when the language version bumps:

```bash
./scripts/refresh-wasm.sh   # copies the wasm from the allium-lsp on PATH
```

## Building

Requires Node.js 22 and pnpm (provided by the Nix flake).

```bash
nix develop -c pnpm install
nix develop -c pnpm run dev    # watch mode
nix develop -c pnpm run build  # production build → main.js + main.css
nix develop -c pnpm run test   # parser + transform tests (vitest)
```

Symlink the project directory into your vault's `.obsidian/plugins/` folder and
enable the plugin.

## Status

Early prototype. The Allium language and this visualizer are both evolving.
