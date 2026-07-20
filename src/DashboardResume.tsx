"use client";
import { useState, useEffect, useRef, useMemo } from "react";
// dark-theme tokens (c, font) imported here previously — the redesigned
// view component now ships its own cream palette, so this import is gone.
// The Multi-resume catalogue strip's skeleton uses inline literal colors
// for the same reason.
import { useAuth } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { useDashboardCore, useDashboardUI } from "./DashboardContext";
import { extractResumeText, parseResumeData, isAiResume, isFallbackResume, type FallbackStoredResume } from "./resumeParser";
import { type ResumeProfile, analyzeResumeWithAI, ACTIVE_RESUME_VERSION_KEY } from "./dashboardData";
import { computeAllFitness } from "./resumeFitness";
import CatalogueGrid from "./resume/CatalogueGrid";
// CoveragePanel was the old dark-mode coverage card. Replaced by the
// inline Coverage section in ResumeTabView. Re-import if/when we
// resurrect the multi-resume catalogue (CatalogueGrid still renders it).
// import CoveragePanel from "./resume/CoveragePanel";
import ResumeTabView from "./resume/ResumeTabView";
import type { FitnessBand, InterviewType } from "./resumeFitness";
import { trackResumeEvent } from "./resume/track";

/** Project a regex-fallback resume into the ResumeProfile shape the UI
 *  expects, so the AI and fallback branches can render through a single
 *  ResumeProfile path. First experience entry's bullets feed
 *  keyAchievements; anything missing falls back to a readable default. */
function fallbackToProfile(r: FallbackStoredResume): ResumeProfile {
  return {
    headline: r.name || "Resume uploaded",
    summary: r.summary || "Your resume has been uploaded and will be used to personalize your interview questions.",
    yearsExperience: null,
    seniorityLevel: "",
    topSkills: (r.skills || []).slice(0, 8),
    keyAchievements: (r.experience || []).flatMap(e => (e as { bullets?: string[] }).bullets || []).slice(0, 5),
    industries: [],
    interviewStrengths: [],
    interviewGaps: [],
    careerTrajectory: "",
  };
}
import { DataLoadingSkeleton } from "./dashboardComponents";

/* ─── Feature flags ──────────────────────────────────────────────────────
 * Multi-resume catalogue UI (catalogue grid, Make Active / Rename /
 * Archive, "+ Add another resume" bar). Hidden for the v1 redesign so
 * the page focuses on the single active resume + readiness analysis.
 *
 * Important: only the *UI* is gated. The DB rows in `resumes` /
 * `resume_versions` are untouched, the `/api/resume/set-active`
 * endpoint still works, and the Supabase fetch is skipped while the
 * flag is off (no needless network for a hidden surface). Flipping
 * this back to `true` re-shows the catalogue with no data migration.
 */
const MULTI_RESUME_UI_ENABLED = false;

/* (PHASE_1_FEATURES flag is added in Step 4 once it has consumers in JSX.) */

/**
 * Push the original file bytes up to /api/resume/upload-file. Best-effort:
 * if the Storage bucket isn't configured, the endpoint returns 503 with
 * `bucketMissing: true` and we silently no-op. Resume analysis itself is
 * unaffected — this is purely "archive the original PDF so we can let
 * the user re-download or audit it later".
 *
 * Encoding: read the file as ArrayBuffer, base64-encode in-browser, send
 * via apiFetch (XHR). Same transport layer as every other mutation.
 */
async function uploadOriginalFile(file: File, resumeVersionId: string): Promise<void> {
  const buf = await file.arrayBuffer();
  // btoa requires a binary string; build it in 32K chunks to avoid
  // "argument list too large" on bigger PDFs.
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  const fileBase64 = btoa(binary);
  const { apiFetch } = await import("./apiClient");
  const res = await apiFetch<{ ok?: boolean; bucketMissing?: boolean; file_path?: string; error?: string }>(
    "/api/resume/upload-file",
    {
      resumeVersionId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileBase64,
    },
  );
  if (!res.ok && !res.data?.bucketMissing) {
    // Bucket-missing is "expected" while file storage isn't enabled
    // for this Supabase project — don't spam the console.
    console.warn(`[resume] file storage upload failed (${res.status}): ${res.error}`);
  }
}

