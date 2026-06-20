import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { initAlliumWasm, parse } from "./wasm/allium-wasm";
import { buildGraph, harvestIdents } from "./allium-ast";
import type { AlliumGraph, ParseResult } from "./types";

// Drive the real parser through the portable glue (not the bundle entry), then
// feed its AST to the pure transform — exactly what ships, minus the esbuild
// wasm import that vitest can't resolve.

const wasmPath = fileURLToPath(
  new URL("./wasm/allium_wasm_bg.wasm", import.meta.url),
);
const example = (name: string) =>
  readFileSync(
    fileURLToPath(new URL(`../examples/${name}`, import.meta.url)),
    "utf8",
  );

const graphOf = (name: string): AlliumGraph =>
  buildGraph(JSON.parse(parse(example(name))) as ParseResult);

beforeAll(() => {
  initAlliumWasm(readFileSync(wasmPath));
});

describe("buildGraph", () => {
  it("makes one node per Block + Invariant + OpenQuestion (space-cards)", () => {
    // 33 blocks + 4 invariants + 4 open questions = 41; the 25 Defaults are not nodes.
    const g = graphOf("space-cards.allium");
    expect(g.version).toBe(3);
    expect(g.nodes).toHaveLength(41);
    expect(g.diagnostics).toHaveLength(0);
    const kinds = countBy(g.nodes.map((n) => n.kind));
    expect(kinds).toMatchObject({
      Entity: 8,
      Enum: 2,
      Rule: 18,
      Surface: 2,
      Actor: 2,
      Config: 1,
      Invariant: 4,
      OpenQuestion: 4,
    });
  });

  it("counts nodes for dictat (v2) and scenes (v2)", () => {
    const dictat = graphOf("dictat.allium");
    expect(dictat.version).toBe(2);
    expect(dictat.nodes).toHaveLength(28); // 25 blocks + 3 invariants
    expect(dictat.diagnostics).toHaveLength(0);

    const scenes = graphOf("scenes.allium");
    expect(scenes.version).toBe(2);
    expect(scenes.nodes).toHaveLength(57); // 49 blocks + 8 invariants
    expect(scenes.diagnostics).toHaveLength(2);
  });

  it("gives every node a unique, non-empty id", () => {
    const g = graphOf("space-cards.allium");
    const ids = g.nodes.map((n) => n.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("synthesizes an id for the anonymous config block", () => {
    const g = graphOf("space-cards.allium");
    const config = g.nodes.find((n) => n.kind === "Config");
    expect(config).toBeDefined();
    expect(config?.id).toBeTruthy();
  });

  describe("edges", () => {
    it("derives a reference edge for an entity-typed field (CardDef → SlotDef)", () => {
      // CardDef.slots = with SlotDef where card_def = this
      const g = graphOf("space-cards.allium");
      expect(g.edges).toContainEqual({
        from: "CardDef",
        to: "SlotDef",
        kind: "reference",
      });
    });

    it("derives a boundary edge from an actor's identified_by (AuthenticatedUser → User)", () => {
      const g = graphOf("space-cards.allium");
      expect(g.edges).toContainEqual({
        from: "AuthenticatedUser",
        to: "User",
        kind: "boundary",
      });
    });

    it("derives behaviour edges from rules to the entities they name", () => {
      const g = graphOf("space-cards.allium");
      const ruleIds = new Set(
        g.nodes.filter((n) => n.kind === "Rule").map((n) => n.id),
      );
      const behaviour = g.edges.filter((e) => e.kind === "behaviour");
      expect(behaviour.length).toBeGreaterThan(0);
      expect(behaviour.every((e) => ruleIds.has(e.from))).toBe(true);
    });

    it("only connects real nodes, with no self-edges or duplicates", () => {
      const g = graphOf("space-cards.allium");
      const ids = new Set(g.nodes.map((n) => n.id));
      for (const e of g.edges) {
        expect(ids.has(e.from)).toBe(true);
        expect(ids.has(e.to)).toBe(true);
        expect(e.from).not.toBe(e.to);
      }
      const keys = g.edges.map((e) => `${e.from} ${e.to} ${e.kind}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});

describe("harvestIdents", () => {
  it("collects identifiers in expression position, ignoring bare names", () => {
    // { Ident: { name } } is a reference; bare { name } (a declaration/field) is not.
    const value = {
      Assignment: {
        name: { span: { start: 0, end: 1 }, name: "field" }, // declaration name — ignored
        value: { Ident: { span: { start: 2, end: 3 }, name: "Referenced" } },
      },
    };
    expect(harvestIdents(value)).toEqual(["Referenced"]);
  });

  it("recurses through nested expressions and arrays", () => {
    const value = {
      Comparison: {
        left: { MemberAccess: { object: { Ident: { name: "a" } }, field: { name: "x" } } },
        right: { Call: { function: { Ident: { name: "B" } }, args: [{ Ident: { name: "C" } }] } },
      },
    };
    expect(harvestIdents(value).sort()).toEqual(["B", "C", "a"]);
  });

  it("returns nothing for primitives and null", () => {
    expect(harvestIdents(null)).toEqual([]);
    expect(harvestIdents("x")).toEqual([]);
    expect(harvestIdents(42)).toEqual([]);
  });
});

function countBy(items: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item] = (out[item] ?? 0) + 1;
  return out;
}
