// Top-level /employer/<segment> pages that exist. A test keeps this in sync
// with the app directory. Anything else is answered with a real 404: the
// console streams a loading skeleton first, so the not-found page alone
// would leave the status at 200.
export const EMPLOYER_SEGMENTS = new Set(["jobs", "messages", "requirements", "settings", "team", "join"]);

export function isUnknownEmployerPath(pathname: string): boolean {
  if (!pathname.startsWith("/employer/")) return false;
  const first = pathname.split("/")[2];
  return first !== "" && !EMPLOYER_SEGMENTS.has(first);
}
