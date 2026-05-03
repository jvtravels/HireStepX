"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";

/* Editorial brand surface — same tokens as auth, onboarding, and the
   interview surface. Discipline rule:
   Indigo is interactive · Copper is editorial · Never mix. */
import { tokens as T, fonts as F } from "./auth/_tokens";
import { Wordmark } from "./auth/_fields";
import { AUTH_STYLES } from "./auth/_styles";

import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";
import { unlockAudio, prefetchTTS } from "./tts";
import { UpgradeModal } from "./dashboardComponents";
import { FREE_SESSION_LIMIT } from "./dashboardData";

/* ─── Suggestions ─── */
const ROLE_SUGGESTIONS = [
  "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Principal Engineer", "Lead Software Engineer",
  "Software Developer", "Senior Software Developer", "Application Developer", "Systems Engineer",
  "Frontend Developer", "Senior Frontend Developer", "React Developer", "Angular Developer", "Vue.js Developer",
  "Backend Developer", "Senior Backend Developer", "Java Developer", "Python Developer", "Node.js Developer", "Go Developer", ".NET Developer",
  "Full Stack Developer", "Senior Full Stack Developer", "MERN Stack Developer", "MEAN Stack Developer",
  "Mobile Developer", "iOS Developer", "Android Developer", "React Native Developer", "Flutter Developer",
  "Embedded Software Engineer", "Firmware Engineer", "C++ Developer", "Rust Developer",
  "DevOps Engineer", "Senior DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer", "Cloud Architect",
  "Platform Engineer", "Infrastructure Engineer", "Network Engineer", "Systems Administrator",
  "Data Engineer", "Senior Data Engineer", "Data Architect",
  "Data Scientist", "Senior Data Scientist", "Research Scientist",
  "Data Analyst", "Senior Data Analyst", "Business Intelligence Analyst", "BI Developer",
  "Machine Learning Engineer", "Senior ML Engineer", "AI Engineer", "AI/ML Lead", "NLP Engineer",
  "QA Engineer", "Senior QA Engineer", "QA Lead", "Test Engineer", "SDET", "Automation Engineer",
  "Security Engineer", "Cybersecurity Analyst", "Penetration Tester", "Security Architect",
  "Tech Lead", "Engineering Manager", "Senior Engineering Manager", "Director of Engineering",
  "VP of Engineering", "Head of Engineering", "CTO",
  "Associate Product Manager", "Product Manager", "Senior Product Manager", "Lead Product Manager",
  "Group Product Manager", "Director of Product", "VP of Product", "Chief Product Officer",
  "Technical Product Manager", "Product Owner",
  "Product Designer", "Senior Product Designer", "UX Designer", "UI Designer", "UX/UI Designer",
  "UX Researcher", "Visual Designer", "Head of Design", "Design Manager",
  "Business Analyst", "Senior Business Analyst", "Management Consultant", "Strategy Consultant",
  "Project Manager", "Senior Project Manager", "Program Manager", "Technical Program Manager", "Scrum Master",
  "Operations Manager", "Supply Chain Manager", "Logistics Manager",
  "Marketing Manager", "Digital Marketing Manager", "Content Strategist", "Growth Manager",
  "Sales Executive", "Account Executive", "Business Development Manager",
  "HR Executive", "HR Manager", "Recruiter", "Technical Recruiter",
  "Financial Analyst", "CA", "Chartered Accountant", "Investment Banking Analyst",
  "Bank PO", "Relationship Manager", "Wealth Manager",
  "Legal Counsel", "Corporate Lawyer", "Company Secretary",
  "Teacher", "Lecturer", "Assistant Professor", "Professor",
  "Civil Engineer", "Mechanical Engineer", "Electrical Engineer",
  "CEO", "Co-founder", "Managing Director", "General Manager",
  "Software Engineer Intern", "Associate Software Engineer", "Junior Developer",
  "Graduate Engineer Trainee (GET)", "Management Trainee", "Fresher",
];

const COMPANY_SUGGESTIONS = [
  "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix",
  "Adobe", "Oracle", "SAP", "Salesforce", "ServiceNow", "Intuit", "Atlassian",
  "IBM", "Cisco", "Intel", "NVIDIA", "Qualcomm",
  "LinkedIn", "Uber", "Spotify", "Airbnb", "Shopify",
  "Stripe", "PayPal", "Visa", "Mastercard",
  "GitHub", "GitLab", "Figma", "Notion", "Twilio",
  "OpenAI", "Anthropic", "Google DeepMind", "Scale AI",
  "Goldman Sachs", "JP Morgan", "Morgan Stanley", "Deutsche Bank", "Barclays",
  "TCS", "Infosys", "Wipro", "HCL Technologies", "Tech Mahindra",
  "Cognizant", "Capgemini", "Accenture", "Deloitte", "PwC", "EY", "KPMG",
  "Flipkart", "Meesho", "Nykaa", "Swiggy", "Zomato",
  "Razorpay", "PhonePe", "Paytm", "CRED", "Zerodha", "Groww",
  "Ola", "Delhivery", "Ather Energy",
  "Byju's", "Unacademy", "upGrad", "Physics Wallah", "Scaler",
  "Freshworks", "Zoho", "Postman", "BrowserStack",
  "MakeMyTrip", "OYO Rooms",
  "McKinsey", "BCG", "Bain",
  "Tata Group", "Reliance Industries", "Adani Group", "Mahindra Group",
  "HDFC Bank", "ICICI Bank", "SBI", "Kotak Mahindra Bank", "Axis Bank",
  "Bajaj Finance", "HDFC Life",
  "Hindustan Unilever (HUL)", "ITC", "Nestle India",
  "Jio (Reliance)", "Airtel (Bharti)",
  "Tata Motors", "Maruti Suzuki", "Mahindra & Mahindra",
  "L&T (Larsen & Toubro)", "BHEL", "ONGC", "NTPC",
  "Pre-seed / Seed Startup", "Series A Startup", "Series B Startup", "Enterprise / MNC", "Government / PSU",
];

