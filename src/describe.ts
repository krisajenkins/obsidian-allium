// Turn a declaration into a structured, compact detail for the summoned card.
// We work from each item's source span (truncated) rather than fully typing the
// expression grammar — honest to the spec text, robust across language versions,
// and far more legible than dumping a whole clause verbatim.

import type { AlliumNode, Item } from "./types";

export interface DetailRow {
  /** Field name, clause keyword, or annotation tag. May be empty (e.g. enum). */
  label: string;
  /** The value/body text, collapsed and truncated. */
  value: string;
}

export type NodeDetail =
  | { type: "fields"; rows: DetailRow[] }
  | { type: "clauses"; rows: DetailRow[] }
  | { type: "variants"; names: string[] }
  | { type: "text"; text: string }
  | { type: "none" };

const FIELD_MAX = 52;
const CLAUSE_MAX = 96;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Source text for a span, collapsed to one line. */
function slice(source: string, start: number, end: number): string {
  return collapse(source.slice(start, end));
}

/** A field row: `name` + the text after it (its type / definition). */
function fieldRow(source: string, name: string, item: Item): DetailRow {
  const raw = slice(source, item.span.start, item.span.end);
  // Drop the leading `name` and any `:`/`=` separator to leave just the value.
  const value = raw.slice(name.length).replace(/^\s*[:=]?\s*/, "");
  return { label: name, value: truncate(value, FIELD_MAX) };
}

/** Build the structured detail for a node. */
export function nodeDetail(node: AlliumNode, source: string): NodeDetail {
  const decl = node.decl;

  if ("OpenQuestion" in decl) {
    return { type: "text", text: slice(source, decl.OpenQuestion.text.span.start, decl.OpenQuestion.text.span.end) };
  }
  if ("Invariant" in decl) {
    const bodyStart = (decl.Invariant.body as { span?: { start: number } }).span?.start ?? node.span.start;
    return { type: "text", text: slice(source, bodyStart, decl.Invariant.span.end) };
  }
  if (!("Block" in decl)) return { type: "none" };

  const kind = decl.Block.kind;
  const items = decl.Block.items;

  if (kind === "Enum") {
    const names = items
      .map((it) => ("EnumVariant" in it.kind ? (it.kind.EnumVariant as { name: { name: string } }).name.name : null))
      .filter((n): n is string => !!n);
    return { type: "variants", names };
  }

  // Behaviour & boundary blocks read as clause lists; data blocks as fields.
  const isClausey = kind === "Rule" || kind === "Trigger" || kind === "Surface" || kind === "Actor" || kind === "Contract";
  const rows: DetailRow[] = [];
  for (const it of items) {
    const k = it.kind as Record<string, { keyword?: string; name?: { name: string }; kind?: string }>;
    if ("Clause" in k && k.Clause.keyword) {
      const raw = slice(source, it.span.start, it.span.end);
      const value = raw.replace(new RegExp(`^${k.Clause.keyword}\\s*:?\\s*`), "");
      rows.push({ label: k.Clause.keyword, value: truncate(value, CLAUSE_MAX) });
    } else if ("Assignment" in k && k.Assignment.name) {
      rows.push(fieldRow(source, k.Assignment.name.name, it));
    } else if ("FieldWithWhen" in k && k.FieldWithWhen.name) {
      rows.push(fieldRow(source, k.FieldWithWhen.name.name, it));
    } else if ("Let" in k && k.Let.name) {
      rows.push({ label: `let ${k.Let.name.name}`, value: "" });
    } else if ("Annotation" in k && k.Annotation.kind) {
      rows.push({ label: `@${k.Annotation.kind.toLowerCase()}`, value: k.Annotation.name?.name ?? "" });
    } else if ("TransitionsBlock" in k) {
      rows.push({ label: "transitions", value: "" });
    }
  }

  if (rows.length === 0) return { type: "none" };
  return { type: isClausey ? "clauses" : "fields", rows };
}
