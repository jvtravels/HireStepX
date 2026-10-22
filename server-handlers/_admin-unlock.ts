/* Admin complimentary unlock — lets an admin unlock matched candidates for
 * any company's job requirement without a Razorpay payment.
 *
 * Reads (listUnlockRequirements / getUnlockMatches) back the admin "Unlock"
 * tab; adminUnlockCandidates performs the write. Every grant is recorded as a
 * zero-amount row in employer_unlock_payments (razorpay_payment_id
 * "admin-grant:<uuid>", status "admin_grant") BEFORE any match is touched, so
 * the employer's unlock history shows it and there is an audit trail of every
 * complimentary unlock. No migration needed: those columns already exist. The
 * admin session is one shared password with no per-person identity, so the
 * audit row records that an admin did it and the optional note, not who. */

import { randomUUID } from "crypto";
import { fetchJSON, supa, ValidationError, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./_admin-shared";
import { slog } from "./_shared";
import { notify } from "./_notify";
import { patchMatchUnlocked } from "./_unlock-apply";

export const ADMIN_UNLOCK_MAX_PER_CALL = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IN_CHUNK = 80;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** Strip characters that would break out of a PostgREST filter value. */
export function sanitizeSearchTerm(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export interface UnlockableMatch {
  id: string;
  unlocked: boolean;
}

/** Which matches an admin call should actually unlock. `requestedIds` null
 *  means "every locked match on the requirement". Throws on ids that don't
 *  belong to the requirement, so a stale or forged id can't unlock something
 *  on a different job. */
export function selectUnlockTargets(
  matches: UnlockableMatch[],
  requestedIds: string[] | null,
): { toUnlock: string[]; alreadyUnlocked: number } {
  const byId = new Map(matches.map((m) => [m.id, m]));
  let candidates: UnlockableMatch[];
  if (requestedIds === null) {
    candidates = matches;
  } else {
    candidates = [];
    for (const id of new Set(requestedIds)) {
      const m = byId.get(id);
      if (!m) throw new ValidationError("match does not belong to this requirement");
      candidates.push(m);
    }
  }
  return {
    toUnlock: candidates.filter((m) => !m.unlocked).map((m) => m.id),
    alreadyUnlocked: candidates.filter((m) => m.unlocked).length,
  };
}

interface EmployerLite { id: string; company_name: string }
interface RequirementRow { id: string; employer_id: string; title: string; location: string | null; status: string; created_at: string }

async function fetchProfiles(ids: string[]): Promise<Map<string, { name: string | null; email: string | null }>> {
  const out = new Map<string, { name: string | null; email: string | null }>();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK).map(encodeURIComponent).join(",");
    const rows = await fetchJSON<{ id: string; name: string | null; email: string | null }>(
      `profiles?id=in.(${chunk})&select=id,name,email`,
    );
    for (const r of rows) out.set(r.id, { name: r.name, email: r.email });
  }
  return out;
}

export async function listUnlockRequirements(rawSearch: unknown) {
  const search = sanitizeSearchTerm(rawSearch);
  const employers = await fetchJSON<EmployerLite>(
    "employers?select=id,company_name&order=company_name.asc&limit=1000",
  );
  const employerById = new Map(employers.map((e) => [e.id, e]));

  let filter = "";
  if (search) {
    const needle = search.toLowerCase();
    const matchingIds = employers.filter((e) => e.company_name.toLowerCase().includes(needle)).map((e) => e.id);
    const clauses = [`title.ilike.*${encodeURIComponent(search)}*`];
    if (matchingIds.length > 0) clauses.push(`employer_id.in.(${matchingIds.slice(0, IN_CHUNK).map(encodeURIComponent).join(",")})`);
    filter = `&or=(${clauses.join(",")})`;
  }
  const reqs = await fetchJSON<RequirementRow>(
    `employer_requirements?select=id,employer_id,title,location,status,created_at${filter}&order=created_at.desc&limit=300`,
  );
  const rows = reqs
    .filter((r) => employerById.has(r.employer_id))
    .map((r) => ({
      requirementId: r.id,
      employerId: r.employer_id,
      companyName: employerById.get(r.employer_id)!.company_name,
      title: r.title,
      location: r.location || "",
      status: r.status,
      createdAt: r.created_at,
    }));
  return { rows, employerCount: employers.length };
}

async function loadRequirementContext(requirementId: string): Promise<{ requirement: RequirementRow; employer: EmployerLite }> {
  if (!isUuid(requirementId)) throw new ValidationError("requirementId must be a uuid");
  const [req] = await fetchJSON<RequirementRow>(
    `employer_requirements?id=eq.${requirementId}&select=id,employer_id,title,location,status,created_at&limit=1`,
  );
  if (!req) throw new ValidationError("requirement not found");
  const [employer] = await fetchJSON<EmployerLite>(
    `employers?id=eq.${encodeURIComponent(req.employer_id)}&select=id,company_name&limit=1`,
  );
  if (!employer) throw new ValidationError("employer not found");
  return { requirement: req, employer };
}

