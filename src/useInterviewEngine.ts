import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { captureClientEvent } from "./posthogClient";

import { useAuth } from "./AuthContext";
import { speak, speakAs, prefetchTTS, cleanupTTS, fetchCartesiaVoices, isAutoplayBlocked, hardMuteTTS } from "./tts";
import { useForceAudioUnlockOnMount, useClickRecoverAutoplay } from "./_audio-unlock";
import { useOnlineOfflineRecovery } from "./_recovery";
import { buildDraftSnapshot, validateRestoredDraft } from "./_session-draft";
import { useBackchannels } from "./_backchannels";
import { extractAccentMarkup } from "./_accent-parser";
import { stripProsodyMarkup } from "./_prosody";
import { useListeningInterjections } from "./_listening-interjections";
import { buildThinkingPhrase } from "./_thinking-phrase";
import { pickInitialNegotiationStyle, computeNegotiationPhase } from "./_negotiation-state";
import { runEvaluationFlow } from "./_evaluation-flow";
import {
  isRepeatRequest,
  computeAdaptiveDifficulty,
  buildConversationHistory,
  pickNegotiationCoachingHint,
  extractRecentFollowUps,
} from "./_advance-helpers";
import { useToast } from "./Toast";
import { saveToIDB, loadFromIDB, deleteFromIDB } from "./interviewIDB";
import type { InterviewStep } from "./interviewScripts";
import { getMiniScript, getScript } from "./interviewScripts";
import { saveSessionResult, fetchLLMQuestions, fetchFollowUp, retryQueuedEvals, getAdaptiveHints, negotiationKernelInit, negotiationKernelTurn } from "./interviewAPI";
import { initLiveSession, saveInterviewTurn, getLatestSessionInsightFlags } from "./supabase";
import { deriveCandidateState } from "./_emotional-state";
import { checkFollowUpCap } from "./_follow-up-cap";
import { extractNounPhrases, appendToMemory } from "./_noun-phrase-memory";
import type { NegotiationBandData } from "./interviewAPI";
import type { DeepgramSTTHandle } from "./deepgramSTT";
import type { SarvamSTTHandle } from "./sarvamSTT";
import { getInterviewerName, getInterviewerGender, getPanelMembers, formatTime, getPersonaTrait } from "./InterviewComponents";
import type { SpeechRecognitionInstance } from "./speechRecognition";
import { safeUUID } from "./utils";
import { computeMicroFeedback } from "./interviewMicroFeedback";
import { detectStarPresence, nextStarGap } from "./_star-detection";
import { detectBehaviouralAnswerSignals, type BehaviouralAnswerSignals } from "../server-handlers/_behavioural-answer-signals";
import { buildBehavioralIntro } from "./_behavioral-intro";
import { cleanSalarySttArtifacts } from "./_salary-stt-cleanup";
import { useInterviewTimers } from "./useInterviewTimers";
import { useInterviewSTT } from "./useInterviewSTT";
import { extractNegotiationFacts } from "./interviewEvaluation";
import { detectRoleCompanyFit } from "./_role-company-fit";
import { detectRoleLabelMismatch } from "../server-handlers/_role-mismatch";
import { computeApplicableYoe } from "../server-handlers/_candidate-profile";
import { matchRoleKey as matchSalaryRoleKey } from "../data/salaries";
import { getCompanyTier } from "../data/company-tiers";
import {
  normalizePersona,
  REACTIONS,
  pickPersonality,
  assessAnswerQuality,
  pickRandom,
  randomDelay,
  shouldUseEmpatheticClosing,
  decideComponentGapFollowUp,
} from "./_interview-engine-helpers";
import type { InterviewerPersonality } from "./_interview-engine-helpers";

/* ─── Draft data shape (for IDB restore) ─── */
interface InterviewDraft {
  transcript: { speaker: "ai" | "user"; text: string; time: string }[];
  currentStep: number;
  elapsed: number;
  script?: InterviewStep[];
  interviewType?: string;
}

/* ═══════════════════════════════════════════════
   useInterviewEngine — core state & logic
   ═══════════════════════════════════════════════ */
