/**
 * Resume v2 — server-side hashing + version persistence helpers.
 *
 * Pulled out of analyze-resume.ts so the cache-lookup logic and the
 * version-write logic are unit-testable without spinning up the LLM
 * call. Uses Web Crypto SubtleCrypto.digest (Edge-compatible, no Node
 * crypto module needed).
 *
 * Key invariants enforced here:
 *   - text_hash is SHA-256 of the normalized text (NFC, lowercased,
 *     whitespace-collapsed). Tiny formatting differences shouldn't
 *     trigger a fresh LLM run.
 *   - When a new version is created, ALL prior versions of the same
 *     resume_id flip to is_latest=false in the same compare-and-swap.
 *   - resumes.active_version_id always points to the latest version
 *     so the read path can resolve the active resume in one row.
 */

/**
 * Normalize resume text before hashing. Stripping incidental whitespace
 * and case ensures a copy/paste with extra spaces or different line
 * endings doesn't bust the cache.
 *
 * The earlier version (NFC + lowercase + whitespace collapse) wasn't
 * enough: pdfjs extractions of the same PDF in different browsers
 * varied on smart-quote vs straight-quote, em-dash vs hyphen, NBSP
 * vs regular space, and stray zero-width / BOM characters at column
 * boundaries. Each variant produced a different SHA-256 hash, every
 * browser missed the cache, and every miss triggered a fresh LLM
 * call — and (because temperature > 0) a different score. The
 * Unicode-folding pass below converges those near-identical variants
 * to a single canonical form so the cache actually hits cross-browser.
 */
export function normalizeResumeText(text: string): string {
  return (text || "")
    .normalize("NFKC") // NFKC > NFC: also folds compatibility variants
    .toLowerCase()
    // Smart quotes → straight quotes
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    // Unicode dashes / minus / hyphens → ASCII hyphen
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    // Bullets and middle-dot punctuation → ASCII bullet "-"
    .replace(/[\u2022\u2023\u25E6\u2043\u00B7]/g, "-")
    // Strip zero-width / BOM / formatting marks that survive PDF text
    // extraction unevenly across browsers (ZWSP, ZWNJ, ZWJ, BOM, soft
    // hyphen, word joiner, LRM/RLM, ZWNBSP). The class includes ZWJ
    // (\u200D) — the linter warns because ZWJ can combine with surrounding
    // chars, but stripping orphan ZWJs out of extracted text is exactly
    // what we want here, so the warning is suppressed with intent.
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[\u00AD\u200B\u200C\u200D\u200E\u200F\u2060\uFEFF]/g, "")
    // Non-breaking spaces and exotic spaces → regular space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // Line endings → \n
    .replace(/\r\n?/g, "\n")
    // Collapse intra-line runs of whitespace
    .replace(/[ \t]+/g, " ")
    // Collapse 3+ blank lines to a single blank line
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Compute SHA-256 hex digest using Web Crypto. Edge-runtime safe; no
 * Node `crypto` import. Returns a 64-char lowercase hex string.
 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute the text_hash that gets stored on resume_versions. Single
 * helper so callers can't drift on the normalization step.
 *
 * Optionally accepts a `targetRole` qualifier. When the same resume
 * text is analyzed against two different target roles, the LLM
 * receives different context and emits different scores / strengths /
 * gaps — caching by text alone would surface yesterday's "PM" analysis
 * to a user who's now applying as a "Designer". The role is folded
 * into the hash input so each (text, role) pair has its own cache
 * entry. Empty / missing role → role-agnostic key (back-compat with
 * pre-role rows that already exist in the DB).
 */
/**
 * LLM output schema version — bump when analyze-resume.ts adds or
 * meaningfully changes a field that the UI hard-depends on. Folding
 * this into the hash means old cached rows stop matching and the next
 * upload forces a fresh LLM run with the current schema.
 *
 * Version history:
 *   1 — original ResumeProfile (headline, summary, topSkills, ...)
 *   2 — added structured experiences[] + skillsDetailed[] (deploy
 *       2e6703c). Without this bump, cache hits for users who
 *       analysed before the deploy keep serving the old shape and
 *       the production Resume tab's Experience section never
 *       renders.
 */
const RESUME_PROFILE_SCHEMA_VERSION = 2;

export async function computeResumeTextHash(
  rawText: string,
  targetRole?: string | null,
): Promise<string> {
  const text = normalizeResumeText(rawText);
  const role = (targetRole ?? "").trim().toLowerCase();
  // Use a delimiter that can't appear in normalized text (newline pair
  // is preserved at most as \n\n, never \n\x00, so no collision risk).
  // Schema version is appended so a profile-shape upgrade transparently
  // invalidates the cache instead of silently serving stale shapes.
  const rolePart = role ? `\n\x00role=${role}` : "";
  const versionPart = `\n\x00schema=${RESUME_PROFILE_SCHEMA_VERSION}`;
  const composite = `${text}${rolePart}${versionPart}`;
  return sha256Hex(composite);
}

