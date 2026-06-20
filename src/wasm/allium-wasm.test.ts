import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { initAlliumWasm, isAlliumWasmReady, parse } from "./allium-wasm";

const wasmPath = fileURLToPath(
  new URL("./allium_wasm_bg.wasm", import.meta.url),
);
const example = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../examples/${name}`, import.meta.url)),
    "utf8",
  );

interface Diagnostic {
  span: { start: number; end: number };
  message: string;
  severity: string;
}
interface ParseResult {
  module: { declarations: unknown[] };
  diagnostics: Diagnostic[];
}

const parseExample = (name: string): ParseResult =>
  JSON.parse(parse(example(name)));

beforeAll(() => {
  initAlliumWasm(readFileSync(wasmPath));
});

describe("allium wasm parser", () => {
  it("initialises from vendored bytes", () => {
    expect(isAlliumWasmReady()).toBe(true);
  });

  it("round-trips space-cards.allium (v3): 66 decls, 0 diagnostics", () => {
    const ast = parseExample("space-cards.allium");
    expect(ast.module.declarations).toHaveLength(66);
    expect(ast.diagnostics).toHaveLength(0);
  });

  it("round-trips dictat.allium (v2): 28 decls, 0 diagnostics", () => {
    const ast = parseExample("dictat.allium");
    expect(ast.module.declarations).toHaveLength(28);
    expect(ast.diagnostics).toHaveLength(0);
  });

  it("surfaces parse errors in scenes.allium (v2): 57 decls, 2 errors", () => {
    const ast = parseExample("scenes.allium");
    expect(ast.module.declarations).toHaveLength(57);
    expect(ast.diagnostics).toHaveLength(2);
    expect(ast.diagnostics.every((d) => d.severity === "Error")).toBe(true);
    // The two errors sit at byte offsets on lines 443 and 459 (verified against
    // `allium check`). Confirm they land on those lines.
    const src = example("scenes.allium");
    const lineOf = (offset: number) => src.slice(0, offset).split("\n").length;
    const lines = ast.diagnostics
      .map((d) => lineOf(d.span.start))
      .sort((a, b) => a - b);
    expect(lines).toEqual([443, 459]);
  });

  it("returns structural diagnostics but no semantic ones (parse-only)", () => {
    // `allium check` also flags allium.surface.unusedBinding in scenes; the
    // parse-only wasm must not, by design. So scenes has exactly 2 (both parse).
    const ast = parseExample("scenes.allium");
    expect(ast.diagnostics).toHaveLength(2);
  });
});
