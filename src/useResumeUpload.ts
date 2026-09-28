"use client";

/* Shared resume-upload state machine, extracted out of DashboardResume.tsx
 * so ResumeV2.tsx doesn't duplicate its ~100-line hydrate/upload/remove
 * logic. Deliberately a SUBSET of DashboardResume's controller: no
 * multi-resume catalogue, no JD-match, no per-bullet polish, no
 * re-analyze button — those are DashboardResume-only surfaces with no
 * ResumeV2 equivalent yet. If a second screen needs those too, lift them
 * into this hook then; don't speculatively add them now. */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useDashboardCore } from "./DashboardContext";
import {
  extractResumeText,
  parseResumeData,
  isAiResume,
  isFallbackResume,
  fallbackToProfile,
} from "./resumeParser";
import { type ResumeProfile, analyzeResumeWithAI } from "./dashboardData";

export type ResumePhase = "idle" | "extracting" | "analyzing" | "done" | "error";

export interface ResumeUploadState {
  phase: ResumePhase;
  profile: ResumeProfile | null;
  analysisSource: "ai" | "fallback" | null;
  fileName: string | null;
  resumeText: string;
  errorMsg: string;
  needsReupload: boolean;
  truncated: boolean;
  handleFile: (file: File | undefined) => Promise<void>;
  handleRemove: () => void;
  triggerUpload: () => void;
}