export function useInterviewEngine() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type");
  const interviewType = (rawType && rawType !== "undefined" && rawType !== "null") ? rawType : "behavioral";
  const interviewFocus = searchParams.get("focus") || "general";
  const interviewDifficulty = searchParams.get("difficulty") || "standard";
  const targetCompany = searchParams.get("company") || "";
  const targetRole = searchParams.get("role") || "";
  const currentCity = searchParams.get("currentCity") || user?.city || "";
  const jobCity = searchParams.get("jobCity") || "";
  const sessionLength = searchParams.get("length") || "";
  const isMiniMode = searchParams.get("mini") === "true" || sessionLength === "10m";
  const shouldUseResume = searchParams.get("useResume") !== "false";
  const jobDescription = searchParams.get("jd") || "";
  /* Coaching-drill hint surfaced by the dashboard "Your next move" CTA
     and reflected on the SessionSetup banner. Forwarded straight to the
     question generator so the LLM can tilt 2+ questions toward this
     coaching area. Vocabulary lives in `nextMove.ts` GAP_CTA_MAP.drill. */
  const drillKey = searchParams.get("drill") || "";

  // Session-level interviewer personality (persists for entire interview)
  const [personality] = useState<InterviewerPersonality>(() => pickPersonality());
  /* Rambling / soft-tracking refs are owned by useListeningInterjections
     (see ./_listening-interjections.ts) — declared there and surfaced
     back here for backchannel coordination. */
  // "I don't know" count for evaluation context
  const dontKnowCountRef = useRef(0);
  // Live session ID — created early so turns can be saved in real-time
  const liveSessionIdRef = useRef<string>(safeUUID());
  // Turn counter for real-time persistence ordering
  const turnIndexRef = useRef(0);
  // Resume v2: capture the active resume_version_id at engine init
  // (pre-question-fetch) and freeze it for the session's lifetime. Even
  // if the user re-uploads in another tab mid-interview, this session
  // saves with the version it actually started on. Falls back to null
  // when the user has no resume — the server still resolves a sensible
  // default at save time.
  const resumeVersionIdRef = useRef<string | null>(
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("hirestepx_active_resume_version") || null
      : null,
  );
  // Negotiation band (populated by LLM question generation for salary-neg)
  const negotiationBandRef = useRef<NegotiationBandData | null>(null);
  /* Canonical negotiation kernel: serialized state passed back to the
     server on each turn. Null until the kernel path initialises it
     on first follow-up. */
  const negotiationKernelStateRef = useRef<string | null>(null);
  /* Single source of truth for "is the negotiation done?": derive from
   * the kernel state's phase. Eliminates the prior pattern of latching
   * a separate boolean ref on serverSaysDone, which could drift out of
   * sync with the kernel and re-introduce the PDF#43 symptom (static
   * closing leaks through while kernel is still mid-negotiation). */
  const isNegotiationKernelTerminal = useCallback((): boolean => {
    const raw = negotiationKernelStateRef.current;
    if (!raw) return false;
    try {
      const phase = (JSON.parse(raw) as { phase?: string })?.phase;
      return phase === "accepted" || phase === "walked-away" || phase === "stalemate";
    } catch {
      return false;
    }
  }, []);
  /* Move history accumulator — one entry per AI turn the kernel returns.
     Consumed at session end to compute kernel-aware metrics (anchor
     turn, lever diversity, band traversal, LPA per turn). Kept as a
     ref because metrics derivation runs once, at save time. */
  const kernelMovesRef = useRef<Array<{
    lever: string;
    newTotalLpa: number | null;
    turnIndex: number;
    candidateTargetAtTurn: number | null;
  }>>([]);
  // Candidate's target salary (set via warm-up calibration card)
  const [targetSalary, setTargetSalary] = useState<number | null>(null);
  // Multi-round scenario mode
  const [negotiationScenario, setNegotiationScenario] = useState<string>(() => searchParams.get("scenario") || "standard");
  const negotiationRound = parseInt(searchParams.get("round") || "1", 10);
  // Highest offer the AI has made so far (for monotonic enforcement)
  const highestOfferRef = useRef<number>(0);
  /* Negotiation style: adaptive based on previous session scores, else random.
     See ./_negotiation-state.ts. Picked once per session — kept stable so the
     AI's tone doesn't drift mid-interview. */
  const [negotiationStyle] = useState(() => pickInitialNegotiationStyle(interviewType));
  // Negotiation pushback tracker: counts how many times the candidate has pushed back/rejected
  // Used for tone shifts and strategic pause decisions
  const negPushbackCountRef = useRef(0);
  // Time pressure spoken flag
  const timePressureSpokenRef = useRef(false);
  const lastQuestionSpokenRef = useRef(false);

  const [jdAnalysisData] = useState(() => {
    try {
      const raw = sessionStorage.getItem("hirestepx_jd_analysis");
      if (raw) { sessionStorage.removeItem("hirestepx_jd_analysis"); return JSON.parse(raw); }
    } catch { /* ignore */ }
    return null;
  });

  // Draft restore: clear on new session (new=1 from SessionSetup), restore on refresh/resume
  const draftKey = `hirestepx_interview_draft_${user?.id || "anon"}`;
  const isNewSession = searchParams.get("new") === "1";
  const isResuming = searchParams.get("resume") === "true";
  const draftRef = useRef<InterviewDraft | null>(null);
  if (!draftRef.current) {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        if (isNewSession && !isResuming) {
          // Explicit new session from SessionSetup — clear old draft
          localStorage.removeItem(draftKey);
          deleteFromIDB(draftKey);
        } else {
          // Page refresh or explicit resume — validate via shared helper
          // (TTL check, shape check, interview-type match) — see ./_session-draft.ts.
          const parsed = JSON.parse(raw);
          const valid = validateRestoredDraft(parsed, interviewType);
          if (valid) {
            draftRef.current = valid;
          } else {
            localStorage.removeItem(draftKey);
            deleteFromIDB(draftKey);
          }
        }
      }
    } catch (e) {
      console.warn("[interview] Draft restore failed:", e);
    }
  }

  // Strip &new=1 from URL so a page refresh doesn't re-trigger "new session" draft clear
  useEffect(() => {
    if (isNewSession) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Back-button safety net (QA bug 22 part B):
  //   The browser back button from /session/[id] used to land on
  //   /interview, where the engine silently started a brand-new
  //   session because the draft had already been deleted on
  //   completion. Now: if /interview is entered without an explicit
  //   start intent (?new=1 or ?resume=true) AND no restorable draft
  //   is in localStorage, redirect to /dashboard. Combined with the
  //   router.replace fix in handleEnd, this closes the back-button
  //   "unexpectedly starts a new session" path entirely.
  //
  //   Legitimate entries (all preserved):
  //     - Fresh start from SessionSetup → has ?new=1
  //     - Resume from dashboard → has ?resume=true
  //     - Page refresh mid-session → draftRef.current is populated
  useEffect(() => {
    const hasExplicitIntent = isNewSession || isResuming;
    const hasRestorableDraft = !!draftRef.current;
    if (!hasExplicitIntent && !hasRestorableDraft) {
      console.warn("[interview] Entered /interview with no start intent and no draft — redirecting to /dashboard");
      router.replace("/dashboard");
    }
    // Mount-only — re-running on prop changes would race with normal flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Role × company sector-fit guard for /interview entry points that
     bypass SessionSetup (deep links, dashboard CTAs, draft-resume,
     daily-challenge URLs). The same check lives in SessionSetup.tsx
     for the fresh-start path; this is the safety net. Hard mismatches
     (e.g. "Pilot @ Razorpay") would otherwise cause the LLM to coach
     the candidate against a synthetic, irrelevant salary band. Soft
     mismatches and universal roles pass through silently.
     See src/_role-company-fit.ts + tests/roleCompanyFit.test.ts. */

  useEffect(() => {
    if (interviewType !== "salary-negotiation") return;
    const role = (targetRole || user?.targetRole || "").trim();
    const company = (targetCompany || user?.targetCompany || "").trim();
    if (!role || !company) return;
    const tier = getCompanyTier(company);
    const roleKey = matchSalaryRoleKey(role);
    const fit = detectRoleCompanyFit(roleKey, tier, company);
    if (fit.fit === "hard_mismatch") {
      console.warn("[interview] Hard role/company mismatch on entry — bouncing to /session/new", { role, company, tier, roleKey });
      toast(fit.reason, "error");
      const qp = new URLSearchParams({
        type: "salary-negotiation",
        role,
        company,
        warn: "role-company-mismatch",
      });
      router.replace(`/session/new?${qp.toString()}`);
    }
    // Mount-only: URL params are stable for an engine instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Count the session at START, not at completion. Without this, users
     could enter /interview, abandon halfway, and never have it counted
     against their quota — letting them test-drive sessions for free.
     The endpoint is idempotent on sessionId (handles React StrictMode
     double-mount and any client retry); save-session.ts checks the
     same started_session_ids list to avoid double-bumping on completion.
     Fire-and-forget — the engine never blocks on this. */
  useEffect(() => {
    if (!user?.id) return; // anon sessions don't count
    const sessionId = liveSessionIdRef.current;
    (async () => {
      try {
        const { apiFetch } = await import("./apiClient");
        await apiFetch("/api/record-session-start", { sessionId, type: interviewType });
      } catch (err) {
        console.warn("[interview] record-session-start failed:", err instanceof Error ? err.message : err);
      }
    })();
    // Mount-only: liveSessionIdRef is stable for this engine instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Override user's profile role/company with URL params (SessionSetup passes these)
  const effectiveUser = (targetRole || targetCompany) ? { ...user, ...(targetRole ? { targetRole } : {}), ...(targetCompany ? { targetCompany } : {}) } as typeof user : user;
  const fallbackScript = isMiniMode ? getMiniScript(effectiveUser, targetCompany, interviewType) : getScript(interviewType, interviewDifficulty, effectiveUser);
  const [interviewScript, setInterviewScript] = useState<InterviewStep[]>(
    draftRef.current?.script && draftRef.current.script.length > 0 ? draftRef.current.script : fallbackScript
  );
  const interviewScriptRef = useRef(interviewScript);
  useEffect(() => { interviewScriptRef.current = interviewScript; }, [interviewScript]);
  const [llmLoading, setLlmLoading] = useState(!draftRef.current && !isMiniMode);

  // Interview state — ref updated synchronously to avoid race conditions in follow-up callbacks
  const [currentStep, _setCurrentStep] = useState(draftRef.current?.currentStep || 0);
  const currentStepRef = useRef(draftRef.current?.currentStep || 0);
  const setCurrentStep = useCallback((v: number | ((prev: number) => number)) => {
    _setCurrentStep(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      currentStepRef.current = next;
      return next;
    });
  }, []);

  // Async IndexedDB fallback — try IDB on refresh or explicit resume (skip on new session)
  useEffect(() => {
    if (draftRef.current || (isNewSession && !isResuming)) return;
    let cancelled = false;
    loadFromIDB(draftKey).then(data => {
      if (cancelled) return;
      if (data && typeof data === "object" && "transcript" in data) {
        const d = data as InterviewDraft & { savedAt?: number; currentStep?: number };
        const DRAFT_TTL = 24 * 60 * 60 * 1000;
        if (d.savedAt && Date.now() - d.savedAt > DRAFT_TTL) {
          deleteFromIDB(draftKey);
          return;
        }
        if (!d.currentStep || d.currentStep === 0) return;
        // Reject draft if interview type doesn't match current session
        if ((d as { interviewType?: string }).interviewType && (d as { interviewType?: string }).interviewType !== interviewType) {
          deleteFromIDB(draftKey);
          return;
        }
        draftRef.current = d;
        setCurrentStep(d.currentStep || 0);
        setTranscript(d.transcript || []);
        setElapsed(d.elapsed || 0);
        if (d.script && Array.isArray(d.script) && d.script.length > 0) {
          setInterviewScript(d.script);
        }
      }
    });
    return () => { cancelled = true; };
    // Mount-only draft restore. The other values (draftKey/interviewType/isNewSession/isResuming/setters) are read once to decide whether to hydrate from IDB; re-running on their change would clobber freshly-typed answers with the persisted draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Auto-prebias: kick off a best-effort fetch of the user's most
     recent session_insights flag set on mount. When the LLM
     fetch fires later, it reads from this ref; if the fetch hasn't
     resolved yet (rare — typically completes in <200ms while the user
     is reading the warmup card) the prebias is simply skipped this
     run. Quiet failures: any error empties the ref.

     Phase-6.1 expanded this from HR-round only to behavioral as well.
     Behavioral analyzer emits a similar coverage-miss flag set (weak
     STAR structure, frequent missing Result, metric-without-baseline,
     we-attribution-heavy, no-learning-reflection, …) and the next
     behavioral session can pre-bias toward dimensions the candidate
     consistently under-covered. The focus-filtered fetch ensures we
     read the candidate's last behavioral session even if intervening
     HR/campus sessions exist. */
  const priorFlagsRef = useRef<string[]>([]);
  useEffect(() => {
    const prebiasFocuses = new Set(["hr-round", "behavioral"]);
    if (!prebiasFocuses.has(interviewFocus) || !user?.id) return;
    let cancelled = false;
    getLatestSessionInsightFlags(user.id, interviewFocus).then((flags) => {
      if (cancelled) return;
      priorFlagsRef.current = flags;
    }).catch(() => { /* silent — prebias degrades to no-op */ });
    return () => { cancelled = true; };
  }, [interviewFocus, user?.id]);

  // LLM question generation — extracted so it can be retried
  const llmFetchCancelRef = useRef(false);
  const fetchPersonalizedQuestions = useCallback(() => {
    if (!navigator.onLine) {
      toast("Offline — using practice questions.", "info");
      setLlmLoading(false);
      return;
    }
    llmFetchCancelRef.current = false;
    setLlmLoading(true);
    setSaveWarning("");

    let adaptiveHints: { weakSkills: string[]; pastTopics: string[] } = { weakSkills: [], pastTopics: [] };
    try {
      const cached = localStorage.getItem(`hirestepx_cache_sessions_${user?.id}`);
      if (cached && cached.length < 500_000) {
        const pastSessions = JSON.parse(cached);
        adaptiveHints = getAdaptiveHints(pastSessions, jdAnalysisData?.missingSkills);
      }
    } catch { /* silent */ }

    const aiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as { interviewStrengths?: string[]; interviewGaps?: string[]; topSkills?: string[]; headline?: string; experiences?: Array<{ title?: string; company?: string; period?: string; bullets?: string[] }> } | undefined;
    /* Resume-role contamination guard for salary-negotiation sessions.
       Production bug (2026-05): user with a "Senior Product Designer" resume
       selected "Java Developer" + TCS + salary-neg; the LLM personalised
       the static script around the resume role and opened at a designer-tier
       ₹38L offer. Root cause: resumeText fed into generate-questions leaked
       the resume role into the negotiation script copy. Fix: when the resume
       headline domain-mismatches the session role, scrub resume context for
       this salary-neg fetch only. Behavioral flow still uses resume because
       there the role-role match is unambiguous. */
    const sessionRoleForFetch = targetRole || user?.targetRole || "";
    const resumeHeadlineRole = (aiProfile?.headline || "").split(/\s+with\s+/i)[0]?.trim() || "";
    const resumeRoleMismatch =
      interviewType === "salary-negotiation"
      && !!sessionRoleForFetch
      && !!resumeHeadlineRole
      && detectRoleLabelMismatch(resumeHeadlineRole, sessionRoleForFetch) !== "";
    if (resumeRoleMismatch) {
      console.warn(`[salary-neg] resume role "${resumeHeadlineRole}" mismatches session role "${sessionRoleForFetch}" — scrubbing resume context.`);
      try { toast(`Using market data for ${sessionRoleForFetch} — your resume role differs.`, "info"); } catch { /* silent */ }
    }
    const effectiveUseResume = shouldUseResume && !resumeRoleMismatch;
    const llmPromise = fetchLLMQuestions({
      type: interviewType,
      focus: interviewFocus,
      difficulty: interviewDifficulty,
      role: targetRole || user?.targetRole || "the role",
      company: targetCompany || user?.targetCompany,
      currentCity: currentCity,
      jobCity: jobCity,
      industry: user?.industry,
      resumeText: effectiveUseResume ? user?.resumeText : undefined,
      pastTopics: adaptiveHints.pastTopics.length > 0 ? adaptiveHints.pastTopics : undefined,
      weakSkills: adaptiveHints.weakSkills.length > 0 ? adaptiveHints.weakSkills : undefined,
      jobDescription: jobDescription || undefined,
      experienceLevel: user?.experienceLevel || undefined,
      mini: isMiniMode || undefined,
      resumeStrengths: effectiveUseResume ? aiProfile?.interviewStrengths : undefined,
      resumeGaps: effectiveUseResume ? aiProfile?.interviewGaps : undefined,
      resumeTopSkills: effectiveUseResume ? aiProfile?.topSkills : undefined,
      resumeExperiences: effectiveUseResume ? aiProfile?.experiences : undefined,
      candidateName: user?.name || undefined,
      negotiationStyle: negotiationStyle || undefined,
      drill: drillKey || undefined,
      priorFlags: priorFlagsRef.current.length > 0 ? priorFlagsRef.current : undefined,
    });
    const timeoutMs = isMiniMode ? 12_000 : 30_000;
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Question generation timed out")), timeoutMs);
    });
    Promise.race([llmPromise, timeoutPromise]).then(result => {
      if (llmFetchCancelRef.current) return;
      const questions = result?.questions ?? null;
      // Store negotiation band for follow-up API calls (validate shape to prevent malformed data)
      if (result?.negotiationBand && typeof result.negotiationBand.initialOffer === "number" && typeof result.negotiationBand.maxStretch === "number") {
        negotiationBandRef.current = result.negotiationBand;
      }
      /* Surface provenance to the UI. Only `"static"` and `"cached"`
         are user-visible; any other server hint is ignored so the
         chip doesn't flash on transient strings. */
      const fb = result?._fallback;
      if (fb === "static" || fb === "cached") {
        setQuestionFallbackSource(fb);
      } else {
        setQuestionFallbackSource(null);
      }
      const step = currentStepRef.current;
      if (questions && questions.length > 0 && step === 0) {
        // Step 0 (intro) is already speaking — keep current intro, replace only steps 1+
        // This prevents the jarring mid-sentence cut when LLM questions arrive
        console.warn(`[interview] LLM generated ${questions.length} custom questions (merging from step 1, preserving intro)`);
        setInterviewScript(prev => [prev[0], ...questions.slice(1)]);
        setSaveWarning("");
      } else if (questions && questions.length > 0 && step === 1) {
        // User already moved past intro — safe to replace entire script
        console.warn(`[interview] LLM generated ${questions.length} custom questions (replacing at step ${step})`);
        setInterviewScript(prev => [prev[0], ...questions.slice(1)]);
        setSaveWarning("");
      } else if (questions && questions.length > 0 && step >= 2) {
        // Late arrival: merge remaining LLM questions into the script from the current position onward
        // This replaces the upcoming fallback questions while preserving already-answered ones
        console.warn(`[interview] LLM questions arrived late (step ${step}) — merging remaining questions`);
        setInterviewScript(prev => {
          // Keep everything up to and including the current step from the old script
          const keepPrefix = prev.slice(0, step + 1);
          // Count how many questions the user has already answered (excluding intro)
          const answeredCount = prev.slice(0, step + 1).filter((s: { type: string }) => s.type === "question" || s.type === "follow-up").length;
          // Take remaining LLM questions — skip intro and already-answered count of question steps
          let skipped = 0;
          const llmFutureSteps = questions.filter((q: { type: string }) => {
            if (q.type === "intro") return false;
            if (q.type === "question" || q.type === "follow-up") {
              skipped++;
              return skipped > answeredCount; // Only take questions after the ones already answered
            }
            return q.type === "closing"; // Always include closing
          });
          if (llmFutureSteps.length === 0) return prev; // Nothing useful to merge
          return [...keepPrefix, ...llmFutureSteps];
        });
        setSaveWarning("");
      } else if (!questions) {
        console.warn("[interview] LLM returned null — using fallback questions");
        setSaveWarning("Using practice questions. Tap retry for personalized ones.");
        /* Hard fallback (LLM null) is functionally identical to the
           server's static-bank path, so chip behavior should match. */
        setQuestionFallbackSource("static");
        if (!isMiniMode) toast("Using practice questions — tap retry for personalized ones.", "info");
      }
      // Persist questions to DB in real-time (best-effort, non-blocking)
      if (questions && questions.length > 0 && user?.id) {
        const qList = questions.map((q: { type: string; aiText: string; persona?: string }) => ({ type: q.type, aiText: q.aiText, persona: q.persona }));
        turnIndexRef.current = qList.length + 1; // session_start(0) + N questions
        initLiveSession({
          sessionId: liveSessionIdRef.current,
          userId: user.id,
          type: interviewType,
          difficulty: interviewDifficulty,
          focus: interviewFocus,
          role: targetRole || user.targetRole || "",
          company: targetCompany || user.targetCompany || "",
          questions: qList,
        }).catch(() => {});
      }
      setLlmLoading(false);
    }).catch(err => {
      if (llmFetchCancelRef.current) return;
      const msg = err.message || "Could not generate questions.";
      console.warn("[interview] LLM question generation error:", msg);
      setSaveWarning(`${msg} Tap retry for personalized questions.`);
      if (!isMiniMode) toast(`Using practice questions — ${msg.toLowerCase()}`, "info");
      setLlmLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewType, interviewFocus, interviewDifficulty, isMiniMode]);

  // Retry LLM question generation (exposed to UI)
  const retryQuestions = useCallback(() => {
    if (currentStepRef.current > 0) {
      toast("Can't change questions after you've started answering.", "info");
      return;
    }
    fetchPersonalizedQuestions();
  }, [fetchPersonalizedQuestions, toast]);

  // Fetch on mount
  useEffect(() => {
    fetchPersonalizedQuestions();
    return () => { llmFetchCancelRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speech recognition
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const deepgramRef = useRef<DeepgramSTTHandle | null>(null);
  const sarvamRef = useRef<SarvamSTTHandle | null>(null);
  // Restored from draft on resume so an in-progress answer (typed but not yet
  // submitted) survives a tab close / network blip / refresh.
  const [currentTranscript, setCurrentTranscript] = useState<string>(() => {
    const draft = draftRef.current as InterviewDraft & { currentTranscript?: string } | null;
    return typeof draft?.currentTranscript === "string" ? draft.currentTranscript : "";
  });
  const [phase, setPhase] = useState<"thinking" | "speaking" | "listening" | "done">("thinking");
  const [isRecording, setIsRecording] = useState(false);

  /** Manual-start gate. Defined here (early) because both the STT hook
   *  and the answer-timer need to read it. See the longer comment near
   *  `restartListening` below for rationale. */
  const [awaitingSpeechStart, setAwaitingSpeechStart] = useState(true);
  useEffect(() => { setAwaitingSpeechStart(true); }, [currentStep]);

  // Timers: elapsed clock, answer timer with auto-advance, tab visibility
  // Pass a "frozen" phase to the timer when we're awaiting the user's
  // manual speech-start tap so the per-question countdown doesn't burn
  // seconds before they realise it's their turn.
  const {
    elapsed, setElapsed, answerTimer, timeRemaining, timePercent,
    handleNextRef,
  } = useInterviewTimers(awaitingSpeechStart ? "speaking" : phase, currentStep, draftRef.current?.elapsed || 0, toast, interviewType === "salary-negotiation");

  // TTS-caption sync: actual audio duration (from TTS provider) and speech-ended flag
  const [ttsDurationMs, setTtsDurationMs] = useState<number | undefined>(undefined);
  const [speechEnded, setSpeechEnded] = useState(false);
  const [speechUnavailable, setSpeechUnavailable] = useState(searchParams.get("nomic") === "1");

  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Transcript history
  const [transcript, setTranscript] = useState<{ speaker: "ai" | "user"; text: string; time: string }[]>(draftRef.current?.transcript || []);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // End interview modal
  const [showEndModal, setShowEndModal] = useState(false);
  const endModalTriggerRef = useRef<HTMLSpanElement>(null);

  // Audio unlock — see ./_audio-unlock.ts for the why.
  useForceAudioUnlockOnMount();

  // Multi-tab guard
  const [tabConflict, setTabConflict] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("hirestepx_interview");
    ch.postMessage({ type: "claim" });
    ch.onmessage = (e) => {
      if (e.data?.type === "claim") {
        setTabConflict(true);
      }
    };
    return () => ch.close();
  }, []);

  // Click-recovery for autoplay blocks — see ./_audio-unlock.ts.
  useClickRecoverAutoplay(toast);

  // Prevent accidental navigation/close during active interview
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!interviewEndedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Offline + save status + mic error
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [saveWarning, setSaveWarning] = useState("");
  /* Provenance hint for the active question script. `"static"` means
   * the LLM path failed and we shipped the static bank from
   * `data/interview-question-bank.ts`; `"cached"` means a 300s Upstash
   * hit; `null` means a fresh LLM response (or the engine never
   * received a hint). Drives the subtle "Practice mode" chip in
   * InterviewPanels — candidates deserve to know when they're
   * answering canned questions rather than fresh AI ones. */
  const [questionFallbackSource, setQuestionFallbackSource] =
    useState<"static" | "cached" | null>(null);
  // Mirror saveWarning to a ref so the recovery hook can read it
  // at fire-time without re-binding window listeners on each change.
  const saveWarningRef = useRef("");
  useEffect(() => { saveWarningRef.current = saveWarning; }, [saveWarning]);
  const [micError, setMicError] = useState("");
  /* ttsError — surfaces "audio temporarily unavailable" when TTS fails.
   * Auto-clears 6s after the last failure so a transient blip doesn't leave
   * a sticky notice. The visual question is always on screen so the user can
   * keep going; the toast just explains *why* there's no voice. */
  const [ttsError, setTtsError] = useState("");
  const ttsErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flagTtsError = useCallback((message: string) => {
    setTtsError(message);
    if (ttsErrorTimerRef.current) clearTimeout(ttsErrorTimerRef.current);
    ttsErrorTimerRef.current = setTimeout(() => setTtsError(""), 6000);
  }, []);
  const [usedFallbackScore, setUsedFallbackScore] = useState(false);
  const [evalTimedOut, setEvalTimedOut] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  /* ── micQuiet — surfaces when STT keeps reporting "no speech detected".
     Drives the inline "Having trouble hearing you" banner so users get a
     friendly nudge instead of waiting through a silent dead-end. */
  const [micQuiet, setMicQuiet] = useState(false);
  /* ── reconnecting — full-screen recovery state used when network drops
     mid-session. Fired from the offline detector below. Auto-clears when
     navigator.onLine flips back. */
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttemptRef = useRef(1);
  const noSpeechCountRef = useRef(0);
  /* Silence-nudge refs are owned by useListeningInterjections — see
     ./_listening-interjections.ts. */
  /* Conversational continuity — accumulates noun-phrase mentions
     across answers and pipes them to the follow-up LLM as
     `previousMentions`. See src/_noun-phrase-memory.ts. */
  const mentionsMemoryRef = useRef<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalElapsed, setEvalElapsed] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const interviewerName = useMemo(() => getInterviewerName(`${interviewType}-${interviewFocus}-${targetCompany}-${user?.id || ""}`), [interviewType, interviewFocus, targetCompany, user?.id]);
  const interviewerGender = useMemo(() => getInterviewerGender(interviewerName), [interviewerName]);

  /* ─── Personalised intro for behavioural sessions ───
     The static behavioural script opens with anonymous "I'm your AI
     interviewer today" — fine for an MVP, terrible for "this feels
     real." Override the intro step's spoken text once per session with
     a named greeting + a rapport hook. Skipped if:
       • the candidate is resuming a draft (currentStep > 0) — don't
         re-introduce yourself mid-session
       • the interview isn't behavioural (other types have their own
         intro voice; salary-neg has a different conversational opener)
       • intro slot already has a non-default opener (e.g. resume flow
         pre-populated something different — don't trample it)
     The personalisation is one-shot — guarded by personalizedIntroRef
     so we don't churn the script on every name re-derivation. */
  const personalizedIntroRef = useRef(false);
  useEffect(() => {
    if (personalizedIntroRef.current) return;
    if (interviewType !== "behavioral") return;
    if ((draftRef.current?.currentStep ?? 0) > 0) return;
    /* Resume-grounded rapport: pull first 1-2 projects from the AI-
       parsed resume so the intro can reference what the candidate
       actually worked on. Falls through to the generic intro when the
       resume isn't present (resumeless practice flow). */
    const introAiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as {
      experiences?: Array<{ topProjects?: string[] }>;
    } | undefined;
    const introTopProjects = (introAiProfile?.experiences || [])
      .flatMap(e => Array.isArray(e?.topProjects) ? e.topProjects : [])
      .filter(p => typeof p === "string" && p.trim().length > 0)
      .slice(0, 2);
    const intro = buildBehavioralIntro({
      interviewerName,
      candidateName: user?.name || undefined,
      role: targetRole || user?.targetRole || undefined,
      company: targetCompany || user?.targetCompany || undefined,
      topProjects: introTopProjects.length ? introTopProjects : undefined,
    });
    personalizedIntroRef.current = true;
    setInterviewScript(prev => {
      if (!prev[0] || prev[0].type !== "intro") return prev;
      // Bump speakingDuration slightly — the new intro is ~3 sentences
      // (greeting + self-intro + rapport hook), needs a touch more TTS
      // time than the original one-liner.
      return [
        { ...prev[0], aiText: intro, aiTextDisplay: intro, speakingDuration: Math.max(prev[0].speakingDuration, 7500) },
        ...prev.slice(1),
      ];
    });
  }, [interviewType, interviewerName, user?.name, user?.targetRole, user?.targetCompany, user?.resumeData, targetRole, targetCompany]);

  // Panel interview: 3 members with gender-matched voices
  const isPanelInterview = interviewType === "panel";

  /* ─── Skip-question budget ───
     Per the product policy: skips are real but cost something (the
     question scores 0 with verdict "skipped"). Budget by interview
     type — warmup unlimited (just practice), behavioral/standard 1,
     panel 2 (longer session), salary negotiation 0 (every turn is
     a real move). The button disables once exhausted. */
  const skipBudget = useMemo<number>(() => {
    if (isMiniMode) return 99; // warmup → effectively unlimited
    if (interviewType === "salary-negotiation") return 0;
    if (interviewType === "panel") return 2;
    return 1; // behavioral / technical / case-study / strategic / etc.
  }, [interviewType, isMiniMode]);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const canSkip = skipsUsed < skipBudget && skipBudget > 0;
  const panelMembers = useMemo(() =>
    isPanelInterview ? getPanelMembers(`${interviewType}-${interviewFocus}-${targetCompany}-${user?.id || ""}`) : null,
    [isPanelInterview, interviewType, interviewFocus, targetCompany, user?.id]
  );

  // Resolve Cartesia voices for panel members (male/female)
  const panelVoicesRef = useRef<Record<string, string>>({});
  const panelVoicesReadyRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!isPanelInterview || !panelMembers) return;
    let cancelled = false;
    panelVoicesRef.current = {};
    const voicePromise = fetchCartesiaVoices("en_IN").then(voices => {
      if (cancelled) return;
      const maleVoices = voices.filter(v => v.gender === "male");
      const femaleVoices = voices.filter(v => v.gender === "female");
      if (maleVoices.length === 0 && femaleVoices.length === 0) {
        toast("Using default voice for all panelists — voice library unavailable.", "info");
        return;
      }
      const voiceMap: Record<string, string> = {};
      let maleIdx = 0, femaleIdx = 0;
      for (const member of panelMembers) {
        const pool = member.gender === "male" ? maleVoices : femaleVoices;
        const fallbackPool = pool.length > 0 ? pool : (maleVoices.length > 0 ? maleVoices : femaleVoices);
        const idxRef = member.gender === "male" ? maleIdx : femaleIdx;
        if (fallbackPool.length > 0) {
          voiceMap[member.title] = fallbackPool[idxRef % fallbackPool.length].id;
          if (member.gender === "male") maleIdx++; else femaleIdx++;
        }
      }
      panelVoicesRef.current = voiceMap;
    }).catch(() => {
      if (!cancelled) toast("Using default voice for all panelists.", "info");
    });
    panelVoicesReadyRef.current = voicePromise;
    return () => { cancelled = true; panelVoicesRef.current = {}; };
  }, [isPanelInterview, panelMembers, toast]);

  const [microFeedback, setMicroFeedback] = useState<string | null>(null);

  // Eval elapsed timer
  useEffect(() => {
    if (!evaluating) { setEvalElapsed(0); return; }
    const t = setInterval(() => setEvalElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [evaluating]);

  // AI Voice (Text-to-Speech). Refs declared early so the recovery
  // hook below can read interviewEndedRef without a forward reference.
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [showCaptions, setShowCaptions] = useState(false);
  const ttsCancelRef = useRef<(() => void) | null>(null);
  const ttsInstanceIdRef = useRef(0);
  const interviewEndedRef = useRef(false);

  // Online/offline recovery — see ./_recovery.ts for the debounce reasoning.
  useOnlineOfflineRecovery({
    setIsOffline,
    setReconnecting,
    reconnectAttemptRef,
    currentStepRef,
    interviewEndedRef,
    retryQueuedEvals,
    fetchPersonalizedQuestions,
    saveWarningRef,
  });

  // Cleanup TTS/WebSocket on tab close
  useEffect(() => {
    const handleUnload = () => {
      cleanupTTS();
      ttsCancelRef.current?.();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // Auto-save draft (clear draft when interview completes to prevent stale restore)
  useEffect(() => {
    if (phase === "done" || evaluating) {
      // Interview completed — clear draft so next session starts fresh
      try { localStorage.removeItem(draftKey); } catch { /* non-critical */ }
      deleteFromIDB(draftKey);
      return;
    }
    const saveDraft = () => {
      // Snapshot shape lives in src/_session-draft.ts (testable + reusable).
      const draftData = buildDraftSnapshot({
        transcript, currentTranscript,
        currentStep, elapsed,
        interviewType, interviewDifficulty, interviewFocus,
        targetRole, targetCompany,
        script: interviewScript,
      });
      try { localStorage.setItem(draftKey, JSON.stringify(draftData)); } catch { /* expected: localStorage may be unavailable */ }
      saveToIDB(draftKey, draftData);
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      saveDraft();
      // Fire-and-forget abandonment analytics (use sendBeacon since page is unloading)
      try {
        const completionRate = totalQuestions > 0 ? currentStep / totalQuestions : 0;
        const body = JSON.stringify({
          event: "session_abandoned",
          type: interviewType,
          difficulty: interviewDifficulty,
          currentStep,
          totalQuestions,
          completionRate: Math.round(completionRate * 100) / 100,
          duration: elapsed,
        });
        navigator.sendBeacon?.("/api/log-error", body);
      } catch { /* noop */ }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    /* Immediate seed-save on mount so a fast refresh (within the first
       15s of the autosave interval) still has a draft to restore. Without
       this, a user who refreshes 3 seconds in lands on the dashboard
       because hasRestorableDraft is false. */
    saveDraft();
    const autoSaveInterval = setInterval(saveDraft, 15_000);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(autoSaveInterval);
    };
    // The draft-save fires every 15s and on unload; it reads draftKey/interviewScript/targetCompany/targetRole/totalQuestions latest-values inside the snapshot closure. Adding them as deps would re-bind the beforeunload listener on every keystroke (transcript/currentTranscript change) and was explicitly avoided.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, evaluating, transcript, currentTranscript, currentStep, elapsed, interviewType, interviewDifficulty, interviewFocus]);

  // Cancel speech + recognition on unmount or when voice toggled
  useEffect(() => {
    return () => {
      // We deliberately read the latest ref.current at cleanup time — capturing now would abort an already-replaced STT instance and leak the new one. Refs here point to STT clients, not React-rendered DOM nodes.
      ttsCancelRef.current?.();
      recognitionRef.current?.stop();
      /* eslint-disable react-hooks/exhaustive-deps */
      deepgramRef.current?.abort();
      sarvamRef.current?.abort();
      /* eslint-enable react-hooks/exhaustive-deps */
    };
  }, [aiVoiceEnabled]);

  /* Mid-answer interrupt support: when the AI talks OVER the candidate
     (rambling cut-off at 90s), this ref turns on for the duration of
     the AI's speech. The wrapped STT setter below discards transcript
     updates while it's on so the AI's own voice — captured back through
     the speaker→mic loop — doesn't get attributed to the candidate's
     answer. The ref lives in the engine (not the listening-interjections
     hook) because it needs to be readable by both the STT setter
     wrapper here and the rambling effect that toggles it. */
  const bargeInActiveRef = useRef(false);
  const setCurrentTranscriptGuarded = useCallback((value: React.SetStateAction<string>) => {
    if (bargeInActiveRef.current) return;
    setCurrentTranscript(value);
  }, []);

  /* Reset the barge-in flag whenever the phase changes. Some
     listening-interjection paths set `bargeInActiveRef.current = true`
     to silence STT writes during a planned interjection but didn't
     always reset on exit — leaving the ref stuck-true would silently
     suppress STT for the rest of the session. Phase transitions are
     the natural reset boundary. */
  useEffect(() => {
    bargeInActiveRef.current = false;
  }, [phase]);

  // Explicit user-triggered STT restart counter. Bumped by Space-to-
  // start-speaking and the "Tap to start" button in the listening UI.
  // Gives users an actionable recovery when auto-start fails silently.
  const [sttRestartTrigger, setSttRestartTrigger] = useState(0);

  /* Manual-start gate state is declared earlier (just after `phase`) so
     the timer + STT hooks can read it. Rationale lives there. */

  /** Per-turn STT confidence snapshot from useInterviewSTT.
   *  Set when the STT pipeline fires onLowSttConfidence; cleared on
   *  every step change. handleNextQuestion reads this to decide whether
   *  to warn the user before submitting potentially-misheard text. */
  const sttLowConfidenceRef = useRef<{ mean: number; min: number; lowFraction: number } | null>(null);
  /** Timestamp of the last "we may have misheard you" prompt so we don't
   *  repeat-block the same submission. Two-tap pattern. */
  const lastLowConfidencePromptRef = useRef<number>(0);
  useEffect(() => { sttLowConfidenceRef.current = null; lastLowConfidencePromptRef.current = 0; }, [currentStep]);
  const restartListening = useCallback(() => {
    if (phase !== "listening") return;
    setCurrentTranscript("");
    setSttRestartTrigger((n) => n + 1);
    setAwaitingSpeechStart(false);
    toast("Listening — speak when ready", "info");
  }, [phase, toast]);

  // STT fallback chain: Deepgram → Sarvam → Web Speech API + mic stream capture
  // STT is gated behind awaitingSpeechStart — we pretend phase isn't yet
  // "listening" so the hook doesn't auto-start until the user clicks the
  // "Start speaking" button.
  useInterviewSTT(awaitingSpeechStart ? "speaking" : phase, isMuted, speechUnavailable, {
    setCurrentTranscript: setCurrentTranscriptGuarded, setMicError, setSpeechUnavailable, setShowCaptions,
    toast, textareaRef, interviewEndedRef,
    onLowSttConfidence: (snapshot) => { sttLowConfidenceRef.current = snapshot; },
  }, {
    recognitionRef, deepgramRef, sarvamRef, noSpeechCountRef, micStreamRef,
  }, sttRestartTrigger);

  /* ── micQuiet poll ───────────────────────────────────────────────
     Lift the noSpeechCountRef into React state so the inline
     "Having trouble hearing you" banner can render. Poll every 1s
     while listening (cheap — ref read is O(1)) and reset when phase
     changes off listening or user starts speaking. */
  useEffect(() => {
    if (phase !== "listening") { setMicQuiet(false); return; }
    const id = setInterval(() => {
      const c = noSpeechCountRef.current;
      // ≥2 no-speech errors → "trouble hearing"; STT itself bails to
      // text-fallback at 3, so this is the warning *before* that fallback.
      setMicQuiet(c >= 2);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  /* ── replayQuestion ──────────────────────────────────────────────
     Re-speak the current AI turn. Wired to the RepeatButton in the
     stage. Mirrors the voice-command "repeat" path (the engine
     already supports "say that again" via STT pattern matching at
     line ~1322), but exposed as a click action too. */
  const replayQuestion = useCallback(() => {
    if (!aiVoiceEnabled) return;
    const stepObj = interviewScriptRef.current[currentStepRef.current];
    if (!stepObj?.aiText) return;
    /* Multi-click guard. User report: "Clicking the repeat button
       multiple times together, multiple AI voices are talking
       together." Without cancellation, every click started a fresh
       TTS handle and the previous handles kept streaming, so 3 rapid
       clicks meant 3 overlapping voices.
       Hard-mute first to yank already-buffered Cartesia PCM / Azure
       audio in the same frame (cancel() alone is too lazy on those
       providers); then call the prior handle's cancel() to release
       the WebSocket; then start a new handle and store its cancel
       in ttsCancelRef so the next click (or any other code path —
       skipSpeaking, step transitions, end-interview) preempts it. */
    hardMuteTTS();
    ttsCancelRef.current?.();
    ttsCancelRef.current = null;
    const instanceId = ++ttsInstanceIdRef.current;
    speak(stepObj.aiText, () => {}, () => {}, interviewerGender).then((handle) => {
      if (ttsInstanceIdRef.current === instanceId) {
        ttsCancelRef.current = handle.cancel;
      } else {
        // A newer click already preempted us — cancel this handle so
        // its audio doesn't leak in.
        handle.cancel();
      }
    }).catch((err) => {
      // TTS failed — log so the failure isn't invisible to ops/PostHog,
      // and surface a brief notice so the candidate isn't left wondering
      // why the interviewer is silent. The visual question is still on
      // screen so the session can continue.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[interview] TTS handle.start failed:", msg.slice(0, 120));
      track("tts_failed", { phase: "preview", error: msg.slice(0, 200) });
      flagTtsError("Audio temporarily unavailable — read the question above.");
    });
  }, [aiVoiceEnabled, interviewerGender, flagTtsError]);

  /* Listening-phase interjections (silence nudge, hard-cap stall,
     rambling cut-off, soft tracking) — see ./_listening-interjections.ts.
     Returns the firing refs that the backchannel hook needs to coordinate
     with, plus a reset for the silence-nudge guard. */
  const {
    resetSilenceNudge,
    ramblingFiredRef,
    softTrackFiredRef,
  } = useListeningInterjections({
    phase, aiVoiceEnabled, currentStep, currentTranscript, elapsed,
    interviewerGender, interviewEndedRef, textareaRef, handleNextRef,
    setTranscript, speak, toast, formatTime,
    bargeInActiveRef,
  });

  /* Real-time backchannels — see ./_backchannels.ts. Default OFF
     behind localStorage flag "hsx-backchannels". Only fires once per
     question, after 30s + 40 words + 1.5s stillness, and only if
     neither rambling nor softTracking has fired. */
  useBackchannels({
    phase,
    aiVoiceEnabled,
    currentStep,
    currentTranscript,
    speak: (text) => speak(text, () => {}, () => {}, interviewerGender),
    pickLine: () => pickRandom(REACTIONS.backchannels),
    ramblingFiredRef,
    softTrackFiredRef,
  });

  const step = interviewScript[currentStep] ?? (interviewScript.length > 0 ? interviewScript[interviewScript.length - 1] : null);
  const rawPersona = step?.persona || (panelMembers ? panelMembers[0].title : "");
  const activePersona = normalizePersona(rawPersona);
  const activeInterviewerName = isPanelInterview && panelMembers
    ? (panelMembers.find(m => m.title === activePersona)?.name || interviewerName)
    : (step?.persona || interviewerName);
  const totalQuestions = useMemo(() => interviewScript.filter(s => s.type === "question" || s.type === "follow-up").length, [interviewScript]);
  const baseQuestionCount = useMemo(() => interviewScript.filter(s => s.type === "question").length, [interviewScript]);
  /* currentQuestionNum is the BASE-question position (1..baseQuestionCount).
     A follow-up keeps the same number as its parent question — so a user
     mid-followup-on-Q3 sees "Question 3 of 5", not "Question 4 of 5".
     This also caps at baseQuestionCount so a back-button re-entry that
     restored a high currentStep can't overflow to "Question 10 of 5"
     (QA bug 33). The follow-up indicator is conveyed separately via
     isCurrentFollowUp, so display layers can render "Q3 · follow-up". */
  const currentQuestionNum = useMemo(() => {
    if (interviewScript.length === 0 || baseQuestionCount === 0) return 0;
    const baseSoFar = interviewScript.slice(0, currentStep + 1).filter(s => s.type === "question").length;
    return Math.min(Math.max(0, baseSoFar), baseQuestionCount);
  }, [interviewScript, currentStep, baseQuestionCount]);
  const isCurrentFollowUp = step?.type === "follow-up";

  // Interview flow: thinking -> speaking (with TTS) -> listening
  const flowGenerationRef = useRef(0);
  const pendingFollowUpRef = useRef<Promise<{ needsFollowUp: boolean; followUpText: string; followUpType?: string; conversationDone?: boolean; moveTag?: import("./MoveTag").MoveTag } | null> | null>(null);
  /** Originating step index for the in-flight follow-up. When the
   *  follow-up resolves we verify the engine has advanced exactly one
   *  step from this — otherwise the user already moved past the question
   *  the follow-up was generated for, and applying it now would inject
   *  Q3's answer-shaped reply into Q5's slot (the cross-question
   *  conflation that produced bug #6).
   *
   *  Race-mitigation model (two layers, neither alone is sufficient):
   *    1. pendingFollowUpStepRef tags the originating step when the
   *       async fires (line ~1863) and is checked on resolution (~1281).
   *       Stale results — where the user rapidly advanced — are dropped
   *       with a console warning, never applied.
   *    2. followUpInsertCountRef (below) is a monotonic counter,
   *       incremented inside the setInterviewScript reducer (~1477)
   *       which makes it atomic w.r.t. React's batched updates. Two
   *       simultaneously-resolving follow-ups can never both pass the
   *       cap because the second sees the first's bump. */
  const pendingFollowUpStepRef = useRef<number>(-1);
  const followUpDepthRef = useRef(0);
  /** Atomic follow-up insertion counter — incremented inside the
   *  setInterviewScript reducer so React batching makes it race-free
   *  even if two follow-ups resolve in the same tick. See the
   *  race-mitigation model on pendingFollowUpStepRef. */
  const followUpInsertCountRef = useRef(0);
  // Dynamic difficulty: track answer quality mid-interview for escalation/de-escalation
  const answerQualityRef = useRef<number[]>([]);
  // Track last few inline micro-feedback strings to avoid showing the same tip twice in a row.
  const recentFeedbacksRef = useRef<string[]>([]);
  // Set by handleSkipQuestion, consumed by the next thinking-phrase build so
  // the AI says "Noted — moving on" instead of reacting to a non-answer.
  const skipPendingAckRef = useRef(false);
  /* ─── Behavioural interview state ───
     Tracks STAR-component completeness per question so the engine can
     decide whether to inject a *component-targeted* follow-up (depth -1)
     versus the generic depth 0/1/2 ladder. Mirrors the negotiationFacts
     ref shape salary-negotiation uses — behavioural is now a first-class
     branch, not a default-fallthrough. Only meaningful when
     interviewType === "behavioral"; other types leave it empty. */
  const behavioralStateRef = useRef<{
    /** Most recent STAR detection per question step index. */
    starPerStep: Map<number, { situation: boolean; task: boolean; action: boolean; result: boolean; count: number; hasMetrics: boolean; weHeavy: boolean }>;
    /** Per-question count of component-gap follow-ups already injected.
        Caps at 1 per question — we coach the gap once, then move on. */
    gapFollowUpsPerStep: Map<number, number>;
  }>({ starPerStep: new Map(), gapFollowUpsPerStep: new Map() });

  /* Reset behavioural state whenever the session key changes
     (interviewType / focus / sessionId). Without this, a user who runs
     multiple sessions in the same tab inherits stale per-question budget
     counters from the previous run — the second interview's Q2 could
     refuse a gap follow-up because the first interview's Q2 already
     "used its one". Refs survive renders but should NOT survive a logical
     session boundary. */
  useEffect(() => {
    behavioralStateRef.current.starPerStep.clear();
    behavioralStateRef.current.gapFollowUpsPerStep.clear();
  }, [interviewType, interviewFocus, liveSessionIdRef.current]);
  // Mid-session coaching: track which phases already showed a hint (avoid repeats)
  const negCoachingShownRef = useRef<Set<string>>(new Set());
  // Last answer quality for contextual reactions
  const lastAnswerQualityRef = useRef<"strong" | "decent" | "weak" | "short">("decent");
  const lastAnswerTextRef = useRef("");
  const introStartedRef = useRef<string | false>(false);
  const lastEffectStepRef = useRef(-1);

  useEffect(() => {
    if (phase === "done") return;

    const step = interviewScript[currentStep];
    if (!step) return;

    /* PDF#46 (2026-05-26) — pendingKernel hold.
     *
     * A structural placeholder slot (pre-inserted before each
     * salary-neg AI turn so the engine has somewhere to land while
     * the async kernel call resolves) carries `pendingKernel: true`
     * and NO user-facing text. The engine MUST NOT advance past
     * `thinking` while the slot is pending — that would fire TTS
     * on an empty string and append an empty AI bubble to the
     * transcript, both of which are worse than the previous
     * fake-question failure mode. We hold in `thinking`; when the
     * kernel-resolve path replaces this slot with a followUpStep
     * (no pendingKernel flag), the effect's step-identity dep flips
     * and the effect re-fires through the normal speaking path.
     *
     * The dep array on this effect now includes `step.pendingKernel`
     * (see the bottom of the effect) so the re-fire actually
     * happens; without the dep, an interviewScript-slot replacement
     * at the same currentStep with the same length doesn't trigger
     * any of the existing deps. */
    if (step.pendingKernel) {
      // Cancel any in-flight TTS from a previous (non-pending) step
      // — important when this slot was inserted mid-turn while the
      // engine was finishing the prior turn's speech.
      ttsCancelRef.current?.();
      ttsCancelRef.current = null;
      setPhase("thinking");
      return;
    }

    /* Runtime closing-step sanitizer for salary-negotiation.
       The LLM occasionally fabricates a final ₹ figure in the closing
       step that's BELOW the highest offer it actually made earlier in
       the conversation (user reported: initial offer ₹16 LPA →
       closing announced "agreed on ₹15.5 LPA total CTC"). The static
       sanitizer in interviewAPI.ts catches LLM-time hallucinations,
       but we also defend at runtime in case the script was mutated
       (e.g. by follow-up replacement paths that build closing text
       from band data). Strategy: if the closing step contains a ₹
       figure that's lower than highestOfferRef, replace with a safe
       template that doesn't commit to a specific number and instead
       defers to HR. The actual final number is communicated in the
       written offer, not the live closing line. */
    /* Backstop for any code path that lands on the static closing while
     * the kernel is still mid-negotiation (skip, hangup, etc bypassing
     * handleNextQuestion's placeholder pre-insertion). Force waitForUser
     * so the engine pauses instead of silently auto-ending. Derived from
     * kernel state — no shadow boolean to keep in sync.
     *
     * Skip the backstop when the closing slot was explicitly authored
     * by the kernel-terminal rewrite path (line ~1605). That path sets
     * waitForUser:false intentionally because the kernel text IS the
     * wrap-up, and the server may have signaled conversationDone via a
     * regex pattern the kernel doesn't share (e.g. "pull out", "have to
     * pass") — in which case phase wouldn't be terminal here. The
     * scoreNote sentinel is the contract between the two code paths. */
    if (
      interviewType === "salary-negotiation"
      && step.type === "closing"
      && step.waitForUser === false
      && !step.scoreNote?.startsWith("Negotiation kernel terminal")
      && !isNegotiationKernelTerminal()
    ) {
      step.waitForUser = true;
    }

    if (
      interviewType === "salary-negotiation"
      && step.type === "closing"
      && typeof step.aiText === "string"
    ) {
      const offerNumMatch = step.aiText.match(/₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore|Cr)/);
      const announcedNum = offerNumMatch ? parseFloat(offerNumMatch[1]) : null;
      const highest = highestOfferRef.current;
      const announcedBelowHighest = announcedNum !== null && highest > 0 && announcedNum < highest;
      const hasAnyNumber = announcedNum !== null;
      // ALSO catch the LLM literally writing "₹X" / "₹Y" / "₹TBD" /
      // "[amount]" placeholders into the closing line — user reported
      // a closing step reading "joining bonus of ₹X" verbatim.
      const hasPlaceholder = /₹\s*[XYZ\u2026]\b|\bTBD\b|\[amount\]|\[number\]/i.test(step.aiText);
      // Detect whether notice period was already discussed in the candidate's
      // turns. Without this check, the closing step asks "What's your notice
      // period situation?" even after the candidate already said "30 days" /
      // "two months" earlier — a clear "did you even listen?" signal that
      // breaks immersion. Match common Indian phrasings.
      const noticeDiscussedRe = /\b(\d{1,3}\s*(?:day|month)s?|notice period|notice is|serve.*notice|two\s*months?|three\s*months?|one\s*month|sixty\s*days?|ninety\s*days?|thirty\s*days?|immediately available|available\s+immediately|no notice|already free|notice ended|served my notice|currently between|on a break|buyout)\b/i;
      const noticeAlreadyDiscussed = transcript.some(
        (t) => t.speaker === "user" && noticeDiscussedRe.test(t.text),
      );
      // Sanitize whenever closing announces a number that's below the highest
      // offer made — that's the catastrophic case. Also sanitize if it announces
      // ANY number we can't verify (highest === 0 means we never tracked an offer).
      if (announcedBelowHighest || (hasAnyNumber && highest === 0) || hasPlaceholder) {
        // Tail varies by whether notice period was already discussed.
        // If it was, ask about start-date instead of repeating the notice
        // question (which is the "did you even listen?" failure mode).
        const tail = noticeAlreadyDiscussed
          ? "Anything else you'd like to clarify before HR follows up?"
          : "What's your notice period situation?";
        const safeClosing = highest > 0
          ? `Great — I think we've had a really productive conversation. Based on everything we've discussed, including offers up to ₹${highest} LPA, let me finalise the numbers internally and have HR send you the formal offer letter with the complete breakdown. ${tail}`
          : `Great — I think we've had a really productive conversation. Let me put together the final numbers based on everything we've discussed and have HR send you the formal offer letter with the complete breakdown. ${tail}`;
        console.warn(
          `[interview] salary-neg closing step announced ₹${announcedNum} LPA `
          + `(highest offer made: ₹${highest} LPA) — replacing with safe template`,
        );
        step.aiText = safeClosing;
        if (typeof step.aiTextDisplay === "string") step.aiTextDisplay = safeClosing;
      } else if (noticeAlreadyDiscussed && /\bnotice period\b/i.test(step.aiText)) {
        // Closing step is already "safe" but still asks notice period when we
        // already know the answer. Strip the redundant question.
        step.aiText = step.aiText.replace(
          /\.?\s*What'?s your (current )?notice period[^.?!]*[.?!]\s*$/i,
          ". Anything else you'd like to clarify before HR follows up?",
        );
        if (typeof step.aiTextDisplay === "string") {
          step.aiTextDisplay = step.aiText;
        }
      }
    }

    // Guard: if step is already playing and only the script length changed (not currentStep),
    // don't restart. This prevents follow-up insertions from interrupting active TTS or recording.
    if (currentStep === 0 && introStartedRef.current && step.aiText === introStartedRef.current) {
      return;
    }
    if (currentStep > 0 && currentStep === lastEffectStepRef.current && (phase === "speaking" || phase === "listening")) {
      // Script length changed but currentStep didn't — skip re-trigger
      return;
    }
    lastEffectStepRef.current = currentStep;

    if (currentStep === 0) {
      introStartedRef.current = step.aiText;
      track("interview_started", { type: interviewType, mode: isMiniMode ? "mini" : "full", isPanel: isPanelInterview });
      // PostHog: per-focus session-started signal. Same `focus` property
      // shape as interview_focus_selected / interview_session_completed so
      // a single PostHog dashboard can build a focus-segmented funnel.
      captureClientEvent("interview_session_started", {
        focus: interviewType,
        mode: isMiniMode ? "mini" : "full",
        is_panel: isPanelInterview,
        role: user?.targetRole || null,
        company: user?.targetCompany || null,
      });
    }

    const gen = ++flowGenerationRef.current;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const isStale = () => cancelled || gen !== flowGenerationRef.current || interviewEndedRef.current;

    // Cancel any in-flight TTS from previous generation to prevent overlap
    ttsCancelRef.current?.();
    ttsCancelRef.current = null;

    setPhase("thinking");

    if (aiVoiceEnabled && step.aiText) {
      prefetchTTS(step.aiText, interviewerGender);
    }

    /* Build the pre-question "thinking phrase" (acknowledgement +
       transition) — see ./_thinking-phrase.ts for the decision tree.
       The pure helper returns counter deltas which we apply here so
       the engine still owns its mutable refs. */
    const questionsRemaining = interviewScript.filter((s, i) => i > currentStep && s.type === "question").length;
    const tp = buildThinkingPhrase({
      currentStep,
      stepType: step.type,
      interviewType,
      lastAnswerQuality: lastAnswerQualityRef.current,
      lastAnswerText: lastAnswerTextRef.current || "",
      personality,
      questionsRemaining,
      pushbackCount: negPushbackCountRef.current,
      lastQuestionSpoken: lastQuestionSpokenRef.current,
      timePressureSpoken: timePressureSpokenRef.current,
      lastTurnWasSkip: skipPendingAckRef.current,
    });
    // Consume the skip-ack flag so it only affects the next AI turn.
    if (skipPendingAckRef.current) skipPendingAckRef.current = false;
    if (tp.pushbackDelta) negPushbackCountRef.current += tp.pushbackDelta;
    if (tp.dontKnowDelta) dontKnowCountRef.current += tp.dontKnowDelta;
    if (tp.markedLastQuestionSpoken) lastQuestionSpokenRef.current = true;
    if (tp.markedTimePressureSpoken) timePressureSpokenRef.current = true;
    const thinkingPhrase = tp.phrase;

    const startSpeaking = () => {
      if (isStale()) return;
      clearTimeout(thinkingSafetyTimer); // Clear thinking safety — we're proceeding
      setPhase("speaking");
      setIsRecording(true);
      // Reset TTS-caption sync state for this question
      setTtsDurationMs(undefined);
      setSpeechEnded(false);

      /* Defer transcript append until audio actually starts playing.
       * Previously, the AI bubble appeared instantly while the user
       * waited 500-1500ms for the Azure REST round-trip on Q1 (no
       * thinking phrase → no warm prefetch). Now the bubble is revealed
       * in sync with audio onset, and we keep an 800ms fallback timer
       * in case the provider never fires `onAudioStarted` (e.g.
       * autoplay-blocked path, browser-TTS fallback failure). */
      let transcriptRevealed = false;
      const revealTranscript = () => {
        if (transcriptRevealed || isStale()) return;
        transcriptRevealed = true;
        setTranscript(prev => [...prev, {
          speaker: "ai",
          text: step.persona ? `[${step.persona}] ${step.aiText}` : step.aiText,
          time: formatTime(elapsed),
        }]);
      };
      // Fallback: if audio onset never fires (autoplay block, voice disabled,
      // provider miss), reveal anyway so the candidate can read the question.
      const transcriptFallbackTimer = setTimeout(revealTranscript, aiVoiceEnabled ? 1200 : 0);

      ttsCancelRef.current?.();

      let localSpeechEnded = false;
      const onSpeechEnd = () => {
        if (localSpeechEnded || isStale()) return;
        localSpeechEnded = true;
        // Safety: ensure transcript is visible by the time speech ends —
        // covers the rare case where neither onAudioStarted nor the
        // 1.2s fallback fired (e.g. very short utterance).
        clearTimeout(transcriptFallbackTimer);
        revealTranscript();
        setSpeechEnded(true);
        if (safetyTimer) clearTimeout(safetyTimer);
        setIsRecording(false);
        if (step.waitForUser) {
          setPhase("listening");
          // Reset silence nudge for the new listening phase
          resetSilenceNudge();
          const nextStep = interviewScript[currentStep + 1];
          if (nextStep && aiVoiceEnabled) {
            prefetchTTS(nextStep.aiText, interviewerGender);
          }
        } else {
          // Auto-advance to done (closing with waitForUser: false)
          // Brief pause for natural conclusion feel
          setTimeout(() => setPhase("done"), 500);
        }
      };

      // Safety timer: allow speakingDuration + buffer for TTS latency/network jitter
      // If autoplay is blocked, use a short 3s timeout since no audio will play
      const safetyMs = isAutoplayBlocked()
        ? 3000
        : Math.max(step.speakingDuration + 8000, 12000);
      safetyTimer = setTimeout(() => {
        if (!localSpeechEnded) {
          console.warn("[interview] TTS safety timeout — forcing phase transition");
          onSpeechEnd();
        }
      }, safetyMs);

      if (aiVoiceEnabled) {
        const instanceId = ++ttsInstanceIdRef.current;
        // Callback: TTS provider reports actual audio duration → sync caption typing speed
        const onDurationKnown = (ms: number) => {
          if (ttsInstanceIdRef.current === instanceId) setTtsDurationMs(ms);
        };
        // For panel interviews, wait for voices to load before speaking (prevents race condition)
        const speakPanel = async () => {
          if (isPanelInterview && panelVoicesReadyRef.current) {
            await panelVoicesReadyRef.current.catch(() => {});
          }
          const normalizedPersona = step.persona ? normalizePersona(step.persona) : null;
          const panelVoiceId = isPanelInterview && normalizedPersona ? panelVoicesRef.current[normalizedPersona] : null;
          const panelGender = isPanelInterview && normalizedPersona && panelMembers
            ? panelMembers.find(m => m.title === normalizedPersona)?.gender
            : undefined;
          // Bug fix: when the Cartesia voice library fails to load,
          // panelVoiceId is null and we fall through to speak() which
          // previously always used `interviewerGender` (the global
          // interviewer's gender, not the current panelist's). Result:
          // every panelist — male or female — used the same fallback
          // voice and "Deepika Iyer" sounded male / "Rahul" sounded
          // female. Now the panel member's own gender drives the
          // Azure voice selection so the gender at least matches even
          // if individual voices don't differ.
          const fallbackGender = isPanelInterview ? (panelGender ?? interviewerGender) : interviewerGender;
          /* onAudioStarted reveals the AI bubble at audio onset so text
           * doesn't lead the voice. Falls back to the 1.2s timer if the
           * provider doesn't fire it. */
          return panelVoiceId
            ? speakAs(step.aiText, panelVoiceId, onSpeechEnd, onSpeechEnd, panelGender, onDurationKnown, revealTranscript)
            : speak(step.aiText, onSpeechEnd, onSpeechEnd, fallbackGender, onDurationKnown, revealTranscript);
        };
        speakPanel().then(handle => {
          if (ttsInstanceIdRef.current === instanceId) {
            ttsCancelRef.current = handle.cancel;
          } else {
            handle.cancel();
          }
        }).catch((e) => {
          // TTS rejection during the active question. The phase advances via
          // onSpeechEnd so the interview keeps moving; we surface a brief
          // notice so the candidate knows audio is broken (not them).
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("[interview] TTS speak() rejected:", msg.slice(0, 120));
          track("tts_failed", { phase: "question", error: msg.slice(0, 200) });
          flagTtsError("Audio temporarily unavailable — read the question above.");
          // Reveal transcript so candidate can read the question text
          // even when audio playback is permanently broken.
          revealTranscript();
          onSpeechEnd();
        });
      } else {
        const speakTimer = setTimeout(onSpeechEnd, step.speakingDuration);
        ttsCancelRef.current = () => clearTimeout(speakTimer);
      }
    };

    // Speak a thinking phrase (e.g. "Hmm… okay.") before the actual question for realism
    const startWithThinkingPhrase = () => {
      if (isStale() || !thinkingPhrase) { startSpeaking(); return; }
      if (aiVoiceEnabled) {
        const phraseInstanceId = ++ttsInstanceIdRef.current;
        const onPhraseDone = () => {
          if (isStale()) return;
          // Brief micro-pause between phrase and question (300-600ms)
          setTimeout(startSpeaking, randomDelay(300, 600));
        };
        speak(thinkingPhrase, onPhraseDone, onPhraseDone, interviewerGender).then(handle => {
          if (ttsInstanceIdRef.current === phraseInstanceId) {
            ttsCancelRef.current = handle.cancel;
          } else {
            handle.cancel();
          }
        }).catch(() => { if (!isStale()) startSpeaking(); });
      } else {
        // Without voice, just add a slightly longer delay to simulate thinking
        setTimeout(startSpeaking, randomDelay(200, 500));
      }
    };

    // Thinking-phase safety: if stuck in "thinking" for >12s, force-start speaking
    const thinkingSafetyTimer = setTimeout(() => {
      if (!isStale()) {
        console.warn("[interview] thinking-phase safety timeout — forcing startSpeaking");
        startSpeaking();
      }
    }, 12000);

    const pendingFollowUp = pendingFollowUpRef.current;
    const isSalaryNegConversation = interviewType === "salary-negotiation";

    if (pendingFollowUp) {
      pendingFollowUpRef.current = null;
      const timeout = new Promise<null>(r => setTimeout(() => r(null), isSalaryNegConversation ? 13000 : 4000));

      // For salary-neg: speak thinking phrase IMMEDIATELY to eliminate dead air,
      // then wait for follow-up API in background. This means the user hears
      // "Hmm, let me think about that..." within 0.5s instead of 6s silence.
      //
      // NOTE: we deliberately do NOT add the thinking phrase to the transcript.
      // It's a UX bridge ("Got it." / "I understand." / "Sure.") to fill TTS
      // dead-air; treating it as a real conversational turn produced the
      // observed bug where the report transcript showed:
      //     [ai] Got it.
      //     [ai] I appreciate you sharing your thoughts...
      // as TWO separate AI turns. Worse, the eval LLM read those bridges as
      // substantive turns and the per-question pairing got confused. Bridges
      // are now spoken-only — the substantive follow-up that arrives via
      // pendingFollowUp.then() is the canonical AI turn.
      if (isSalaryNegConversation && (thinkingPhrase !== null) && thinkingPhrase && aiVoiceEnabled) {
        const isHeavyPushback = negPushbackCountRef.current >= 3;
        const walkAwayPatCheck = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|move on|take the other|have to pass)\b/i;
        const isWalkAway = walkAwayPatCheck.test(lastAnswerTextRef.current);
        // Reduced pauses: strategic pause for walk-away/pushback (1.5-2.5s), normal (150-400ms)
        const strategicPause = (isWalkAway || isHeavyPushback) ? randomDelay(1500, 2500) : undefined;
        const phraseDelay = strategicPause ?? randomDelay(150, 400);

        // Speak thinking phrase immediately. NOT added to transcript — see
        // note above. The TTS-only path keeps the no-dead-air UX without
        // polluting the conversation log.
        setTimeout(() => {
          if (isStale() || interviewEndedRef.current) return;
          const phraseInstanceId = ++ttsInstanceIdRef.current;
          speak(thinkingPhrase!, () => {}, () => {}, interviewerGender).then(handle => {
            if (ttsInstanceIdRef.current === phraseInstanceId) {
              ttsCancelRef.current = handle.cancel;
            } else {
              handle.cancel();
            }
          }).catch(() => {});
        }, phraseDelay);
      }

      Promise.race([pendingFollowUp, timeout]).then(result => {
        if (isStale() || interviewEndedRef.current) return;
        // Drop stale follow-ups: we only apply if the engine is exactly one
        // step past the originating question. If the user advanced further
        // (slow LLM, fast typer), the result describes a question they no
        // longer remember — applying it would conflate turns. Bug #6 root.
        const originatingStep = pendingFollowUpStepRef.current;
        if (originatingStep >= 0 && currentStep !== originatingStep + 1) {
          console.warn(`[interview] dropping stale follow-up — originated at step ${originatingStep}, engine now at ${currentStep}`);
          pendingFollowUpStepRef.current = -1;
          return;
        }
        pendingFollowUpStepRef.current = -1;
        // Track highest AI offer for monotonic enforcement
        if (isSalaryNegConversation && result?.followUpText) {
          const offerRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs)/g;
          let m: RegExpExecArray | null;
          while ((m = offerRe.exec(result.followUpText)) !== null) {
            const num = parseFloat(m[1]);
            if (num > highestOfferRef.current) highestOfferRef.current = num;
          }
        }
        if (result?.needsFollowUp && result.followUpText && currentStepRef.current === currentStep) {
          // Preserve persona from the original question (or from API response) for panel interviews
          const followUpPersona = isPanelInterview ? ((result as { persona?: string }).persona || step.persona) : undefined;
          // Sanitize the LLM's raw follow-up the same way batch questions
          // get sanitized in interviewAPI.ts — without this, [pause:long]
          // and *foo* markers leaked straight into the rendered question.
          const { cleaned: followUpCleaned, accentSplit: followUpAccent } = extractAccentMarkup(result.followUpText);
          // Compute speakingDuration from word count (~150 WPM for TTS, with a 2s floor)
          const followUpWords = followUpCleaned.split(/\s+/).length;
          const followUpSpeakMs = Math.max(3000, Math.round((followUpWords / 150) * 60 * 1000) + 1500);
          const followUpStep: InterviewStep = {
            type: isSalaryNegConversation ? "question" : "follow-up",
            aiText: followUpCleaned,
            aiTextDisplay: stripProsodyMarkup(followUpCleaned),
            thinkingDuration: 300,
            speakingDuration: followUpSpeakMs,
            waitForUser: true,
            scoreNote: isSalaryNegConversation ? "Salary negotiation response — evaluate negotiation strategy" : "Dynamic follow-up based on candidate's answer",
            persona: followUpPersona,
            ...(followUpAccent ? { accentSplit: followUpAccent } : {}),
            /* In-flow transparency: server-derived move tag rides on
             * the kernel response for salary-negotiation turns. Copy
             * through to the step so the Learning Mode chip can render
             * it under the AI bubble. Absent on non-negotiation
             * follow-ups; renderer falls back to null. */
            ...((result as { moveTag?: import("./MoveTag").MoveTag }).moveTag
              ? { moveTag: (result as { moveTag?: import("./MoveTag").MoveTag }).moveTag }
              : {}),
          };
          // Persist follow-up to DB in real-time
          if (user?.id) {
            const idx = turnIndexRef.current++;
            saveInterviewTurn({
              id: safeUUID(),
              session_id: liveSessionIdRef.current,
              user_id: user.id,
              turn_index: idx,
              turn_type: "follow_up",
              speaker: "ai",
              content: result.followUpText,
              metadata: { persona: followUpPersona || null, isSalaryNeg: isSalaryNegConversation },
            }).catch(() => {});
          }
          if (isSalaryNegConversation) {
            // Salary negotiation: replace the ABOUT-TO-SPEAK question slot
            // with the dynamic response generated from the user's PREVIOUS
            // answer. Until this fix the findIndex used `i > currentStep`,
            // which skipped over the about-to-speak Q2 and wrote the
            // follow-up into Q3 — so Q2 played as scripted, the user
            // answered Q2, and THEN Q3 played a probe of Q1. User report
            // verbatim: "User answered Q1, AI asked Q2, user answered Q2,
            // AI asked a follow-up on Q1." Using `i >= currentStep` puts
            // the follow-up where it belongs — as the AI's immediate next
            // turn after the answer that originated it.
            //
            // The CLOSING step is intentionally excluded — we observed
            // (sessions ea2689e9 / d1c2d3d0) that follow-ups were replacing
            // the closing slot, leaving the interview to end abruptly
            // without an AI wrap-up turn ("Suddenly interview ends" — bug
            // #21e). Closings always run.
            /* Item #1 minimum-viable: when the server signals
               conversationDone (candidate accepted or walked away),
               drop all remaining question slots after the injected
               follow-up. The closing step is preserved. This is what
               makes the engine stop marching past acceptance — a
               candidate who says yes on turn 1 hears the AI's
               confirmation, then the closing wrap-up, instead of
               being dragged through 4 more anchor phases. */
            const serverSaysDone = isSalaryNegConversation && (result as { conversationDone?: boolean })?.conversationDone === true;
            setInterviewScript(prev => {
              const nextQuestionIdx = prev.findIndex((s, i) => i >= currentStep && s.type === "question");
              /* Sticky terminal-phase safety net (session 13 bug,
                 2026-05-14): if the kernel signals terminal but the
                 script has already been truncated to a single wrap
                 step from a PRIOR terminal turn, findIndex returns -1
                 and the original code returned `prev` unchanged —
                 dropping the followUpStep AND silently leaving the UI
                 in phase="listening" with the "Start Speaking" mic.
                 Append a fresh wrapStep at the end so the engine has
                 a step to advance into with waitForUser:false, which
                 routes through the speaking-end branch into
                 phase="done" and the View Result CTA. */
              if (serverSaysDone && (nextQuestionIdx < 0 || nextQuestionIdx < currentStep)) {
                const wrapStep = {
                  ...followUpStep,
                  type: "closing" as const,
                  waitForUser: false,
                  scoreNote: "Negotiation kernel terminal restate",
                };
                /* Truncate any tail beyond currentStep so we don't
                   advance past the wrap into stale scripted slots. */
                return [...prev.slice(0, currentStep + 1), wrapStep];
              }
              if (nextQuestionIdx >= currentStep && nextQuestionIdx >= 0) {
                // Replace the next question with the dynamic response
                const updated = [...prev.slice(0, nextQuestionIdx), followUpStep, ...prev.slice(nextQuestionIdx + 1)];
                if (serverSaysDone) {
                  /* The kernel's terminal text (close-acceptance /
                     close-walkaway / close-stalemate) IS the wrap-up —
                     it already locks in the number, acknowledges the
                     walk-away, etc. Convert the inserted followUpStep
                     itself into the closing slot and drop the static
                     closing, so the user hears one clean wrap instead
                     of "kernel wrap" + "static notice-period boilerplate"
                     back-to-back. */
                  /* waitForUser: false — the kernel has reached a
                     terminal phase (accepted / walked-away / stalemate),
                     so the conversation is over. Inheriting waitForUser
                     from the followUpStep (true) left phase="listening"
                     after the kernel's wrap-up text finished, which
                     surfaced the "Start Speaking" mic instead of routing
                     into the phase==="done" branch that owns the
                     post-interview report flow (DealSummaryCard, eval
                     overlay, "View Result" CTA). Forcing waitForUser
                     false here is the single signal the UI uses to
                     transition into the done phase for ALL terminal
                     kernel phases — accepted, walked-away, stalemate
                     (and any future terminal phase the kernel adds, as
                     long as it sets the server's terminal flag). */
                  const wrapStep = {
                    ...updated[nextQuestionIdx],
                    type: "closing" as const,
                    waitForUser: false,
                    scoreNote: "Negotiation kernel terminal wrap",
                  };
                  return [...updated.slice(0, nextQuestionIdx), wrapStep];
                }
                // Mark remaining pre-generated questions (after the replaced one) with adaptive placeholders
                // so they don't play stale content if follow-up fails for a later turn
                for (let i = nextQuestionIdx + 1; i < updated.length; i++) {
                  const s = updated[i];
                  if (s.type === "question" && !s.scoreNote?.includes("Dynamic follow-up")) {
                    updated[i] = { ...s, aiText: "Based on our discussion so far, let me think about what makes sense here. What are your thoughts on the overall package — is there a specific area you'd like to focus on?" };
                  } else if (s.type === "closing" && !s.scoreNote?.includes("Dynamic follow-up")) {
                    /* Closing must NOT contain a question (Bug C fix).
                       The trailing "What's your notice period situation?"
                       turned the wrap-up into an open question while the
                       UI was already showing the "View result" button —
                       leaving the user with a question on screen and no
                       way to answer it.
                       Branch the wrap-up on the candidate's actual stance
                       so a "we'll follow up" message doesn't fire after
                       a clear walk-away or after a concrete acceptance.
                       The negotiationFacts above already classify
                       acceptance / rejection from the live transcript. */
                    // Read the current transcript to classify the
                    // candidate's last stance. extractNegotiationFacts is
                    // pure, so safe to call here from the script-mutation
                    // closure.
                    const facts = extractNegotiationFacts([
                      ...transcript,
                      { speaker: "user" as const, text: lastAnswerTextRef.current || "", time: "" },
                    ]);
                    const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|move on|take the other|have to pass)\b/i;
                    const isWalking = walkAwayPat.test(lastAnswerTextRef.current || "");
                    // "Still actively negotiating" — candidate is asking for
                    // more / countering / pushing on a lever. Closing the
                    // session with "we'll follow up shortly" feels dismissive
                    // and unrealistic. Acknowledge the open state and pin a
                    // concrete next step.
                    // Includes frustration / "already mentioned" — these
                    // are signs the candidate is still pushing, not winding
                    // down. Closing on these would feel dismissive.
                    const stillNegotiatingPat = /\b(higher|more|increase|stretch|push|counter ?offer|what.?s your counter|can you (?:offer|do|go)|i.?d like (?:a |to )?(?:higher|more)|i would like (?:a |to )?(?:higher|more)|can we (?:go|do)|already (?:mentioned|said|told)|as i (?:said|mentioned|told)|i (?:said|mentioned|told you) (?:that|this|earlier|before)|mentioned (?:multiple times|earlier|before)|told you|for the (?:second|third|fourth|nth) time|like to have higher|highest base)\b/i;
                    const stillNegotiating = stillNegotiatingPat.test(lastAnswerTextRef.current || "");
                    /* Frustration detector (added 2026-Q2): rhetorical
                       questions, "what's the point", repeat complaints.
                       When fired alongside acceptance, the closing
                       should acknowledge the friction explicitly
                       instead of cheerfully wrapping up — that reads
                       as gaslighting. The `stillNegotiating` "already
                       mentioned" branch was previously catching this
                       case and routing it to negotiation copy, which
                       is also wrong post-acceptance. */
                    const frustrationPat = /\b(does it (?:even )?matter|what.?s the point|why (?:does it|are you) (?:matter|asking|repeating)|stop (?:asking|repeating)|don.?t repeat|just (?:close|wrap|accept)|move on|enough (?:already|of)|how many times)\b/i;
                    const isFrustrated = frustrationPat.test(lastAnswerTextRef.current || "");
                    let closingText = "Thanks for working through this with me. We'll review the conversation and follow up with next steps shortly.";
                    if (facts.acceptedImmediately && isFrustrated) {
                      /* User accepted AND is exasperated — apologise
                         for the friction first, then close cleanly.
                         Higher priority than the cheery acceptance
                         branch below. */
                      closingText = "You're right — apologies for the back-and-forth. You've accepted, that's what matters. I'll have HR send the formal offer letter and we'll cover the logistics (start date, notice, benefits paperwork) over email. Welcome aboard.";
                    } else if (facts.acceptedImmediately) {
                      closingText = "Great — really glad we found terms that work. I'll have HR send the formal offer letter shortly. Welcome aboard.";
                    } else if (facts.rejectedOutright || isWalking) {
                      closingText = "I appreciate you being direct with me. We weren't able to bridge the gap today, but thank you for the conversation. Best of luck with the search.";
                    } else if (isFrustrated) {
                      /* Frustrated but no clear acceptance — likely
                         the LLM has been asking the same probe
                         repeatedly. Acknowledge + offer to take it
                         offline rather than pretend we can keep
                         negotiating cleanly. */
                      closingText = "I hear you — sorry for the loop. Let me bring the offer details to you in writing over email so we can move forward without going in circles here.";
                    } else if (stillNegotiating) {
                      closingText = "I hear you — and I want to be straight with you: I've shared where I can land today. Take some time to think it through, and let me know by tomorrow if the package works or if there's a specific lever you want me to revisit. I'll hold the offer till then.";
                    }
                    updated[i] = { ...s, aiText: closingText };
                  }
                }
                return updated;
              }
              // No more questions to replace — check if we can insert a follow-up probe.
              // Two budgets: a session-global cap (avoids the interview growing
              // unbounded) AND a per-question cap (prevents one question
              // burning the entire budget before later questions get any probes).
              const maxInserts = isMiniMode ? 2 : 3;
              const maxPerQuestion = 2;
              // Count consecutive follow-up steps already inserted between
              // the last "question" slot and the current cursor — that's
              // how many probes this main question has already received.
              let perQuestionInserted = 0;
              for (let i = currentStep; i >= 0; i--) {
                const s = prev[i];
                if (!s) break;
                if (s.type === "question") break;
                if (s.type === "follow-up") perQuestionInserted++;
              }
              /* Kernel bypass: for salary-negotiation the kernel's
                 turnRes.terminal flag owns conversation length. The
                 session-global and per-question caps were sized for
                 behavioural interviews and would cause premature
                 close ("Thanks, what's your notice period?") if applied
                 here. */
              const overGlobal = !isSalaryNegConversation && followUpInsertCountRef.current >= maxInserts;
              const overPerQ = !isSalaryNegConversation && perQuestionInserted >= maxPerQuestion;
              if (!overGlobal && !overPerQ) {
                /* Salary-neg race fix (2026-05-13). Was `i > currentStep`
                 * which silently failed when currentStep IS the closing
                 * slot — the case for every 3-step salary-neg script
                 * (intro + initial offer + closing) after the candidate
                 * answers the lone question. The engine had already
                 * advanced past the question by the time the kernel
                 * resolved, so the lookup found no closing AFTER
                 * currentStep, the insert was silently dropped, and the
                 * static "Thanks for the conversation today" closing
                 * played as the AI's response to the candidate's first
                 * counter. Result: ENTIRE salary negotiation collapsed
                 * to one back-and-forth.
                 *
                 * Switch to `i >= currentStep` so the insert finds the
                 * closing at currentStep and inserts BEFORE it. When
                 * closingIdx === currentStep we also CLONE the closing
                 * before placing it back into the script — the closure-
                 * captured `step` is the original closing object, and
                 * the mutation block below needs to retarget it to the
                 * follow-up content for the about-to-fire startSpeaking.
                 * Without the clone, mutating `step.aiText` would also
                 * pollute the still-in-script closing slot. */
                const closingIdx = prev.findIndex((s, i) => i >= currentStep && s.type === "closing");
                if (closingIdx >= currentStep && closingIdx >= 0) {
                  followUpInsertCountRef.current++;
                  const insertStep = { ...followUpStep, type: "follow-up" as const };
                  if (closingIdx === currentStep) {
                    const closingClone = { ...prev[closingIdx] };
                    return [...prev.slice(0, closingIdx), insertStep, closingClone, ...prev.slice(closingIdx + 1)];
                  }
                  return [...prev.slice(0, closingIdx), insertStep, ...prev.slice(closingIdx)];
                }
              }
              return prev;
            });
            /* setInterviewScript replaces the slot at currentStep with a
               brand-new object (followUpStep), but startSpeaking reads
               `step.aiText` from the closure-captured reference of the
               OLD object. Without this mutation, Q2's original scripted
               text would still be spoken even though the script array
               now contains the follow-up. Mirror followUpStep's content
               onto the closure's step so the about-to-fire startSpeaking
               speaks the dynamic response. Only do this when the replaced
               slot IS currentStep — if it's a later question slot
               (shouldn't happen with the i >= currentStep change above,
               but defensive), we leave step alone and the follow-up will
               surface on the next step naturally. */
            /* Salary-neg race fix (2026-05-13). When the 3-step salary-neg
               script has currentStep === closingIdx, the closure-captured
               `step` is the "closing" object. The insert above placed a
               follow-up at currentStep and CLONED the original closing one
               slot later, so the in-script closing is now a separate
               object. We must update the closure's step (still the
               original closing reference) so the about-to-fire
               startSpeaking reads the follow-up text — otherwise the
               static "Thanks for the conversation today" would play. */
            if (step.type === "question" || step.type === "follow-up" || (isSalaryNegConversation && step.type === "closing")) {
              step.aiText = followUpStep.aiText;
              /* aiTextDisplay MUST track aiText. The user-reported
                 "audio TTS is different from written question" bug
                 came from this slot when followUpStep.aiTextDisplay
                 was undefined — we'd update aiText (TTS source)
                 without touching aiTextDisplay (UI source), so the
                 captions would show the OLD question while the new
                 audio played. Always derive a display string when
                 the explicit one is missing. */
              if (typeof followUpStep.aiTextDisplay === "string") {
                step.aiTextDisplay = followUpStep.aiTextDisplay;
              } else {
                step.aiTextDisplay = stripProsodyMarkup(followUpStep.aiText);
              }
              step.speakingDuration = followUpStep.speakingDuration;
              if (followUpStep.scoreNote) step.scoreNote = followUpStep.scoreNote;
              const fuAccent = (followUpStep as { accentSplit?: { before: string; accent: string; after: string } }).accentSplit;
              if (fuAccent) (step as { accentSplit?: typeof fuAccent }).accentSplit = fuAccent;
            }
            // Thinking phrase already spoken — go directly to main response
            // Brief pause for natural transition from thinking phrase to main speech
            const microDelay = randomDelay(200, 500);
            setTimeout(() => { if (!isStale() && !interviewEndedRef.current) startSpeaking(); }, microDelay);
          } else {
            setInterviewScript(prev => {
              /* Cap check — see src/_follow-up-cap.ts. BYPASSED for
                 salary-negotiation: the kernel owns its own terminal
                 phase. Letting the behavioural-interview cap fire
                 here forces the engine into the static closing slot
                 producing premature close. */
              if (!isSalaryNegConversation) {
                const cap = checkFollowUpCap({ script: prev });
                if (!cap.allowed) {
                  console.warn(`[interview] Skipping follow-up — turn cap reached (${cap.currentTurns}/${cap.maxTurns})`);
                  return prev;
                }
              }
              return [
                ...prev.slice(0, currentStep),
                followUpStep,
                ...prev.slice(currentStep),
              ];
            });
          }
        } else if (!interviewEndedRef.current) {
          // Follow-up timed out or returned needsFollowUp=false
          if (isSalaryNegConversation) {
            // Thinking phrase already spoken — go directly to main response
            const microDelay = randomDelay(200, 500);
            setTimeout(() => { if (!isStale() && !interviewEndedRef.current) startSpeaking(); }, microDelay);
          } else {
            const quality = lastAnswerQualityRef.current;
            const pauseRange = quality === "strong" ? [1200, 2000] : quality === "decent" ? [800, 1400] : [500, 900];
            const microDelay = (thinkingPhrase !== null) ? randomDelay(pauseRange[0], pauseRange[1]) : step.thinkingDuration;
            setTimeout(() => { if (!isStale() && !interviewEndedRef.current) startWithThinkingPhrase(); }, microDelay);
          }
        }
      }).catch(() => {
        if (!isStale() && !interviewEndedRef.current) {
          if (isSalaryNegConversation) {
            const microDelay = randomDelay(200, 500);
            setTimeout(() => { if (!isStale() && !interviewEndedRef.current) startSpeaking(); }, microDelay);
          } else {
            const microDelay = (thinkingPhrase !== null) ? randomDelay(800, 1500) : step.thinkingDuration;
            setTimeout(() => { if (!isStale() && !interviewEndedRef.current) startWithThinkingPhrase(); }, microDelay);
          }
        }
      });
    } else {
      // Quality-aware pause before next question
      const quality = lastAnswerQualityRef.current;
      const pauseRange = (thinkingPhrase !== null)
        ? (quality === "strong" ? [1200, 2000] : quality === "decent" ? [800, 1400] : [500, 900])
        : [step.thinkingDuration, step.thinkingDuration];
      const microDelay = randomDelay(pauseRange[0], pauseRange[1]);
      const thinkTimer = setTimeout(startWithThinkingPhrase, microDelay);
      return () => {
        cancelled = true;
        clearTimeout(thinkTimer);
        clearTimeout(thinkingSafetyTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
        ttsCancelRef.current?.();
      };
    }

    return () => {
      cancelled = true;
      clearTimeout(thinkingSafetyTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
      ttsCancelRef.current?.();
    };
  // interviewScript.length: re-run when follow-up steps are inserted at currentStep.
  // interviewScript[currentStep]?.pendingKernel: PDF#46 — re-run when the kernel-
  //   resolve path replaces a pending placeholder with a real followUpStep. The
  //   replacement keeps array length identical so the .length dep alone never fires;
  //   without this dep the engine would stay parked in `thinking` forever even after
  //   the kernel returned prose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, aiVoiceEnabled, interviewScript.length, interviewScript[currentStep]?.pendingKernel]);

  // Handle user "finishing" their answer
  const advancingRef = useRef(false);
  const handleNextQuestion = useCallback(() => {
    if (phase !== "listening" || advancingRef.current) return;
    advancingRef.current = true;
    // Safety: always release advancing lock after 500ms regardless of code path
    const advancingSafetyTimer = setTimeout(() => { advancingRef.current = false; }, 500);

    try { ttsCancelRef.current?.(); } catch { /* ignore TTS cleanup errors */ }
    try { recognitionRef.current?.stop(); } catch { /* ignore STT cleanup errors */ }

    const rawTranscript = currentTranscript.trim();
    // Salary-negotiation interviews routinely capture STT mishears for
    // Indian comp vocabulary ("legs" → "lakhs", "celery" → "salary",
    // "NMCTC" → "CTC"). Run a domain-specific normalizer before the
    // text is committed to transcript / sent to follow-up evaluation —
    // both the candidate's display copy and the LLM's input become
    // intelligible. No-op for other interview types.
    const cleanedTranscript = interviewType === "salary-negotiation"
      ? cleanSalarySttArtifacts(rawTranscript)
      : rawTranscript;
    const answerText = cleanedTranscript || (answerTimer > 2 ? `[Answer recorded — ${answerTimer}s]` : "");

    // Block completely empty answers (silence with no speech detected)
    if (!answerText) {
      toast("Please speak or type your response before continuing.", "info");
      advancingRef.current = false;
      clearTimeout(advancingSafetyTimer);
      return;
    }

    /* "Repeat that question" voice command — if the candidate's only
       utterance is a request to repeat, re-speak the current AI turn
       instead of treating it as an answer. See ./_advance-helpers.ts. */
    if (isRepeatRequest(rawTranscript)) {
      const currentStepObj = interviewScript[currentStep];
      if (currentStepObj?.aiText && aiVoiceEnabled) {
        setCurrentTranscript("");
        advancingRef.current = false;
        clearTimeout(advancingSafetyTimer);
        speak(currentStepObj.aiText, () => {}, () => {}, interviewerGender).catch(() => {});
        return;
      }
    }

    // Warn user when STT captured nothing — encourage typing
    if (!rawTranscript && answerTimer > 2) {
      toast("Speech wasn't detected clearly. Try typing your response next time.", "info");
    }

    // Validate text input — require minimum length (shorter threshold for salary-negotiation since "₹25 LPA" is valid)
    const minLength = interviewType === "salary-negotiation" ? 3 : 10;
    if (!answerText.startsWith("[Answer recorded") && answerText.length < minLength) {
      toast(interviewType === "salary-negotiation" ? "Please type your response." : "Please provide a longer answer (at least a few words).", "info");
      advancingRef.current = false;
      clearTimeout(advancingSafetyTimer);
      return;
    }

    // STT-confidence gate: if the running confidence on this turn was low,
    // warn the user before letting their probably-misheard answer go to
    // the eval LLM. Two-tap pattern — first tap shows the warning + lets
    // them edit/retry; second tap (within 8s) sends as-is.
    const sttSnap = sttLowConfidenceRef.current;
    const STT_CONFIRM_WINDOW_MS = 8000;
    if (
      sttSnap && sttSnap.mean < 0.55 && rawTranscript &&
      Date.now() - lastLowConfidencePromptRef.current > STT_CONFIRM_WINDOW_MS
    ) {
      lastLowConfidencePromptRef.current = Date.now();
      toast(
        "We may have misheard parts of that — review the captured text or tap Send again to submit anyway.",
        "info",
      );
      advancingRef.current = false;
      clearTimeout(advancingSafetyTimer);
      return;
    }

    // Store answer quality for contextual reaction in next thinking phase
    lastAnswerQualityRef.current = assessAnswerQuality(answerText);
    lastAnswerTextRef.current = answerText;

    setTranscript(prev => [...prev, {
      speaker: "user",
      text: answerText,
      time: formatTime(elapsed),
    }]);
    setCurrentTranscript("");

    // Persist user answer to DB in real-time
    if (user?.id) {
      const idx = turnIndexRef.current++;
      saveInterviewTurn({
        id: safeUUID(),
        session_id: liveSessionIdRef.current,
        user_id: user.id,
        turn_index: idx,
        turn_type: "answer",
        speaker: "user",
        content: answerText,
        metadata: { time: formatTime(elapsed), questionStep: currentStep },
      }).catch(() => {});
    }

    const currentStepObj = interviewScript[currentStep];
    const isLastStep = currentStep >= interviewScript.length - 1;

    // Generate micro-feedback with dynamic difficulty awareness.
    // Skipped answers ("[SKIPPED — reason: …]") and stub recordings should
    // not produce coaching tips — they're not real attempts. We also
    // suppress feedback when the *just-asked* step was an intro (opener
    // exchange like "Yes, let's get started") or a closing — neither
    // turn is a substantive answer, so a "Share more detail…" tip is
    // worse than nothing.
    const justAskedType = interviewScript[currentStep]?.type;
    const nextStepType = interviewScript[currentStep + 1]?.type;
    // Once the candidate has accepted in salary-neg, stop emitting
    // coaching tips. The conversation is closing; "Tip: share more
    // detail" reads as an attempt to backseat-drive a deal that's
    // already done.
    const acceptedAlready = interviewType === "salary-negotiation"
      ? extractNegotiationFacts([
          ...transcript,
          { speaker: "user" as const, text: answerText, time: "" },
        ]).acceptedImmediately
      : false;
    // Suppress when (a) the just-answered turn was an opener/closing,
    // (b) this is the last real answer before closing, or (c) the
    // candidate has already accepted.
    const skipMicroFeedback =
      justAskedType === "intro" ||
      justAskedType === "closing" ||
      nextStepType === "closing" ||
      acceptedAlready;
    setMicroFeedback(null);
    if (
      !skipMicroFeedback &&
      answerText.length > 10 &&
      !answerText.startsWith("[Answer recorded") &&
      !answerText.startsWith("[SKIPPED")
    ) {
      // Compute current negotiation phase for phase-aware feedback (no-op for non-negotiation types)
      const negPhase = computeNegotiationPhase({
        interviewType, currentStep,
        scriptStepTypes: interviewScript.map(s => s.type),
      });
      /* Micro-feedback consumes the originating question text so the
         Lift-A detectors (defensiveness, self-awareness, vagueness) can
         fire the same cues the follow-up coach will pick up next.
         Originally behavioural-only; opened up to every STAR-friendly
         type (technical / strategic / panel / management / case-study)
         since those interviews routinely embed behavioural beats and the
         detectors no-op cleanly when irrelevant. Salary-negotiation
         excluded — STAR doesn't apply to a price conversation. */
      let originatingQuestionText: string | undefined;
      if (interviewType !== "salary-negotiation") {
        for (let i = currentStep; i >= 0; i--) {
          if (interviewScript[i]?.type === "question") {
            originatingQuestionText = interviewScript[i]?.aiText;
            break;
          }
        }
      }
      const { feedback, score: answerScore } = computeMicroFeedback(answerText, interviewType, answerQualityRef.current, negPhase, recentFeedbacksRef.current, originatingQuestionText);
      answerQualityRef.current.push(answerScore);
      if (feedback) {
        setMicroFeedback(feedback);
        recentFeedbacksRef.current.push(feedback);
        if (recentFeedbacksRef.current.length > 3) recentFeedbacksRef.current.shift();
        /* Telemetry: symmetric with the server-side `behavioural_probe_picked`
           event so we can finally answer "what % of turns surface a coaching
           tip" and "do Lift-A tips correlate with downstream improvement on
           the next answer". `tip_prefix` (not full text) because tips are
           templated — the prefix uniquely identifies the branch fired. */
        captureClientEvent("micro_feedback_picked", {
          interview_type: interviewType,
          tip_prefix: feedback.slice(0, 48),
          answer_score: answerScore,
          word_count: answerText.trim().split(/\s+/).filter(Boolean).length,
          had_question_text: Boolean(originatingQuestionText),
          turn_index: currentStep,
        });
      }
      /* Behavioural-only: snapshot STAR completeness for this question so
         the follow-up decision below can branch on "what's missing" rather
         than the generic depth ladder. Key by the original question step
         (walk back through any inserted follow-ups to find it). */
      if (interviewType === "behavioral") {
        let questionStepIdx = currentStep;
        for (let i = currentStep; i >= 0; i--) {
          if (interviewScript[i]?.type === "question") { questionStepIdx = i; break; }
        }
        const star = detectStarPresence(answerText);
        behavioralStateRef.current.starPerStep.set(questionStepIdx, {
          situation: star.situation, task: star.task, action: star.action, result: star.result, count: star.count, hasMetrics: star.hasMetrics, weHeavy: star.weHeavy ?? false,
        });
      }
    }

    // Fire follow-up check in background
    const isSalaryNegType = interviewType === "salary-negotiation";
    // For salary-negotiation: always fire follow-up to make conversation contextual.
    // The resolution handler decides whether to REPLACE the next question or INSERT a probe.
    // Hard cap on total inserted follow-ups prevents infinite growth (max 2-3 extra turns).
    const hasRealAnswer = answerText.length > 10 && !answerText.startsWith("[Answer recorded");
    const canFollowUp = isSalaryNegType
      ? ((currentStepObj?.type === "question" || currentStepObj?.type === "follow-up") && !isLastStep && hasRealAnswer)
      : ((currentStepObj?.type === "question" || currentStepObj?.type === "follow-up")
        && !isLastStep && hasRealAnswer);

    /* Conversational continuity — extract noun phrases from EVERY real
       user response (including the intro/TMAY reply), not just turns
       that trigger a live follow-up. Real interviewers reference what
       was said in the opener throughout the loop ("earlier you
       mentioned the Razorpay project"); without lifting this out of
       the canFollowUp gate, TMAY mentions never enter the rolling
       memory and Q2+ probes feel like they're hearing the candidate
       for the first time. See src/_noun-phrase-memory.ts. */
    if (hasRealAnswer) {
      const earlyPhrases = extractNounPhrases(answerText);
      if (earlyPhrases.length > 0) {
        mentionsMemoryRef.current = appendToMemory(mentionsMemoryRef.current, earlyPhrases);
      }
    }

    if (canFollowUp) {
      /* Conversation history + recent follow-ups for the LLM payload —
         see ./_advance-helpers.ts. Both are pure transformations of
         the transcript + script + current Q&A. */
      const conversationHistory = buildConversationHistory({
        transcript,
        currentQuestionText: currentStepObj!.aiText,
        currentAnswerText: answerText,
        isSalaryNeg: isSalaryNegType,
      });
      const recentFollowUps = extractRecentFollowUps({
        script: interviewScript,
        currentStep,
        currentAnswerText: answerText,
      });

      // For salary negotiation: always depth 0 (each response is a new conversational turn, not a stacked follow-up)
      // For other types: increment depth for follow-up chains
      const depth = isSalaryNegType ? 0 : (currentStepObj?.type === "follow-up" ? followUpDepthRef.current + 1 : 0);

      // Guard: if pending follow-up fetch is still in flight, skip to avoid desync
      if (pendingFollowUpRef.current) {
        pendingFollowUpRef.current = null;
      }

      /* Determine negotiation phase from position ratio (not absolute index) so
         it works even when follow-ups change the total question count
         mid-interview. See ./_negotiation-state.ts. The follow-up payload
         also needs the raw question index + total count for prompt
         construction, so we still compute those here. */
      const stepTypes = interviewScript.map(s => s.type);
      const isQuestionLike = (t: string) => t === "question" || t === "follow-up";
      const totalQs = stepTypes.filter(isQuestionLike).length;
      const currentQuestionIdx = stepTypes.slice(0, currentStep + 1).filter(isQuestionLike).length;
      const salaryPhase: string | undefined = computeNegotiationPhase({
        interviewType, currentStep, scriptStepTypes: stepTypes,
      });

      if (depth <= 2) {
        followUpDepthRef.current = depth;
        const followUpAiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as {
          topSkills?: string[];
          experiences?: Array<{ company?: string; title?: string; period?: string; bullets?: string[]; topProjects?: string[] }>;
        } | undefined;
        /* Flatten top projects from the AI-parsed resume's experience
           timeline. Cap to 5 so we keep the follow-up prompt cache-
           friendly (Groq caches prefixes ≥1024 tokens — bloating
           per-call dynamic content defeats the prefix cache). */
        const followUpResumeProjects = (followUpAiProfile?.experiences || [])
          .flatMap(e => Array.isArray(e?.topProjects) ? e.topProjects : [])
          .filter(p => typeof p === "string" && p.trim().length > 0)
          .slice(0, 5);
        // For salary negotiation: find the initial offer question text so the LLM can reference exact numbers
        const initialOfferText = isSalaryNegType
          ? interviewScript.find(s => s.type === "question" && /₹|lpa|ctc|offer|base/i.test(s.aiText))?.aiText
          : undefined;

        // Extract structured negotiation facts from the full transcript (including current answer)
        const negotiationFacts = isSalaryNegType
          ? extractNegotiationFacts([...transcript, { speaker: "user", text: answerText, time: "" }])
          : undefined;

        /* Mid-session coaching hint (salary-negotiation only) — fires once
           per phase, when the candidate is missing a known high-leverage
           move. See pickNegotiationCoachingHint in ./_advance-helpers.ts. */
        if (isSalaryNegType && negotiationFacts && salaryPhase) {
          const hint = pickNegotiationCoachingHint({
            phase: salaryPhase as Parameters<typeof pickNegotiationCoachingHint>[0]["phase"],
            facts: negotiationFacts,
            alreadyShown: negCoachingShownRef.current,
          });
          if (hint) {
            negCoachingShownRef.current.add(salaryPhase);
            // Delay hint so it doesn't overlap with the micro-feedback
            setTimeout(() => toast(hint, "info"), 2500);
          }
        }

        /* Adaptive difficulty: rolling-3 average of answer scores tells the
           follow-up LLM whether to escalate or ease up. See
           computeAdaptiveDifficulty in ./_advance-helpers.ts. */
        const adaptiveDifficulty = computeAdaptiveDifficulty(answerQualityRef.current);

        // Emotional-state signals — see src/_emotional-state.ts.
        const userTurns = transcript.filter(m => m.speaker === "user").map(m => m.text);
        const candidateState = deriveCandidateState([...userTurns, answerText]);

        /* Noun-phrase memory was already appended above (outside the
           canFollowUp gate) so it captures TMAY mentions too. Here we
           just read the rolling buffer for the follow-up payload. */
        const previousMentions = mentionsMemoryRef.current.length > 0
          ? mentionsMemoryRef.current
          : undefined;

        // Tag the in-flight request with the step it's answering. If the
        // engine has advanced past the next step by the time this resolves,
        // we'll drop the result (see check at the consumer site).
        pendingFollowUpStepRef.current = currentStep;

        /* Behavioural-only: decide whether this follow-up should be a
           targeted component-gap probe. We re-walk back to the original
           question step (same key as the STAR snapshot above), check
           which STAR pillar is missing, and gate by a per-question
           budget so we don't drill on a stubbornly weak answer
           indefinitely. The LLM still composes the actual probe text —
           the hint just steers it. */
        let starGapHint: "action" | "result" | "situation-task" | undefined;
        /* weHeavy is a parallel hint to starGap — it flags pronoun-
           attribution ambiguity (the answer is collective, not
           first-person) so the follow-up can clarify ownership without
           teaching the candidate that "we" is wrong. Indian candidates
           default to "we" out of cultural humility; we don't want to
           punish that, just ask the next question. */
        let weHeavyHint = false;
        /* Lift A — answer-analysis signals (vagueness, crispness,
           self-awareness, defensiveness). Pure regex on answer text +
           the originating question; cheap enough to run inline. Computed
           here so the follow-up coach can fire `crispness.too-thin`,
           `defensiveness.own-it`, `vagueness.quantify` cues and suppress
           `closer.would-do-differently` when the candidate already
           self-critiqued. */
        let behaviouralSignals: BehaviouralAnswerSignals | null = null;
        if (interviewType === "behavioral") {
          let questionStepIdx = currentStep;
          for (let i = currentStep; i >= 0; i--) {
            if (interviewScript[i]?.type === "question") { questionStepIdx = i; break; }
          }
          const star = behavioralStateRef.current.starPerStep.get(questionStepIdx);
          const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
          const budgetUsed = behavioralStateRef.current.gapFollowUpsPerStep.get(questionStepIdx) ?? 0;
          if (star) {
            const decision = decideComponentGapFollowUp(nextStarGap(star, wordCount), budgetUsed);
            if (decision) {
              starGapHint = decision.gap;
              behavioralStateRef.current.gapFollowUpsPerStep.set(questionStepIdx, decision.nextUsed);
            }
            if (star.weHeavy && wordCount >= 25) weHeavyHint = true;
          }
          // Pin signals against the ORIGINATING question (not a prior
          // follow-up step) so `isFailureQuestion` reads the right text.
          const originatingQ = interviewScript[questionStepIdx]?.aiText ?? currentStepObj?.aiText ?? "";
          behaviouralSignals = detectBehaviouralAnswerSignals({
            questionText: originatingQ,
            answer: answerText,
          });
        }

        /* Canonical kernel path for salary-negotiation. Routes through
           /api/negotiate-turn which owns state via the kernel. On any
           kernel error the async returns null so the resolution path
           falls through to a no-op (engine continues with the static
           script). */
        if (isSalaryNegType) {
          pendingFollowUpRef.current = (async () => {
            const band = negotiationBandRef.current;
            if (!band) return null; /* legacy path didn't load band; bail */
            try {
              /* Init lazily on first call. We treat the FIRST candidate
                 answer as a "turn" against a freshly-initialised state;
                 the engine's static-script opening offer is what got us
                 here, so the kernel starts from after the open. We seed
                 by calling init then immediately turn — two round-trips
                 first turn only, single round-trip every turn after. */
              if (!negotiationKernelStateRef.current) {
                /* Phase 29 (2026-05-14) — role-applicable YOE plumbing.
                   Pull totalYearsExperience + primaryDomain off the
                   resume's aiProfile and combine with the session
                   targetRole to compute applicableYoe. A Senior Product
                   Designer with 6 yrs applying for "Java Developer"
                   yields applicableYoe=0; the server uses that to pick
                   the entry-level band instead of senior. */
                const aiProf = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as
                  | { totalYearsExperience?: number; primaryDomain?: string }
                  | undefined;
                const totalYoeFromResume = typeof aiProf?.totalYearsExperience === "number"
                  ? aiProf.totalYearsExperience
                  : null;
                const primaryDomainFromResume = typeof aiProf?.primaryDomain === "string" && aiProf.primaryDomain
                  ? aiProf.primaryDomain
                  : null;
                const sessionRole = targetRole || user?.targetRole || "swe";
                const yoeResult = computeApplicableYoe({
                  totalYoe: totalYoeFromResume,
                  primaryDomain: primaryDomainFromResume,
                  targetRole: sessionRole,
                });
                /* Bug-report 14 follow-up (2026-05-14) — observability for
                 * the structural fix that treats unknown-domain as pivot.
                 * When BOTH sides fail to classify, the kernel falls back
                 * to applicableYoe=0 (entry tier) — which is the right
                 * conservative default but tells us nothing about how
                 * often the safety net fires. Emit a track event so we
                 * can monitor frequency: if this fires a lot, the domain
                 * graph needs more keywords; if rarely, the fix is doing
                 * its job invisibly and we can leave the graph alone.
                 * Distinct from semantic pivots (Backend → HR) where at
                 * least one side classified. */
                if (
                  yoeResult.relation === "pivot" &&
                  yoeResult.candidateDomainKey == null &&
                  yoeResult.targetDomainKey == null
                ) {
                  track("salary_neg_domain_classification_failed", {
                    primaryDomain: primaryDomainFromResume || "(none)",
                    targetRole: sessionRole,
                    totalYoe: totalYoeFromResume ?? -1,
                  });
                } else if (
                  yoeResult.relation === "pivot" &&
                  (yoeResult.candidateDomainKey == null ||
                    yoeResult.targetDomainKey == null)
                ) {
                  /* One side classified, the other didn't. Distinct from
                   * the full-fallback above and from a true semantic
                   * pivot (both classified, different buckets). */
                  track("salary_neg_domain_classification_partial", {
                    primaryDomain: primaryDomainFromResume || "(none)",
                    targetRole: sessionRole,
                    candidateDomainKey: yoeResult.candidateDomainKey || "(null)",
                    targetDomainKey: yoeResult.targetDomainKey || "(null)",
                  });
                }
                const initRes = await negotiationKernelInit({
                  sessionId: crypto.randomUUID(),
                  role: sessionRole,
                  company: targetCompany || user?.targetCompany || "",
                  band: {
                    initialOffer: band.initialOffer,
                    maxStretch: band.maxStretch,
                    walkAway: band.walkAway,
                    hasEquity: !!band.hasEquity,
                  },
                  /* Seniority routing (May 2026): without this, a senior
                     Java/TCS session was getting the entry-level band
                     ceiling because the server's resolveServerBand fell
                     through to generateNegotiationBand without an
                     experienceLevel hint. */
                  experienceLevel: user?.experienceLevel || undefined,
                  totalYoe: totalYoeFromResume,
                  applicableYoe: yoeResult.applicableYoe,
                  primaryDomain: primaryDomainFromResume,
                });
                if (!initRes) return null;
                negotiationKernelStateRef.current = initRes.state;
                /* Record the opener (open-with-offer / probe) in the
                   move history so end-of-session metrics see it. */
                try {
                  const parsedInit = JSON.parse(initRes.state) as {
                    turnIndex?: number;
                    candidateTarget?: number | null;
                  };
                  kernelMovesRef.current.push({
                    lever: initRes.move.lever,
                    newTotalLpa: initRes.move.newTotalLpa,
                    turnIndex: typeof parsedInit.turnIndex === "number" ? parsedInit.turnIndex : 0,
                    candidateTargetAtTurn: typeof parsedInit.candidateTarget === "number" ? parsedInit.candidateTarget : null,
                  });
                } catch { /* non-fatal */ }
              }
              const turnRes = await negotiationKernelTurn({
                state: negotiationKernelStateRef.current,
                candidateAnswer: answerText,
              });
              if (!turnRes) {
                /* Observability — silent null here was the previous
                   behaviour and made kernel-turn failures invisible
                   in PostHog. Network drops, 400 invalid-state, 5xx
                   LLM crashes all collapse to null; tag the path so
                   we can see hit rate. */
                track("negotiate_turn_failed", { reason: "null_response" });
                return null;
              }
              negotiationKernelStateRef.current = turnRes.state;
              /* Idempotency replay: server returned the cached prior
                 response (same state + answer within 60s). The first
                 response already advanced metrics; we MUST NOT push
                 the move again or end-of-session metrics double-count
                 turns. We still speak the same text and honour the
                 terminal flag (idempotent UX). */
              if (turnRes._replayed) {
                track("negotiate_turn_replayed", {
                  lever: turnRes.move.lever,
                  terminal: Boolean(turnRes.terminal),
                });
                return {
                  needsFollowUp: true,
                  /* Same canonical-pair read as the non-replay branch
                   * below — see Bug 2 PDF#25 comment. */
                  followUpText: turnRes.aiTextDisplay ?? turnRes.aiText ?? turnRes.text,
                  followUpType: "negotiation",
                  conversationDone: turnRes.terminal,
                  moveTag: turnRes.moveTag,
                };
              }
              /* Mirror the kernel's highestOfferMade into the legacy
                 highestOfferRef so any code path still reading the legacy
                 ref (closing recap regex, monotonic guards, telemetry)
                 stays in sync with the kernel's source of truth. Without
                 this, the kernel's deterministic-fallback path can update
                 state without bumping the ref, and the next legacy read
                 reports a stale number. */
              try {
                const parsedState = JSON.parse(turnRes.state) as {
                  highestOfferMade?: number;
                  turnIndex?: number;
                  candidateTarget?: number | null;
                };
                const kernelHigh = typeof parsedState.highestOfferMade === "number" ? parsedState.highestOfferMade : 0;
                if (kernelHigh > highestOfferRef.current) {
                  highestOfferRef.current = kernelHigh;
                }
                /* Accumulate the move for end-of-session metrics. We
                   snapshot the candidate's target AS OF this turn so
                   anchor-turn detection can find the first non-null
                   value. turnIndex comes from the kernel-after state
                   (post-applyAiMove), which is the AI turn we're
                   recording. */
                kernelMovesRef.current.push({
                  lever: turnRes.move.lever,
                  newTotalLpa: turnRes.move.newTotalLpa,
                  turnIndex: typeof parsedState.turnIndex === "number" ? parsedState.turnIndex : kernelMovesRef.current.length,
                  candidateTargetAtTurn: typeof parsedState.candidateTarget === "number" ? parsedState.candidateTarget : null,
                });
              } catch {
                /* serialized state shape changed under us — non-fatal,
                   the kernel still owns its own state. */
              }
              /* Always speak the kernel's text. The previous mapping
                 (needsFollowUp: !terminal) silently DROPPED the
                 kernel's terminal wrap-up text on close-acceptance /
                 close-walkaway / close-stalemate, because the engine's
                 false-branch ignores result.followUpText and falls
                 through to the static closing slot instead. That
                 produced the "I accept" → "Thanks, what's your notice
                 period?" mismatch users complained about.
                 conversationDone routes through the engine's wrap
                 handler which strips intermediate anchor questions,
                 so the kernel's "Done — ₹X locked in" plays as the
                 single closing turn. */
              /* Bug 2 fix (PDF#25, 2026-05-16) — the typewriter consumes
               * from step.aiTextDisplay ?? step.aiText. The kernel now
               * emits the canonical pair directly so we read from
               * `aiTextDisplay` here and let the downstream followUpStep
               * constructor copy it through verbatim. `turnRes.text` is
               * still present (legacy) but is no longer the field the
               * animation hook synchronises with. */
              return {
                needsFollowUp: true,
                followUpText: turnRes.aiTextDisplay ?? turnRes.aiText ?? turnRes.text,
                followUpType: "negotiation",
                conversationDone: turnRes.terminal,
                moveTag: turnRes.moveTag,
              };
            } catch (err) {
              console.warn("[interview] kernel turn failed", err);
              return null;
            }
          })();
          /* Skip legacy fetchFollowUp this turn — kernel owns it. */
        } else { pendingFollowUpRef.current = fetchFollowUp({
          question: currentStepObj!.aiText,
          answer: answerText,
          type: interviewType,
          role: targetRole || user?.targetRole || "senior role",
          jobDescription: jobDescription || undefined,
          company: targetCompany || user?.targetCompany,
          currentCity: currentCity || undefined,
          jobCity: jobCity || undefined,
          followUpDepth: depth,
          adaptiveDifficulty,
          previousFollowUps: recentFollowUps.length > 0 ? recentFollowUps : undefined,
          persona: isPanelInterview ? currentStepObj?.persona : undefined,
          conversationHistory: conversationHistory || undefined,
          negotiationPhase: salaryPhase,
          questionIndex: isSalaryNegType ? currentQuestionIdx : undefined,
          totalQuestions: isSalaryNegType ? totalQs : undefined,
          resumeTopSkills: followUpAiProfile?.topSkills,
          resumeProjects: followUpResumeProjects.length ? followUpResumeProjects : undefined,
          // Wave-8: campus-placement-only live BGV cross-check signal.
          // Engine passes the whole experiences list; follow-up.ts gates
          // the prompt-block on `type === "campus-placement"` so we
          // don't bloat behavioural / salary-neg prompts.
          resumeExperiences: interviewType === "campus-placement" && Array.isArray(followUpAiProfile?.experiences)
            ? (followUpAiProfile!.experiences as Array<{ title?: string; company?: string; period?: string; bullets?: string[] }>)
            : undefined,
          initialOfferText,
          negotiationFacts,
          negotiationStyle: negotiationStyle || undefined,
          negotiationBand: negotiationBandRef.current || undefined,
          industry: user?.industry || undefined,
          highestOfferMade: highestOfferRef.current > 0 ? highestOfferRef.current : undefined,
          /* Anchor priority for the candidate's stated ask:
             1. user's explicit pre-set target (onboarding setSalary)
             2. extracted highest counter from the live transcript
                (extractNegotiationFacts → candidateCounter, e.g. "₹21 LPA")
             Without (2) the LLM was free to echo whatever number it
             pulled from the latest answer, producing flips like
             "I heard ₹20 from you" then "I heard ₹21 from you" on
             consecutive turns. Locking to a canonical extracted
             value also lets the speaker-confusion validator in
             follow-up.ts patch mistakes. */
          candidateTarget:
            targetSalary ||
            (() => {
              const c = negotiationFacts?.candidateCounter;
              if (!c) return undefined;
              const n = parseFloat(c.replace(/[^\d.]/g, ""));
              return Number.isFinite(n) && n > 0 ? n : undefined;
            })(),
          negotiationScenario: negotiationScenario !== "standard" ? negotiationScenario : undefined,
          // Persona trait flavor — gives the LLM a one-line cue so
          // back-to-back sessions feel like meeting a different
          // hiring manager. Deterministic by interviewer name.
          personaTrait: isSalaryNegType ? getPersonaTrait(interviewerName) : undefined,
          candidateState,
          previousMentions,
          starGap: starGapHint,
          weHeavy: weHeavyHint,
          vagueness: behaviouralSignals?.vagueness,
          crispness: behaviouralSignals?.crispness,
          selfAwarenessShown: behaviouralSignals?.selfAwarenessShown,
          defensiveness: behaviouralSignals?.defensiveness,
        }); }
      } else {
        pendingFollowUpRef.current = null;
      }
    } else {
      pendingFollowUpRef.current = null;
    }

    if (!isLastStep) {
      // Reset follow-up depth when advancing to a new original question
      const nextStep = interviewScript[currentStep + 1];
      if (nextStep?.type === "question" || nextStep?.type === "intro" || nextStep?.type === "closing") {
        followUpDepthRef.current = 0;
      }
      /* Phase MUST flip to "thinking" in the same batched update as
         setCurrentStep — otherwise the new step renders for one frame
         against the old "listening" phase, which renders the next
         question STATICALLY before the typewriter starts. The user-
         facing symptom was a "question briefly visible → vanishes →
         re-types" flash. React 18 batches both setStates here so the
         next render has both new step AND phase=thinking — the typewriter
         then takes over cleanly when the speak() effect fires. */
      const nextIdx = currentStep + 1;
      /* Sentiment-aware closing for general (non-negotiation) interviews.
         The static role closings are uniformly cheerful ("Great. That's
         all I had…"), which reads as oblivious when the candidate just
         struggled — short answers, skips, "I don't know" responses.
         Swap in a warmer, lower-key closing in those cases. We only
         swap when the closing is still the static default (no runtime
         follow-up replacement / no LLM-personalized closing). */
      if (
        nextStep?.type === "closing" &&
        interviewType !== "salary-negotiation" &&
        !nextStep.scoreNote?.includes("Dynamic follow-up")
      ) {
        const recentUserTurns = [
          ...transcript.filter(t => t.speaker === "user").slice(-1).map(t => t.text || ""),
          answerText || "",
        ].filter(Boolean);
        if (shouldUseEmpatheticClosing(recentUserTurns, answerQualityRef.current.slice(-3))) {
          const empatheticClosing = "Thanks for sticking with it — these conversations aren't easy. Generating your detailed report now.";
          if (empatheticClosing !== nextStep.aiText) {
            setInterviewScript(prev => {
              const updated = [...prev];
              updated[nextIdx] = { ...updated[nextIdx], aiText: empatheticClosing };
              return updated;
            });
          }
        }
      }
      /* PDF#43 architectural fix (2026-05-22) — kernel-driven slot
       * pre-insertion for salary-negotiation.
       *
       * THE STRUCTURAL PROBLEM: the 3-step salary-neg script
       * [intro, question, closing] has exactly one "question" slot. The
       * NegotiationKernel needs N turns (discovery → counter → close).
       * After the candidate's first negotiation answer, currentStep
       * advances to the static closing slot (waitForUser:false) — and
       * every kernel response after that has to be retrofitted into a
       * slot that doesn't structurally exist. The historical fix was a
       * race-fix that inserted before the closing AND mutated the
       * closure-captured `step` object (waitForUser/aiText/type) so the
       * engine wouldn't auto-end. That's three layers of patchwork
       * fighting the data model.
       *
       * THE ARCHITECTURAL FIX: before currentStep advances onto the
       * static closing slot during an active (non-terminal) negotiation,
       * INSERT a fresh "question" slot at currentStep+1. The engine
       * lands in a slot that is structurally correct (waitForUser:true,
       * type:"question") — the existing follow-up resolution path
       * (line 1581 branch) replaces its aiText with the kernel response
       * via the normal nextQuestionIdx === currentStep flow. No closure
       * mutations needed, no race-fix-against-closing needed.
       *
       * The placeholder's aiText is a safe generic probe so that on the
       * rare path where the kernel turn returns null (network drop,
       * 5xx, parse failure) the bot says something coherent instead of
       * the placeholder string leaking through.
       *
       * When the kernel later signals serverSaysDone, the existing path
       * at line ~1607 rewrites the current slot into a closing
       * (waitForUser:false) AND truncates everything after — so the
       * inserted placeholders don't cause the interview to run forever.
       *
       * Pre-insertion is gated on the kernel's own terminal phase so
       * that AFTER a terminal turn (where the closing has been
       * rewritten) we advance normally. */
      if (
        isSalaryNegType &&
        !isNegotiationKernelTerminal() &&
        nextStep?.type === "closing"
      ) {
        /* PDF#46 (2026-05-26) — STRUCTURAL FIX for the placeholder
         * leak.
         *
         * The two prior attempts at this slot both failed because
         * they baked user-visible content into the structural slot:
         *
         *   PDF#43 (silent wait — "Let me take a look on my side,
         *           one moment"): left the candidate staring at
         *           nothing if the kernel reply dropped (PDF#47
         *           reproduced this end-of-session).
         *   PDF#47 (fake question — "While I check the structure
         *           on my side, what's been guiding the number"):
         *           when the kernel reply dropped, that hardcoded
         *           question shipped verbatim AS the recruiter's
         *           next turn, multiple times in a row, because
         *           every salary-neg AI turn pre-inserts this slot.
         *           PDF#46 caught it asked four times character-
         *           identical to four different user answers.
         *
         * Both shapes are bandaids on the same architectural
         * mistake: a structural slot (the kernel needs space to
         * land) is sharing its representation with a user-facing
         * slot (the kernel has filled the space with real prose).
         *
         * The clean cut: `pendingKernel: true`. The slot exists so
         * the engine has somewhere to advance into, but it carries
         * NO user-facing text. The engine's main flow effect treats
         * pendingKernel as a hold signal — no TTS fires, no
         * transcript append, no mic prompt. When the kernel-resolve
         * path at line ~1619 replaces the slot with a real
         * followUpStep (which doesn't carry the flag), the effect's
         * step-identity dep flips and the engine proceeds through
         * the normal speaking → listening flow.
         *
         * If the kernel reply legitimately never arrives, the
         * holding-state is still preferable to shipping a fake
         * question: the user sees "thinking" — true; the user
         * doesn't see a fabricated recruiter question — also true.
         * A future surface can layer a retry/error UI on top of
         * sustained pendingKernel, but the lying-recruiter failure
         * mode is closed by this slot alone. */
        setInterviewScript(prev => {
          const placeholder: InterviewStep = {
            type: "question",
            aiText: "",
            aiTextDisplay: "",
            thinkingDuration: 300,
            speakingDuration: 4500,
            waitForUser: true,
            pendingKernel: true,
            scoreNote: "Negotiation kernel placeholder — invisible until kernel resolve",
          };
          return [...prev.slice(0, nextIdx), placeholder, ...prev.slice(nextIdx)];
        });
      }
      setPhase("thinking");
      setCurrentStep(currentStep + 1);
    } else {
      setPhase("done");
    }
    // handleNextQuestion is the central transition function. Many of the values flagged (aiVoiceEnabled / currentCity / interviewerGender / isPanelInterview / jobCity / jobDescription / negotiationScenario / negotiationStyle / targetSalary / toast / transcript) are read at *fire-time* from latest closures inside the callback body — adding them as deps would re-create the function on every keystroke and re-bind every effect that depends on it. The values we DO bind to are the minimum trigger set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, answerTimer, elapsed, interviewScript, interviewType, user, currentTranscript]);

  // Keep ref in sync for answer timer auto-advance
  // handleNextRef is a ref; React doesn't warn that it's missing because writing to a ref is the explicit out for stale-closure problems.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleNextRef.current = handleNextQuestion; }, [handleNextQuestion]);

  /* ─── Skip current question ───
     Bypasses the empty-answer guard in handleNextQuestion (which is
     correct for a regular submission but blocks legitimate skips).
     Marks the answer with a sentinel "[SKIPPED]" + reason so the
     evaluator definitely classifies the verdict as "skipped" and the
     report scores it 0/100 with a clear "Skipped" label. The exemplar
     and restructured-answer content still get generated for that Q —
     a skipped question becomes a free coaching surface in the report
     ("here's what an L4 candidate would have said"). */
  const handleSkipQuestion = useCallback((reason: string) => {
    if (phase !== "listening") return;
    if (skipsUsed >= skipBudget) {
      toast(
        skipBudget === 0
          ? "Skips aren't allowed in this interview type — every turn matters."
          : `You've used your ${skipBudget} skip${skipBudget === 1 ? "" : "s"}. Work through this one, even partially.`,
        "info",
      );
      return;
    }
    try { ttsCancelRef.current?.(); } catch { /* ignore TTS cleanup */ }
    try { recognitionRef.current?.stop(); } catch { /* ignore STT cleanup */ }

    const sentinel = `[SKIPPED — reason: ${reason || "no_reason"}]`;
    const skippedEntry = { speaker: "user" as const, text: sentinel, time: formatTime(elapsed) };
    setTranscript((prev) => [...prev, skippedEntry]);
    setCurrentTranscript("");
    setSkipsUsed((n) => n + 1);
    // A skip is not a real answer — drop any stale tip from the previous
    // turn so it doesn't read as coaching on the skipped question.
    setMicroFeedback(null);
    // Mark the next AI turn so its thinking phrase acknowledges the skip
    // ("Noted — moving on") instead of reacting to a non-answer.
    skipPendingAckRef.current = true;

    // Advance to next step. We don't go through the follow-up pipeline
    // (skipped questions don't deserve probes). Mirrors the no-followup
    // path in handleNextQuestion's late branches.
    advancingRef.current = true;
    const nextIdx = currentStep + 1;
    if (nextIdx >= interviewScript.length) {
      setPhase("done");
      advancingRef.current = false;
      return;
    }
    setCurrentStep(nextIdx);
    setPhase("thinking");
    advancingRef.current = false;
    // setCurrentStep / setPhase / setTranscript / setCurrentTranscript / setSkipsUsed
    // are React useState setters — stable references, never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, skipsUsed, skipBudget, currentStep, interviewScript, elapsed, toast]);

  // Skip AI speaking. Hard-mute first so already-buffered Cartesia PCM
  // and pre-rendered Azure audio actually stop within the same frame —
  // the regular cancel() doesn't yank fast enough on those providers
  // and users hear 1-2s of voice after pressing Space.
  const skipSpeaking = useCallback(() => {
    if (phase !== "speaking") return;
    hardMuteTTS();
    ttsCancelRef.current?.();
    ttsCancelRef.current = null;
    setIsRecording(false);
    const currentStepObj = interviewScript[currentStep];
    if (currentStepObj?.waitForUser) {
      setPhase("listening");
      const nextStep = interviewScript[currentStep + 1];
      if (nextStep && aiVoiceEnabled) {
        prefetchTTS(nextStep.aiText, interviewerGender);
      }
    } else {
      setTimeout(() => setPhase("done"), 1000);
    }
    // interviewerGender is read inside the prefetchTTS branch but is derived from interviewerName which is derived from session-stable inputs; recomputing this callback when gender changes is unnecessary churn since gender effectively never changes within a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, interviewScript, aiVoiceEnabled]);

  /* Retake the just-sent answer.
     Real interviews have an "actually let me redo that" moment —
     candidate hits Send, immediately realizes the answer landed badly,
     wants to start over before the interviewer reacts. We give them a
     window during phase=thinking before the follow-up locks in:
       1. Cancel the pending follow-up fetch (so we don't get a probe
          based on the discarded answer)
       2. Strip the last user message from the transcript
       3. Clear currentTranscript
       4. Revert phase to listening on the same question
     Engine state stays consistent — it's as if the user never sent. */
  const retakeLastAnswer = useCallback(() => {
    if (phase !== "thinking") return;
    if (interviewEndedRef.current) return;
    if (pendingFollowUpRef.current) {
      pendingFollowUpRef.current = null;
    }
    setTranscript(prev => {
      // Drop the last user message + any AI placeholder rendered after it
      const lastUserIdx = (() => {
        for (let i = prev.length - 1; i >= 0; i--) if (prev[i].speaker === "user") return i;
        return -1;
      })();
      if (lastUserIdx === -1) return prev;
      return prev.slice(0, lastUserIdx);
    });
    setCurrentTranscript("");
    setPhase("listening");
    // Analytics fire happens at the call site (Interview.tsx) where
    // posthog is already imported, to keep this engine helper free of
    // browser-only deps.
  }, [phase]);

  // Keyboard shortcuts.
  //   speaking: Enter / Space → skip AI speech (interrupt)
  //   listening + has transcript: Space → submit answer
  //   listening + empty transcript: Space → explicit STT restart
  //                                 ("I'm ready, listen now" trigger)
  //   listening: Enter → submit (legacy, even with empty answer
  //                              hits the empty-guard toast)
  //   done: Enter → close out the interview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") {
        if (e.key === "Enter" && !e.shiftKey && phase === "listening") {
          e.preventDefault();
          handleNextQuestion();
        }
        return;
      }
      if (phase === "listening") {
        if (e.key === "Enter") {
          handleNextQuestion();
        } else if (e.key === " ") {
          e.preventDefault();
          // If the user has already started speaking → Space submits.
          // If nothing yet → Space (re)starts STT capture and toasts.
          if (currentTranscript.trim().length > 0) {
            handleNextQuestion();
          } else {
            restartListening();
          }
        }
      } else if ((e.key === "Enter" || e.key === " ") && phase === "speaking") {
        e.preventDefault();
        skipSpeaking();
      } else if (e.key === "Enter" && phase === "done") {
        handleEnd();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // handleEnd is captured at fire-time inside the keydown handler; adding it as a dep would re-bind the listener whenever handleEnd's identity changes (which is on every transcript edit) and was explicitly avoided.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, handleNextQuestion, skipSpeaking, aiVoiceEnabled, restartListening, currentTranscript]);

  // Update document.title with current phase
  useEffect(() => {
    const phaseLabel = phase === "thinking" ? "Preparing" : phase === "speaking" ? "AI Speaking" : phase === "listening" ? "Your Turn" : "Complete";
    document.title = `${phaseLabel} — HireStepX Interview`;
    return () => { document.title = "HireStepX"; };
  }, [phase]);

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (isNearBottom) {
        const lastChild = el.lastElementChild;
        if (lastChild) lastChild.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [transcript]);

  // Handle end interview
  const handleEnd = useCallback(async () => {
    if (evaluating || interviewEndedRef.current) return;
    interviewEndedRef.current = true;
    setPhase("done");
    ttsCancelRef.current?.();
    ttsCancelRef.current = null;
    pendingFollowUpRef.current = null; // Release orphaned follow-up promises
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setAiVoiceEnabled(false);
    setIsMuted(true);
    /* Clear any stale saveWarning from the question-generation phase
       before flipping into eval. User-reported failure: a "Question
       generation failed: server error 500. Tap retry for personalized
       questions." banner from the start of the session was leaking
       into the report-loading screen, telling the user something is
       wrong with their REPORT when in reality it was the OLD
       question-gen error from before they even started answering.
       The evaluation flow itself sets saveWarning fresh if the eval
       run produces one (network error, fallback, etc.), so clearing
       here can't lose any meaningful state. */
    setSaveWarning("");
    setEvaluating(true);

    const sessionId = liveSessionIdRef.current;
    setLastSessionId(sessionId);

    // Global escape hatch — no matter what hangs below (eval, auth refresh,
    // supabase save, service-worker intercept), navigate to the session
    // detail after 35s so the user never stares at a dead spinner. The
    // rich v6 report will regenerate server-side when SessionReportView
    // mounts, and partial local saves survive page navigation.
    const escapeHatch = setTimeout(() => {
      console.warn("[interview] handleEnd exceeded 35s — forcing navigation to session detail");
      // replace not push — same reasoning as the success path: back-button
      // from /session/[id] must not land on /interview.
      try { router.replace(`/session/${sessionId}`); } catch { /* best effort */ }
      setEvaluating(false);
    }, 35_000);
    let score = 0;
    let aiFeedback = "";
    let skillScores: Record<string, number> | null = null;

    // Flush any in-progress answer before evaluation
    const pendingAnswer = currentTranscript.trim();
    let evalTranscript = [...transcript];
    if (pendingAnswer && pendingAnswer.length > 0) {
      const flushedEntry = { speaker: "user" as const, text: pendingAnswer, time: formatTime(elapsed) };
      setTranscript(prev => [...prev, flushedEntry]);
      evalTranscript = [...evalTranscript, flushedEntry];
      setCurrentTranscript("");
    }

    // Evaluation timeout controller — shortened from 40s to 18s.
    // The *rich* per-question evaluation now runs via /api/evaluate-session when
    // the user opens their report, so this quick pre-save eval only needs to
    // produce a usable score. Fallback scores are honest and the user lands
    // on the report faster; SessionReportView computes the full v6 report
    // there with proper caching.
    const evalAbort = new AbortController();
    const safetyTimer = setTimeout(() => {
      console.warn("[interview] handleEnd evaluation timeout (18s) — aborting fetch, using fallback scores");
      evalAbort.abort();
    }, 18_000);

    try {
    /* End-of-session evaluation — see ./_evaluation-flow.ts. The flow is
       pure async (LLM race + fallback merge + offline retry queueing); it
       never throws and never calls setState. We apply its side-effect
       signals here so React state stays inside the engine. */
    const outcome = await runEvaluationFlow({
      evalTranscript,
      currentStep,
      scriptLength: interviewScript.length,
      difficulty: interviewDifficulty,
      elapsed,
      interviewType,
      originalQuestions: interviewScript
        .filter(s => s.type === "question" || s.type === "follow-up")
        .map(s => s.aiText),
      role: targetRole || user?.targetRole || "the role",
      company: targetCompany || user?.targetCompany,
      resumeText: shouldUseResume ? user?.resumeText : undefined,
      jobDescription: jobDescription || undefined,
      negotiationBand: negotiationBandRef.current,
      targetSalary,
      highestOfferMade: highestOfferRef.current,
      negotiationStyle: negotiationStyle || undefined,
      interviewerName,
      interviewerPersonality: personality,
      evalAbort,
      sessionId,
    });

    score = outcome.score;
    aiFeedback = outcome.aiFeedback;
    skillScores = outcome.skillScores;
    const idealAnswers = outcome.idealAnswers;
    const starAnalysis = outcome.starAnalysis;
    const strengths = outcome.strengths;
    const improvements = outcome.improvements;
    const nextSteps = outcome.nextSteps;

    if (outcome.usedFallback) setUsedFallbackScore(true);
    if (outcome.evalTimedOut) setEvalTimedOut(true);
    if (outcome.saveWarning) setSaveWarning(outcome.saveWarning);
    if (outcome.toastMessage) toast(outcome.toastMessage, "info");

    // Refresh auth token before saving results — capped so a hung network
    // request can't trap the user on the loading spinner.
    try {
      const { getSupabase } = await import("./supabase");
      const client = await getSupabase();
      const refreshResult = await Promise.race([
        client.auth.refreshSession(),
        new Promise<{ error: { message: string } }>((resolve) => setTimeout(() => resolve({ error: { message: "refresh timeout (3s)" } }), 3_000)),
      ]);
      if (refreshResult.error) console.warn("[interview] Auth refresh failed:", refreshResult.error.message);
    } catch { /* best effort */ }

    let localOk = false;
    let cloudOk = false;

    /* Kernel-aware metrics for salary-negotiation sessions. Pure
       client-side derivation from the accumulated move history + the
       kernel's final state. Only populated when the session actually
       ran through the kernel (i.e. moves accumulated). Persisted via
       the savePayload so the report layer can render the Negotiation
       Quality card without re-deriving. */
    let negotiationMetrics: {
      outcome: "accepted" | "walked-away" | "stalemate" | "in-progress";
      anchorTurn: number | null;
      leverDiversity: number;
      lpaGained: number;
      lpaPerTurn: number;
      bandTraversal: number | null;
      overBandViolation: boolean;
      totalTurns: number;
      score: number;
      vossTacticsUsed: ReadonlyArray<string>;
      infoAsked: ReadonlyArray<string>;
      walkAwayReturned: boolean;
      hardBandCap: boolean;
      marketMode: "soft" | "neutral" | "hot";
    } | undefined = undefined;
    try {
      if (
        interviewType === "salary-negotiation" &&
        kernelMovesRef.current.length > 0 &&
        negotiationKernelStateRef.current
      ) {
        const finalState = JSON.parse(negotiationKernelStateRef.current);
        const { computeNegotiationMetrics, scoreNegotiationBehaviour } = await import(
          "../server-handlers/_negotiation-metrics"
        );
        const m = computeNegotiationMetrics({
          finalState,
          moves: kernelMovesRef.current as Parameters<typeof computeNegotiationMetrics>[0]["moves"],
        });
        negotiationMetrics = { ...m, score: scoreNegotiationBehaviour(m) };
      }
    } catch (e) {
      console.warn("[interview] negotiation metrics derivation failed (non-fatal):", e);
    }

    // Build the payload once so we can both attempt the save AND enqueue
    // it for retry if the cloud write fails. Sharing the literal across
    // both paths means the retry is byte-identical to what the user just
    // saw fail — no drift between online success and offline retry.
    const savePayload = {
      id: sessionId,
      date: new Date().toISOString(),
      type: interviewType,
      difficulty: interviewDifficulty,
      focus: interviewFocus,
      duration: elapsed,
      score,
      questions: totalQuestions,
      transcript: evalTranscript,
      ai_feedback: aiFeedback,
      skill_scores: skillScores,
      ideal_answers: idealAnswers.length > 0 ? idealAnswers : undefined,
      starAnalysis,
      strengths,
      improvements,
      nextSteps,
      resumeUsed: !!user?.resumeText,
      // Frozen at engine init — see resumeVersionIdRef above for why.
      resumeVersionId: resumeVersionIdRef.current,
      jobDescription: jobDescription || undefined,
      jdAnalysis: jdAnalysisData || null,
      targetRole: targetRole || user?.targetRole || undefined,
      targetCompany: targetCompany || user?.targetCompany || undefined,
      negotiationMetrics,
    };
    try {
      // Race the entire save against a 10s ceiling — Supabase PATCH on slow
      // networks has been observed to hang indefinitely. Fallback to local-only
      // save so the user still lands on /session/{id} with their transcript.
      const saveResult = await Promise.race([
        saveSessionResult(savePayload, user?.id),
        new Promise<{ localOk: boolean; cloudOk: boolean; streakReward?: { milestone: number; bonusCredits: number } | null }>((resolve) => setTimeout(() => {
          console.warn("[interview] saveSessionResult timeout (10s) — proceeding with whatever landed");
          resolve({ localOk: true, cloudOk: false, streakReward: null });
        }, 10_000)),
      ]);
      localOk = saveResult.localOk;
      cloudOk = saveResult.cloudOk;
      // Server-side awarded a streak milestone — celebrate it. This is cheap
      // dopamine that costs us nothing and is one of the stronger retention
      // levers we have (free users especially notice the bonus-session drop).
      if (saveResult.streakReward) {
        const { milestone, bonusCredits } = saveResult.streakReward;
        track("streak_reward_granted", { milestone, bonusCredits });
        // Delay slightly so it lands after the "Session saved" toast below.
        setTimeout(() => {
          toast(`${milestone}-day streak! +${bonusCredits} bonus session added to your account.`, "success");
        }, 1200);
      }
    } catch (saveErr) {
      console.error("[interview] saveSessionResult threw:", saveErr);
      // Even when the in-line save throws, enqueue for background retry
      // so we don't lose the session.
      if (user?.id) {
        const errMsg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        void import("./saveRetryQueue").then(({ enqueueSave }) =>
          enqueueSave(savePayload, user.id, errMsg)
        ).catch(() => { /* IDB unavailable */ });
      }
    }

    if (!cloudOk && localOk) {
      setSaveWarning("Session saved locally but could not sync to cloud.");
      toast("Session saved locally — will sync when online.", "info");
      // Enqueue the cloud-save for background retry. We have a userId
      // (cloud was attempted), the payload is intact, and the retry
      // queue handles backoff + 5-attempt cap + 14-day pruning.
      // Fire-and-forget — don't block the route to /session/{id}.
      if (user?.id) {
        void import("./saveRetryQueue").then(({ enqueueSave }) =>
          enqueueSave(savePayload, user.id, "cloud save returned cloudOk=false")
        ).catch(() => { /* IDB unavailable — local-only is still saved */ });
      }
    } else if (!localOk && !cloudOk) {
      try {
        await saveToIDB(`hirestepx_unsaved_${sessionId}`, {
          id: sessionId, date: new Date().toISOString(), type: interviewType,
          difficulty: interviewDifficulty, focus: interviewFocus, duration: elapsed,
          score, questions: totalQuestions, transcript: evalTranscript, ai_feedback: aiFeedback,
          skill_scores: skillScores,
        });
        setSaveWarning("Session saved to backup storage. Will sync when connection restores.");
        toast("Saved to backup — will sync when online.", "info");
      } catch {
        setSaveWarning("Warning: Session could not be saved. Please check your connection.");
        toast("Could not save session. Check your connection.", "error");
      }
    } else {
      toast("Session saved successfully!", "success");
    }

    // Completion haptic — two-pulse pattern tells mobile users the session
    // is officially done even if they're not looking at the screen.
    try {
      const { haptic } = await import("./haptics");
      haptic.completion();
    } catch { /* no-op if haptics module missing */ }

    track("session_complete", {
      type: interviewType,
      score,
      difficulty: interviewDifficulty,
      duration: elapsed,
      questions: totalQuestions,
      usedFallback: !!(usedFallbackScore || evalTimedOut),
      hasSkillScores: !!skillScores,
      hasFeedback: !!aiFeedback,
    });
    track("interview_completed", { type: interviewType, questionsAnswered: currentStep, duration: elapsed });
    // PostHog: per-focus completion signal — terminal node of the
    // selected → started → completed funnel. Score / duration / question
    // count let the dashboard build "Pro plan engagement by focus" or
    // "fallback rate by focus" insights without joining elsewhere.
    captureClientEvent("interview_session_completed", {
      focus: interviewType,
      score,
      difficulty: interviewDifficulty,
      duration_seconds: elapsed,
      questions: totalQuestions,
      questions_answered: currentStep,
      used_fallback: !!(usedFallbackScore || evalTimedOut),
      has_skill_scores: !!skillScores,
      has_feedback: !!aiFeedback,
    });

    try { localStorage.removeItem(draftKey); } catch { /* expected: localStorage cleanup is non-critical */ }
    try { await deleteFromIDB(draftKey); } catch { /* expected: IDB cleanup is non-critical */ }
    try {
      // /api/sessions/save already atomically appends the timestamp and sets
      // has_completed_onboarding=true server-side. We still call updateUser
      // so the in-memory User object reflects the new timestamp immediately
      // (it's an optimistic setState, no blocking network dependency).
      // The request itself is non-awaited — any server round-trip is already
      // done via the save-session call above.
      const timestamps = user?.practiceTimestamps || [];
      const updates: Partial<Parameters<typeof updateUser>[0]> = {
        practiceTimestamps: [...timestamps, new Date().toISOString()],
      };
      if (!user?.hasCompletedOnboarding) updates.hasCompletedOnboarding = true;
      void updateUser(updates).catch(err => console.warn("[interview] updateUser post-session:", err));
    } catch (err) { console.error("[interview] Profile update failed:", err); }

    if (!localOk || !cloudOk) {
      await new Promise(r => setTimeout(r, 2500));
    }

    try {
      // router.replace (not push) — pressing the browser back button from
      // /session/[id] should NOT land back on /interview, because the
      // engine there auto-starts a fresh session when no draft exists,
      // which surprised users (QA bug 22 part B). Replacing the history
      // entry means back from the score page lands on whatever came
      // before /interview (typically /interview-setup or /dashboard).
      router.replace(`/session/${sessionId}`);
    } catch (navErr) {
      console.warn("[interview] Navigation failed:", navErr);
      toast("Session saved! Navigate to dashboard to view results.", "info");
    }

    } catch (fatalErr) {
      console.error("[interview] handleEnd fatal error:", fatalErr);
      toast("Something went wrong saving your session. Please check your dashboard.", "error");
      try { router.push("/dashboard"); } catch { /* expected: navigation may fail if component unmounted */ }
    } finally {
      clearTimeout(safetyTimer);
      clearTimeout(escapeHatch);
      setEvaluating(false);
    }
    // handleEnd reads many derived values (draftKey/evalTimedOut/evaluating/interviewScript/jdAnalysisData/jobDescription/negotiationStyle/shouldUseResume/targetRole/targetSalary/toast/usedFallbackScore) at fire-time. It runs exactly once per session — re-creating the callback on each of these would only churn ref identity without changing behavior since handleEndRef holds the latest version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, elapsed, interviewType, interviewDifficulty, interviewFocus, totalQuestions, user, updateUser, currentStep, interviewScript.length, transcript, currentTranscript]);

  // Auto-finalize once we hit the done phase. The closing step now has
  // waitForUser: false so the engine reaches "done" automatically — fire
  // handleEnd so the user never has to press a button or sit on a dead
  // screen. Reduced from 600ms → 100ms per user feedback: the
  // intermediate "View Feedback" CompletionCard was visible during
  // that window and confused users (the engine was already moving on,
  // but they saw a button-with-instructions UI). Near-zero delay
  // means the EvaluatingOverlay takes over almost immediately.
  useEffect(() => {
    if (phase !== "done") return;
    if (interviewEndedRef.current) return;
    const t = setTimeout(() => {
      if (!interviewEndedRef.current) handleEnd();
    }, 100);
    return () => clearTimeout(t);
  }, [phase, handleEnd]);

  // ─── Live negotiation state (derived from transcript for dashboard) ───
  const liveNegotiationState = useMemo(() => {
    if (interviewType !== "salary-negotiation") return null;
    const facts = extractNegotiationFacts(transcript as { speaker: "ai" | "user"; text: string; time: string }[]);
    const questionSteps = interviewScript.filter(s => s.type === "question" || s.type === "follow-up");
    const currentQuestionIdx = interviewScript.slice(0, currentStep + 1).filter(s => s.type === "question" || s.type === "follow-up").length;
    const totalQs = questionSteps.length;
    const negotiationPhases = ["offer-reaction", "probe-expectations", "counter-offer", "benefits-discussion", "closing-pressure", "closing"];
    const ratio = totalQs > 1 ? (currentQuestionIdx - 1) / (totalQs - 1) : 0;
    const phaseIdx = Math.min(Math.round(ratio * (negotiationPhases.length - 1)), negotiationPhases.length - 1);
    const phase = negotiationPhases[phaseIdx] || "offer-reaction";
    // Leverage score: 0-100 based on tactics used
    let leverage = 30; // baseline
    if (facts.hasCompetingOffers) leverage += 20;
    if (facts.mentionedBATNA) leverage += 15;
    if (facts.candidateCounter) leverage += 15;
    if (facts.usedTacticalSilence) leverage += 10;
    if (facts.expressedSurprise) leverage += 5;
    if (facts.deflectedNumbers) leverage += 5;
    if (facts.acceptedImmediately) leverage -= 25;
    if (facts.rejectedOutright) leverage -= 10;
    leverage = Math.max(0, Math.min(100, leverage));
    // Topics checklist
    const allPossibleTopics = ["equity/ESOPs", "joining bonus", "remote/flexibility", "health insurance", "learning budget", "career growth", "notice period/joining", "relocation", "market data/benchmarks", "variable pay structure", "title/level"];
    const topicsCovered = allPossibleTopics.map(t => ({ topic: t, covered: facts.topicsRaised.includes(t) }));
    return { facts, phase, leverage, topicsCovered, phaseIdx, totalPhases: negotiationPhases.length };
  }, [interviewType, transcript, currentStep, interviewScript]);

  // ─── Voice confidence analysis via Web Audio API ───
  const voiceConfidenceRef = useRef<{ score: number; volume: number; variability: number } | null>(null);
  const audioAnalyserRef = useRef<{ analyser: AnalyserNode; ctx: AudioContext; source: MediaStreamAudioSourceNode } | null>(null);
  const volumeSamplesRef = useRef<number[]>([]);

  // Set up audio analyser when mic stream is available and we're in listening phase
  useEffect(() => {
    if (phase !== "listening" || !micStreamRef.current || interviewType !== "salary-negotiation") {
      return;
    }
    // Don't create duplicate analysers
    if (audioAnalyserRef.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(micStreamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      audioAnalyserRef.current = { analyser, ctx, source };
      volumeSamplesRef.current = [];

      // Sample volume at 10Hz
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const interval = setInterval(() => {
        if (!audioAnalyserRef.current) { clearInterval(interval); return; }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
        volumeSamplesRef.current.push(avg);
        // Keep last 100 samples (10 seconds)
        if (volumeSamplesRef.current.length > 100) volumeSamplesRef.current.shift();
        // Compute confidence
        const samples = volumeSamplesRef.current;
        if (samples.length >= 5) {
          const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
          const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
          const stdDev = Math.sqrt(variance);
          // Volume score: louder = more confident (normalize 0-100)
          const volumeScore = Math.min(100, Math.round((mean / 128) * 100));
          // Variability: lower stdDev relative to mean = more steady = more confident
          const coefVar = mean > 0 ? stdDev / mean : 1;
          const steadinessScore = Math.max(0, Math.min(100, Math.round((1 - coefVar) * 100)));
          // Combined confidence
          const confidence = Math.round(volumeScore * 0.6 + steadinessScore * 0.4);
          voiceConfidenceRef.current = { score: Math.max(0, Math.min(100, confidence)), volume: volumeScore, variability: steadinessScore };
        }
      }, 100);

      return () => {
        clearInterval(interval);
        try { source.disconnect(); ctx.close(); } catch { /* cleanup */ }
        audioAnalyserRef.current = null;
      };
    } catch { /* Web Audio API not available */ return undefined; }
  }, [phase, interviewType]);

  // Live speech metrics (computed from current transcript)
  const liveMetrics = useMemo(() => {
    if (!currentTranscript || currentTranscript.length < 10) return null;
    const words = currentTranscript.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const minutes = Math.max(0.1, answerTimer / 60);
    const wpm = Math.round(wordCount / minutes);

    // Count filler words
    let fillerCount = 0;
    const text = currentTranscript.toLowerCase();
    const fillerWords = ["um", "uh", "like", "you know", "basically", "actually", "literally", "i mean", "kind of", "sort of"];
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) fillerCount += matches.length;
    }

    // Answer length guidance based on timer
    let lengthGuidance: string | null = null;
    if (answerTimer < 30 && wordCount < 20) {
      lengthGuidance = "Keep going — aim for 60-90 seconds";
    } else if (answerTimer >= 30 && answerTimer < 60 && wordCount < 40) {
      lengthGuidance = "Good start — add more detail";
    } else if (answerTimer >= 60 && answerTimer <= 90) {
      lengthGuidance = "Great length — wrap up with your result";
    } else if (answerTimer > 100) {
      lengthGuidance = "Consider wrapping up";
    }

    // Live coaching signals — surface "I" vs "we" framing and specificity
    // (numbers/names/dates). Helps candidates self-correct mid-answer instead
    // of waiting for the report. Research-backed: real-time biofeedback
    // outperforms post-game review for behavior change.
    const iCount = (text.match(/\bi\b/gi) || []).length;
    const weCount = (text.match(/\bwe\b/gi) || []).length;
    const ownership: "i-led" | "balanced" | "we-heavy" | null =
      (iCount + weCount) < 2 ? null
      : iCount >= weCount * 1.2 ? "i-led"
      : weCount > iCount * 1.5 ? "we-heavy"
      : "balanced";
    const specificityHits =
      (currentTranscript.match(/\d+%|\d+x|₹[\d,]+|\$[\d,]+|\d+\s*(users|customers|months|days|people|team|engineers|percent|crore|lakh|lpa|qps|ms|gb|tb)/gi) || []).length;
    let specificityHint: string | null = null;
    if (wordCount >= 40 && specificityHits === 0) {
      specificityHint = "Add a number — metric, count, or %";
    }

    return { wordCount, wpm, fillerCount, lengthGuidance, ownership, specificityHits, specificityHint };
  }, [currentTranscript, answerTimer]);

  const displayRole = targetRole || user?.targetRole || interviewType.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const displayCompany = targetCompany || user?.targetCompany || "";
  const displayFocus = interviewFocus !== "general" ? interviewFocus.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : interviewType.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return {
    // State values
    phase,
    currentStep,
    step,
    interviewScript,
    llmLoading,
    elapsed,
    isRecording,
    speechUnavailable,
    isMuted,
    showTranscript,
    transcript,
    showEndModal,
    tabConflict,
    isOffline,
    saveWarning,
    questionFallbackSource,
    micError,
    ttsError,
    micQuiet,
    reconnecting,
    reconnectAttempt: reconnectAttemptRef.current,
    usedFallbackScore,
    evalTimedOut,
    lastSessionId,
    evaluating,
    evalElapsed,
    aiVoiceEnabled,
    showCaptions,
    currentTranscript,
    microFeedback,
    totalQuestions,
    baseQuestionCount,
    currentQuestionNum,
    isCurrentFollowUp,
    timeRemaining,
    timePercent,
    displayRole,
    displayCompany,
    displayFocus,
    // Raw internal id (behavioral / strategic / technical / case-study /
    // salary-negotiation / panel / campus-placement / hr-round /
    // management / government-psu). Exposed so client telemetry
    // (PostHog) can tag abandonment + retake events with a consistent
    // `focus` property — see Interview.tsx capture sites.
    interviewType,
    interviewerName: activeInterviewerName,
    isPanelInterview,
    panelMembers,
    activePersona: activePersona || "",
    ttsDurationMs,
    speechEnded,
    liveMetrics,
    isSalaryNegotiation: interviewType === "salary-negotiation",
    negotiationStyle: negotiationStyle || undefined,
    negotiationBand: negotiationBandRef.current,
    targetSalary,
    setTargetSalary,
    highestOffer: highestOfferRef.current,
    liveNegotiationState,
    voiceConfidence: voiceConfidenceRef.current,
    negotiationScenario,
    setNegotiationScenario,
    negotiationRound,

    // Setters the UI needs
    setCurrentTranscript,
    setSpeechUnavailable,
    setIsMuted,
    setShowTranscript,
    setShowEndModal,
    setAiVoiceEnabled,
    setMicError,
    setEvalTimedOut,
    setUsedFallbackScore,
    setEvaluating,

    // Action functions
    handleNextQuestion,
    handleSkipQuestion,
    skipSpeaking,
    retakeLastAnswer,
    handleEnd,
    /** User-initiated STT restart — bound to Space-to-start and the
     *  "Tap to start speaking" button in the listening UI. */
    restartListening,
    /** True when the engine is in the listening phase but waiting on
     *  the user to click "Start speaking" before STT + the answer
     *  countdown begin. */
    awaitingSpeechStart,
    /** True when the current step is the final step of the interview.
     *  Drives the "View result" button on the last turn — once the user
     *  has reached the closing/last question, there's nothing left to
     *  answer; the CTA flips from "Start speaking" to "View result"
     *  which calls handleEnd to trigger the report. */
    isLastStep: currentStep >= interviewScript.length - 1 && interviewScript.length > 0,
    /** True when the current step is a closing/wrap-up turn (no answer
     *  expected). Used to suppress mic UI + show the View Result CTA
     *  only on genuine outro turns, instead of any "last index" turn —
     *  fixes Bug C where the mic disappeared on the final question
     *  ("What's your notice period?") because isLastStep alone gated
     *  the View Result branch. */
    isClosingStep: interviewScript[currentStep]?.type === "closing",

    // Skip budget — used by Interview.tsx to enable/disable the skip CTA
    skipsUsed,
    skipBudget,
    canSkip,
    navigate: router,
    retryQuestions,
    replayQuestion,

    // Refs the UI needs
    transcriptRef,
    endModalTriggerRef,
    textareaRef,
    nextBtnRef,
    micStreamRef,
    noSpeechCountRef,
    ttsCancelRef,
    interviewEndedRef,
  };
}
