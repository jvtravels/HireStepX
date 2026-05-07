import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";

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
import { saveSessionResult, fetchLLMQuestions, fetchFollowUp, retryQueuedEvals, getAdaptiveHints } from "./interviewAPI";
import { initLiveSession, saveInterviewTurn } from "./supabase";
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
import { cleanSalarySttArtifacts } from "./_salary-stt-cleanup";
import { useInterviewTimers } from "./useInterviewTimers";
import { useInterviewSTT } from "./useInterviewSTT";
import { extractNegotiationFacts } from "./interviewEvaluation";
import {
  normalizePersona,
  REACTIONS,
  pickPersonality,
  assessAnswerQuality,
  pickRandom,
  randomDelay,
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

    const aiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as { interviewStrengths?: string[]; interviewGaps?: string[]; topSkills?: string[] } | undefined;
    const llmPromise = fetchLLMQuestions({
      type: interviewType,
      focus: interviewFocus,
      difficulty: interviewDifficulty,
      role: targetRole || user?.targetRole || "the role",
      company: targetCompany || user?.targetCompany,
      currentCity: currentCity,
      jobCity: jobCity,
      industry: user?.industry,
      resumeText: shouldUseResume ? user?.resumeText : undefined,
      pastTopics: adaptiveHints.pastTopics.length > 0 ? adaptiveHints.pastTopics : undefined,
      weakSkills: adaptiveHints.weakSkills.length > 0 ? adaptiveHints.weakSkills : undefined,
      jobDescription: jobDescription || undefined,
      experienceLevel: user?.experienceLevel || undefined,
      mini: isMiniMode || undefined,
      resumeStrengths: shouldUseResume ? aiProfile?.interviewStrengths : undefined,
      resumeGaps: shouldUseResume ? aiProfile?.interviewGaps : undefined,
      resumeTopSkills: shouldUseResume ? aiProfile?.topSkills : undefined,
      candidateName: user?.name || undefined,
      negotiationStyle: negotiationStyle || undefined,
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
  // Mirror saveWarning to a ref so the recovery hook can read it
  // at fire-time without re-binding window listeners on each change.
  const saveWarningRef = useRef("");
  useEffect(() => { saveWarningRef.current = saveWarning; }, [saveWarning]);
  const [micError, setMicError] = useState("");
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
      // TTS failed — log so the failure isn't invisible to ops/PostHog.
      // The visual question is still on screen so the candidate can read it,
      // but a sustained pattern of "tts_failed" events should page the team.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[interview] TTS handle.start failed:", msg.slice(0, 120));
      track("tts_failed", { phase: "preview", error: msg.slice(0, 200) });
    });
  }, [aiVoiceEnabled, interviewerGender]);

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
  const pendingFollowUpRef = useRef<Promise<{ needsFollowUp: boolean; followUpText: string; followUpType?: string } | null> | null>(null);
  /** Originating step index for the in-flight follow-up. When the
   *  follow-up resolves we verify the engine has advanced exactly one
   *  step from this — otherwise the user already moved past the question
   *  the follow-up was generated for, and applying it now would inject
   *  Q3's answer-shaped reply into Q5's slot (the cross-question
   *  conflation that produced bug #6). */
  const pendingFollowUpStepRef = useRef<number>(-1);
  const followUpDepthRef = useRef(0);
  // Atomic follow-up insertion counter — prevents race when two follow-ups resolve simultaneously
  const followUpInsertCountRef = useRef(0);
  // Dynamic difficulty: track answer quality mid-interview for escalation/de-escalation
  const answerQualityRef = useRef<number[]>([]);
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
      // Sanitize whenever closing announces a number that's below the highest
      // offer made — that's the catastrophic case. Also sanitize if it announces
      // ANY number we can't verify (highest === 0 means we never tracked an offer).
      if (announcedBelowHighest || (hasAnyNumber && highest === 0) || hasPlaceholder) {
        const safeClosing = highest > 0
          ? `Great — I think we've had a really productive conversation. Based on everything we've discussed, including offers up to ₹${highest} LPA, let me finalise the numbers internally and have HR send you the formal offer letter with the complete breakdown. What's your notice period situation?`
          : "Great — I think we've had a really productive conversation. Let me put together the final numbers based on everything we've discussed and have HR send you the formal offer letter with the complete breakdown. What's your notice period situation?";
        console.warn(
          `[interview] salary-neg closing step announced ₹${announcedNum} LPA `
          + `(highest offer made: ₹${highest} LPA) — replacing with safe template`,
        );
        step.aiText = safeClosing;
        if (typeof step.aiTextDisplay === "string") step.aiTextDisplay = safeClosing;
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
    });
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

      setTranscript(prev => [...prev, {
        speaker: "ai",
        text: step.persona ? `[${step.persona}] ${step.aiText}` : step.aiText,
        time: formatTime(elapsed),
      }]);

      ttsCancelRef.current?.();

      let localSpeechEnded = false;
      const onSpeechEnd = () => {
        if (localSpeechEnded || isStale()) return;
        localSpeechEnded = true;
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
          return panelVoiceId
            ? speakAs(step.aiText, panelVoiceId, onSpeechEnd, onSpeechEnd, panelGender, onDurationKnown)
            : speak(step.aiText, onSpeechEnd, onSpeechEnd, fallbackGender, onDurationKnown);
        };
        speakPanel().then(handle => {
          if (ttsInstanceIdRef.current === instanceId) {
            ttsCancelRef.current = handle.cancel;
          } else {
            handle.cancel();
          }
        }).catch((e) => {
          // TTS rejection during the active question. The phase advances via
          // onSpeechEnd so the interview keeps moving, but log it loudly:
          // the candidate just heard silence where there should have been a
          // question. A spike in tts_failed events with phase=question is
          // the canonical "audio infrastructure broken" signal.
          const msg = e instanceof Error ? e.message : String(e);
          console.warn("[interview] TTS speak() rejected:", msg.slice(0, 120));
          track("tts_failed", { phase: "question", error: msg.slice(0, 200) });
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

    // Intent-aware fallback for salary-neg when follow-up times out / fails
    // Returns true if early-close was triggered (caller should NOT call startSpeaking)
    const applySalaryNegFallback = (): boolean => {
      if (!isSalaryNegConversation) return false;
      const lastAnswer = lastAnswerTextRef.current;
      if (!lastAnswer) return false;
      // Position-aware intent: "but I accept" → accept wins, "I accept but want more" → hedge wins
      const acceptPat = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|it.?s a deal|i.?m happy with|fine with me|i agree|agreed|let.?s go ahead)\b/i;
      const hedgePat = /\b(but|however|only if|unless|provided|on condition|contingent|except|though)\b/i;
      const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline the offer|i decline|pull out|not worth|won.?t work|isn.?t going to work|move on|other option|take the other|thanks but no|not for me|have to pass)\b/i;
      const isShortAffirmative = lastAnswer.trim().split(/\s+/).length < 8
        && /^(yes|yeah|okay|ok|sure|deal|agreed|accept|sounds good|that works|fine)\b/i.test(lastAnswer.trim())
        && !hedgePat.test(lastAnswer);
      const acceptIdx = lastAnswer.search(acceptPat);
      const hedgeIdx = lastAnswer.search(hedgePat);
      const hasAcceptFirst = acceptIdx >= 0 && (hedgeIdx < 0 || hedgeIdx < acceptIdx);
      const hasHedgeAfterAccept = acceptIdx >= 0 && hedgeIdx > acceptIdx;
      // Guard: "I'm happy with the base" is partial acceptance of one component, not the full offer
      const componentOnlyPat = /\b(?:i.?m happy with|fine with|accept)\s+(?:the\s+)?(?:base|variable|bonus|equity|benefits?|joining)\b/i;
      const isComponentOnly = componentOnlyPat.test(lastAnswer) && !/\b(offer|package|deal|overall|total|ctc)\b/i.test(lastAnswer);
      const userAccepted = (hasAcceptFirst || isShortAffirmative) && !hasHedgeAfterAccept && !isComponentOnly;
      const userWalkAway = walkAwayPat.test(lastAnswer) && !acceptPat.test(lastAnswer);
      const userRejected = /\b(not acceptable|too low|can.?t accept|absolutely not|not enough|way too low|that.?s insulting)\b/i.test(lastAnswer)
        && !/\b(i accept|sounds good|deal)\b/i.test(lastAnswer);
      // Also detect "need time to think" and competing offers
      const thinkPat = /\b(need time|think about|sleep on|let me think|consider|talk to.*(?:family|partner|wife|husband)|get back to you|not ready)\b/i;
      const competingPat = /\b(other offer|competing|another company|counter.?offer|multiple offers|also talking|got an offer)\b/i;
      const userNeedsTime = thinkPat.test(lastAnswer);
      const userMentionedCompeting = competingPat.test(lastAnswer);
      // Reference actual ₹ numbers from negotiationBand when available
      const band = negotiationBandRef.current;
      const offerStr = band ? `₹${band.initialOffer} LPA` : "the offer";
      const stretchStr = band ? `₹${band.maxStretch} LPA` : "the top of our band";

      let fallbackText: string;
      let scoreNote: string;
      const waitForUser = true;
      if (userWalkAway) {
        // Distinct walk-away: hiring manager tries to retain with strategic pause
        fallbackText = band
          ? `I understand, and I respect that. But before you make a final decision — I genuinely believe you'd be a great fit here. Let me go back to my leadership. I may be able to push this closer to ${stretchStr}, which is the absolute ceiling for this band. Would that change things?`
          : "I understand, and I respect that. But before you make a final decision — I genuinely believe you'd be a great fit here. Let me go back to my leadership and see if there's any room to move. Would you be open to hearing a revised number before walking away?";
        scoreNote = "Candidate walked away — evaluate: did they walk away too early? Did they leave room for counter? Did they stay professional?";
      } else if (userNeedsTime) {
        // "Need time to think" — respect but create soft urgency
        fallbackText = band
          ? `Of course — it's an important decision, take the time you need. But I should mention, we're looking to close this position soon. Can we reconnect in 48 hours? The ${offerStr} package stands until then. Is there anything specific you'd like me to clarify in the meantime?`
          : "Of course — it's an important decision. Can we reconnect in 48 hours? I want to make sure you have everything you need to decide. Is there anything specific giving you pause that we could talk through now?";
        scoreNote = "Candidate asked for time — evaluate: did they use this tactically or were they genuinely undecided?";
      } else if (userMentionedCompeting) {
        // Competing offers — engage directly
        fallbackText = band
          ? `That's helpful to know — competition keeps everyone honest. Can you share what they're offering? Not to match blindly, but to understand where we need to be. What matters most to you beyond the number — the role, the team, or the growth path? Because our ${offerStr} package with equity and benefits might tell a different story.`
          : "That's helpful to know. Can you share what they're offering? More importantly, what would make you choose us over them? Is it purely about the number, or are there other factors at play?";
        scoreNote = "Candidate mentioned competing offers — evaluate: did they use BATNA effectively? Did they share details or keep leverage?";
      } else if (userAccepted) {
        fallbackText = band
          ? `That's wonderful to hear! I'm really glad ${offerStr} works for you. Before we finalize, let me walk you through the complete package — the benefits, growth path, and everything that comes with this role. I want you to feel confident about the full picture.`
          : "That's wonderful to hear! I'm glad the offer works for you. Before we finalize, let me walk you through the complete package — the benefits, growth path, and everything else that comes with this role. I want to make sure you have the full picture.";
        scoreNote = "Candidate accepted — exploring full package";
        // Early close: if we're past Q2 (step >= 3), skip remaining questions and go to closing
        if (currentStepRef.current >= 3) {
          const curStep = currentStepRef.current;
          const closingText = band
            ? `Great, so just to confirm — we're agreed on ${offerStr} total CTC, plus the benefits we discussed. I'll have HR send you the formal offer letter by tomorrow. Take a day to review and let us know. I'm really glad we worked this out — the team is excited to have you!`
            : "Great, so we're agreed on the package we discussed. I'll have HR send you the formal offer letter by tomorrow. Take a day to review and let us know. I'm really glad we worked this out — welcome aboard!";
          const closingWords = closingText.split(/\s+/).length;
          const closingMs = Math.max(3000, Math.round((closingWords / 150) * 60 * 1000) + 1500);
          const closingStep: InterviewStep = {
            type: "closing", aiText: closingText,
            thinkingDuration: 300, speakingDuration: closingMs, waitForUser: true,
            scoreNote: "Early close — candidate accepted. Evaluate overall negotiation strategy.",
          };
          setInterviewScript(prev => {
            return [...prev.slice(0, curStep + 1), closingStep];
          });
          // Advance to the closing step so the effect re-fires on the new step
          setCurrentStep(curStep + 1);
          return true;
        }
      } else if (userRejected) {
        // Explicit rejection — make specific counter with ₹ numbers
        fallbackText = band
          ? `I hear you — ${offerStr} may not be where you need it. Let me see what I can do. I might be able to stretch to ${stretchStr} if we restructure the variable component. What's the minimum that makes this a clear yes for you?`
          : "I understand your concern, and I appreciate your honesty. Let me see what flexibility I have — I want to make sure we find something that works for both of us. What's the minimum package that makes this a clear yes?";
        scoreNote = "Candidate rejected — exploring alternatives";
      } else {
        // Vague or indirect answer — probe gently without assuming rejection
        fallbackText = band
          ? `I want to make sure we're on the same page. The ${offerStr} package — does that feel like the right ballpark for you, or is there a specific area where you'd like to see more? I'm happy to talk through the breakdown.`
          : "I want to make sure we're aligned. How are you feeling about the overall package? Is there a specific part you'd like to dig into — whether that's base, variable, benefits, or something else entirely?";
        scoreNote = "Candidate gave vague/indirect answer — evaluate: are they being strategic or genuinely unsure?";
      }

      const curStep = currentStepRef.current;
      const fallbackWords = fallbackText.split(/\s+/).length;
      const fallbackMs = Math.max(3000, Math.round((fallbackWords / 150) * 60 * 1000) + 1500);
      const fallbackStep: InterviewStep = {
        type: "question",
        aiText: fallbackText,
        // Fallback strings are mostly engine-authored constants, but a
        // couple of paths feed through scoreNote builders that may carry
        // stale markup. Sanitize defensively so the UI is never lied to.
        aiTextDisplay: stripProsodyMarkup(fallbackText),
        thinkingDuration: 300, speakingDuration: fallbackMs, waitForUser,
        scoreNote,
      };
      setInterviewScript(prev => {
        const nextIdx = prev.findIndex((s, i) => i > curStep && (s.type === "question" || s.type === "closing"));
        if (nextIdx > curStep) {
          return [...prev.slice(0, nextIdx), fallbackStep, ...prev.slice(nextIdx + 1)];
        }
        return prev;
      });
      return false;
    };

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
            setInterviewScript(prev => {
              const nextQuestionIdx = prev.findIndex((s, i) => i >= currentStep && s.type === "question");
              if (nextQuestionIdx >= currentStep && nextQuestionIdx >= 0) {
                // Replace the next question with the dynamic response
                const updated = [...prev.slice(0, nextQuestionIdx), followUpStep, ...prev.slice(nextQuestionIdx + 1)];
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
              // No more questions to replace — check if we can insert a follow-up probe
              const maxInserts = isMiniMode ? 2 : 3;
              if (followUpInsertCountRef.current < maxInserts) {
                const closingIdx = prev.findIndex((s, i) => i > currentStep && s.type === "closing");
                if (closingIdx > currentStep) {
                  followUpInsertCountRef.current++;
                  const insertStep = { ...followUpStep, type: "follow-up" as const };
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
            if (step.type === "question" || step.type === "follow-up") {
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
              // Cap check — see src/_follow-up-cap.ts for the formula.
              const cap = checkFollowUpCap({ script: prev });
              if (!cap.allowed) {
                console.warn(`[interview] Skipping follow-up — turn cap reached (${cap.currentTurns}/${cap.maxTurns})`);
                return prev;
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
          // For salary-neg: if user accepted/rejected, replace next question with an intent-aware response
          const earlyClose = applySalaryNegFallback();
          if (earlyClose) return; // Early close advances step — effect will re-fire
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
          const earlyClose = applySalaryNegFallback();
          if (earlyClose) return; // Early close advances step — effect will re-fire
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
  // interviewScript.length: re-run when follow-up steps are inserted at currentStep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, aiVoiceEnabled, interviewScript.length]);

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
      const { feedback, score: answerScore } = computeMicroFeedback(answerText, interviewType, answerQualityRef.current, negPhase);
      answerQualityRef.current.push(answerScore);
      if (feedback) setMicroFeedback(feedback);
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
        const followUpAiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as { topSkills?: string[] } | undefined;
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

        // Conversational continuity — extract noun phrases from this
        // answer and accumulate into the rolling memory ref. See
        // src/_noun-phrase-memory.ts.
        const newPhrases = extractNounPhrases(answerText);
        if (newPhrases.length > 0) {
          mentionsMemoryRef.current = appendToMemory(mentionsMemoryRef.current, newPhrases);
        }
        const previousMentions = mentionsMemoryRef.current.length > 0
          ? mentionsMemoryRef.current
          : undefined;

        // Tag the in-flight request with the step it's answering. If the
        // engine has advanced past the next step by the time this resolves,
        // we'll drop the result (see check at the consumer site).
        pendingFollowUpStepRef.current = currentStep;
        pendingFollowUpRef.current = fetchFollowUp({
          question: currentStepObj!.aiText,
          answer: answerText,
          type: interviewType,
          role: user?.targetRole || "senior role",
          jobDescription: jobDescription || undefined,
          company: user?.targetCompany,
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
        });
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
      // Outcome-aware closing override. If we're about to advance INTO
      // a closing step in a salary-neg session AND no runtime follow-up
      // has replaced it (i.e. it's still the upfront LLM-generated /
      // synthesized fallback closing), apply the same branching the
      // follow-up resolution path uses. Without this, the upfront
      // closing fires with no awareness of how the conversation went.
      const nextIdx = currentStep + 1;
      if (
        nextStep?.type === "closing" &&
        interviewType === "salary-negotiation" &&
        !nextStep.scoreNote?.includes("Dynamic follow-up")
      ) {
        const facts = extractNegotiationFacts([
          ...transcript,
          { speaker: "user" as const, text: answerText, time: "" },
        ]);
        const lastAns = answerText || "";
        const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|move on|take the other|have to pass)\b/i;
        const stillNegotiatingPat = /\b(higher|more|increase|stretch|push|counter ?offer|what.?s your counter|can you (?:offer|do|go)|i.?d like (?:a |to )?(?:higher|more)|i would like (?:a |to )?(?:higher|more)|can we (?:go|do)|already (?:mentioned|said|told)|as i (?:said|mentioned|told)|told you|mentioned (?:multiple times|earlier|before)|like to have higher|highest base)\b/i;
        // Pull the agreed total — prefer highest offer made by AI
        // (after counters), else the script's initial offer extracted
        // from the offer step's aiText. Used to recap actual numbers
        // in the close instead of hand-waving "the final numbers".
        const offerStep = interviewScript.find(s => s.type === "question" && /₹\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?)/.test(s.aiText || ""));
        const offerMatch = offerStep?.aiText.match(/₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/);
        const initialOfferNum = offerMatch ? parseFloat(offerMatch[1]) : null;
        const finalNum = highestOfferRef.current > 0 ? highestOfferRef.current : initialOfferNum;
        const dealRecap = finalNum ? `at ₹${finalNum} LPA total CTC` : "at the package we discussed";

        let closingText: string | null = null;
        if (facts.acceptedImmediately) {
          closingText = `Great — really glad we found terms that work. To recap: we're closing ${dealRecap}, with the breakdown we discussed. I'll have HR send the formal offer letter today. Welcome aboard.`;
        } else if (facts.rejectedOutright || walkAwayPat.test(lastAns)) {
          closingText = "I appreciate you being direct with me. We weren't able to bridge the gap today, but thank you for the conversation. Best of luck with the search.";
        } else if (stillNegotiatingPat.test(lastAns)) {
          closingText = "I hear you — and I want to be straight with you: I've shared where I can land today. Take some time to think it through, and let me know by tomorrow if the package works or if there's a specific lever you want me to revisit. I'll hold the offer till then.";
        }
        if (closingText && closingText !== nextStep.aiText) {
          setInterviewScript(prev => {
            const updated = [...prev];
            updated[nextIdx] = { ...updated[nextIdx], aiText: closingText! };
            return updated;
          });
        }
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
      company: user?.targetCompany,
      resumeText: shouldUseResume ? user?.resumeText : undefined,
      jobDescription: jobDescription || undefined,
      negotiationBand: negotiationBandRef.current,
      targetSalary,
      highestOfferMade: highestOfferRef.current,
      negotiationStyle: negotiationStyle || undefined,
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
    micError,
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
