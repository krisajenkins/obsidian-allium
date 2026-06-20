import type { EdgeKind, NodeKind } from "./types";

/** Card face colours by construct kind. Light faces with dark text, matching
 *  the obsidian-strategy family look (theme-neutral, not Obsidian CSS vars, so
 *  the diagram renders the same under any theme). */
export const KIND_FACE: Record<string, { bg: string; fg: string; label: string }> = {
  Entity: { bg: "#d8dfe8", fg: "#1e2e4a", label: "Entity" },
  Value: { bg: "#d0e8e4", fg: "#1a3a34", label: "Value" },
  ExternalEntity: { bg: "#dde2e6", fg: "#33414a", label: "External" },
  Enum: { bg: "#e4ddf0", fg: "#352a50", label: "Enum" },
  Variant: { bg: "#ece2f4", fg: "#3d2c54", label: "Variant" },
  Rule: { bg: "#dceee4", fg: "#1e3a2a", label: "Rule" },
  Trigger: { bg: "#f0e4d0", fg: "#4a3210", label: "Trigger" },
  Surface: { bg: "#f0dce6", fg: "#5a1e38", label: "Surface" },
  Actor: { bg: "#efe2d2", fg: "#4a3216", label: "Actor" },
  Contract: { bg: "#dad8f0", fg: "#2a2550", label: "Contract" },
  Config: { bg: "#e2e4e8", fg: "#33383f", label: "Config" },
  Invariant: { bg: "#f0edd0", fg: "#4a4010", label: "Invariant" },
  OpenQuestion: { bg: "#e4e4ea", fg: "#3a3a48", label: "Open Question" },
};

/** Fallback face for an unfamiliar kind from a future language version. */
export const UNKNOWN_FACE = { bg: "#e0e0e0", fg: "#333", label: "?" };

export function faceOf(kind: string): { bg: string; fg: string; label: string } {
  return KIND_FACE[kind] ?? { ...UNKNOWN_FACE, label: kind };
}

/** Shelf sections: ordered groups of kinds. Each becomes a labelled band in
 *  the shelf; kinds within a section keep this order. */
export const SECTIONS: { label: string; kinds: NodeKind[] }[] = [
  { label: "Types", kinds: ["Entity", "Value", "ExternalEntity", "Enum", "Variant"] },
  { label: "Behaviour", kinds: ["Rule", "Trigger"] },
  { label: "Boundaries", kinds: ["Surface", "Actor", "Contract"] },
  { label: "Config", kinds: ["Config"] },
  { label: "Constraints", kinds: ["Invariant"] },
  { label: "Questions", kinds: ["OpenQuestion"] },
];

/** Section header colours, keyed by section label. */
export const SECTION_BADGE: Record<string, { bg: string; fg: string }> = {
  Types: { bg: "#2e5090", fg: "#dce8f8" },
  Behaviour: { bg: "#2a7a55", fg: "#dcf5e8" },
  Boundaries: { bg: "#9a3d6a", fg: "#f8dde8" },
  Config: { bg: "#5a5a68", fg: "#e8e8ee" },
  Constraints: { bg: "#9a7a10", fg: "#fdf6d8" },
  Questions: { bg: "#4a4a58", fg: "#e8e8ee" },
};

/** Edge colours by derived kind. */
export const EDGE_COLORS: Record<EdgeKind, string> = {
  reference: "#93c5fd", // data/type reference
  behaviour: "#6ee7a0", // rule/trigger → entity
  boundary: "#f0a3c0", // surface/actor → entity
  contract: "#a78bfa", // contract → type
};

/** One-sentence description for each construct kind (shown in the info card). */
export const KIND_DESCRIPTION: Record<string, string> = {
  Entity: "A thing in the domain with identity and fields that change over time.",
  Value: "An immutable value type — defined wholly by its fields, with no identity.",
  ExternalEntity: "An entity owned by another system, referenced but not governed here.",
  Enum: "A closed set of named literal values.",
  Variant: "A named case of a base entity — a sum-type member.",
  Rule: "A behaviour: when some condition holds, it ensures an outcome.",
  Trigger: "A temporal behaviour that fires when a field reaches a state.",
  Surface: "A boundary that exposes data and provides actions to an audience.",
  Actor: "A role that interacts with the system, identified by a query over entities.",
  Contract: "A typed interface of demands and fulfilments between surfaces.",
  Config: "Tunable parameters referenced by rules instead of magic numbers.",
  Invariant: "A property that must hold across the whole domain at all times.",
  OpenQuestion: "An unresolved design question recorded in the spec.",
};

/** Card dimensions used by the fan layout. */
export const CARD_WIDTH = 150;
export const CARD_HEIGHT = 64;
