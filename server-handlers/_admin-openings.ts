/* Admin side of the public openings. Any open role can be listed: the admin reads
 * it (company name included) and writes the public summary and title, so nothing
 * an employer typed reaches the public unreviewed. Approval is
 * refused if the public text still contains the company name. The admin session is
 * one shared login (see _admin-unlock.ts), so the audit trail records the action,
 * not the person. */

import { fetchJSON, supa, ValidationError } from "./_admin-shared";
import { isUuid } from "./_admin-unlock";
import { PUBLIC_OPENING_SELECT, OPENING_MAX_AGE_DAYS, toPublicOpening, isLiveOpening, type OpeningRow } from "./_public-openings-helpers";

export const PUBLIC_SUMMARY_MAX = 280;
export const PUBLIC_TITLE_MAX = 120;

/** True when `text` contains the company name (case and spacing insensitive, whole name only). */
export function mentionsCompany(text: string, companyName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const name = norm(companyName);
  if (name.length < 2) return false;
  return ` ${norm(text)} `.includes(` ${name} `);
}

export type OpeningDecision = "approve" | "unpublish";

export function validateOpeningInput(
  input: { decision?: unknown; publicSummary?: unknown; publicTitle?: unknown },
  currentTitle: string,
  companyName: string,
): { decision: OpeningDecision; summary: string; title: string } {
  if (input.decision !== "approve" && input.decision !== "unpublish") throw new ValidationError("decision must be approve | unpublish");
  if (input.decision === "unpublish") return { decision: "unpublish", summary: "", title: "" };
  const summary = typeof input.publicSummary === "string" ? input.publicSummary.replace(/\s+/g, " ").trim() : "";
  if (!summary) throw new ValidationError("publicSummary required to approve");
  if (summary.length > PUBLIC_SUMMARY_MAX) throw new ValidationError(`publicSummary must be ${PUBLIC_SUMMARY_MAX} characters or fewer`);
  const rawTitle = typeof input.publicTitle === "string" ? input.publicTitle.replace(/\s+/g, " ").trim() : "";
  const title = rawTitle || currentTitle.replace(/\s+/g, " ").trim();
  if (!title || title.length > PUBLIC_TITLE_MAX) throw new ValidationError(`publicTitle must be 1 to ${PUBLIC_TITLE_MAX} characters`);
  if (mentionsCompany(summary, companyName) || mentionsCompany(title, companyName)) {
    throw new ValidationError("Public text mentions the company name. Remove it before approving.");
  }
  return { decision: "approve", summary, title };
}

interface AdminOpeningRow extends OpeningRow { employer_id: string }

export async function listPublicOpeningRequests() {
  const rows = await fetchJSON<AdminOpeningRow>(
    `employer_requirements?select=${PUBLIC_OPENING_SELECT},employer_id&status=neq.closed&order=created_at.desc&limit=200`,
  );
  const ids = [...new Set(rows.map((r) => r.employer_id))];
  const employers = ids.length
    ? await fetchJSON<{ id: string; company_name: string }>(`employers?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,company_name`)
    : [];
  const nameById = new Map(employers.map((e) => [e.id, e.company_name]));
  const now = new Date();
  return {
    maxAgeDays: OPENING_MAX_AGE_DAYS,
    rows: rows.map((r) => ({
      requirementId: r.id,
      companyName: nameById.get(r.employer_id) ?? "",
      title: r.title,
      listing: r.public_listing,
      live: isLiveOpening(r, now),
      // Exactly what the public sees when live; null until a summary exists.
      preview: r.public_summary ? toPublicOpening({ ...r, public_approved_at: r.public_approved_at ?? now.toISOString() }) : null,
    })),
  };
}

export async function setPublicOpening(input: { requirementId?: unknown; decision?: unknown; publicSummary?: unknown; publicTitle?: unknown }) {
  if (!isUuid(input.requirementId)) throw new ValidationError("requirementId must be a uuid");
  const [req] = await fetchJSON<{ id: string; title: string; employer_id: string; public_listing: string; status: string }>(
    `employer_requirements?id=eq.${input.requirementId}&select=id,title,employer_id,public_listing,status&limit=1`,
  );
  if (!req) throw new ValidationError("requirement not found");
  const [employer] = await fetchJSON<{ company_name: string }>(`employers?id=eq.${encodeURIComponent(req.employer_id)}&select=company_name&limit=1`);
  const v = validateOpeningInput(input, req.title, employer?.company_name ?? "");
  if (v.decision === "approve" && req.status === "closed") throw new ValidationError("This role is closed");

  const patch = v.decision === "approve"
    ? { public_listing: "approved", public_summary: v.summary, public_title: v.title, public_approved_at: new Date().toISOString() }
    : { public_listing: "off", public_approved_at: null };
  const res = await supa(`employer_requirements?id=eq.${req.id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const updated = res.ok ? ((await res.json().catch(() => [])) as unknown[]) : [];
  if (!res.ok) return { ok: false as const, error: `Update failed: HTTP ${res.status}` };
  if (updated.length === 0) return { ok: false as const, error: "Role not found. Nothing was changed." };
  return { ok: true as const, requirementId: req.id, listing: patch.public_listing };
}
