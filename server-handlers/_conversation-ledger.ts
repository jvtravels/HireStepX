/* PDF #28 follow-up — Conversation Ledger (Month 1 PR-1, 2026-06-07).
 *
 * SINGLE SOURCE OF TRUTH for everything the bot has captured, asked,
 * said, or failed to understand during a salary-negotiation session.
 *
 * # Why this exists
 *
 * Pre-ledger, the same fact ("candidate's current CTC is 44 LPA") was
 * potentially tracked across five separate places:
 *
 *   1. state.candidateCurrentCtc                 (kernel slot, main parser)
 *   2. state.pendingCandidateAcks[]              (one-turn ack labels)
 *   3. state.askedTopics[]                       (dedup ledger, typed topics only)
 *   4. state.conversationLog[]                   (raw transcript)
 *   5. state.userClaims{}                        (separate claim ledger)
 *
 * Each writer had its own regex / detection logic. Each reader queried
 * one of the five. The CTC re-ask bug (PDF #28 transcript) happened
 * because the main parser missed a phrasing the disclosure tracker
 * caught, and the planner only consulted the main parser's slot.
 *
 * This module collapses all five surfaces into ONE append-only ledger.
 * Every fact has exactly one writer kind. Every reader queries through
 * the same API. First-disclosure-wins so a later misparse cannot
 * clobber a correctly-captured value.
 *
 * # Invariants
 *
 *   I1. Append-only. Entries are never mutated or removed.
 *   I2. First-wins for facts. Once Ledger.hasFact(kind) is true, a
 *       later write for the same kind appends a new entry (audit
 *       trail) but Ledger.getFact still returns the FIRST value.
 *   I3. Strict typing. Every entry has a discriminated `kind` field;
 *       readers narrow via the discriminant, no runtime casts.
 *   I4. Pure. No I/O, no Date.now(), no Math.random() — every entry
 *       carries the originating turn index so replays are
 *       deterministic.
 *
 * # Migration sequence (this file = PR-1)
 *
 *   PR-1 (this PR): add module + state field, no callers change. Pure
 *         addition. Zero behavior change in prod.
 *   PR-2: dual-write from existing fact writers (main parser,
 *         disclosure tracker, applyAiMove askedTopics push).
 *   PR-3: migrate dedup readers (canRefire, isAskedTopicAnswered).
 *   PR-4: migrate fact readers (planner branches, prose templates).
 *   PR-5: replay-the-PDF regression scenarios.
 *   PR-6: lock direct slot writes behind syncFromLedger + ESLint rule.
 *
 * Until PR-6, the kernel state slots remain authoritative. This PR is
 * purely additive infrastructure.
 *
 * # Field-kind taxonomy
 *
 * The eight `fact-*` kinds cover every candidate-disclosable fact the
 * planner currently gates on. Extending requires:
 *   1. New `fact-*` kind in LedgerEntry discriminated union.
 *   2. New writer in `recordFact` switch (or generic recordFactGeneric).
 *   3. New reader in `getFact` if planner gates on it.
 *   4. Unit test asserting first-wins and source tracking. */

/* DiscoveryTopic is defined in _negotiation-kernel.ts. Using `import type`
 * avoids a runtime circular dependency — TS emits zero runtime code for
 * type-only imports so the module load graph stays acyclic. */
import type { DiscoveryTopic } from "./_negotiation-kernel";

// ============================================================================
// Type-only re-export: the planner module exports NextAction; importing it
// would create a circular dep (ledger ← kernel ← planner ← ledger). Instead
// we type-tag emitted actions by their `kind` string and keep the full
// action shape opaque here. The kernel writer site has the typed value.
// ============================================================================

/** Opaque action handle. Carries the NextAction.kind for diagnostics
 *  and an optional satisfiesTopic tag for the dedup query. The full
 *  action shape lives in _next-action-planner; this module only needs
 *  to know what was emitted, not how to re-emit it. */
export interface LedgerActionRef {
  readonly kind: string;
  readonly satisfiesTopic?: DiscoveryTopic | null;
}

/** Source attribution for fact entries. Lets us see which detection
 *  layer wrote the value — useful for diagnosing why a fact landed
 *  with one phrasing but not another. */
export type LedgerFactSource =
  | "main-parser"          // parseCandidateAnswer in _negotiation-kernel
  | "disclosure-tracker"   // _candidate-disclosure-tracker write-through
  | "manual"               // explicit test fixture or admin override
  | "inferred";            // derived from another fact (e.g. hike% from ctc+target)

/** Reason a candidate utterance was tagged unclassified. Drives the
 *  empty-prose recovery counter and informs future probe selection. */
