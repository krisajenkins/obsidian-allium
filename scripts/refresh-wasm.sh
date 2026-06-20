#!/usr/bin/env bash
# Re-vendor the Allium parser wasm from the allium-lsp on PATH.
#
# The vendored src/wasm/allium_wasm_bg.wasm is the wasm-bindgen build of the
# same Rust parser as the `allium` CLI. When the language version bumps, point
# your environment at the new allium-lsp (Nix profile) and run this to refresh.
#
# Usage: scripts/refresh-wasm.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="$here/src/wasm/allium_wasm_bg.wasm"

lsp="$(command -v allium-lsp || true)"
if [[ -z "$lsp" ]]; then
  echo "error: allium-lsp not found on PATH (enter the dev shell / nix profile)" >&2
  exit 1
fi
lsp="$(readlink -f "$lsp")"
src="$(dirname "$lsp")/../lib/allium-lsp/allium_wasm_bg.wasm"

if [[ ! -f "$src" ]]; then
  echo "error: wasm not found next to allium-lsp at $src" >&2
  exit 1
fi

version="$(allium --version 2>/dev/null | head -1 || echo unknown)"
cp "$src" "$dest"
chmod u+w "$dest"
echo "refreshed $dest"
echo "  from: $src"
echo "  $version"
echo "  sha256: $(shasum -a 256 "$dest" | cut -d' ' -f1)"
echo
echo "Run 'pnpm test' to re-confirm the parser round-trips, then commit the wasm."
