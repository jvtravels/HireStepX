/* HireStepX — Personalised behavioural-interview intro builder
 *
 * Static script intros are anonymous and metronomic:
 *   "Hi! Welcome to your behavioral mock interview. I'm your AI
 *    interviewer today. We'll focus on leadership... Ready?"
 *
 * Real Indian interviewers open differently:
 *   1. They introduce themselves BY NAME (one of the strongest
 *      "this is a real person" signals — anonymous "AI interviewer"
 *      kills the suspension of disbelief in the first three seconds).
 *   2. They open with a rapport beat — city, current role, or a
 *      short "what brings you here" — BEFORE diving into structured
 *      questions. Skipping rapport feels brusque and American.
 *
 * This helper builds a single personalised intro string that does both,
 * keeping the spoken-duration budget close to the original (~6 seconds).
 *
 * Why pure: trivially unit-testable, no React imports, no LLM, no DB.
 * The engine calls this once at session init and stores the result on
 * the script's intro step. The same output also feeds the report-side
 * voice-continuity check (same interviewer name surfaces in evaluation).
 */

export interface BuildBehavioralIntroOpts {
  /** Deterministic per-session interviewer name (e.g. "Priya Sharma").
   *  Built upstream via getInterviewerName(seed). */
  interviewerName: string;
  /** Optional candidate name from their profile. Greeting feels warmer
   *  when included but the intro must also work without it (resumeless
   *  practice flow). */
  candidateName?: string;
  /** Target role the candidate is practising for, e.g. "Senior Product
   *  Manager". Used in the rapport hook ("...what brings you to Senior
   *  PM?"). Falls back to a neutral phrase when absent. */
  role?: string;
  /** Optional company the candidate is targeting. When present, the
   *  rapport hook anchors there ("...what brings you to PM at Razorpay?"). */
  company?: string;
}

/* Indian IT-services companies. At these firms the academic-pedigree
   opener ("walk me through 10th, 12th, B.Tech, any backlogs") is a
   real ritual — present even for 8-year-experienced laterals. Swapping
   the rapport hook to a pedigree variant makes the intro feel genuinely
   services-track. Conservative list — only the firms where this ritual
   is unambiguous. Product-cos (Razorpay, Flipkart) and MNC-IN (Google
   India, Microsoft India) keep the default rapport hook. */
const SERVICES_TRACK_COMPANIES = [
  "tcs", "tata consultancy", "infosys", "wipro", "cognizant",
  "accenture", "capgemini", "tech mahindra", "hcl", "hcltech",
  "ltimindtree", "lti", "mindtree", "mphasis", "persistent",
  "ibm india", "dxc", "birlasoft",
];
function isServicesTrack(company: string): boolean {
  const c = company.toLowerCase();
  return SERVICES_TRACK_COMPANIES.some(name => c.includes(name));
}

/** Returns a 2-3 sentence personalised intro. Single-line, no markdown,
 *  TTS-safe (no brackets, no markup). */
export function buildBehavioralIntro(opts: BuildBehavioralIntroOpts): string {
  const interviewer = (opts.interviewerName || "").trim();
  const candidate = (opts.candidateName || "").trim();
  const role = (opts.role || "").trim();
  const company = (opts.company || "").trim();

  // First-name only for the spoken greeting (full name reads stiff
  // and the candidate's report still surfaces the full name).
  const interviewerFirst = interviewer.split(/\s+/)[0] || "your interviewer";
  const candidateFirst = candidate.split(/\s+/)[0];

  /* Greeting — uses candidate first name when known, falls back to
     a warm-but-neutral opener otherwise. */
  const greeting = candidateFirst
    ? `Hi ${candidateFirst}, thanks for taking the time today.`
    : `Hi, thanks for taking the time today.`;

  /* Self-introduction. The "I'll be your interviewer for the next
     few minutes" framing matches Indian recruiting register — warmer
     than "I'm your AI interviewer", more grounded than skipping the
     intro entirely. */
  const selfIntro = `I'm ${interviewerFirst}, and I'll be your interviewer for the next few minutes.`;

  /* Rapport hook. Anchored on role/company when available so the
     candidate's first response is contextual, not generic. Always
     ends with a "feel free to take your time" beat — the Indian
     equivalent of "no pressure, this is a conversation."

     Services-track variant: at TCS / Infosys / Wipro etc., interviewers
     genuinely open with an academic-background walkthrough — even for
     experienced laterals. Mirroring that ritual makes the intro feel
     authentic; the candidate is also primed to deliver pedigreeRecital
     content which the cultural-register detector will recognise as a
     non-penalty signal. */
  let rapportHook: string;
  if (company && isServicesTrack(company)) {
    rapportHook = role
      ? `Before we get into the structured questions — just briefly, walk me through your background a bit, your academics and what you've been doing currently. And what's drawing you to ${role} at ${company}?`
      : `Before we get into the structured questions — just briefly, walk me through your background a bit, your academics and what you've been doing currently. And what brings you to ${company}?`;
  } else if (role && company) {
    rapportHook = `Before we dive into the structured questions — just briefly, where are you joining from today, and what's drawing you to ${role} at ${company}?`;
  } else if (role) {
    rapportHook = `Before we dive in — just briefly, where are you joining from today, and what's drawing you to ${role}?`;
  } else if (company) {
    rapportHook = `Before we dive in — just briefly, where are you joining from today, and what's drawing you to ${company}?`;
  } else {
    rapportHook = `Before we dive in — just briefly, where are you joining from today, and what brings you here?`;
  }

  return `${greeting} ${selfIntro} ${rapportHook}`;
}

/** Display-ready variant — identical to TTS output for behavioural intros
 *  (no prosody markers to strip). Kept as a separate function so future
 *  prosody additions to buildBehavioralIntro (e.g. [pause:short] beats)
 *  don't leak into the UI. */
export function buildBehavioralIntroDisplay(opts: BuildBehavioralIntroOpts): string {
  return buildBehavioralIntro(opts);
}
