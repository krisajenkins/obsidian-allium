// Bundle entry point for the Allium parser: feeds the esbuild-inlined wasm
// bytes into the portable glue, then re-exports `parse`. This is the file the
// plugin imports. The unit test imports `./allium-wasm` directly with bytes
// from `fs`, so this loader (which depends on the esbuild `.wasm` loader) stays
// out of the test path.
import wasmBytes from "./allium_wasm_bg.wasm";
import { initAlliumWasm, parse } from "./allium-wasm";

initAlliumWasm(wasmBytes);

export { parse };
