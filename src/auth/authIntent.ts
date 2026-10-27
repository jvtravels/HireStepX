/* What a /login or /signup visit is for, decided once from `?next=`. Every auth form
 * reads this instead of re-deriving it, so the 2.0 and legacy forms cannot disagree
 * about whether an invitee is "a new company" (they did, and it showed a team invite
 * the Create-a-company-account form). */

export type AuthIntent =
  | { kind: "invite"; token: string }
  | { kind: "employer" }
  | { kind: "candidate" };

const INVITE_PATH = "/employer/join";

export function classifyAuthIntent(next: string | null | undefined): AuthIntent {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return { kind: "candidate" };
  let url: URL;
  try {
    url = new URL(next, "http://auth.invalid");
  } catch {
    return { kind: "candidate" };
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path === INVITE_PATH) {
    const token = url.searchParams.get("token") ?? "";
    return { kind: "invite", token };
  }
  if (path === "/employer" || path.startsWith("/employer/")) return { kind: "employer" };
  return { kind: "candidate" };
}