function sampleDiverse(arr: string[], count: number): string[] {
  if (arr.length <= count) return arr;
  const step = Math.floor(arr.length / count);
  const result: string[] = [];
  for (let i = 0; i < count; i++) result.push(arr[i * step]);
  return result;
}

/* ─── Autocomplete Input ─── */
function AutocompleteInput({
  id, value, onChange, placeholder, suggestions, label, required, error,
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder: string;
  suggestions: string[]; label?: string; required?: boolean; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [diverseSample] = useState(() => sampleDiverse(suggestions, 8));

  useEffect(() => { return () => { setFocused(false); }; }, []);

  const filtered = focused
    ? value.length > 0
      ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()).slice(0, 8)
      : diverseSample
    : [];

  useEffect(() => {
    if (filtered.length > 0 && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const pad = 8;
      let left = rect.left;
      let width = rect.width;
      if (width > vw - pad * 2) width = vw - pad * 2;
      if (left < pad) left = pad;
      if (left + width > vw - pad) left = vw - pad - width;
      const spaceBelow = window.innerHeight - rect.bottom - 4;
      const top = spaceBelow < 120 ? Math.max(pad, rect.top - 224) : rect.bottom + 4;
      setDropdownPos({ top, left, width });
    }
  }, [filtered.length, focused, value]);

  return (
    <div>
      {label && (
        <label htmlFor={id} style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.inkSoft, display: "block", marginBottom: 8 }}>
          {label} {required && <span style={{ color: T.error }}>*</span>}
        </label>
      )}
      <input
        ref={inputRef} id={id} type="text" value={value}
        onChange={(e) => { onChange(e.target.value); setSelectedIdx(-1); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); setFocused(false); inputRef.current?.blur(); return; }
          if (filtered.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && selectedIdx >= 0) { e.preventDefault(); onChange(filtered[selectedIdx]); setFocused(false); }
        }}
        placeholder={placeholder} autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: "100%", padding: "12px 16px", borderRadius: 10,
          background: T.white, border: `1.5px solid ${error ? T.error : focused ? T.indigo : T.line}`,
          color: T.coal, fontFamily: F.sans, fontSize: 14,
          outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
        }}
      />
      {error && <p id={`${id}-error`} role="alert" style={{ fontFamily: F.sans, fontSize: 11, color: T.error, marginTop: 4 }}>{error}</p>}
      {filtered.length > 0 && dropdownPos && createPortal(
        <div role="listbox" style={{
          position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999,
          background: T.white, border: `1px solid ${T.line}`, borderRadius: 10,
          boxShadow: "0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)", maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.map((s, i) => (
            <button key={s} role="option" aria-selected={i === selectedIdx} onMouseDown={() => { onChange(s); setFocused(false); }}
              style={{
                display: "block", width: "100%", padding: "10px 16px", border: "none", textAlign: "left",
                fontFamily: F.sans, fontSize: 13, cursor: "pointer",
                background: i === selectedIdx ? "rgba(49,46,129,0.08)" : "transparent",
                color: i === selectedIdx ? T.coal : T.inkSoft,
              }}>
              {s}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}


/* ─── Intro text for TTS pre-fetch ─── */
const introByType: Record<string, string> = {
  behavioral: "Hi! Welcome to your behavioral mock interview. I'm your AI interviewer today. We'll focus on leadership, decision-making, and conflict resolution. This will take about 15 minutes. Feel free to take your time. Ready?",
  strategic: "Welcome to your strategic interview session. Today we'll explore your vision-setting ability, roadmap thinking, and business alignment. Let's dive in — are you ready?",
  technical: "Welcome to your technical leadership interview. We'll focus on architecture decisions, system design at scale, and tech strategy. Ready to begin?",
  "case-study": "Welcome to your case study interview. I'll present you with business scenarios that test your analytical thinking and problem-solving frameworks. Let's start.",
  "salary-negotiation": "Welcome to your salary negotiation practice session. I'll play the role of a hiring manager extending you an offer. We'll practice negotiating compensation, benefits, and terms. This is a safe space to build your confidence. Ready to negotiate?",
  "panel": "Welcome to your panel interview. I'm the hiring manager, and I'll be joined by our technical lead and HR partner. We'll each ask you questions from our perspective. Let's begin — tell us briefly about yourself.",
  "campus-placement": "Welcome to your campus placement interview practice. We'll cover the typical questions asked during on-campus recruitment — aptitude, HR, and role-specific questions. Let's get you placement-ready!",
  "hr-round": "Welcome to your HR round practice. We'll focus on culture fit, motivation, salary expectations, and behavioral questions that HR teams typically ask. Ready?",
  "management": "Welcome to your management interview. We'll explore your people leadership, project management, and stakeholder communication skills. Let's begin.",
  "government-psu": "Welcome to your government and public sector interview practice. These interviews test your awareness of public administration, ethics, current affairs, and your motivation for public service. Let's begin — are you ready?",
};

/* Focus type → interview type mapping */
const focusToType: Record<string, string> = {
  "Behavioral": "behavioral",
  "Strategic": "strategic",
  "Technical Leadership": "technical",
  "Case Study": "case-study",
  "Salary Negotiation": "salary-negotiation",
  "Panel Interview": "panel",
  "Campus Placement": "campus-placement",
  "HR Round": "hr-round",
  "Management": "management",
  "Government / PSU": "government-psu",
};

function getRecommendedFocus(role?: string): string {
  if (!role) return "Behavioral";
  const r = role.toLowerCase();
  if (/engineer|developer|sde|swe|programmer|coder/i.test(r)) return "Technical Leadership";
  if (/product\s*manager|pm\b/i.test(r)) return "Strategic";
  if (/analyst|data/i.test(r)) return "Technical Leadership";
  if (/intern|fresher|graduate|campus|entry/i.test(r)) return "Campus Placement";
  if (/consult/i.test(r)) return "Case Study";
  if (/manager|director|vp|head of|cto|ceo/i.test(r)) return "Management";
  return "Behavioral";
}

/* ─── MicMeter ──────────────────────────────────────────────────────────
   3-bar live audio meter rendered inside the mic permission card once
   the stream is granted. Bars rise as the analyser sees more energy,
   and turn green once a voice threshold has been crossed. */
function MicMeter({ level, active }: { level: number; active: boolean }) {
  // Three thresholds spread across 0-100 so the bars fill in sequence,
  // not in lockstep — feels like a real meter.
  const heights = [
    Math.max(20, Math.min(100, level * 1.6)),
    Math.max(15, Math.min(100, level * 1.1)),
    Math.max(10, Math.min(100, level * 0.7)),
  ];
  return (
    <span aria-hidden style={{ display: "inline-flex", alignItems: "flex-end", gap: 3, height: 16 }}>
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: `${active ? h : 20}%`,
            background: active && level > 6 ? T.success : T.inkFaint,
            borderRadius: 2,
            transition: "height 80ms linear, background 200ms ease",
          }}
        />
      ))}
    </span>
  );
}

