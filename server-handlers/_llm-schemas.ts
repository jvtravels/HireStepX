/* Provider-enforced JSON shapes for LLM calls whose output the server parses
 * field by field. The handlers still validate: Cloudflare has no JSON mode and
 * a schema only constrains syntax and types, not meaning. */

export const FOLLOW_UP_SCHEMA = {
  name: "follow_up",
  schema: {
    type: "object",
    properties: {
      needsFollowUp: { type: "boolean" },
      followUpText: { type: "string" },
      followUpType: { type: "string" },
      reason: { type: "string" },
      wantsBreakdown: { type: "boolean" },
      proposedCounter: { type: ["number", "null"] },
    },
    required: ["needsFollowUp"],
  },
} as const satisfies { name: string; schema: Record<string, unknown> };