export function useResumeUpload(): ResumeUploadState {
  const { user, updateUser } = useAuth();
  const { updatePersisted } = useDashboardCore();

  const [fileName, setFileName] = useState<string | null>(user?.resumeFileName ?? null);
  const [resumeText, setResumeText] = useState("");
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [phase, setPhase] = useState<ResumePhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [needsReupload, setNeedsReupload] = useState(false);
  const [analysisSource, setAnalysisSource] = useState<"ai" | "fallback" | null>(null);
  const [truncated, setTruncated] = useState(false);

  const analyzingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // True for the whole span of handleFile — extraction through analysis,
  // success or failure. Guards the hydrate effect below: handleFile's own
  // updateUser({ resumeText }) call (needed mid-upload, before resumeData is
  // known) changes a hydrate dependency and would otherwise re-fire hydrate's
  // own background-reanalysis branch concurrently with handleFile's, running
  // AI analysis on the same text twice.
  const uploadingRef = useRef(false);

  useEffect(() => () => { abortControllerRef.current?.abort(); }, []);

  // Hydrate from whatever's already on `user` — mirrors DashboardResume's
  // hydrate effect (see src/DashboardResume.tsx) minus the schema-upgrade
  // re-analysis branch, which is a DashboardResume-only migration path.
  useEffect(() => {
    if (uploadingRef.current) return;
    if (user?.resumeText) setResumeText(user.resumeText);
    if (user?.resumeFileName) setFileName(user.resumeFileName);

    const stored = user?.resumeData;
    if (stored) {
      if (isAiResume(stored)) {
        setProfile(stored);
        setAnalysisSource("ai");
        setPhase("done");
      } else if (isFallbackResume(stored) && user?.resumeText && !analyzingRef.current) {
        // Regex-fallback stored — opportunistically try AI re-analysis in
        // the background, keeping the fallback visible while we wait.
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
              setErrorMsg("AI analysis returned no results. Try re-uploading your resume.");
            }
            setPhase("done");
          })
          .catch(err => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setErrorMsg(`AI analysis failed: ${msg}`);
            setPhase("done");
          })
          .finally(() => { analyzingRef.current = false; });
      } else if (isFallbackResume(stored)) {
        setProfile(fallbackToProfile(stored));
        setAnalysisSource("fallback");
        setPhase("done");
        if (!user?.resumeText) setNeedsReupload(true);
      }
    } else if (user?.resumeText && user?.resumeFileName) {
      if (!analyzingRef.current) {
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
      }
    } else if (user?.resumeFileName) {
      setPhase("done");
      setNeedsReupload(true);
    }
    // Re-runs only when the underlying resume payload changes; updateUser /
    // targetRole are read inside the branches but adding them would re-fire
    // analysis whenever the user edits an unrelated field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.resumeData, user?.resumeFileName, user?.resumeText]);

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
    uploadingRef.current = true;
    analyzingRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setFileName(file.name);
    setErrorMsg("");
    setNeedsReupload(false);
    setTruncated(false);
    setPhase("extracting");

    let text: string;
    try {
      text = await extractResumeText(file);
      setResumeText(text);
      updatePersisted({ resumeFileName: file.name });
      updateUser({ resumeFileName: file.name, resumeText: text });
    } catch (err: unknown) {
      // Extraction failed — leave the previously-loaded profile (if any) on
      // screen instead of blanking the page; the error banner explains why
      // the replace didn't go through.
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse resume");
      setPhase("error");
      uploadingRef.current = false;
      analyzingRef.current = false;
      return;
    }

    // SHA-256 of the original bytes, best-effort — lets the server dedup
    // at the file level. Never blocks the upload if it fails.
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
        analyzeResumeWithAI(text, user?.targetRole, undefined, { fileName: file.name, fileHash, domain: "general" }),
        // 40s covers the server's worst case: Groq → Gemini fallback + pre-checks.
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 40_000)),
      ]);
    } catch (err) {
      analyzeError = err instanceof Error ? err.message : String(err);
      console.error("[resume] Upload-time AI analysis failed:", analyzeError);
    }

    if (result?.profile) {
      setProfile(result.profile);
      setAnalysisSource("ai");
      setTruncated(!!result.truncated);
      updateUser({ resumeData: { _type: "ai", ...result.profile } });
      setPhase("done");
    } else {
      const isTimeout = analyzeError?.toLowerCase().includes("timeout");
      const isAuth = analyzeError?.toLowerCase().includes("session") || analyzeError?.toLowerCase().includes("unauthorized");
      const isQuota = analyzeError?.toLowerCase().includes("quota") || analyzeError?.toLowerCase().includes("limit");
      setErrorMsg(
        isAuth
          ? "Session expired — please refresh and sign in again, then re-upload."
          : isQuota
            ? `${analyzeError} — basic profile shown below.`
            : isTimeout
              ? "AI analysis timed out — showing basic profile."
              : analyzeError
                ? `AI analysis failed: ${analyzeError}. Showing basic profile.`
                : "AI analysis unavailable — showing basic profile.",
      );
      const parsed = parseResumeData(text);
      updateUser({ resumeData: { _type: "fallback", ...parsed } });
      setProfile(fallbackToProfile({ _type: "fallback", ...parsed }));
      setAnalysisSource("fallback");
      setPhase("done");
    }
    uploadingRef.current = false;
    analyzingRef.current = false;
  };

  const handleRemove = () => {
    // Cancel any in-flight extraction/analysis so it can't land after removal
    // and resurrect a profile the user just deleted.
    abortControllerRef.current?.abort();
    uploadingRef.current = false;
    analyzingRef.current = false;
    setFileName(null);
    setResumeText("");
    setProfile(null);
    setPhase("idle");
    setErrorMsg("");
    updatePersisted({ resumeFileName: null });
    updateUser({ resumeFileName: null, resumeText: "", resumeData: null });
    // Same localStorage namespace onboarding writes to — clear it so a
    // stale cache can't resurrect the deleted resume.
    try { localStorage.removeItem("hirestepx_resume"); } catch { /* noop */ }
  };

  const triggerUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt";
    input.onchange = (e) => { void handleFile((e.target as HTMLInputElement).files?.[0]); };
    input.click();
  };

  return {
    phase,
    profile,
    analysisSource,
    fileName,
    resumeText,
    errorMsg,
    needsReupload,
    truncated,
    handleFile,
    handleRemove,
    triggerUpload,
  };
}