/* ─── PermissionCard ────────────────────────────────────────────────────
   A two-state tile: idle / requesting / granted / denied (+ skipped for
   camera). The idle state shows a primary "Allow …" button. Granted
   collapses to a success row. Denied shows a help line + retry. Same
   visual language as the focus chips so it feels native to the form. */
function PermissionCard({
  kind, label, sublabel, sublabelTone, status, onRequest, onSkip, onDisable,
  level, voiceDetected, denyReason, isIOS, cameraStream,
}: {
  kind: "mic" | "camera";
  label: string;
  sublabel: string;
  sublabelTone: "copper" | "muted";
  status: "idle" | "requesting" | "granted" | "denied" | "skipped";
  onRequest: () => void;
  onSkip?: () => void;
  /** Turn-off link shown on granted camera so users can opt out post-grant. */
  onDisable?: () => void;
  /** Live mic level 0-100 — only used when kind === "mic" && status === "granted". */
  level?: number;
  /** Whether the analyser has detected speech yet — flips the prompt copy. */
  voiceDetected?: boolean;
  /** Distinguishes "blocked" (user denied) vs "no-device" (no hardware). */
  denyReason?: "blocked" | "no-device" | null;
  /** When true and status === "denied" with reason "blocked", show the
   *  iOS Safari recovery path (different from desktop). */
  isIOS?: boolean;
  /** Live MediaStream — when present and kind === "camera" + status ===
   *  "granted", we render a small mirrored video preview in the icon
   *  slot so the user can verify framing/lighting before launching. */
  cameraStream?: MediaStream | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);
  const isGranted = status === "granted";
  const isDenied = status === "denied";
  const isSkipped = status === "skipped";
  const icon = kind === "mic" ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );

  // Skipped renders dimmer + greyer so it's visually distinct from idle.
  const denyCopy = (() => {
    if (!isDenied) return null;
    if (denyReason === "no-device") {
      return kind === "mic"
        ? "No microphone detected. Connect one and retry."
        : "No camera detected — you can still proceed without one.";
    }
    if (kind === "mic") {
      return isIOS
        ? "Blocked. Tap aA in the address bar → Website Settings → Microphone → Allow, then retry."
        : "Blocked. Open browser settings → allow microphone, then retry.";
    }
    return "Blocked — you can still proceed without camera.";
  })();

  return (
    <div
      className="hsx-permission-card"
      style={{
        padding: 14,
        borderRadius: 12,
        /* Same gradient grammar as the selected focus chip:
             linear-gradient(180deg, <tint-100>, white)
           Keeps the success/error tint at the same subtlety as the
           indigo100 used for selection — no raw rgbas. */
        background: isGranted
          ? `linear-gradient(180deg, ${T.success100}, ${T.white})`
          : isDenied
            ? `linear-gradient(180deg, ${T.error100}, ${T.white})`
            : T.white,
        border: `1px solid ${isGranted ? T.success : isDenied ? T.error : T.line}`,
        boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "all 220ms cubic-bezier(.2,.7,.2,1)",
        opacity: isSkipped ? 0.7 : 1,
      }}
    >
      {kind === "camera" && isGranted && cameraStream ? (
        /* Live preview — replaces the icon tile with a 4:3 thumbnail of
           the user's camera feed. Mirrored (scaleX(-1)) per self-view
           convention. Same border radius family as the icon tile. */
        <span
          aria-label="Live camera preview"
          className="hsx-permission-cam-preview"
          style={{
            width: 64,
            height: 48,
            borderRadius: 6,
            overflow: "hidden",
            background: T.creamSoft,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${T.success}`,
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
          />
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            /* Icon-tile background uses the same -100 tint family as the
               card surface for visual coherence. Skipped uses creamSoft —
               no raw coal-rgba. */
            background: isGranted
              ? T.success100
              : isDenied
                ? T.error100
                : isSkipped
                  ? T.creamSoft
                  : T.indigo100,
            color: isGranted ? T.success : isDenied ? T.error : isSkipped ? T.inkFaint : T.coal,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.coal, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: sublabelTone === "copper" ? T.copper : T.inkFaint }}>· {sublabel}</span>
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 12, color: isDenied ? T.error : T.inkSoft, marginTop: 2, lineHeight: 1.4 }}>
          {status === "idle" && (kind === "mic" ? "Used to capture your answers." : "Practice eye contact and presence.")}
          {status === "requesting" && "Waiting for your permission…"}
          {isGranted && kind === "camera" && "Camera ready"}
          {isGranted && kind === "mic" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <MicMeter level={level ?? 0} active />
              <span style={{ color: voiceDetected ? T.success : T.inkSoft }}>
                {voiceDetected ? "Sounds great" : "Say \"hello\" to test"}
              </span>
            </span>
          )}
          {isDenied && denyCopy}
          {isSkipped && "Skipped for this session."}
        </div>
      </div>
      <div className="hsx-permission-actions" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {status === "idle" && (
          <button
            type="button"
            onClick={onRequest}
            style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 500,
              padding: "8px 14px", borderRadius: 8,
              background: T.indigo, color: T.cream, border: "1px solid transparent",
              cursor: "pointer", transition: "all 160ms ease",
              boxShadow: "0 1px 2px rgba(20,17,10,.08)",
            }}
          >
            Allow
          </button>
        )}
        {status === "requesting" && (
          <span style={{ width: 16, height: 16, border: `2px solid ${T.indigoRing}`, borderTopColor: T.indigo, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        )}
        {isGranted && (
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: 999, background: T.success, color: T.cream, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        )}
        {isGranted && kind === "camera" && onDisable && (
          <button
            type="button"
            onClick={onDisable}
            aria-label="Turn camera off for this session"
            style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 500,
              padding: "6px 10px", borderRadius: 6,
              background: "transparent", color: T.inkSoft, border: 0,
              cursor: "pointer",
            }}
          >
            Turn off
          </button>
        )}
        {isDenied && (
          <button
            type="button"
            onClick={onRequest}
            style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 500,
              padding: "8px 14px", borderRadius: 8,
              background: T.white, color: T.coal, border: `1px solid ${T.lineStrong}`,
              cursor: "pointer", transition: "all 160ms ease",
            }}
          >
            Retry
          </button>
        )}
        {kind === "camera" && status === "idle" && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 500,
              padding: "8px 12px", borderRadius: 8,
              background: "transparent", color: T.inkSoft, border: "0",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}
        {isSkipped && onRequest && (
          <button
            type="button"
            onClick={onRequest}
            style={{
              fontFamily: F.sans, fontSize: 12, fontWeight: 500,
              padding: "8px 14px", borderRadius: 8,
              background: T.white, color: T.coal, border: `1px solid ${T.lineStrong}`,
              cursor: "pointer",
            }}
          >
            Enable
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SESSION SETUP — single-page flow (matches the SetupEmpty canvas)
   Target role + Company + Interview focus + Permissions → Start practice.
   ═══════════════════════════════════════════════ */

export default function SessionSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const preselectedFocus = searchParams.get("type");

  const [targetRole, setTargetRole] = useState(user?.targetRole || "");
  const [roleTouched, setRoleTouched] = useState(false);
  const [targetCompany, setTargetCompany] = useState(() => {
    if (user?.targetCompany) return user.targetCompany;
    // Fallback variant carries job history — pull the latest employer if
    // the stored resume is the regex-parsed shape. AI variant has no
    // equivalent field (headline instead), so skip.
    const rd = user?.resumeData;
    if (rd && rd._type === "fallback") return rd.experience?.[0]?.company || "";
    return "";
  });
  const recommendedFocus = getRecommendedFocus(user?.targetRole);
  const [interviewFocus, setInterviewFocus] = useState<string[]>(() => {
    if (preselectedFocus) {
      const match = Object.entries(focusToType).find(([, v]) => v === preselectedFocus);
      if (match) return [match[0]];
    }
    return [getRecommendedFocus(user?.targetRole)];
  });
  // Session length is fixed at 15m — the canvas-aligned setup screen no
  // longer asks the user to choose. The interview engine still respects
  // the URL param so this constant keeps the contract intact.
  const SESSION_LENGTH = "15m";
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const isFreeUser = !user?.subscriptionTier || user.subscriptionTier === "free";
  const isFirstTimer = !user?.practiceTimestamps || user.practiceTimestamps.length === 0;
  const freeSessionCount = user?.practiceTimestamps?.length ?? 0;
  const [showAllFocus, setShowAllFocus] = useState(false);
  const atSessionLimit = isFreeUser && freeSessionCount >= FREE_SESSION_LIMIT;
  const { toast } = useToast();

  // Redirect free users who've exhausted sessions to the upgrade modal
  useEffect(() => {
    if (atSessionLimit) setShowUpgradeModal(true);
  }, [atSessionLimit]);

  // Notify user if their subscription just expired and auto-downgraded
  useEffect(() => {
    try {
      const expired = sessionStorage.getItem("hirestepx_sub_expired");
      if (expired) {
        sessionStorage.removeItem("hirestepx_sub_expired");
        toast(`Your ${expired} plan has expired. You're now on the free tier.`, "info");
      }
    } catch { /* noop */ }
  }, [toast]);

  // Launch
  const [starting, setStarting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const [launching, setLaunching] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  /* ── Permissions ───────────────────────────────────────────────────────
     Mic is compulsory (voice-first interview); camera is optional and the
     user can skip it. We request permissions on this screen so the
     interview surface itself can launch with everything granted — no
     mid-interview permission prompt that breaks the flow. */
  type PermStatus = "idle" | "requesting" | "granted" | "denied";
  type DenyReason = "blocked" | "no-device";
  const [micStatus, setMicStatus] = useState<PermStatus>("idle");
  const [cameraStatus, setCameraStatus] = useState<PermStatus | "skipped">("idle");
  // Stream is mirrored into state so the PermissionCard can render a live
  // <video> preview. Ref alone wouldn't trigger a re-render in the child.
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micDenyReason, setMicDenyReason] = useState<DenyReason | null>(null);
  const [cameraDenyReason, setCameraDenyReason] = useState<DenyReason | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // iOS detection — Safari/iOS has a different "go to settings" path that
  // most users won't intuit, so we render iOS-specific recovery copy.
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let peak = 0;
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        if (level > peak) peak = level;
        setMicLevel(level);
        if (peak > 18) setVoiceDetected(true);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch { /* analyser optional */ }
  };

  const stopLevelMeter = () => {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  const reasonFromError = (err: unknown): DenyReason => {
    const name = (err as { name?: string })?.name;
    return name === "NotFoundError" || name === "OverconstrainedError" ? "no-device" : "blocked";
  };

  /* Tab-scoped opt-in flags. Survive a refresh, drop on tab close.
     We need these because navigator.permissions.query for
     "camera" / "microphone" returns "prompt" (not "granted") on Safari,
     Firefox, and many Chromium builds even when the OS grant is cached.
     Without a hint, refresh = camera mysteriously turns off.

     Tri-state — true = user opted in, false = user explicitly opted out
     (skipped or turned off), null = no decision yet. The "false" state
     is what makes the difference: the browser's permissions.query
     still says "granted" after a Turn off, so without this distinction
     a refresh would happily re-acquire the stream against the user's
     last action. */
  const OPTIN_MIC = "hsx_setup_mic_optin";
  const OPTIN_CAM = "hsx_setup_camera_optin";
  const readOptIn = (k: string): boolean | null => {
    try {
      const v = sessionStorage.getItem(k);
      return v === "1" ? true : v === "0" ? false : null;
    } catch { return null; }
  };
  const writeOptIn = (k: string, on: boolean) => {
    try { sessionStorage.setItem(k, on ? "1" : "0"); } catch { /* private mode */ }
  };

  const requestMic = async () => {
    setMicStatus("requesting");
    setMicDenyReason(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicStatus("granted");
      startLevelMeter(stream);
      writeOptIn(OPTIN_MIC, true);
      track("permission_granted", { kind: "mic" });
    } catch (e) {
      writeOptIn(OPTIN_MIC, false);
      const reason = reasonFromError(e);
      setMicDenyReason(reason);
      setMicStatus("denied");
      track("permission_denied", { kind: "mic", reason });
    }
  };

  const requestCamera = async () => {
    setCameraStatus("requesting");
    setCameraDenyReason(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraStatus("granted");
      writeOptIn(OPTIN_CAM, true);
      track("permission_granted", { kind: "camera" });
    } catch (e) {
      writeOptIn(OPTIN_CAM, false);
      const reason = reasonFromError(e);
      setCameraDenyReason(reason);
      setCameraStatus("denied");
      track("permission_denied", { kind: "camera", reason });
    }
  };

  const skipCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraStatus("skipped");
    writeOptIn(OPTIN_CAM, false);
    track("permission_skipped", { kind: "camera" });
  };

  // Allow a granted camera to be turned off — gives the user the same
  // pre-call control they'd expect from Zoom/Meet.
  const disableCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraStatus("skipped");
    writeOptIn(OPTIN_CAM, false);
  };

  /* Probe existing permission grants + tab-scoped opt-in on mount so a
     refresh doesn't toss the user back to "idle".

     Decision matrix:
       opt-in === true   → re-acquire (user opted in earlier this tab)
       opt-in === false  → DO NOT auto-restore (user explicitly turned
                            it off / skipped — overrides browser cache)
       opt-in === null   → consult permissions.query; if browser says
                            "granted" we treat it as opt-in.

     Without the explicit-false handling, "Turn off" on the camera card
     followed by a refresh would helpfully re-enable the camera, which
     ignores the user's most recent action. */
  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      const micPref = readOptIn(OPTIN_MIC);
      const camPref = readOptIn(OPTIN_CAM);
      let micGranted = micPref === true;
      let camGranted = camPref === true;
      const perms = (navigator as Navigator & { permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
      if (perms?.query) {
        if (micPref !== false) {
          try {
            const mic = await perms.query({ name: "microphone" as PermissionName });
            if (mic.state === "granted") micGranted = true;
          } catch { /* unsupported */ }
        }
        if (camPref !== false) {
          try {
            const cam = await perms.query({ name: "camera" as PermissionName });
            if (cam.state === "granted") camGranted = true;
          } catch { /* unsupported */ }
        }
      }
      if (mounted && micGranted) void requestMic();
      if (mounted && camGranted) void requestCamera();
      // Reflect explicit-skipped camera in UI so the user sees their
      // choice persisted instead of an idle "Allow" card.
      if (mounted && camPref === false && !camGranted) setCameraStatus("skipped");
    };
    void probe();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop preview streams + level meter on unmount.
  useEffect(() => {
    return () => {
      stopLevelMeter();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formComplete = !!targetRole.trim() && interviewFocus.length > 0;
  const canProceed = formComplete && micStatus === "granted";

  // Launch interview
  const handleStart = () => {
    if (!canProceed) return;
    if (!navigator.onLine) {
      toast("You're offline. Please check your internet connection before starting.", "error");
      return;
    }
    setStarting(true);
    unlockAudio();
    const focusType = focusToType[interviewFocus[0]] || "behavioral";
    track("session_start", { type: focusType, role: targetRole, sessionLength: SESSION_LENGTH });
    const introText = introByType[focusType] || introByType.behavioral;
    prefetchTTS(introText);
    setLaunching(true);
    setCountdown(3);
    setTimeout(() => setCountdown(2), 1000);
    setTimeout(() => setCountdown(1), 2000);
    setTimeout(() => {
      setCountdown(0);
      // Release the preview streams — the interview surface re-acquires
      // them. The browser keeps the permission grant so this is instant.
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      cameraStreamRef.current?.getTracks().forEach(t => t.stop());
      const cameraParam = cameraStatus === "granted" ? "&camera=1" : "";
      router.push(`/interview?type=${focusType}&difficulty=standard&new=1${targetCompany ? `&company=${encodeURIComponent(targetCompany)}` : ""}&role=${encodeURIComponent(targetRole)}&length=${SESSION_LENGTH}${cameraParam}`);
    }, 3000);
  };

  // Power-user shortcut: ⌘/Ctrl+Enter from anywhere on the page launches.
  // If the form is complete but mic is missing, the shortcut prompts for
  // mic instead of starting. Listed in the title-attr help text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (canProceed && !starting && isOnline) handleStart();
      else if (formComplete && micStatus !== "granted" && micStatus !== "requesting") void requestMic();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canProceed, starting, isOnline, formComplete, micStatus]);

  return (
    <div style={{ minHeight: "100vh", background: T.cream, display: "flex", flexDirection: "column", color: T.coal, fontFamily: F.sans }}>
      <style>{AUTH_STYLES}</style>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes launchIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes launchPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
        @keyframes countdownPop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes countdownFade { 0% { opacity: 1; transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0.6; transform: scale(0.95); } }
        .ob-card { background: ${T.white}; border: 1px solid ${T.line}; }
        .ob-mic-pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .ob-s2-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .ob-s2-focus-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .ob-permissions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ob-s2-session-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

        /* ─── Responsive layout ─────────────────────────────────────────
           Three breakpoints: tablet (≤1024), small (≤600), tiny (≤500). */
        .hsx-setup-topbar { padding: 32px 48px; }
        .hsx-setup-content { padding: clamp(24px, 4vh, 64px) 32px 80px; }
        .hsx-setup-hero-h1 { white-space: nowrap; }
        .hsx-setup-identity-name { display: inline; }

        @media (max-width: 1024px) {
          .ob-s2-focus-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 760px) {
          /* The hero clamp settles to its floor here and the nowrap
             starts overflowing. Let it wrap. */
          .hsx-setup-hero-h1 { white-space: normal !important; text-wrap: balance; }
        }
        @media (max-width: 600px) {
          .hsx-setup-topbar { padding: 16px 20px !important; }
          .hsx-setup-content { padding: 20px 20px 64px !important; }
          .ob-s2-role-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .ob-s2-focus-grid { grid-template-columns: 1fr 1fr !important; }
          .ob-s2-session-grid { grid-template-columns: 1fr !important; }
          .ob-permissions-grid { grid-template-columns: 1fr !important; }
          /* Keep the icon+copy+action row inline on mobile — wrapping made
             the granted card ~2× taller than it needed to be. Compact the
             padding + icon tile so everything still fits in 320-360px. */
          .hsx-permission-card { padding: 12px !important; gap: 10px !important; }
          .hsx-permission-card > span:first-child { width: 32px !important; height: 32px !important; }
          /* Camera preview is a wider rectangle — keep its aspect on mobile
             instead of being collapsed to the 32-square icon-tile size. */
          .hsx-permission-cam-preview { width: 56px !important; height: 42px !important; }
          .hsx-permission-actions { padding-top: 0 !important; }
          /* Focus chip labels ("Technical Leadership") need slightly less
             padding to fit comfortably in the 2-col mobile grid. */
          .ob-focus-card { padding: 12px !important; }
          .ob-focus-card span:nth-child(2) { font-size: 12px !important; }
          /* On phones a centered short CTA looks lonely — let it span the
             form again so the tap target is generous. */
          /* On phones the CTA is full-width AND the zone above it gets a
             1px hairline + extra padding so it reads as the commit zone. */
          .hsx-setup-cta { width: 100% !important; min-width: 0 !important; padding: 16px 24px !important; font-size: 15px !important; }
          .hsx-setup-cta-zone { border-top: 1px solid #EBE5D2; padding-top: 28px !important; margin-top: 32px !important; }
        }
        @media (max-width: 500px) {
          /* Drop the name to keep the right cluster from overflowing —
             avatar + Skip remain. The full name still appears via title
             attr on the avatar block. */
          .hsx-setup-identity-name { display: none !important; }
        }
      `}</style>

      {/* ─── Top Bar — same 3-col grid + tokens used by auth + onboarding. ─── */}
      <div className="hsx-setup-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", borderBottom: `1px solid ${T.line}`, background: T.cream, gap: 16 }}>
        <div role="button" tabIndex={0} onClick={() => router.push("/dashboard")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/dashboard"); } }} style={{ justifySelf: "start", cursor: "pointer" }} title="Back to dashboard">
          <Wordmark />
        </div>
        <div style={{ justifySelf: "center" }} />
        {/* Identity chip + escape link — matches the auth/onboarding pattern. */}
        <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14 }}>
          {(() => {
            const trimmed = (user?.name || "").trim();
            if (!trimmed) return null;
            const initials = trimmed.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("");
            return (
              <div title={trimmed} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: T.coal }}>
                <span aria-hidden style={{ width: 30, height: 30, borderRadius: 999, background: T.indigo100, color: T.indigo, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F.serif, fontSize: 13, fontWeight: 400, flexShrink: 0 }}>
                  {initials || (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </span>
                <span className="hsx-setup-identity-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{trimmed}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="hsx-setup-content" style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "auto" }}>
        <div style={{ width: "100%", maxWidth: "min(1080px, calc(100vw - 32px))", animation: "fadeUp 0.3s ease" }}>

          <div>
              {/* Hero — centered, matches the canvas SetupEmpty storyboard. */}
              <div style={{ marginBottom: 32, textAlign: "center" }} className="fade-up-1">
                <h2 className="hsx-setup-hero-h1" style={{ fontFamily: F.serif, fontSize: "clamp(1.75rem, 5.6vw, 4rem)", fontWeight: 400, color: T.coal, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>
                  Let&apos;s get you{" "}
                  <em style={{ fontStyle: "italic", fontWeight: 400, color: T.copper }}>ready</em>
                </h2>
                <p style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 1.55, color: T.inkSoft, marginTop: 14, marginBottom: 0, textWrap: "balance" }}>
                  Tell us a few things and we&apos;ll personalise the experience for you.
                </p>
                {/* Time pill — answers the unspoken "how long is this going to take?".
                    No question count: the engine adapts question depth to the 15-min window. */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, padding: "5px 12px", borderRadius: 999, background: T.copper100, color: T.copper, fontFamily: F.sans, fontSize: 12, fontWeight: 500 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  ~15 minutes
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {/* ── Role & Company — canvas-style: clean field rows, no card chrome ── */}
                <div className="fade-up-1">
                  <div className="ob-s2-role-grid">
                    <div>
                      <AutocompleteInput id="setup-role" value={targetRole} onChange={(v) => { setTargetRole(v); setRoleTouched(true); }} suggestions={ROLE_SUGGESTIONS} placeholder="e.g. Senior Engineering Manager..." label="Role" required error={roleTouched && !targetRole.trim() ? "Required to personalize your questions" : undefined} />
                    </div>
                    <div>
                      <AutocompleteInput id="setup-company" value={targetCompany} onChange={setTargetCompany} suggestions={COMPANY_SUGGESTIONS} placeholder="e.g. Google, Stripe..." label="Company (optional)" />
                    </div>
                  </div>
                </div>

                {/* ── Interview Focus — canvas-style: clean label, 5-col grid ── */}
                <div className="fade-up-2">
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.coal }}>
                      <span>Interview focus</span>
                      <span style={{ color: T.copper, fontSize: 12 }}>*</span>
                    </div>
                    <div style={{ fontFamily: F.sans, fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                      {isFirstTimer && !showAllFocus
                        ? "We picked the best for your role. Explore all 10 below."
                        : "Choose one area to focus on."}
                    </div>
                  </div>
                  <div className="ob-s2-focus-grid">
                    {(() => {
                      const allOpts = [
                        { value: "Behavioral", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, desc: "Tell stories about how you handled past situations" },
                        { value: "Strategic", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, desc: "Show how you set vision and align teams" },
                        { value: "Technical Leadership", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, desc: "Walk through architecture and tech tradeoffs" },
                        { value: "Case Study", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, desc: "Solve real business problems out loud" },
                        { value: "Campus Placement", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/></svg>, desc: "Talk projects, goals, and teamwork — fresher style" },
                        { value: "HR Round", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, desc: "Culture fit, motivation, salary expectations" },
                        { value: "Management", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>, desc: "How you lead, hire, and handle change" },
                        { value: "Panel Interview", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, desc: "Field three angles at once — manager, peer, HR" },
                        { value: "Salary Negotiation", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, desc: "Negotiate offer, benefits, and counter-offers" },
                        { value: "Government / PSU", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>, desc: "Ethics, current affairs, public-service motivation" },
                      ];
                      const visibleOpts = (isFirstTimer && !showAllFocus)
                        ? (() => {
                            const top3 = new Set([recommendedFocus, "Behavioral", "HR Round"]);
                            if (recommendedFocus === "Behavioral") top3.add("Strategic");
                            return allOpts.filter(o => top3.has(o.value));
                          })()
                        : allOpts;
                      return visibleOpts.map(opt => {
                        const sel = interviewFocus[0] === opt.value;
                        const isRecommended = opt.value === recommendedFocus && recommendedFocus !== "Behavioral";
                        return (
                          <button key={opt.value} className="ob-focus-card" onClick={() => setInterviewFocus([opt.value])}
                            type="button"
                            role="radio"
                            aria-checked={sel}
                            style={{
                              padding: 14, borderRadius: 12, cursor: "pointer", transition: "all 0.22s cubic-bezier(.2,.7,.2,1)", textAlign: "left",
                              background: sel ? `linear-gradient(180deg, ${T.indigo100}, ${T.white})` : T.white,
                              border: `1px solid ${sel ? T.indigo : T.line}`,
                              boxShadow: sel ? `0 0 0 3px ${T.indigoRing}` : "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
                              display: "flex", alignItems: "center", gap: 10, color: T.coal,
                              position: "relative", fontFamily: F.sans,
                            }}>
                            {isRecommended && (
                              <span style={{ position: "absolute", top: -8, right: 10, fontFamily: F.sans, fontSize: 9, fontWeight: 700, color: T.cream, background: T.indigo, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>For you</span>
                            )}
                            <span style={{ width: 32, height: 32, borderRadius: 6, background: T.indigo100, color: T.coal, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {opt.icon}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: T.coal, flex: 1, lineHeight: 1.2 }}>{opt.value}</span>
                            <span aria-hidden style={{ width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${sel ? T.indigo : T.line}`, background: sel ? T.indigo : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                  {isFirstTimer && !showAllFocus && (
                    <button onClick={() => setShowAllFocus(true)}
                      style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px auto 0", fontFamily: F.sans, fontSize: 12, fontWeight: 500, color: T.indigo, background: "none", border: "none", cursor: "pointer", padding: "6px 12px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      Show all 10 interview types
                    </button>
                  )}
                </div>

                {/* ── Permissions — mic compulsory, camera optional ── */}
                <div className="fade-up-3">
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.coal }}>Permissions</div>
                    <div style={{ fontFamily: F.sans, fontSize: 12, color: T.inkSoft, marginTop: 4 }}>
                      We&apos;ll only use these for this practice session. Nothing is recorded or shared.
                    </div>
                  </div>
                  <div className="ob-permissions-grid">
                    <PermissionCard
                      kind="mic"
                      label="Microphone"
                      sublabel="Required"
                      sublabelTone="copper"
                      status={micStatus}
                      onRequest={requestMic}
                      level={micLevel}
                      voiceDetected={voiceDetected}
                      denyReason={micDenyReason}
                      isIOS={isIOS}
                    />
                    <PermissionCard
                      kind="camera"
                      label="Camera"
                      sublabel="Optional"
                      sublabelTone="muted"
                      status={cameraStatus}
                      onRequest={requestCamera}
                      onSkip={skipCamera}
                      onDisable={disableCamera}
                      denyReason={cameraDenyReason}
                      isIOS={isIOS}
                      cameraStream={cameraStream}
                    />
                  </div>
                </div>

              </div>
            </div>


          {/* ─── Single canvas-style "Start practice" CTA + trust line.
                The CTA stays clickable when only the mic is missing — it
                triggers the prompt instead of failing silently. */}
          <div className="hsx-setup-cta-zone" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 48, paddingTop: 24 }}>
            {(() => {
              const needsMic = formComplete && micStatus !== "granted" && micStatus !== "requesting";
              const isHardDisabled = !formComplete || starting || !isOnline || micStatus === "requesting";
              const ctaLabel = starting
                ? "Starting…"
                : needsMic
                  ? "Allow microphone to start"
                  : "Start practice";
              const shortcutHint = isIOS ? "" : " · ⌘/Ctrl + Enter";
              const ctaTitle = !formComplete
                ? "Pick a target role and interview focus to continue."
                : needsMic
                  ? micStatus === "denied"
                    ? "Microphone is blocked. Open browser settings to allow it, then try again."
                    : "We need microphone access to start a voice interview."
                  : !isOnline
                    ? "You're offline. Reconnect to start."
                    : `Start your practice interview${shortcutHint}`;
              const onCtaClick = () => {
                if (needsMic) { void requestMic(); return; }
                handleStart();
              };
              return (
                <button
                  type="button"
                  onClick={onCtaClick}
                  disabled={isHardDisabled}
                  title={ctaTitle}
                  aria-label={ctaTitle ?? ctaLabel}
                  className="hsx-setup-cta"
                  style={{
                    fontFamily: F.sans, fontSize: 16, fontWeight: 600, padding: "18px 36px", borderRadius: 12, border: "1px solid transparent",
                    background: T.indigo, color: T.cream,
                    cursor: isHardDisabled ? "not-allowed" : "pointer",
                    opacity: isHardDisabled ? 0.45 : needsMic ? 0.85 : 1,
                    transition: "all 180ms cubic-bezier(.2,.7,.2,1)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 12,
                    boxShadow: isHardDisabled ? "none" : "0 2px 4px rgba(20,17,10,.10), 0 12px 28px -10px rgba(49,46,129,.45)",
                    letterSpacing: 0.1,
                    minWidth: 320,
                  }}
                >
                  {starting ? (
                    <span style={{ width: 16, height: 16, border: `2.5px solid ${T.indigoRing}`, borderTopColor: T.cream, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  ) : null}
                  {ctaLabel}
                  {!starting && (
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  )}
                </button>
              );
            })()}

            <div aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, fontFamily: F.sans, fontSize: 12, color: T.inkSoft, minHeight: 18 }}>
              {micStatus === "granted" && cameraStatus === "granted" && "Mic and camera ready — you're all set."}
              {micStatus === "granted" && cameraStatus !== "granted" && "Mic ready. Camera is optional."}
              {micStatus !== "granted" && (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Your responses stay private and are never shared.
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Countdown overlay */}
      {launching && countdown !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: T.cream, animation: "launchIn 0.4s ease",
        }}>
          {countdown > 0 ? (
            <>
              <div key={countdown} style={{
                width: 120, height: 120, borderRadius: "50%",
                background: `linear-gradient(135deg, rgba(49,46,129,0.12), rgba(49,46,129,0.04))`,
                border: `2px solid ${T.indigoRing}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 32,
                animation: "countdownPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}>
                <span style={{
                  fontFamily: F.serif, fontSize: 56, fontWeight: 600,
                  color: T.indigo, lineHeight: 1,
                  animation: "countdownFade 1s ease",
                }}>
                  {countdown}
                </span>
              </div>
              <p style={{ fontFamily: F.sans, fontSize: 15, color: T.inkFaint, letterSpacing: "0.02em" }}>
                Get ready...
              </p>
            </>
          ) : (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: 16, marginBottom: 24,
                background: `linear-gradient(135deg, rgba(49,46,129,0.15), rgba(49,46,129,0.05))`,
                border: "1px solid rgba(49,46,129,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "launchPulse 1.2s ease-in-out infinite",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.indigo} strokeWidth="2" strokeLinecap="round"><polygon points="5,3 19,12 5,21"/></svg>
              </div>
              <h2 style={{ fontFamily: F.serif, fontSize: 28, fontWeight: 400, color: T.coal, marginBottom: 8, letterSpacing: "-0.02em" }}>
                Let's go!
              </h2>
            </>
          )}
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => { setShowUpgradeModal(false); if (atSessionLimit) router.push("/dashboard"); }}
          sessionsUsed={freeSessionCount}
          user={user}
          currentTier={user?.subscriptionTier || "free"}
          onPaymentSuccess={(_tier: string, _start: string, _end: string) => {
            setShowUpgradeModal(false);
          }}
        />
      )}
    </div>
  );
}
