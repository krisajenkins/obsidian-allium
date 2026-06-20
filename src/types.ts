// Types for the Allium AST (as emitted by the vendored wasm `parse()`), plus the
// derived node/edge graph the UI consumes.
//
// The AST is an externally-tagged union at every level: each node is a
// single-key object whose key is the variant tag (e.g. `{ Block: {...} }`,
// `{ Ident: {...} }`). We type the *declaration and item skeleton* precisely
// — that's the structure the transform walks — but treat the rich expression
// grammar (Call, MemberAccess, Comparison, For, Lambda, …) as a loose
// recursive `Expr`. The transform never interprets expressions; it only
// harvests the identifiers inside them (see allium-ast.ts), so a structural
// type is enough and saves us mirroring the whole grammar.

// ---------------------------------------------------------------------------
// Raw AST
// ---------------------------------------------------------------------------

export interface Span {
  start: number;
  end: number;
}

/** A bare name occurrence — declaration names, field names, enum-variant names.
 *  Distinct from an `Ident` *expression* (`{ Ident: NameRef }`), which is a
 *  reference in value position. */
export interface NameRef {
  span: Span;
  name: string;
}

export interface ParseResult {
  module: Module;
  diagnostics: Diagnostic[];
}

export interface Module {
  span: Span;
  version: number | null;
  declarations: Declaration[];
}

export interface Diagnostic {
  span: Span;
  message: string;
  /** "Error" | "Warning" | … (parser severities). */
  severity: string;
}

/** The block kinds the language defines. Kept as a union for the known set but
 *  widened with `string` so an unfamiliar kind from a future language version
 *  degrades gracefully rather than breaking the build. */
export type BlockKind =
  | "Enum"
  | "Entity"
  | "Variant"
  | "Rule"
  | "Trigger"
  | "Surface"
  | "Contract"
  | "Config"
  | "ExternalEntity"
  | "Value"
  | "Actor";

export type Declaration =
  | { Block: BlockDecl }
  | { Default: DefaultDecl }
  | { Invariant: InvariantDecl }
  | { OpenQuestion: OpenQuestionDecl };

export interface BlockDecl {
  span: Span;
  kind: BlockKind | string;
  /** Null for anonymous blocks (e.g. `config`). */
  name: NameRef | null;
  items: Item[];
}

export interface DefaultDecl {
  span: Span;
  type_alias: NameRef | null;
  type_name: NameRef;
  name: NameRef;
  value: Expr;
}

export interface InvariantDecl {
  span: Span;
  name: NameRef;
  body: Expr;
}

export interface OpenQuestionDecl {
  span: Span;
  text: TextNode;
}

/** Interpolated string / prose body: a list of literal `Text` and expression parts. */
export interface TextNode {
  span: Span;
  parts: TextPart[];
}
export type TextPart = { Text: string } | { [tag: string]: unknown };

export interface Item {
  span: Span;
  kind: ItemKind;
}

export type ItemKind =
  | { Assignment: { name: NameRef; value: Expr } }
  | { Clause: { keyword: string; value: Expr } }
  | { EnumVariant: { name: NameRef; backtick_quoted: boolean } }
  | { FieldWithWhen: { name: NameRef; value: Expr; when_clause: unknown } }
  | { Let: { name: NameRef; value: Expr } }
  | { Annotation: { kind: string; name: NameRef; body: string[]; span: Span } }
  | { TransitionsBlock: { field: NameRef; edges: unknown; terminal: unknown; span: Span } }
  | { [tag: string]: unknown };

/** The expression grammar, left structural on purpose. Every expression is an
 *  externally-tagged single-key object; the only variant the transform cares
 *  about is `Ident` (a reference in value position). */
export type Expr = { Ident: NameRef } | { [tag: string]: unknown };

// ---------------------------------------------------------------------------
// Derived graph (consumed by the UI)
// ---------------------------------------------------------------------------

/** One node per named declaration: every Block, plus Invariants and
 *  OpenQuestions. Defaults are instance data, not structure, so they are not
 *  nodes. */
export type NodeKind = BlockKind | "Invariant" | "OpenQuestion";

export interface AlliumNode {
  /** Unique key within the graph; the declaration name where it has one. */
  id: string;
  kind: NodeKind | string;
  /** Display name (for anonymous/text declarations, a synthesized label). */
  name: string;
  span: Span;
  /** The raw declaration, so the card can render full detail. */
  decl: Declaration;
}

/** How one node references another. Derived from the *source* node's kind
 *  rather than the syntactic position — good enough for colouring edges. */
export type EdgeKind =
  | "reference" // data/type reference (entity field, value, invariant body)
  | "behaviour" // rule/trigger referencing an entity
  | "boundary" // surface/actor referencing an entity
  | "contract"; // contract referencing a type

export interface AlliumEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface AlliumGraph {
  nodes: AlliumNode[];
  edges: AlliumEdge[];
  diagnostics: Diagnostic[];
  version: number | null;
}
