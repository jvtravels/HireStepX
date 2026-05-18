/* Move-tag types — emitted by the server (server-handlers/_move-tag.ts)
 * alongside each negotiate-turn response. The Learning Mode in-flow UI
 * was removed (2026-05-18); these types remain because the server
 * payload, telemetry, and analytics still carry the tag. */

export type MoveTagFamily =
  | "discovery"
  | "anchor"
  | "defense"
  | "counter"
  | "stall"
  | "close"
  | "terminal"
  | "meta";

export interface MoveTag {
  label: string;
  hint: string;
  family: MoveTagFamily;
}
