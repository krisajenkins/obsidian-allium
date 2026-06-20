// Trimmed, environment-agnostic wasm-bindgen glue for the Allium parser.
//
// This is the portable core: the wasm-bindgen string marshalling plus a
// `parse(source): string` wrapper. It deliberately contains NO `fs`,
// `__dirname`, or wasm import — the caller supplies the wasm bytes via
// `initAlliumWasm(bytes)`. That keeps this module identical across the esbuild
// bundle (bytes from the `.wasm` binary loader) and vitest (bytes from `fs`),
// so the unit test exercises exactly what ships.
//
// Regenerate together with allium_wasm_bg.wasm via scripts/refresh-wasm.sh —
// the pointer ABI below must match the vendored wasm exactly.

interface AlliumWasmExports {
  memory: WebAssembly.Memory;
  parse(ptr: number, len: number): [number, number];
  __wbindgen_malloc(size: number, align: number): number;
  __wbindgen_realloc(
    ptr: number,
    oldSize: number,
    newSize: number,
    align: number,
  ): number;
  __wbindgen_free(ptr: number, size: number, align: number): void;
  __wbindgen_externrefs: WebAssembly.Table;
  __wbindgen_start(): void;
}

let wasm: AlliumWasmExports | null = null;
let WASM_VECTOR_LEN = 0;
let cachedUint8ArrayMemory: Uint8Array | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
textDecoder.decode();

function w(): AlliumWasmExports {
  if (!wasm) {
    throw new Error(
      "Allium wasm not initialised — call initAlliumWasm(bytes) first",
    );
  }
  return wasm;
}

function getUint8ArrayMemory(): Uint8Array {
  if (
    cachedUint8ArrayMemory === null ||
    cachedUint8ArrayMemory.byteLength === 0
  ) {
    cachedUint8ArrayMemory = new Uint8Array(w().memory.buffer);
  }
  return cachedUint8ArrayMemory;
}

function passStringToWasm(arg: string): number {
  const { __wbindgen_malloc: malloc, __wbindgen_realloc: realloc } = w();
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory();

  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 0x7f) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) arg = arg.slice(offset);
    ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
    const view = getUint8ArrayMemory().subarray(ptr + offset, ptr + len);
    const ret = textEncoder.encodeInto(arg, view);
    offset += ret.written ?? 0;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}

function getStringFromWasm(ptr: number, len: number): string {
  ptr = ptr >>> 0;
  return textDecoder.decode(getUint8ArrayMemory().subarray(ptr, ptr + len));
}

function buildImports(): WebAssembly.Imports {
  const import0 = {
    __proto__: null,
    __wbindgen_init_externref_table(): void {
      const table = w().__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, undefined);
      table.set(offset + 0, undefined);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    },
  };
  return { "./allium_wasm_bg.js": import0 } as unknown as WebAssembly.Imports;
}

/** Instantiate the parser from raw wasm bytes. Idempotent. */
export function initAlliumWasm(bytes: BufferSource): void {
  if (wasm) return;
  const mod = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(mod, buildImports());
  wasm = instance.exports as unknown as AlliumWasmExports;
  cachedUint8ArrayMemory = null;
  wasm.__wbindgen_start();
}

/** True once `initAlliumWasm` has run. */
export function isAlliumWasmReady(): boolean {
  return wasm !== null;
}

/** Parse Allium source and return the AST as a JSON string. */
export function parse(source: string): string {
  const exports = w();
  let d0 = 0;
  let d1 = 0;
  try {
    const ptr = passStringToWasm(source);
    const len = WASM_VECTOR_LEN;
    const ret = exports.parse(ptr, len);
    d0 = ret[0];
    d1 = ret[1];
    return getStringFromWasm(ret[0], ret[1]);
  } finally {
    exports.__wbindgen_free(d0, d1, 1);
  }
}