export interface ResumeVersionRow {
  id: string;
  resume_id: string;
  version_number: number;
  text_hash: string;
  parsed_data: unknown;
  parse_source: string;
  is_latest: boolean;
  created_at: string;
}

/**
 * Look up an existing resume_version by text_hash for a given user.
 * Returns the row if found (LLM call should be skipped) or null.
 *
 * Cross-user dedup is intentionally NOT done — two users with the same
 * resume text might want differently personalised analyses, and sharing
 * one user's parsed_data with another raises subtle privacy questions
 * we don't want to hand-wave through. Per-user dedup is the safe scope.
 */
export async function findCachedResumeVersion(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  textHash: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ResumeVersionRow | null> {
  if (!supabaseUrl || !serviceKey || !userId || !textHash) return null;
  try {
    // Find versions whose parent resume belongs to this user, with the
    // matching text_hash, OLDEST first (first-writer-wins). PostgREST
    // inner-join via resumes!inner so we filter on user_id without
    // leaking other users.
    //
    // Why oldest, not newest: in the rare case multiple rows exist for
    // the same hash (e.g. legacy rows written before scoring became
    // deterministic at temperature: 0), the earliest row is the
    // canonical analysis. Picking it consistently means a user's
    // displayed score never flaps even if there's stale duplication
    // in the DB. With t=0 + structured subscores, all rows for the
    // same hash should now be identical anyway — this is just
    // defensive against historical noise.
    const url = `${supabaseUrl}/rest/v1/resume_versions?text_hash=eq.${encodeURIComponent(textHash)}&select=id,resume_id,version_number,text_hash,parsed_data,parse_source,is_latest,created_at,resumes!inner(user_id)&resumes.user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1`;
    const res = await fetchImpl(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      resume_id: row.resume_id,
      version_number: row.version_number,
      text_hash: row.text_hash,
      parsed_data: row.parsed_data,
      parse_source: row.parse_source,
      is_latest: row.is_latest,
      created_at: row.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a resume_version row by id and normalize its `parsed_data`
 * jsonb into the slim `ResumeForAnalyzer` shape the analyzer pipeline
 * expects. Returns null on any error / missing row / unparseable
 * payload — analyzers must tolerate null gracefully.
 *
 * Why this lives here: it's the read-side complement of
 * `findCachedResumeVersion()` + `persistResumeVersion()`. Co-locating
 * the resume-versions table accessors keeps the schema knowledge in
 * one file.
 *
 * Why the shape conversion: `parsed_data` is stored as the frontend
 * `StoredResume` discriminated union, which transitively imports from
 * `src/dashboardData.ts`. Edge-runtime analyzer code cannot import
 * from `src/`, so we flatten on the way out.
 */
import type { ResumeForAnalyzer } from "./analyzers/_types";

type LooseStoredResume = {
  _type?: string;
  // AI variant (ResumeProfile)
  topSkills?: unknown;
  experiences?: unknown;
  // Fallback variant (ParsedResume)
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
  linkedin?: unknown;
  // Common
  summary?: unknown;
  headline?: unknown;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0);
}

function normalizeExperiences(v: unknown): ResumeForAnalyzer["experiences"] {
  if (!Array.isArray(v)) return undefined;
  const out: NonNullable<ResumeForAnalyzer["experiences"]> = [];
  for (const e of v) {
    if (!e || typeof e !== "object") continue;
    const row = e as Record<string, unknown>;
    out.push({
      title: typeof row.title === "string" ? row.title : undefined,
      company: typeof row.company === "string" ? row.company : undefined,
      period: typeof row.period === "string" ? row.period : undefined,
      bullets: asStringArray(row.bullets),
    });
  }
  return out.length > 0 ? out : undefined;
}

function extractLinks(text: string | undefined): string[] {
  if (!text) return [];
  const re = /\bhttps?:\/\/[^\s)]+|(?:github|gitlab|bitbucket|linkedin|leetcode|kaggle|huggingface)\.com\/[\w.\-/]+/gi;
  return Array.from(text.matchAll(re)).map((m) => m[0]);
}

export function normalizeStoredResumeForAnalyzer(parsed: unknown): ResumeForAnalyzer | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as LooseStoredResume;
  const result: ResumeForAnalyzer = {};

  // AI variant ----------------------------------------------------------
  if (p._type === "ai" || p.experiences) {
    result.experiences = normalizeExperiences(p.experiences);
    result.topSkills = asStringArray(p.topSkills);
    /* Wave-8: best-effort extraction of degree / school / gradYear from
     * the AI variant's `headline` + `summary` free-text. The AI
     * profile doesn't carry structured education today, so the
     * analyzer's grad-year / college cross-checks would never fire on
     * AI-parsed resumes. These regexes are intentionally permissive
     * (loose alternation, case-insensitive) — false-positives are
     * cheap because the downstream cross-check has its own evidence
     * requirement (transcript signal). Misses are also fine: the
     * cross-check silently skips when the field is undefined. */
    const eduText = [
      typeof p.headline === "string" ? p.headline : "",
      typeof p.summary === "string" ? p.summary : "",
    ].join(" | ");
    const degreeMatch = eduText.match(/\b(?:b\.?\s*tech|bachelor of technology|m\.?\s*tech|master of technology|b\.?\s*e\.?|bachelor of engineering|b\.?\s*sc\.?|m\.?\s*sc\.?|b\.?\s*c\.?\s*a\.?|m\.?\s*c\.?\s*a\.?|mba|ph\.?\s*d\.?)[^,;\n|]{0,80}/i);
    if (degreeMatch) result.degree = degreeMatch[0].trim();
    const yearMatch = eduText.match(/\b(?:graduat(?:ed|ing|ion)\s+(?:in\s+)?|class of\s+|batch\s+(?:of\s+)?)(20\d{2})\b/i)
      || eduText.match(/\b(20[12]\d)\s*(?:passout|pass[- ]out|batch|grad)/i)
      || eduText.match(/\b(20[12]\d)\s*[-–]\s*(20[12]\d)\b/);
    if (yearMatch) result.gradYear = yearMatch[yearMatch.length === 3 ? 2 : 1];
    const schoolMatch = eduText.match(/\b(?:iit|nit|iiit|bits|iisc|vit|srm|manipal|thapar|dtu|nsit|coep|psg|pes university|pesu|bms college|rvce|ramaiah|amrita|jadavpur|anna university|jntu|nitk|nitt|nita)\b[^,;\n|]{0,60}/i)
      || eduText.match(/\b(?:from|at)\s+([A-Z][A-Za-z& ]{3,40}(?:\sUniversity|\sCollege|\sInstitute))/);
    if (schoolMatch) result.school = (schoolMatch[1] || schoolMatch[0]).trim();
    const linkText = [typeof p.headline === "string" ? p.headline : "", typeof p.summary === "string" ? p.summary : ""].join(" ");
    result.links = extractLinks(linkText);
    return result;
  }

  // Fallback variant (ParsedResume) -------------------------------------
  result.topSkills = asStringArray(p.skills);
  const exp = normalizeExperiences(
    Array.isArray(p.experience)
      ? p.experience.map((e) => {
          if (!e || typeof e !== "object") return {};
          const r = e as Record<string, unknown>;
          return {
            title: r.title,
            company: r.company,
            period: r.period,
            bullets: r.bullets,
          };
        })
      : undefined,
  );
  result.experiences = exp;

  if (Array.isArray(p.education) && p.education.length > 0) {
    const ed = p.education[0] as Record<string, unknown>;
    if (typeof ed.degree === "string") result.degree = ed.degree;
    if (typeof ed.school === "string") result.school = ed.school;
    if (typeof ed.year === "string") result.gradYear = ed.year;
  }

  const linkText = [typeof p.linkedin === "string" ? p.linkedin : "", typeof p.summary === "string" ? p.summary : ""].join(" ");
  result.links = extractLinks(linkText);

  return result;
}

/**
 * Load a resume_version by id and return the analyzer-friendly slim
 * shape. Best-effort — returns null on any failure so the caller's
 * analyzer can run on transcript-only data.
 */
export async function fetchResumeForAnalyzer(
  supabaseUrl: string,
  serviceKey: string,
  resumeVersionId: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ResumeForAnalyzer | null> {
  if (!supabaseUrl || !serviceKey || !resumeVersionId) return null;
  try {
    const url = `${supabaseUrl}/rest/v1/resume_versions?id=eq.${encodeURIComponent(resumeVersionId)}&select=parsed_data&limit=1`;
    const res = await fetchImpl(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return normalizeStoredResumeForAnalyzer(rows[0]?.parsed_data);
  } catch {
    return null;
  }
}

export interface PersistVersionInput {
  userId: string;
  domain: string;             // 'sde' | 'pm' | 'sales' | 'design' | 'general' | custom
  textHash: string;
  fileHash?: string | null;
  resumeText: string;         // normalized — caller's responsibility
  parsedData: unknown;
  parseSource: "ai" | "fallback";
  fileName?: string | null;
}

/**
 * Persist a new resume_version, creating the parent resume row if no
 * row for (user_id, domain, is_archived=false) exists. Bumps
 * version_number, flips prior versions' is_latest=false, and updates
 * resumes.active_version_id.
 *
 * Returns the new version's id, or null on failure (best-effort —
 * the LLM call has already happened by this point so we don't want
 * the analyze-resume flow to fail just because the persistence layer
 * hiccupped).
 */
export async function persistResumeVersion(
  supabaseUrl: string,
  serviceKey: string,
  input: PersistVersionInput,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ resumeId: string; versionId: string; versionNumber: number } | null> {
  if (!supabaseUrl || !serviceKey || !input.userId) return null;
  const auth = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

  try {
    // 1. Find or create the parent `resumes` row for (user, domain).
    const findRes = await fetchImpl(
      `${supabaseUrl}/rest/v1/resumes?user_id=eq.${encodeURIComponent(input.userId)}&domain=eq.${encodeURIComponent(input.domain)}&is_archived=eq.false&select=id&limit=1`,
      { headers: auth },
    );
    let resumeId = "";
    if (findRes.ok) {
      const rows = await findRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]?.id) resumeId = rows[0].id;
    }
    if (!resumeId) {
      const createRes = await fetchImpl(`${supabaseUrl}/rest/v1/resumes`, {
        method: "POST",
        headers: { ...auth, Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: input.userId,
          domain: input.domain,
          title: input.fileName || input.domain,
        }),
      });
      if (!createRes.ok) return null;
      const created = await createRes.json().catch(() => []);
      resumeId = Array.isArray(created) ? created[0]?.id : created?.id;
      if (!resumeId) return null;
    }

    // 2. Compute the next version_number for this resume.
    const numRes = await fetchImpl(
      `${supabaseUrl}/rest/v1/resume_versions?resume_id=eq.${encodeURIComponent(resumeId)}&select=version_number&order=version_number.desc&limit=1`,
      { headers: auth },
    );
    let nextNumber = 1;
    if (numRes.ok) {
      const rows = await numRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]?.version_number) nextNumber = rows[0].version_number + 1;
    }

    // 3. Flip prior versions to is_latest=false. We want this to land
    //    BEFORE the new row's insert so a concurrent reader never sees
    //    two is_latest=true rows for the same resume.
    if (nextNumber > 1) {
      await fetchImpl(
        `${supabaseUrl}/rest/v1/resume_versions?resume_id=eq.${encodeURIComponent(resumeId)}&is_latest=eq.true`,
        {
          method: "PATCH",
          headers: { ...auth, Prefer: "return=minimal" },
          body: JSON.stringify({ is_latest: false }),
        },
      );
    }

    // 4. Insert the new version row.
    const insertRes = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions`, {
      method: "POST",
      headers: { ...auth, Prefer: "return=representation" },
      body: JSON.stringify([{
        resume_id: resumeId,
        version_number: nextNumber,
        text_hash: input.textHash,
        file_hash: input.fileHash || null,
        file_name: input.fileName || null,
        resume_text: input.resumeText.slice(0, 50_000),
        parsed_data: input.parsedData,
        parse_source: input.parseSource,
        is_latest: true,
      }]),
    });
    if (!insertRes.ok) return null;
    const inserted = await insertRes.json().catch(() => []);
    const versionId: string = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    if (!versionId) return null;

    // 5. Point the parent `resumes.active_version_id` at the new version.
    await fetchImpl(
      `${supabaseUrl}/rest/v1/resumes?id=eq.${encodeURIComponent(resumeId)}`,
      {
        method: "PATCH",
        headers: { ...auth, Prefer: "return=minimal" },
        body: JSON.stringify({ active_version_id: versionId, updated_at: new Date().toISOString() }),
      },
    );

    return { resumeId, versionId, versionNumber: nextNumber };
  } catch {
    return null;
  }
}

/**
 * Resolve the user's currently-active resume_version_id. Used by
 * /api/sessions/save to capture the version into session.resume_version_id
 * at session start. Returns null if the user has no resume yet (a
 * legitimate state — sessions can run without one).
 */
export async function resolveActiveResumeVersionId(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  domain?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  if (!supabaseUrl || !serviceKey || !userId) return null;
  try {
    // Prefer a resume tagged for the requested domain; fall back to any
    // active resume; ultimately null. The is_archived=false filter
    // prevents resurrecting a user-archived resume.
    const domainFilter = domain ? `&domain=eq.${encodeURIComponent(domain)}` : "";
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/resumes?user_id=eq.${encodeURIComponent(userId)}${domainFilter}&is_archived=eq.false&select=active_version_id&order=updated_at.desc&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    if (Array.isArray(rows) && rows[0]?.active_version_id) return rows[0].active_version_id;
    // Domain-specific lookup found nothing — try without the domain filter
    if (domain) return resolveActiveResumeVersionId(supabaseUrl, serviceKey, userId, undefined, fetchImpl);
    return null;
  } catch {
    return null;
  }
}