export type UnclassifiedReason =
  | "terse"                // "okay", "next", "fine", "hmm"
  | "non-cooperative"      // "I don't know", "I already told you that"
  | "off-topic"            // candidate asks a question instead of answering
  | "refusal"              // explicit "I don't want to share that"
  | "uninterpretable";     // STT garbage or empty text

// ============================================================================
// LedgerEntry — discriminated union covering every recordable event
// ============================================================================

export type LedgerEntry =
  // Candidate-disclosed facts. First-wins.
  | { kind: "fact-current-ctc";       value: number;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-current-company";   value: string;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-target-ctc";        value: number;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-notice-period-days"; value: number; atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-competing-offer";   value: number;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-joining-date";      value: string;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-component-base";    value: number;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-component-variable"; value: number; atTurn: number; source: LedgerFactSource; rawUtterance: string }
  | { kind: "fact-component-equity";  value: number;  atTurn: number; source: LedgerFactSource; rawUtterance: string }
  // Bot-side asks. Used by canRefire to dedup probes.
  | { kind: "asked-topic"; topic: DiscoveryTopic; atTurn: number; actionRef: LedgerActionRef }
  // Bot-side emissions. Full audit of what the bot said and when.
  | { kind: "emitted-action"; action: LedgerActionRef; atTurn: number; prose: string }
  // Candidate-side non-answers. Drives empty-prose recovery + flow control.
  | { kind: "unclassified-candidate"; text: string; atTurn: number; reason: UnclassifiedReason }
  // Explicit refusals on a specific topic. Distinct from unclassified —
  // the candidate engaged but declined the probe. Planner must NOT refire.
  | { kind: "candidate-refusal"; refused: DiscoveryTopic; atTurn: number; rawUtterance: string };

/** Discriminator helpers — type predicates so consumers can filter
 *  with TypeScript's narrowing instead of runtime kind checks. */
export const isFactEntry = (e: LedgerEntry): e is Extract<LedgerEntry, { kind: `fact-${string}` }> =>
  e.kind.startsWith("fact-");
export const isAskedTopicEntry = (e: LedgerEntry): e is Extract<LedgerEntry, { kind: "asked-topic" }> =>
  e.kind === "asked-topic";
export const isEmittedActionEntry = (e: LedgerEntry): e is Extract<LedgerEntry, { kind: "emitted-action" }> =>
  e.kind === "emitted-action";
export const isUnclassifiedEntry = (e: LedgerEntry): e is Extract<LedgerEntry, { kind: "unclassified-candidate" }> =>
  e.kind === "unclassified-candidate";
export const isRefusalEntry = (e: LedgerEntry): e is Extract<LedgerEntry, { kind: "candidate-refusal" }> =>
  e.kind === "candidate-refusal";

// ============================================================================
// ConversationLedger — the container
// ============================================================================

export interface ConversationLedger {
  /** Append-only entry list. Ordered by insertion (== chronological
   *  within a session). Never mutated in place after the writer
   *  returns. */
  readonly entries: ReadonlyArray<LedgerEntry>;
}

/** Construct a fresh empty ledger. Used by createInitialState in the
 *  kernel and by every unit test. */
export function emptyLedger(): ConversationLedger {
  return { entries: [] };
}

// ============================================================================
// FactKind type-narrowing helper
// ============================================================================

export type FactKind =
  | "current-ctc"
  | "current-company"
  | "target-ctc"
  | "notice-period-days"
  | "competing-offer"
  | "joining-date"
  | "component-base"
  | "component-variable"
  | "component-equity";

/** Map a FactKind to the value type that fact carries. String for
 *  current-company and joining-date; number for everything else.
 *  We use this rather than indexed access on FactEntry<K> because
 *  TypeScript cannot narrow a discriminated-union indexed access
 *  through a generic K — it widens to `never`. */
export type FactValue<K extends FactKind> =
  K extends "current-company" | "joining-date" ? string : number;

// ============================================================================
// Writers — every write returns a NEW ledger; original is never mutated
// ============================================================================

function append(led: ConversationLedger, entry: LedgerEntry): ConversationLedger {
  return { entries: [...led.entries, entry] };
}

/** Record a candidate-disclosed fact. Append-only (audit trail
 *  preserved across multiple disclosures of the same fact). Use
 *  Ledger.getFact to read — first-wins is enforced there. */
export function recordFact<K extends FactKind>(
  led: ConversationLedger,
  factKind: K,
  value: FactValue<K>,
  source: LedgerFactSource,
  atTurn: number,
  rawUtterance: string,
): ConversationLedger {
  // Switch over the literal kind so the value type lines up structurally.
  // Each case constructs the typed entry; TS narrows correctly because
  // the discriminated union is symmetric for the value type per kind.
  switch (factKind) {
    case "current-ctc":
      return append(led, { kind: "fact-current-ctc", value: value as number, atTurn, source, rawUtterance });
    case "current-company":
      return append(led, { kind: "fact-current-company", value: value as string, atTurn, source, rawUtterance });
    case "target-ctc":
      return append(led, { kind: "fact-target-ctc", value: value as number, atTurn, source, rawUtterance });
    case "notice-period-days":
      return append(led, { kind: "fact-notice-period-days", value: value as number, atTurn, source, rawUtterance });
    case "competing-offer":
      return append(led, { kind: "fact-competing-offer", value: value as number, atTurn, source, rawUtterance });
    case "joining-date":
      return append(led, { kind: "fact-joining-date", value: value as string, atTurn, source, rawUtterance });
    case "component-base":
      return append(led, { kind: "fact-component-base", value: value as number, atTurn, source, rawUtterance });
    case "component-variable":
      return append(led, { kind: "fact-component-variable", value: value as number, atTurn, source, rawUtterance });
    case "component-equity":
      return append(led, { kind: "fact-component-equity", value: value as number, atTurn, source, rawUtterance });
    default: {
      // Exhaustiveness check — if a new FactKind is added without a
      // case here, TS errors at compile time.
      const _exhaustive: never = factKind;
      return _exhaustive;
    }
  }
}

/** Record that the bot asked about a specific DiscoveryTopic. Used by
 *  canRefire to dedup probes. Append-only — multiple asks of the same
 *  topic across turns each get an entry (proves the refire chain). */
export function recordAskedTopic(
  led: ConversationLedger,
  topic: DiscoveryTopic,
  atTurn: number,
  actionRef: LedgerActionRef,
): ConversationLedger {
  return append(led, { kind: "asked-topic", topic, atTurn, actionRef });
}

/** Record a bot-emitted action and its final prose. Useful for
 *  diagnostics ("what did the bot actually say at turn 7?") and for
 *  the future empty-prose contract assertion (no emitted-action
 *  entry may have empty prose). */
export function recordEmittedAction(
  led: ConversationLedger,
  action: LedgerActionRef,
  atTurn: number,
  prose: string,
): ConversationLedger {
  return append(led, { kind: "emitted-action", action, atTurn, prose });
}

/** Record an unclassified candidate utterance. Drives the empty-prose
 *  recovery counter — when unclassified count rises across consecutive
 *  turns, the planner is signaled to pivot the probe. */
export function recordUnclassified(
  led: ConversationLedger,
  text: string,
  atTurn: number,
  reason: UnclassifiedReason,
): ConversationLedger {
  return append(led, { kind: "unclassified-candidate", text, atTurn, reason });
}

/** Record an explicit topic refusal. Distinct from unclassified — the
 *  planner must NOT refire on this topic without an intervening
 *  permission-elicitation. */
export function recordRefusal(
  led: ConversationLedger,
  refused: DiscoveryTopic,
  atTurn: number,
  rawUtterance: string,
): ConversationLedger {
  return append(led, { kind: "candidate-refusal", refused, atTurn, rawUtterance });
}

// ============================================================================
// Readers — query primitives. All callers go through these, never the
// entries array directly. Keeps the migration sequence sane.
// ============================================================================

/** Has this fact ever been captured? First-wins — once true, stays true. */
export function hasFact(led: ConversationLedger, factKind: FactKind): boolean {
  const target: LedgerEntry["kind"] = `fact-${factKind}`;
  for (const e of led.entries) {
    if (e.kind === target) return true;
  }
  return false;
}

/** Get the FIRST captured value for this fact. Returns null if never
 *  captured. First-wins protects against later misparses clobbering a
 *  correctly-captured value. */
export function getFact<K extends FactKind>(
  led: ConversationLedger,
  factKind: K,
): FactValue<K> | null {
  const target: LedgerEntry["kind"] = `fact-${factKind}`;
  for (const e of led.entries) {
    if (e.kind === target) {
      // Narrow by construction: e.kind === target implies the entry's
      // value type is FactValue<K>.
      return (e as unknown as { value: FactValue<K> }).value;
    }
  }
  return null;
}

/** Get the source layer that captured this fact's first value. Useful
 *  for diagnostics ("did the main parser catch it, or did the
 *  disclosure tracker save us?"). */
export function getFactSource(
  led: ConversationLedger,
  factKind: FactKind,
): LedgerFactSource | null {
  const target: LedgerEntry["kind"] = `fact-${factKind}`;
  for (const e of led.entries) {
    if (e.kind === target && isFactEntry(e)) return e.source;
  }
  return null;
}

/** Has the bot asked this topic? Returns the first ask's turn index
 *  and a refireable hint (always false here — refireability is
 *  decided by the existing canRefire logic in the planner; this is
 *  pure "did we ask"). PR-3 wires canRefire to call this. */
export function wasTopicAsked(
  led: ConversationLedger,
  topic: DiscoveryTopic,
): { atTurn: number } | null {
  for (const e of led.entries) {
    if (e.kind === "asked-topic" && e.topic === topic) {
      return { atTurn: e.atTurn };
    }
  }
  return null;
}

/** Return every asked-topic entry in (topic, atTurn) form, in the order
 *  it was recorded. Equivalent shape to legacy state.askedTopics — this
 *  is the migration target readers route through during PR-3. */
export function askedTopicEntries(
  led: ConversationLedger,
): ReadonlyArray<{ topic: DiscoveryTopic; atTurn: number }> {
  const out: Array<{ topic: DiscoveryTopic; atTurn: number }> = [];
  for (const e of led.entries) {
    if (e.kind === "asked-topic") out.push({ topic: e.topic, atTurn: e.atTurn });
  }
  return out;
}

/** How many times was this topic asked? Used by refire-cap logic. */
export function askedTopicCount(led: ConversationLedger, topic: DiscoveryTopic): number {
  let n = 0;
  for (const e of led.entries) {
    if (e.kind === "asked-topic" && e.topic === topic) n++;
  }
  return n;
}

/** Was this topic refused? Returns the refusal turn, or null. */
export function wasTopicRefused(
  led: ConversationLedger,
  topic: DiscoveryTopic,
): { atTurn: number } | null {
  for (const e of led.entries) {
    if (e.kind === "candidate-refusal" && e.refused === topic) {
      return { atTurn: e.atTurn };
    }
  }
  return null;
}

/** Count consecutive unclassified candidate utterances at the END of
 *  the ledger. Drives empty-prose recovery escalation: 1 = nudge, 2 =
 *  pivot probe, 3 = exit discovery early. */
export function consecutiveUnclassifiedTail(led: ConversationLedger): number {
  let n = 0;
  for (let i = led.entries.length - 1; i >= 0; i--) {
    const e = led.entries[i];
    if (e.kind === "unclassified-candidate") n++;
    // Bot-side entries don't break the streak — only a candidate
    // classified answer (fact / refusal) does.
    else if (isFactEntry(e) || isRefusalEntry(e)) break;
  }
  return n;
}

/** Get entries since a given turn index (inclusive). Used to inspect
 *  "what happened this turn" without recomputing from scratch. */
export function entriesSince(
  led: ConversationLedger,
  sinceTurn: number,
): ReadonlyArray<LedgerEntry> {
  return led.entries.filter((e) => e.atTurn >= sinceTurn);
}

/** Get all fact entries (any kind). Used by diagnostic exports. */
export function allFactEntries(led: ConversationLedger): ReadonlyArray<LedgerEntry> {
  return led.entries.filter(isFactEntry);
}

/** Total entry count — useful for invariant assertions. */
export function size(led: ConversationLedger): number {
  return led.entries.length;
}

// ============================================================================
// Diagnostic export — flatten for telemetry / debugging
// ============================================================================

export interface LedgerSnapshot {
  totalEntries: number;
  facts: Record<string, { value: unknown; source: LedgerFactSource; atTurn: number }>;
  askedTopics: Array<{ topic: DiscoveryTopic; atTurn: number; actionKind: string }>;
  refusals: Array<{ topic: DiscoveryTopic; atTurn: number }>;
  unclassifiedCount: number;
}

/** Build a flat snapshot suitable for telemetry events or session
 *  debugging UI. Skips emitted-action and raw utterance text to keep
 *  payloads small. */
export function snapshot(led: ConversationLedger): LedgerSnapshot {
  const facts: LedgerSnapshot["facts"] = {};
  const askedTopics: LedgerSnapshot["askedTopics"] = [];
  const refusals: LedgerSnapshot["refusals"] = [];
  let unclassifiedCount = 0;

  for (const e of led.entries) {
    if (isFactEntry(e)) {
      // First-wins: skip if we already recorded this fact kind.
      const factKey = e.kind.slice("fact-".length);
      if (facts[factKey] !== undefined) continue;
      facts[factKey] = { value: e.value, source: e.source, atTurn: e.atTurn };
    } else if (isAskedTopicEntry(e)) {
      askedTopics.push({ topic: e.topic, atTurn: e.atTurn, actionKind: e.actionRef.kind });
    } else if (isRefusalEntry(e)) {
      refusals.push({ topic: e.refused, atTurn: e.atTurn });
    } else if (isUnclassifiedEntry(e)) {
      unclassifiedCount++;
    }
  }

  return {
    totalEntries: led.entries.length,
    facts,
    askedTopics,
    refusals,
    unclassifiedCount,
  };
}
