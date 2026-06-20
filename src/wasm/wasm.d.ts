// esbuild's `binary` loader turns a `.wasm` import into a Uint8Array default
// export. Declare that for TypeScript (vitest never imports the .wasm directly).
declare module "*.wasm" {
  const bytes: Uint8Array<ArrayBuffer>;
  export default bytes;
}
