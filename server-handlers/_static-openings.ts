import type { PublicOpening } from "./_public-openings-helpers";

/* Roles listed straight from code, with no database or admin step. Same rule as
 * the database path: never name the employer in any field here. A role hides
 * itself at expiresAt; remove the entry when it is filled. */
export const STATIC_OPENINGS: PublicOpening[] = [];

export function liveStaticOpenings(now: Date = new Date()): PublicOpening[] {
  return STATIC_OPENINGS.filter((o) => Date.parse(o.expiresAt) > now.getTime());
}