export async function getUnlockMatches(requirementId: string) {
  const { requirement, employer } = await loadRequirementContext(requirementId);
  const matches = await fetchJSON<{ id: string; candidate_user_id: string; match_score: number; unlocked: boolean; unlocked_at: string | null }>(
    `requirement_matches?requirement_id=eq.${requirement.id}&select=id,candidate_user_id,match_score,unlocked,unlocked_at&order=match_score.desc&limit=1000`,
  );
  const profiles = await fetchProfiles(matches.map((m) => m.candidate_user_id));
  return {
    requirement: { id: requirement.id, title: requirement.title, location: requirement.location || "", status: requirement.status },
    employer: { id: employer.id, companyName: employer.company_name },
    matches: matches.map((m) => ({
      matchId: m.id,
      name: profiles.get(m.candidate_user_id)?.name || "(no name)",
      email: profiles.get(m.candidate_user_id)?.email || "—",
      matchScore: m.match_score,
      unlocked: m.unlocked,
      unlockedAt: m.unlocked_at,
    })),
  };
}

export async function adminUnlockCandidates(input: { requirementId: unknown; matchIds?: unknown; note?: unknown }) {
  if (typeof input.requirementId !== "string") throw new ValidationError("requirementId required");
  let requested: string[] | null = null;
  if (input.matchIds !== undefined && input.matchIds !== null) {
    if (!Array.isArray(input.matchIds) || input.matchIds.length === 0 || !input.matchIds.every(isUuid)) {
      throw new ValidationError("matchIds must be a non-empty array of uuids");
    }
    requested = input.matchIds as string[];
  }
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 200) : "";

  const { requirement, employer } = await loadRequirementContext(input.requirementId);

  const matches = await fetchJSON<{ id: string; candidate_user_id: string; unlocked: boolean }>(
    `requirement_matches?requirement_id=eq.${requirement.id}&select=id,candidate_user_id,unlocked&limit=1000`,
  );
  const { toUnlock, alreadyUnlocked } = selectUnlockTargets(matches, requested);
  if (toUnlock.length === 0) return { ok: true, unlocked: 0, alreadyUnlocked, failed: 0 };
  if (toUnlock.length > ADMIN_UNLOCK_MAX_PER_CALL) {
    return { ok: false, error: `Too many at once (${toUnlock.length}). Unlock at most ${ADMIN_UNLOCK_MAX_PER_CALL} per action.` };
  }

  const candidateByMatch = new Map(matches.map((m) => [m.id, m.candidate_user_id]));
  const profiles = await fetchProfiles(toUnlock.map((id) => candidateByMatch.get(id)!));

  const auditRes = await supa("employer_unlock_payments", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      toUnlock.map((matchId) => ({
        match_id: matchId,
        employer_id: employer.id,
        razorpay_payment_id: `admin-grant:${randomUUID()}`,
        razorpay_order_id: "admin-grant",
        amount: 0,
        currency: "INR",
        status: "admin_grant",
      })),
    ),
  });
  if (!auditRes.ok) {
    const t = await auditRes.text().catch(() => "");
    slog.error("admin-unlock: audit insert failed", { status: auditRes.status, body: t.slice(0, 200), requirementId: requirement.id });
    return { ok: false, error: "Could not record the grant, nothing was unlocked." };
  }

  const unlockedAt = new Date().toISOString();
  const results = await Promise.all(
    toUnlock.map(async (matchId) => {
      const res = await patchMatchUnlocked({
        supabaseUrl: SUPABASE_URL,
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        matchId,
        unlockedAt,
        profile: profiles.get(candidateByMatch.get(matchId)!),
      });
      return res.ok;
    }),
  );
  const unlocked = results.filter(Boolean).length;
  const failed = results.length - unlocked;

  slog.info("admin-unlock: complimentary unlock", {
    requirementId: requirement.id, employerId: employer.id, unlocked, failed, alreadyUnlocked, note,
  });

  if (unlocked > 0) {
    void notify({
      userId: employer.id,
      type: "unlock_confirmed",
      title: "Candidate contacts unlocked",
      body: `${unlocked} candidate contact${unlocked === 1 ? "" : "s"} unlocked for "${requirement.title}" by the HireStepX team.`,
      link: `/employer/requirements/${requirement.id}`,
    });
  }
  return { ok: failed === 0, unlocked, alreadyUnlocked, failed, ...(failed > 0 ? { error: `${failed} candidate${failed === 1 ? "" : "s"} could not be unlocked — retry.` } : {}) };
}
