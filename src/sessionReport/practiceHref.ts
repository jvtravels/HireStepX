/* Setup link for "Practise again": same interview type, role and company as
 * the session being viewed. Campus placement is stored as a behavioral type
 * with a focus, so it travels as `focus`. */

const PLACEHOLDER_ROLE = "Target Role";

export function practiceHref(session: { type?: string; focus?: string; role?: string; company?: string }): string {
  const params = new URLSearchParams();
  if (session.focus === "campus-placement") params.set("focus", "campus-placement");
  else if (session.type) params.set("type", session.type);
  const role = (session.role ?? "").trim();
  if (role && role !== PLACEHOLDER_ROLE) params.set("role", role);
  const company = (session.company ?? "").trim();
  if (company) params.set("company", company);
  const qs = params.toString();
  return qs ? `/session/new?${qs}` : "/session/new";
}