/* ─── Resume Version History (localStorage) ─── */
const RESUME_HISTORY_KEY = "hirestepx_resume_history";
interface ResumeVersion { fileName: string; date: string; resumeScore?: number; contentHash?: string; resumeText?: string; }
/** Simple fast hash of resume text to detect content changes */
function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}
function saveResumeVersion(fileName: string, resumeScore?: number, resumeText?: string) {
  try {
    const raw = localStorage.getItem(RESUME_HISTORY_KEY);
    const history: ResumeVersion[] = raw ? JSON.parse(raw) : [];
    const hash = resumeText ? hashText(resumeText) : undefined;
    // Same file AND same content = re-analysis of identical resume → update score only
    // Same file but different content (or no hash to compare) = genuinely new version
    const isDuplicate = history.length > 0
      && history[0].fileName === fileName
      && hash != null && history[0].contentHash != null
      && hash === history[0].contentHash;
    if (isDuplicate) {
      history[0].resumeScore = resumeScore ?? history[0].resumeScore;
      history[0].date = new Date().toISOString();
      if (resumeText) history[0].resumeText = resumeText.slice(0, 8000);
    } else {
      history.unshift({ fileName, date: new Date().toISOString(), resumeScore, contentHash: hash, resumeText: resumeText?.slice(0, 8000) });
    }
    // Keep last 10 versions
    localStorage.setItem(RESUME_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  } catch { /* expected: localStorage may be unavailable */ }
}
// getResumeHistory() removed — the localStorage-backed version-history block
// was rendered in the old dark JSX (Restore button per row). The cream
// redesign relies on the multi-resume catalogue (gated for v1) for that
// concept. saveResumeVersion still runs on each upload so the data is
// preserved if/when we resurface the history list.

/* ─── ATS Compliance Check (client-side keyword matching) ─── */
interface ATSResult {
  score: number;
  label: string;
  found: string[];
  missing: string[];
  suggestions: string[];
}

function computeATSScore(resumeText: string, _targetRole?: string): ATSResult {
  const text = resumeText.toLowerCase();
  const lines = resumeText.split("\n").filter(l => l.trim().length > 0);

  // ATS-required sections — check for clear section headings (not just word mentions)
  const requiredSections = [
    { name: "Contact Info", keywords: ["email", "@", "phone", "linkedin", "github"] },
    { name: "Work Experience", keywords: ["experience", "employment", "work history", "professional experience"] },
    { name: "Education", keywords: ["education", "academic", "university", "degree", "college"] },
    { name: "Skills", keywords: ["skills", "technical skills", "technologies", "competencies", "tools"] },
  ];

  // Bonus sections
  const bonusSections = [
    { name: "Summary", keywords: ["summary", "objective", "profile", "about"] },
    { name: "Projects", keywords: ["projects", "portfolio"] },
    { name: "Certifications", keywords: ["certifications", "certificates", "licenses"] },
  ];

  // Action verbs — require more for a high score
  const actionVerbs = ["achieved", "led", "managed", "developed", "implemented", "designed", "built", "increased", "reduced", "improved", "launched", "delivered", "created", "optimized", "coordinated", "analyzed", "spearheaded", "orchestrated", "streamlined", "pioneered", "established", "transformed", "automated", "mentored", "negotiated", "resolved"];

  // Metrics/quantification patterns
  const metricPatterns = [
    /\d+%/,
    /\$[\d,]+/,
    /\d+\+?\s*(users|customers|team|members|engineers|projects|clients|people)/i,
    /\d+x\b/i,
    /\b(revenue|growth|savings|reduction|increase|improvement)\b.*\d/i,
  ];
  const metricsFound = metricPatterns.filter(p => p.test(resumeText)).length;
  const hasMetrics = metricsFound > 0;

  // Check sections
  const foundSections = requiredSections.filter(s => s.keywords.some(k => text.includes(k)));
  const missingSections = requiredSections.filter(s => !s.keywords.some(k => text.includes(k)));
  const foundBonus = bonusSections.filter(s => s.keywords.some(k => text.includes(k)));

  // Check action verbs
  const foundVerbs = actionVerbs.filter(v => new RegExp(`\\b${v}\\w*\\b`, "i").test(text));

  // Length & density checks
  const wordCount = resumeText.trim().split(/\s+/).length;
  const hasSufficientLength = wordCount >= 150;
  const hasGoodLength = wordCount >= 300 && wordCount <= 1200;
  const bulletCount = (resumeText.match(/^[\s]*[-•●◦▪]/gm) || []).length;
  const hasBullets = bulletCount >= 3;

  // Formatting red flags
  const hasLongParagraphs = lines.some(l => l.trim().split(/\s+/).length > 60);
  const hasAllCapsBlocks = (resumeText.match(/^[A-Z\s]{20,}$/gm) || []).length > 3;

  // Score: 100 points total, harder to max out
  let score = 0;

  // Sections: up to 30 pts (required) + 6 pts (bonus)
  score += foundSections.length * 7.5;  // up to 30
  score += Math.min(6, foundBonus.length * 2); // up to 6

  // Action verbs: up to 15 pts (need 8+ verbs for full marks)
  score += Math.min(15, foundVerbs.length * 1.9);

  // Metrics: up to 15 pts (more metrics = higher score)
  score += Math.min(15, metricsFound * 5);

  // Structure: up to 14 pts
  score += hasSufficientLength ? 4 : 0;
  score += hasGoodLength ? 4 : 0;
  score += hasBullets ? 4 : 0;
  score += (!hasLongParagraphs) ? 2 : 0;

  // Formatting: up to 10 pts
  score += (!hasAllCapsBlocks) ? 3 : 0;
  score += (foundSections.length >= 3) ? 4 : 0;
  score += (wordCount > 100 && bulletCount >= 5) ? 3 : 0;

  // Penalties
  if (!hasSufficientLength) score -= 5;
  if (missingSections.length >= 2) score -= 5;
  if (foundVerbs.length < 3) score -= 5;

  score = Math.min(100, Math.max(0, Math.round(score)));

  const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Work" : "Poor";

  const found = [
    ...foundSections.map(s => s.name),
    ...foundBonus.map(s => s.name),
    foundVerbs.length > 0 ? `${foundVerbs.length} action verbs` : null,
    hasMetrics ? "Quantified achievements" : null,
    hasBullets ? "Bullet-point formatting" : null,
    hasGoodLength ? "Good length" : null,
  ].filter(Boolean) as string[];

  const missing = [
    ...missingSections.map(s => `Missing: ${s.name} section`),
    foundVerbs.length < 5 ? "Add more action verbs (achieved, led, built, implemented...)" : null,
    !hasMetrics ? "Add quantified metrics (%, $, numbers)" : null,
    !hasBullets ? "Use bullet points for better readability" : null,
    !hasSufficientLength ? "Resume is too short — add more detail" : null,
    hasLongParagraphs ? "Break long paragraphs into bullet points" : null,
  ].filter(Boolean) as string[];

  const suggestions = [
    missingSections.length > 0 ? `Add clear section headers: ${missingSections.map(s => s.name).join(", ")}` : null,
    !hasMetrics ? "Quantify achievements with specific numbers (e.g., 'increased revenue by 30%')" : null,
    foundVerbs.length < 8 ? "Start bullet points with strong action verbs: achieved, led, implemented, designed" : null,
    !hasBullets ? "Format experience as bullet points for ATS readability" : null,
    hasLongParagraphs ? "Keep paragraphs under 3 lines — ATS and recruiters prefer concise bullets" : null,
    "Use standard section headings (Experience, Education, Skills) for better ATS parsing",
    "Avoid tables, graphics, and complex formatting that ATS cannot read",
  ].filter(Boolean) as string[];

  return { score, label, found, missing, suggestions: suggestions.slice(0, 5) };
}

export default function DashboardResume() {
  useDocTitle("Resume");
  const { user, updateUser } = useAuth();
  const { persisted, updatePersisted } = useDashboardCore();
  const { dataLoading } = useDashboardUI();

  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState(user?.resumeFileName || persisted.resumeFileName);
  const [resumeText, setResumeText] = useState("");
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [phase, setPhase] = useState<"idle" | "extracting" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [needsReupload, setNeedsReupload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reanalyzeDone, setReanalyzeDone] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<"ai" | "fallback" | null>(null);
  const [truncated, setTruncated] = useState(false);
  // tooltipVisible was the hover state for the old "Why these?" focus-areas
  // tooltip — replaced in the cream redesign by a static dotted-underline
  // label inside ResumeTabView. Removed.
  // Resume v2 — domain tag selected at upload. Defaults to "general"
  // for back-compat with single-resume users. Persists in component
  // state only; on upload we pass it to /api/analyze-resume which
  // creates/finds the matching `resumes` row.
  const [domain, setDomain] = useState<string>("general");
  // Free-form text used when the user picks "Custom". Trimmed,
  // lowercased and slash-replaced before being sent as the domain
  // value, so "Solutions Engineering" becomes "solutions-engineering"
  // — keeps the (user_id, domain) grouping key stable and URL-safe.
  const [customDomain, setCustomDomain] = useState<string>("");
  const effectiveDomain = useMemo(() => {
    if (domain !== "custom") return domain;
    const cleaned = customDomain.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return cleaned || "custom"; // fall back to literal "custom" only if user left it blank
  }, [domain, customDomain]);
  // Multi-resume list — shown above the single-active-resume card so
  // users can see they have e.g. an SDE resume + a PM resume in one
  // glance. Read-only for now; switching is a Phase 4 ticket.
  const [allResumes, setAllResumes] = useState<Array<{
    id: string;
    domain: string;
    title: string;
    latestVersion: number;
    latestVersionId: string | null;
    latestScore: number | null;
    latestProfile: ResumeProfile | null;
    latestFileName: string | null;
    updatedAt: string;
    isActive: boolean;
    versions: Array<{ id: string; versionNumber: number; isLatest: boolean; fileName: string | null; score: number | null; profile: ResumeProfile | null; createdAt: string | null; resumeText: string | null }>;
  }>>([]);
  // expandedTimeline / renamingId / renameDraft were lifted into
  // CatalogueGrid as local UI state; the parent only needs to know the
  // pending action ids (archivingId, activatingId) to gate spinners.
  const [archivingId, setArchivingId] = useState<string | null>(null);
  // Lightweight toast — single slot, auto-dismiss. Used for
  // confirmation feedback on Make Active / Restore / Archive / Rename
  // so users actually know their click did something. Errors still go
  // through errorMsg so the existing error UI keeps working.
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3200);
  };
  useEffect(() => () => { if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current); }, []);
  // Per-bullet polish state. key = improvement index, value = pending /
  // returned suggestion. Lives only as long as the user is on the tab —
  // polishing is a transient UI nudge, not persisted.
  const [polished, setPolished] = useState<Record<number, { state: "loading" | "done" | "error"; rewrite?: string; rationale?: string; error?: string }>>({});
  const [activatingId, setActivatingId] = useState<string | null>(null);
  // Bump to force the catalogue useEffect to refetch (e.g. after the
  // server PATCH on Make Active so updated_at-based ordering reflects
  // DB truth).
  const [catalogueRefreshKey, setCatalogueRefreshKey] = useState(0);
  // True until the first catalogue fetch resolves, then false. Used to
  // render a skeleton placeholder so cards don't pop in mid-render.
  const [loadingResumes, setLoadingResumes] = useState(true);
  // Remember last seen catalogue count to render an honest skeleton
  // (was always 2 cards, looked weird for users who had 1 or 4).
  const SKELETON_COUNT_KEY = "hirestepx_resume_skeleton_count";
  const skeletonCount = useMemo(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SKELETON_COUNT_KEY) : null;
      const n = raw ? parseInt(raw, 10) : 1;
      if (!Number.isFinite(n) || n < 1) return 1;
      return Math.min(4, n);
    } catch { return 1; }
  }, []);
  const analyzingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // JD Match — LLM-powered resume vs job description analysis.
  // The /api/analyze-jd-match endpoint is fully implemented; this wires
  // the frontend. Users paste a JD and click "Analyze Fit" to get a
  // match score, missing skills, gaps, and interview tips specific to
  // that JD. The suggestedFocus pre-fills the session-setup focus chip.
  const [jdText, setJdText] = useState("");
  const [jdAnalysis, setJdAnalysis] = useState<{
    matchScore: number;
    matchLabel: string;
    matchedSkills: string[];
    missingSkills: string[];
    experienceMatch: string;
    keyStrengths: string[];
    gaps: string[];
    interviewTips: string[];
    suggestedFocus: string;
  } | null>(null);
  const [jdLoading, setJdLoading] = useState(false);
  const [jdError, setJdError] = useState("");

  const handleAnalyzeJD = async () => {
    const resumeSource = user?.resumeText || resumeText;
    if (!resumeSource || jdText.trim().length < 30) return;
    setJdLoading(true);
    setJdError("");
    setJdAnalysis(null);
    try {
      const { apiFetch } = await import("./apiClient");
      const res = await apiFetch<{ analysis?: Record<string, unknown>; error?: string }>(
        "/api/analyze-jd-match",
        { resumeText: resumeSource, jobDescription: jdText },
      );
      if (!res.ok || res.data?.error) {
        throw new Error(res.data?.error || res.error || "Analysis failed");
      }
      if (res.data?.analysis) {
        setJdAnalysis(res.data.analysis as typeof jdAnalysis);
      }
    } catch (err) {
      setJdError(err instanceof Error ? err.message : "Could not analyze match. Try again.");
    } finally {
      setJdLoading(false);
    }
  };

  // ATS compliance check — auto-computes when resume/JD changes
  const atsResult = useMemo<ATSResult | null>(() => {
    const rText = user?.resumeText || resumeText;
    if (!rText) return null;
    return computeATSScore(rText, user?.targetRole);
  }, [user?.resumeText, resumeText, user?.targetRole]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  // Fetch the user's full resume catalogue (all domains, all versions) so
  // we can render the multi-resume list view above the active card. RLS
  // restricts this to rows owned by the current user. Best-effort — if
  // the request fails (offline, RLS misconfig) the list just stays empty
  // and the single-active-resume UI renders as before.
  useEffect(() => {
    if (!user?.id) return;
    // Skip the Supabase fetch entirely while the multi-resume UI is
    // hidden — no point hitting the network for a render that isn't
    // happening. setLoadingResumes(false) so the skeleton placeholder
    // doesn't sit forever on first render.
    if (!MULTI_RESUME_UI_ENABLED) {
      setLoadingResumes(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getSupabase } = await import("./supabase");
        const client = await getSupabase();
        const { data, error } = await client
          .from("resumes")
          .select("id, domain, title, active_version_id, updated_at, is_archived, resume_versions(id, version_number, parsed_data, is_latest, file_name, created_at, resume_text)")
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        if (error || !Array.isArray(data)) {
          setLoadingResumes(false);
          return;
        }
        type VersionRow = { id: string; version_number: number; parsed_data: ResumeProfile | null; is_latest: boolean; file_name: string | null; created_at: string | null; resume_text: string | null };
        type ResumeRow = { id: string; domain: string; title: string | null; active_version_id: string | null; updated_at: string; resume_versions: VersionRow[] | null };
        // Active = the resume with the most-recent updated_at. The
        // server orders the response that way already, so the first
        // row in the array is the one driving the user's experience.
        // resumes.active_version_id is per-resume "which version of
        // this row is current" — every row has one, so it can't tell
        // us which resume is "active" in the user-facing sense.
        const transformed = (data as ResumeRow[]).map((r, idx) => {
          const versions = Array.isArray(r.resume_versions) ? r.resume_versions : [];
          const latest = versions.find(v => v.is_latest) ?? versions.sort((a, b) => b.version_number - a.version_number)[0];
          // Title resolution — show the actual uploaded filename, not the
          // domain code. Order:
          //   1. latest version's file_name (the most authoritative source —
          //      always set when the user uploaded a real file)
          //   2. resumes.title if it's not just the domain code
          //   3. friendly "{Domain} resume" fallback
          // The previous version of this fell back to the parsed headline,
          // which surfaced the LLM-generated tagline ("Senior Product
          // Designer with 5+…") instead of the filename. That confused
          // users into thinking the wrong resume was attached.
          const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const niceTitle = latest?.file_name
            || (r.title && r.title !== r.domain ? r.title : null)
            || `${titleCase(r.domain)} resume`;
          // Sort versions newest-first for the timeline rendering.
          const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);
          // Pick the version the card should display. After Restore, the
          // active version may NOT be the latest. The card must mirror
          // what sessions + the profile view see — i.e. the active
          // version. Fall back to latest when active_version_id is null
          // (legacy rows) or points at an absent row (data error).
          const displayed =
            (r.active_version_id ? versions.find(v => v.id === r.active_version_id) : null)
            ?? latest;
          return {
            id: r.id,
            domain: r.domain || "general",
            title: niceTitle,
            latestVersion: displayed?.version_number ?? 1,
            latestVersionId: displayed?.id ?? null,
            latestScore: typeof displayed?.parsed_data?.resumeScore === "number" ? displayed.parsed_data.resumeScore : null,
            latestProfile: displayed?.parsed_data ?? null,
            latestFileName: displayed?.file_name ?? null,
            updatedAt: r.updated_at,
            isActive: idx === 0,
            versions: sortedVersions.map(v => ({
              id: v.id,
              versionNumber: v.version_number,
              isLatest: v.is_latest,
              fileName: v.file_name,
              score: typeof v.parsed_data?.resumeScore === "number" ? v.parsed_data.resumeScore : null,
              profile: v.parsed_data,
              createdAt: v.created_at,
              resumeText: v.resume_text,
            })),
          };
        });
        setAllResumes(transformed);
        setLoadingResumes(false);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(SKELETON_COUNT_KEY, String(transformed.length));
          }
        } catch { /* ignore */ }
      } catch {
        setLoadingResumes(false);
        /* best-effort */
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, fileName, catalogueRefreshKey]);

  useEffect(() => {
    if (user?.resumeText) setResumeText(user.resumeText);
    if (user?.resumeFileName) setFileName(user.resumeFileName);

    const stored = user?.resumeData;
    if (stored) {
      if (isAiResume(stored)) {
        // AI variant carries headline/topSkills directly — show as-is.
        setProfile(stored);
        setAnalysisSource("ai");
        setPhase("done");
        // Schema-version upgrade path: profiles persisted before
        // 2e6703c don't have `experiences` or `skillsDetailed`.
        // Fire a one-shot background re-analysis so the Experience
        // timeline + skill-depth chips populate without users having
        // to click Re-analyse manually. The schema version bump in
        // _resume-versioning.ts ensures this hits the LLM (not the
        // stale cache row).
        const needsSchemaUpgrade =
          stored.experiences === undefined && stored.skillsDetailed === undefined;
        if (needsSchemaUpgrade && user?.resumeText && !analyzingRef.current) {
          analyzingRef.current = true;
          abortControllerRef.current?.abort();
          abortControllerRef.current = new AbortController();
          analyzeResumeWithAI(user.resumeText, user?.targetRole, abortControllerRef.current.signal)
            .then(result => {
              if (result?.profile) {
                setProfile(result.profile);
                updateUser({ resumeData: { _type: "ai", ...result.profile } });
              }
            })
            .catch(() => { /* silent — old shape keeps rendering */ })
            .finally(() => { analyzingRef.current = false; });
        }
      } else if (isFallbackResume(stored) && user?.resumeText && !analyzingRef.current) {
        // Regex-fallback stored — opportunistically try AI re-analysis in
        // the background. Keep the fallback visible while we wait.
        analyzingRef.current = true;
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();
        setProfile(fallbackToProfile(stored));
        setPhase("analyzing");
        analyzeResumeWithAI(user.resumeText, user?.targetRole, abortControllerRef.current.signal)
          .then(result => {
            if (result?.profile) {
              setProfile(result.profile);
              setAnalysisSource("ai");
              setErrorMsg("");
              updateUser({ resumeData: { _type: "ai", ...result.profile } });
            } else {
              setErrorMsg("AI analysis returned no results. Try clicking re-analyze.");
            }
            setPhase("done");
          })
          .catch(err => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setErrorMsg(`AI analysis failed: ${msg}`);
            console.error("[resume] AI re-analysis error:", err);
            setPhase("done");
          })
          .finally(() => { analyzingRef.current = false; });
      } else if (isFallbackResume(stored)) {
        // Fallback without resumeText to re-analyze — render it directly.
        setProfile(fallbackToProfile(stored));
        setAnalysisSource("fallback");
        setPhase("done");
        if (!user?.resumeText) setNeedsReupload(true);
      }
    } else if (user?.resumeText && user?.resumeFileName) {
      // Resume was uploaded (e.g. during onboarding) but no AI profile exists yet.
      // Auto-trigger AI analysis (guard against duplicate calls).
      if (analyzingRef.current) return;
      analyzingRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      setPhase("analyzing");
      analyzeResumeWithAI(user.resumeText, user?.targetRole, abortControllerRef.current.signal)
        .then(result => {
          if (result?.profile) {
            setProfile(result.profile);
            updateUser({ resumeData: { _type: "ai", ...result.profile } });
          }
          setPhase("done");
        })
        .catch(() => setPhase("done"))
        .finally(() => { analyzingRef.current = false; });
    } else if (user?.resumeFileName) {
      // Resume filename exists but no text/analysis — mark done but show re-upload prompt
      setPhase("done");
      setNeedsReupload(true);
    }
    // Re-runs only when the underlying resume payload changes. updateUser/targetRole are read inside the analysis branch but adding them would re-fire analysis whenever the user edits an unrelated field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.resumeData, user?.resumeFileName, user?.resumeText]);

  /**
   * Promote a resume version to active. Three jobs:
   *   1. PATCH `resumes.active_version_id` + `updated_at` server-side
   *   2. Mirror the change into in-memory state — profile view, user
   *      data, and the sessionStorage key the interview engine reads
   *      at session init. Without (2) the catalogue badge moves but
   *      the next interview still pins to whatever resume the user
   *      last *analyzed*, which silently breaks the contract.
   *   3. Bump catalogueRefreshKey so cards re-order on the wire too.
   *
   * Used by both the "Make active" button on a non-active card and
   * the "Use this version" button on the per-version timeline.
   */
  const handleMakeActive = async (
    resumeId: string,
    versionId: string | null,
    chosenProfile?: ResumeProfile | null,
    chosenFileName?: string | null,
    chosenResumeText?: string | null,
  ) => {
    if (!versionId) return;
    setActivatingId(resumeId);
    const prev = allResumes;
    setAllResumes(prev.map(r => ({ ...r, isActive: r.id === resumeId })));
    try {
      const { apiFetch } = await import("./apiClient");
      const res = await apiFetch<{ ok?: boolean; error?: string }>(
        "/api/resume/set-active",
        { resumeId, versionId },
      );
      if (!res.ok) {
        setAllResumes(prev); // revert
        showNotice("err", res.error || "Failed to switch active resume");
        return;
      }
      // Server PATCH succeeded. Now keep local state in sync so the
      // profile view + interview engine pick up the new active resume
      // immediately without a page refresh.
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(ACTIVE_RESUME_VERSION_KEY, versionId);
        }
      } catch { /* restricted */ }
      if (chosenProfile) {
        setProfile(chosenProfile);
        setAnalysisSource("ai");
        // Sync ALL three: profile, fileName, AND resumeText. The
        // previous version forgot resumeText, so a Re-analyze after
        // Restore was running on the OLD text. Subtle correctness bug.
        const userPatch: Parameters<typeof updateUser>[0] = {
          resumeData: { _type: "ai", ...chosenProfile },
        };
        if (chosenFileName) userPatch.resumeFileName = chosenFileName;
        if (chosenResumeText) userPatch.resumeText = chosenResumeText;
        updateUser(userPatch);
        if (chosenFileName) {
          setFileName(chosenFileName);
          updatePersisted({ resumeFileName: chosenFileName });
        }
        if (chosenResumeText) {
          setResumeText(chosenResumeText);
        }
      }
      setCatalogueRefreshKey(k => k + 1);
      const isRestore = chosenProfile != null && allResumes.find(r => r.id === resumeId)?.latestVersionId !== versionId;
      trackResumeEvent(isRestore ? "resume_restore_version" : "resume_make_active", { resumeId, versionId });
      showNotice("ok", chosenFileName ? `Switched to ${chosenFileName}` : "Active resume switched");
    } catch (err) {
      setAllResumes(prev);
      showNotice("err", (err as Error).message || "Failed to switch active resume");
    } finally {
      setActivatingId(null);
    }
  };

  /**
   * Rename a resume row's title. Direct supabase-js call — RLS already
   * scopes updates to the owner. Optimistic update with revert on error.
   */
  const handleRenameResume = async (resumeId: string, newTitle: string) => {
    const trimmed = newTitle.trim().slice(0, 120);
    if (!trimmed) return;
    const prev = allResumes;
    setAllResumes(prev.map(r => r.id === resumeId ? { ...r, title: trimmed } : r));
    try {
      const { getSupabase } = await import("./supabase");
      const client = await getSupabase();
      const { error } = await client.from("resumes").update({ title: trimmed }).eq("id", resumeId);
      if (error) {
        setAllResumes(prev);
        showNotice("err", `Rename failed: ${error.message}`);
      } else {
        trackResumeEvent("resume_renamed", { resumeId });
        showNotice("ok", `Renamed to "${trimmed}"`);
      }
    } catch (err) {
      setAllResumes(prev);
      showNotice("err", (err as Error).message || "Rename failed");
    }
  };

  /**
   * Archive (soft-delete) a non-active resume. We keep the row in DB so
   * historical sessions that reference its versions still resolve. The
   * catalogue filters `is_archived=false`, so the user just stops seeing
   * it. Refuses if the resume is currently active — user must switch to
   * another resume first.
   */
  const handleArchiveResume = async (resumeId: string, isActive: boolean) => {
    if (isActive) {
      setErrorMsg("Switch to another resume first, then archive this one.");
      return;
    }
    // Confirm UI is now inline inside CatalogueGrid; this handler runs
    // only after the user confirms, so no extra prompt here.
    setArchivingId(resumeId);
    const prev = allResumes;
    const archivedRow = prev.find(r => r.id === resumeId);
    setAllResumes(prev.filter(r => r.id !== resumeId));
    try {
      const { getSupabase } = await import("./supabase");
      const client = await getSupabase();
      const { error } = await client.from("resumes").update({ is_archived: true, updated_at: new Date().toISOString() }).eq("id", resumeId);
      if (error) {
        setAllResumes(prev);
        showNotice("err", `Archive failed: ${error.message}`);
      } else {
        // Best-effort: clean up the original-file blobs from Storage so
        // the bucket doesn't accumulate orphans for archived resumes.
        // Failure here is non-fatal — the row is archived, the user
        // doesn't see the files; a future cron can sweep stragglers.
        if (archivedRow && user?.id) {
          const paths = archivedRow.versions
            .filter(v => v.fileName) // only versions that uploaded a file
            .map(v => `${user.id}/${resumeId}/${v.id}.${(v.fileName || "").split(".").pop() || "bin"}`);
          if (paths.length > 0) {
            try {
              await client.storage.from("resume-files").remove(paths);
            } catch (storageErr) {
              console.warn(`[resume-archive] storage cleanup failed for ${resumeId}: ${(storageErr as Error).message}`);
            }
          }
        }
        trackResumeEvent("resume_archived", { resumeId });
        showNotice("ok", "Resume archived");
      }
    } catch (err) {
      setAllResumes(prev);
      showNotice("err", (err as Error).message || "Archive failed");
    } finally {
      setArchivingId(null);
    }
  };

  /**
   * Replace an improvement bullet in-place with the polished suggestion.
   * Persists the edited profile to user.resumeData so the change survives
   * navigation. The cached resume_versions row in Postgres is intentionally
   * NOT mutated — we keep the original LLM output as the source of truth
   * and treat polish as a user-applied delta on top.
   */
  const handleApplyPolish = (idx: number, rewrite: string) => {
    if (!profile) return;
    const next = { ...profile, improvements: [...(profile.improvements || [])] };
    next.improvements![idx] = rewrite;
    setProfile(next);
    updateUser({ resumeData: { _type: "ai", ...next } });
    setPolished(p => {
      const copy = { ...p };
      delete copy[idx];
      return copy;
    });
    trackResumeEvent("resume_polish_applied", { idx });
    showNotice("ok", "Suggestion applied to your resume");
  };

  /**
   * Ask the server to rewrite a single improvement bullet. Inline result
   * appears below the bullet; user can copy the suggestion or dismiss it.
   */
  const handlePolishBullet = async (idx: number, bullet: string) => {
    trackResumeEvent("resume_polish_requested", { idx });
    setPolished(p => ({ ...p, [idx]: { state: "loading" } }));
    try {
      const { apiFetch } = await import("./apiClient");
      const res = await apiFetch<{ rewrite?: string; rationale?: string; error?: string }>(
        "/api/resume/rewrite-bullet",
        { bullet, context: { role: user?.targetRole, domain: effectiveDomain } },
      );
      if (!res.ok || !res.data?.rewrite) {
        setPolished(p => ({ ...p, [idx]: { state: "error", error: res.error || "Polish failed" } }));
      } else {
        setPolished(p => ({ ...p, [idx]: { state: "done", rewrite: res.data!.rewrite, rationale: res.data!.rationale } }));
      }
    } catch (err) {
      setPolished(p => ({ ...p, [idx]: { state: "error", error: (err as Error).message } }));
    }
  };

  // Memoize the per-card fitness computation. computeAllFitness runs
  // 4 regex passes over the profile blob × N cards × every render —
  // cheap individually but adds up on big catalogues. Recompute only
  // when the underlying allResumes array changes.

  const fitsByResumeId = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeAllFitness> | null> = {};
    for (const r of allResumes) {
      out[r.id] = r.latestProfile ? computeAllFitness(r.latestProfile) : null;
    }
    return out;
  }, [allResumes]);

  // The multi-resume catalogue panel was rendered here. Re-introduce when
  // MULTI_RESUME_UI_ENABLED flips back on — wrap CatalogueGrid + the
  // skeleton in a conditional and render inside ResumeTabView (or above
  // it). The fetch effect, fitness memo, and action handlers all remain
  // in this controller for that flip.

  /* ─── Coverage rows for the Practise band ────────────────────────
     Maps the four interview-type FitnessScores into the row shape the
     view expects. Computed on the active profile only — old cached
     profiles without `experiences[]` still produce coverage because
     resumeFitness reads off topSkills + interviewStrengths/Gaps.
     IMPORTANT: this hook must run unconditionally on every render —
     placing it after `if (dataLoading) return ...` would violate the
     hook ordering rule. */
  const COVERAGE_LABELS: Record<InterviewType, string> = useMemo(() => ({
    behavioral: "Behavioural rounds",
    technical: "Technical depth",
    system_design: "System design",
    case: "Case-study problem-solving",
    campus: "Campus placement",
  }), []);
  const coverage = useMemo<Array<{ label: string; band: FitnessBand; score: number; type: InterviewType }>>(() => {
    if (!profile) return [];
    const fits = computeAllFitness(profile);
    return (Object.keys(COVERAGE_LABELS) as InterviewType[]).map((type) => ({
      type,
      label: COVERAGE_LABELS[type],
      band: fits[type].band,
      score: fits[type].score,
    }));
  }, [profile, COVERAGE_LABELS]);

  if (dataLoading) return <DataLoadingSkeleton />;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large — please upload a file under 10 MB.");
      setPhase("error");
      return;
    }
    if (file.name.toLowerCase().endsWith(".doc")) {
      setErrorMsg("Old .doc format is not supported. Please convert to .docx or PDF first (open in Word or Google Docs → Save As).");
      setPhase("error");
      return;
    }
    setFileName(file.name);
    setErrorMsg("");
    setProfile(null);
    setNeedsReupload(false);
    setAnalysisSource(null);
    setTruncated(false);

    setPhase("extracting");
    let text: string;
    try {
      text = await extractResumeText(file);
      setResumeText(text);
      updatePersisted({ resumeFileName: file.name });
      updateUser({ resumeFileName: file.name, resumeText: text });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse resume");
      setPhase("error");
      return;
    }

    // Compute SHA-256 of the original file bytes so the server can
    // dedup at the file level (even if the extracted text identically
    // matches a prior version, the file_hash distinguishes "exact same
    // PDF re-uploaded" from "different PDF with same text". Useful for
    // future audit/integrity checks; for now it just gets persisted on
    // the resume_versions row.
    let fileHash: string | undefined;
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      fileHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch { /* file-hash is best-effort */ }

    setPhase("analyzing");
    let result: { profile: ResumeProfile; truncated?: boolean; resumeVersionId?: string | null; cached?: boolean } | null = null;
    let analyzeError: string | null = null;
    try {
      result = await Promise.race([
        analyzeResumeWithAI(text, user?.targetRole, undefined, { fileName: file.name, fileHash, domain: effectiveDomain }),
        // 40s covers the server's worst case: Groq (15s) → Gemini fallback
        // (15s) + auth/rate/quota pre-checks (~2–5s). A tighter 25s budget
        // was killing legitimate fallback paths.
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 40_000)),
      ]);
    } catch (err) {
      // Preserve the real error so the UI can surface it (auth expired, quota,
      // LLM misconfigured, etc.) instead of a generic "unavailable" message.
      analyzeError = err instanceof Error ? err.message : String(err);
      console.error("[resume] Upload-time AI analysis failed:", analyzeError);
    }
    if (result?.profile) {
      setProfile(result.profile);
      setAnalysisSource("ai");
      setTruncated(!!result.truncated);
      updateUser({ resumeData: { _type: "ai", ...result.profile } });
      saveResumeVersion(file.name, result.profile.resumeScore, text);
      trackResumeEvent("resume_uploaded", { domain: effectiveDomain, cached: !!result.cached, score: result.profile.resumeScore });
      // Best-effort: ship the original file bytes to Supabase Storage
      // so the resume_versions row carries a file_path. Defensive — if
      // the bucket isn't configured (503 with bucketMissing=true) we
      // log and move on. Resume analysis already succeeded; archival
      // is bonus.
      if (result.resumeVersionId) {
        uploadOriginalFile(file, result.resumeVersionId).catch(err => {
          console.warn("[resume] file storage upload failed:", err?.message || err);
        });
      }
      setPhase("done");
    } else {
      const isTimeout = analyzeError?.toLowerCase().includes("timeout");
      const isAuth = analyzeError?.toLowerCase().includes("session") || analyzeError?.toLowerCase().includes("unauthorized");
      const isQuota = analyzeError?.toLowerCase().includes("quota") || analyzeError?.toLowerCase().includes("limit");
      setErrorMsg(
        isAuth
          ? "Session expired — please refresh and sign in again, then click Re-analyze."
          : isQuota
            ? `${analyzeError} — basic profile shown below.`
            : isTimeout
              ? "AI analysis timed out — showing basic profile. Click Re-analyze to retry."
              : analyzeError
                ? `AI analysis failed: ${analyzeError}. Showing basic profile — click Re-analyze to retry.`
                : "AI analysis unavailable — showing basic profile. Click Re-analyze to retry.",
      );
      const parsed = parseResumeData(text);
      // Store the raw regex-parse result as the fallback — it carries
      // the ParsedResume fields (name/experience/education) that the
      // FallbackStoredResume discriminator branch expects. UI rendering
      // runs through fallbackToProfile() to project into ResumeProfile.
      updateUser({ resumeData: { _type: "fallback", ...parsed } });
      setProfile(fallbackToProfile({ _type: "fallback", ...parsed }));
      setAnalysisSource("fallback");
      saveResumeVersion(file.name, undefined, text);
      setPhase("done");
    }
  };

  const handleRemove = () => {
    setFileName(null);
    setResumeText("");
    setProfile(null);
    setPhase("idle");
    setErrorMsg("");
    updatePersisted({ resumeFileName: null });
    updateUser({ resumeFileName: null, resumeText: "", resumeData: null });
    // Also clear the local resume cache so handleReanalyze's fallback chain
    // doesn't bring the deleted resume back from localStorage on the next
    // Re-analyze click. Onboarding writes the same key on upload, so staying
    // consistent with that namespace is important.
    try { localStorage.removeItem("hirestepx_resume"); } catch { /* noop */ }
  };

  const handleReanalyze = async () => {
    if (reanalyzing) return;
    // Fallback chain: local state → user profile → localStorage. The local
    // state may be empty on first render before the hydration useEffect runs,
    // or when the Supabase profile.resume_text column was skipped due to a
    // missing column and text lives only in localStorage under hirestepx_resume.
    let textForAnalysis = resumeText || user?.resumeText || "";
    if (!textForAnalysis) {
      try {
        const raw = localStorage.getItem("hirestepx_resume");
        if (raw) {
          const obj = JSON.parse(raw) as { text?: string };
          if (obj?.text) textForAnalysis = obj.text;
        }
      } catch { /* ignore */ }
    }
    if (!textForAnalysis || textForAnalysis.trim().length < 30) {
      setErrorMsg("Resume text not available — please click Replace and re-upload your resume to get AI analysis.");
      return;
    }
    // Sync local state so subsequent renders have the text available too.
    if (!resumeText) setResumeText(textForAnalysis);
    setReanalyzing(true);
    setReanalyzeDone(false);
    setErrorMsg("");
    const tStart = Date.now();
    // AbortController lets us actually cancel the underlying fetch when the
    // race timeout wins — without it the request stays in flight and never
    // surfaces in the Network tab as "canceled", which is exactly what made
    // the previous failure invisible.
    const reanalyzeAbort = new AbortController();
    const timeoutId = setTimeout(() => reanalyzeAbort.abort(), 40_000);
    try {
      const result = await Promise.race([
        analyzeResumeWithAI(textForAnalysis, user?.targetRole, reanalyzeAbort.signal),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 40_000)),
      ]);
      clearTimeout(timeoutId);
      const elapsed = Date.now() - tStart;
      if (result?.profile) {
        setProfile(result.profile);
        setAnalysisSource("ai");
        setTruncated(!!result.truncated);
        updateUser({ resumeData: { _type: "ai", ...result.profile } });
        if (fileName) saveResumeVersion(fileName, result.profile.resumeScore, textForAnalysis);
      } else {
        console.warn(`[resume] Re-analyze returned no profile in ${elapsed}ms`, result);
        setErrorMsg("AI couldn't extract structured data. Try re-uploading a cleaner PDF or DOCX.");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      reanalyzeAbort.abort(); // cancel underlying fetch on any failure
      const elapsed = Date.now() - tStart;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[resume] Re-analyze FAILED after ${elapsed}ms: ${msg}`);
      setErrorMsg(msg.includes("timeout") ? `Analysis timed out after ${Math.round(elapsed / 1000)}s. Try again.` : `Analysis failed: ${msg}`);
    }
    setReanalyzing(false);
    setReanalyzeDone(true);
    setTimeout(() => setReanalyzeDone(false), 5000);
  };

  const triggerUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt";
    input.onchange = (e) => { handleFile((e.target as HTMLInputElement).files?.[0]); };
    input.click();
  };

  /* Last-analysed label derived from reanalyzeDone is a plain ternary,
     defined right where it's used in the return below. */
  const lastAnalysedLabel = reanalyzeDone ? "just now" : null;

  /* During the active extracting / analyzing phases the loading screen
     is shown without the rest of the chrome. Funnel everything through
     <ResumeTabView /> — its top-level dispatcher renders the right
     phase variant. */
  return (
    <>
    {/* Multi-resume catalogue strip — gated off in v1. The expression
        below statically references the catalogue's handlers + state so
        flipping MULTI_RESUME_UI_ENABLED back to true is a one-liner; no
        re-imports, no re-wiring. While the flag is false the JSX never
        evaluates at runtime. */}
    {MULTI_RESUME_UI_ENABLED && (loadingResumes || allResumes.length >= 1) && (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 0 0" }}>
        {loadingResumes && allResumes.length === 0 ? (
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}
            aria-label="Loading resumes"
            aria-live="polite"
          >
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #EBE5D2",
                  borderRadius: 12,
                  height: 130,
                }}
              />
            ))}
          </div>
        ) : (
          <CatalogueGrid
            resumes={allResumes}
            fitsByResumeId={fitsByResumeId}
            activatingId={activatingId}
            archivingId={archivingId}
            onMakeActive={handleMakeActive}
            onArchive={handleArchiveResume}
            onRename={handleRenameResume}
          />
        )}
      </div>
    )}
    <ResumeTabView
      phase={phase}
      profile={profile}
      analysisSource={analysisSource}
      targetRole={user?.targetRole ?? undefined}
      fileName={fileName}
      fileSizeKb={null}
      lastAnalysedLabel={lastAnalysedLabel}
      errorMsg={errorMsg}
      needsReupload={needsReupload}
      truncated={truncated}
      reanalyzing={reanalyzing}
      reanalyzeDone={reanalyzeDone}
      onReanalyze={handleReanalyze}
      confirmDelete={confirmDelete}
      setConfirmDelete={setConfirmDelete}
      onRemove={handleRemove}
      isDragging={isDragging}
      setIsDragging={setIsDragging}
      onTriggerUpload={triggerUpload}
      onDropFile={handleFile}
      polished={polished}
      onPolishBullet={handlePolishBullet}
      onApplyPolish={handleApplyPolish}
      onDismissPolish={(idx: number) => setPolished(p => { const copy = { ...p }; delete copy[idx]; return copy; })}
      domain={domain}
      setDomain={setDomain}
      customDomain={customDomain}
      setCustomDomain={setCustomDomain}
      atsResult={atsResult}
      coverage={coverage}
      onDismissError={() => { setErrorMsg(""); if (phase === "error") setPhase("idle"); }}
      resumeText={resumeText}
      jdText={jdText}
      jdAnalysis={jdAnalysis}
      jdLoading={jdLoading}
      jdError={jdError}
      onJDTextChange={(t) => { setJdText(t); if (!t) { setJdAnalysis(null); setJdError(""); } }}
      onAnalyzeJD={() => { void handleAnalyzeJD(); }}
    />
    {/* Floating toast — surfaces feedback from showNotice() (e.g. "Polish
        applied", "Resume archived"). Single slot, auto-dismisses. Cream
        palette so it reads correctly on the redesigned page. */}
    {notice && (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
          maxWidth: 360,
          padding: "10px 14px",
          borderRadius: 10,
          background: notice.kind === "ok" ? "#15803D" : "#B91C1C",
          color: "#FFFFFF",
          fontFamily: "'Satoshi', -apple-system, system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}
      >
        <span style={{ fontWeight: 700 }}>{notice.kind === "ok" ? "✓" : "!"}</span>
        {notice.text}
      </div>
    )}
    </>
  );
}
