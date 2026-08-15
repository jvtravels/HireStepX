/* Pure decision logic extracted from employer-verify-unlock-payment.ts so the
 * money path (ownership checks, dedup/closed-requirement gating) is
 * unit-tested against the real code, not an inline copy.
 */

const RAZORPAY_ID_PATTERN = /^[a-zA-Z0-9_]{6,50}$/;

/** Format-validates the three Razorpay fields the client sends back after
 *  checkout, before any network call is made. */
export function validatePaymentIdsFormat(args: {
  orderId: unknown;
  paymentId: unknown;
  signature: unknown;
}): boolean {
  const { orderId, paymentId, signature } = args;
  return (
    typeof orderId === "string" && RAZORPAY_ID_PATTERN.test(orderId)
    && typeof paymentId === "string" && RAZORPAY_ID_PATTERN.test(paymentId)
    && typeof signature === "string" && signature.length > 0 && signature.length <= 128
  );
}

/** True iff the request body exceeds either the declared Content-Length or
 *  the actual serialized size — either signal alone is enough to reject. */
export function isOversizedRequest(contentLength: number, bodyBytes: number, maxBytes: number): boolean {
  return contentLength > maxBytes || bodyBytes > maxBytes;
}

/** The Razorpay order's `notes` are server-written at order-creation time and
 *  never trusted from the client — this re-derives matchId/employerId from
 *  the order itself and checks the caller actually owns it. */
export function verifyOrderOwnership(args: {
  notedEmployerId: string;
  matchId: string;
  employerId: string;
}): boolean {
  return args.matchId.length > 0 && args.notedEmployerId === args.employerId;
}

/** A closed requirement can no longer be unlocked for the first time — but a
 *  match that's already unlocked stays viewable (idempotent re-fetch), so the
 *  gate only fires on closed + not-yet-unlocked. */
export function isClosedAndLocked(status: string, unlocked: boolean): boolean {
  return status === "closed" && !unlocked;
}

/** Shapes the success response returned to the employer once a match is
 *  confirmed unlocked, falling back to safe defaults if the candidate's
 *  profile row is missing name/email. */
export function buildUnlockResponsePayload(args: {
  matchId: string;
  profile: { name?: string | null; email?: string | null } | undefined;
}): { matchId: string; unlocked: true; name: string; contact: { email: string } } {
  return {
    matchId: args.matchId,
    unlocked: true,
    name: args.profile?.name || "Candidate",
    contact: { email: args.profile?.email || "" },
  };
}
