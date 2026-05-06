/**
 * Interview Question Taxonomy
 *
 * 18 categories of interviewer-asked questions + 4 categories of
 * candidate-asked questions (the kind a good candidate asks back at
 * closing). Each category lists:
 *   - intent: what the interviewer is actually probing for
 *   - signals: what a strong vs weak answer looks like
 *   - stems: 6-10 representative question stems (the LLM should
 *     produce semantically equivalent phrasings, not copy verbatim)
 *
 * Used by:
 *   - data/focus-question-recipes.ts to compose category mixes per
 *     interview focus (behavioral, hr-round, panel, etc.)
 *   - server-handlers/generate-questions.ts to inject category
 *     descriptions into the LLM prompt
 *   - server-handlers/follow-up.ts to recognise when a candidate is
 *     asking the AI a question (closing-phase reverse interview)
 *
 * Source: distilled from a curated bank of ~360 real interview
 * questions covering Indian + global hiring patterns. Numbered 1-18
 * for interviewer-asked, A-D for candidate-asked.
 */

export type CategoryKey =
  | "opening-resume"
  | "experience-deepdive"
  | "role-execution"
  | "problem-solving"
  | "ownership"
  | "pressure-resilience"
  | "collaboration"
  | "communication"
  | "leadership"
  | "adaptability-learning"
  | "decision-making"
  | "customer-user"
  | "culture-fit"
  | "salary-practical"
  | "hr-essentials"
  | "managerial"
  | "trap"
  | "closing-questions"
  // Candidate-asked (reverse-interview) categories
  | "ask-about-role"
  | "ask-about-team"
  | "ask-about-growth"
  | "ask-about-company";

export interface CategoryDef {
  /** Stable key used by recipes. */
  key: CategoryKey;
  /** Short label for prompt context. */
  label: string;
  /** What the interviewer is actually probing for — drives scoreNote. */
  intent: string;
  /** Signal markers — drives the AI's evaluation lens. */
  signals: { strong: string; weak: string };
  /** Representative stems — LLM should paraphrase + personalise, not copy. */
  stems: string[];
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  /* ─── 1. Opening / resume walkthrough ─── */
  "opening-resume": {
    key: "opening-resume",
    label: "Opening / resume walkthrough",
    intent: "Establish context, surface what the candidate considers important, and warm them up before harder probes. Tests narrative clarity and self-awareness.",
    signals: {
      strong: "Tight 60-90s arc with one sharp signal per role; ties past to the target role.",
      weak: "Reads the resume top-to-bottom, no filtering, no narrative thread.",
    },
    stems: [
      "Tell me about yourself — the 90-second version.",
      "Walk me through your resume, focusing on what's most relevant for this role.",
      "Which project on your resume best represents how you work?",
      "What's not on your resume that we should know?",
      "Why are you exploring a change right now?",
      "Why this role, and why this company?",
      "How does this role fit your career arc?",
      "What pulled you toward {targetRole}?",
    ],
  },

  /* ─── 2. Experience / project deep-dive ─── */
  "experience-deepdive": {
    key: "experience-deepdive",
    label: "Experience / project deep-dive",
    intent: "Force a STAR-shaped answer with real numbers. Probes: scope, constraints, decisions, trade-offs, outcome.",
    signals: {
      strong: "Names stakeholders, owns a specific decision, quantifies impact, talks honestly about what didn't work.",
      weak: "Stays at the level of 'we built X' without scope, metrics, or trade-offs.",
    },
    stems: [
      "Pick one project you led — walk me through what you actually shipped.",
      "What was the business goal behind that project, and how did you measure success?",
      "What was your exact contribution, separate from your team's?",
      "What trade-off did you have to make, and what did you give up?",
      "What's the part of that project that didn't work the first time?",
      "If you redid that project tomorrow, what's the one thing you'd change?",
      "Walk me through how you handled unclear requirements on that project.",
      "What was the hardest decision in that project?",
    ],
  },

  /* ─── 3. Role-specific execution ─── */
  "role-execution": {
    key: "role-execution",
    label: "Role-specific execution",
    intent: "Probes the candidate's daily craft — their default process, quality bar, and tools. 2026 standard: tests AI-tooling discipline (when to lean on Cursor/Copilot/Claude Code vs. when to verify by hand).",
    signals: {
      strong: "Describes a repeatable process with specific checkpoints; names tools concretely (including AI assistants and where they trust them vs. verify); admits where they cut corners.",
      weak: "Generic answers ('I plan and execute'); no checkpoints; can't articulate when to use AI tooling vs. when it's a liability; can't name a tool they're strongest in.",
    },
    stems: [
      "Walk me through your usual process from a fresh assignment to delivery.",
      "How do you decide what to work on first when everything feels urgent?",
      "What does 'good work' look like in your role?",
      "How do you review your own work before sending it for review?",
      "Which tool or skill are you currently learning, and why that one?",
      "How do you make sure your work doesn't create friction for the next person?",
      "Where do you use AI tooling in your daily work, and where do you deliberately NOT use it?",
      "Tell me about a time AI-generated output looked right but was wrong. How did you catch it?",
    ],
  },

  /* ─── 4. Problem-solving ─── */
  "problem-solving": {
    key: "problem-solving",
    label: "Problem-solving",
    intent: "Tests structured thinking under uncertainty. Looks for: framing, decomposition, assumption-checking, recovery.",
    signals: {
      strong: "Frames the problem before solving, lists 2-3 candidate solutions with trade-offs, knows when to escalate.",
      weak: "Jumps straight to a tool/answer; doesn't separate symptom from cause; gives up at the first dead-end.",
    },
    stems: [
      "Tell me about a problem you'd never seen before — how did you start?",
      "Walk me through a time your first solution failed.",
      "How do you find the root cause when the symptom is unclear?",
      "What do you do when you're stuck and don't know who to ask?",
      "Tell me about a time you reduced effort, cost, or time on something repetitive.",
      "What's the hardest problem you've solved at work, and why was it hard?",
    ],
  },

  /* ─── 5. Ownership / accountability ─── */
  ownership: {
    key: "ownership",
    label: "Ownership & accountability",
    intent: "Probes whether the candidate operates beyond their JD. Looks for proactive fixes, public mistake-owning, end-to-end delivery.",
    signals: {
      strong: "Names a specific moment they took on a problem nobody assigned them; admits a real mistake without externalising blame.",
      weak: "Talks about ownership abstractly; their failure stories are always 'team-level' or 'someone else's fault'.",
    },
    stems: [
      "Tell me about a time you took on something that wasn't your job.",
      "Tell me about a recent mistake — what did you do after?",
      "Tell me about a time you missed a deadline. What did you do next?",
      "Tell me about a time you flagged a risk early.",
      "What does ownership mean to you in your day-to-day?",
      "Tell me about a time you protected quality even when there was pressure to ship.",
    ],
  },

  /* ─── 6. Pressure / failure / resilience ─── */
  "pressure-resilience": {
    key: "pressure-resilience",
    label: "Pressure, failure, resilience",
    intent: "Tests how the candidate behaves when things go wrong. Looks for honesty about failure + concrete recovery actions.",
    signals: {
      strong: "Picks a real failure (not a humble-brag), describes what they learned in concrete terms, shows a behaviour change.",
      weak: "Picks a fake failure ('I cared too much'); attributes failure to others; no behaviour change.",
    },
    stems: [
      "Tell me about a real failure at work — not a near miss.",
      "Tell me about your most stressful work week — what got you through it?",
      "Tell me about feedback that stung. How did you use it?",
      "What do you do when you're overwhelmed and can't see a path forward?",
      "What's the biggest professional setback you've faced, and how did it change how you work?",
    ],
  },

  /* ─── 7. Collaboration ─── */
  collaboration: {
    key: "collaboration",
    label: "Collaboration & teamwork",
    intent: "How they handle disagreement, cross-functional friction, and people with different working styles.",
    signals: {
      strong: "Names the disagreement clearly, describes how they listened first, ended at a real compromise (not a 'we all agreed').",
      weak: "Avoids naming the conflict; ends every story with everyone agreeing; can't articulate the other person's POV.",
    },
    stems: [
      "Tell me about a time you disagreed with a teammate. How did it end?",
      "Tell me about a time you disagreed with your manager — and how you raised it.",
      "Tell me about a time you changed your mind after hearing someone else out.",
      "How do you handle a teammate who's slow to respond or unreliable?",
      "Tell me about a time you helped a junior teammate get unstuck.",
    ],
  },

  /* ─── 8. Communication ─── */
  communication: {
    key: "communication",
    label: "Communication",
    intent: "Tests clarity, audience-adaptation, and managing expectations.",
    signals: {
      strong: "Picks the right level of detail for the audience; uses concrete examples; closes with explicit next steps.",
      weak: "One register for everyone; lots of jargon; doesn't follow up after meetings.",
    },
    stems: [
      "How would you explain your most technical project to someone non-technical?",
      "Tell me about a time poor communication caused a real issue.",
      "How do you communicate bad news — a delay, a regression, a hard 'no'?",
      "How do you handle a stakeholder who keeps changing requirements?",
      "How do you adapt your communication for different people in the room?",
    ],
  },

  /* ─── 9. Leadership / influence ─── */
  leadership: {
    key: "leadership",
    label: "Leadership & influence",
    intent: "How they get things done through other people, especially without formal authority.",
    signals: {
      strong: "Has led without title; names specific moments of difficult feedback or alignment-building; balances empathy with accountability.",
      weak: "Treats leadership as a job title; gives generic answers about 'motivating the team'.",
    },
    stems: [
      "Tell me about a time you led without having authority.",
      "Tell me about a time you gave someone difficult feedback.",
      "How do you build alignment when stakeholders disagree?",
      "Tell me about a time you helped a team stay focused under pressure.",
      "How do you handle underperformance on a team you don't manage?",
    ],
  },

  /* ─── 10. Adaptability / learning ─── */
  "adaptability-learning": {
    key: "adaptability-learning",
    label: "Adaptability & learning",
    intent: "How they keep skills current, how they handle priority shifts, and what they're learning right now. 2026 standard: tests GenAI fluency for non-AI roles (does a PM/designer/marketer who's NOT an AI specialist still have working knowledge of LLMs in their domain?).",
    signals: {
      strong: "Names a specific skill they picked up in the last 6 months and where they applied it; comfortable saying 'I don't know yet'; for non-AI roles, articulates how GenAI reshaped their craft and where they've adopted it concretely.",
      weak: "Generic 'I read articles'; can't name a recent skill or who they learn from; treats GenAI as a buzzword they haven't actually used.",
    },
    stems: [
      "Tell me about something you learned quickly because you had to.",
      "What new skill have you picked up in the last 6 months, and where did you use it?",
      "Tell me about a time priorities flipped on you mid-quarter.",
      "Who do you learn from professionally? Be specific.",
      "What skill do you think will matter most in your role over the next 2-3 years?",
      "How has GenAI changed how you do your job in the last 12 months — concretely, not abstractly?",
      "Tell me about a moment you'd been doing something a certain way for years and you scrapped it for a new approach.",
    ],
  },

  /* ─── 11. Decision-making ─── */
  "decision-making": {
    key: "decision-making",
    label: "Decision-making",
    intent: "How they decide under incomplete information, balance trade-offs, and explain their logic.",
    signals: {
      strong: "Names a framework or set of factors; can articulate what would have changed their mind; owns regret without externalising.",
      weak: "Says 'I just go with my gut'; can't name a recent decision they regret.",
    },
    stems: [
      "Tell me about a difficult decision you made with incomplete information.",
      "How do you balance short-term wins against long-term cost?",
      "Tell me about a decision you regret — what would you do differently?",
      "How do you decide when to escalate vs. decide yourself?",
      "How do you get buy-in for a decision that's unpopular?",
    ],
  },

  /* ─── 12. Customer / user-focused ─── */
  "customer-user": {
    key: "customer-user",
    label: "Customer / user-focus",
    intent: "How well they understand the gap between what users say and what they need.",
    signals: {
      strong: "Names a specific moment user feedback changed their work; can articulate when to override user requests.",
      weak: "Treats 'user feedback' as monolithic; can't talk about conflicting user needs.",
    },
    stems: [
      "Tell me about a time user feedback changed how you built something.",
      "How do you handle conflicting customer needs?",
      "How do you tell the difference between what users say they want and what they actually need?",
      "Tell me about a customer pain point you solved — and how you measured the fix.",
      "How do you communicate limitations or hard 'no's to customers?",
    ],
  },

  /* ─── 13. Culture fit / values ─── */
  "culture-fit": {
    key: "culture-fit",
    label: "Culture fit / values",
    intent: "Probes what kind of environment they thrive in (or not), motivation, ethics under pressure.",
    signals: {
      strong: "Honest about what doesn't work for them; can name a time they did the right thing when it cost them; specific about non-negotiables.",
      weak: "Says 'I work well anywhere'; vague on values; can't name a hard line.",
    },
    stems: [
      "What kind of culture brings out your best work? What kind doesn't?",
      "Tell me about a time you did the right thing when it was uncomfortable.",
      "What are your non-negotiables at work?",
      "How do you handle workplace politics?",
      "What's a time you stayed quiet when you wish you'd spoken up?",
    ],
  },

  /* ─── 14. Salary / notice / practical ─── */
  "salary-practical": {
    key: "salary-practical",
    label: "Salary, notice, practical logistics",
    intent: "Practical employment details. Often interleaved with HR round.",
    signals: {
      strong: "Has a clear number and rationale; transparent about competing offers; realistic about start dates.",
      weak: "Dodges the question; gives wildly inflated expectations without justification; vague on notice period.",
    },
    stems: [
      "What are your salary expectations for this role, and what's that based on?",
      "What's your current CTC and notice period?",
      "Are you actively interviewing elsewhere? At what stages?",
      "Why are you asking for a {N}% jump from your current package?",
      "What would help you make a decision if we made an offer?",
    ],
  },

  /* ─── 15. HR-round essentials (Indian context) ─── */
  "hr-essentials": {
    key: "hr-essentials",
    label: "HR round essentials (Indian context)",
    intent: "Standard HR-round battery — softer than managerial, harder than opener. Tests motivation, fit, basic logistics.",
    signals: {
      strong: "Specific reasons for change, honest about gaps/job-hops, names a real weakness, has a thoughtful 'why us' answer.",
      weak: "'I want growth' as the only reason; rehearsed weakness ('I'm a perfectionist'); generic 'why us'.",
    },
    stems: [
      "Why are you leaving your current company? Be specific.",
      "Why is there a gap from {date} to {date}?",
      "Why have you switched jobs every {N} years?",
      "What's a real weakness — something a manager has actually given you feedback on?",
      "What do you actually know about our company and team?",
      "What would make you accept this offer over another?",
    ],
  },

  /* ─── 16. Managerial round ─── */
  managerial: {
    key: "managerial",
    label: "Managerial round",
    intent: "Tests how they operate with a manager — planning, escalation, scope of independence, stakeholder handling.",
    signals: {
      strong: "Has a planning rhythm; escalates with a recommendation, not just a problem; manages up clearly.",
      weak: "Waits to be told what to do; surprises their manager with delays; can't articulate what support they need.",
    },
    stems: [
      "How do you plan your week when priorities are unclear?",
      "How do you escalate a risk to a manager who's hard to reach?",
      "What support do you expect from a manager — what do you NOT need?",
      "Tell me about a time you handled a difficult stakeholder.",
      "What would you do in your first 30 days here?",
    ],
  },

  /* ─── 17. Trap questions ─── */
  trap: {
    key: "trap",
    label: "Trap questions",
    intent: "Questions designed to catch rehearsed answers, expose ego, or surface red flags. Use sparingly — 1 per session max.",
    signals: {
      strong: "Doesn't get defensive; gives a real answer instead of the 'right' answer; admits limits with confidence.",
      weak: "Visibly rehearsed; deflects to a humble-brag; gets defensive or political.",
    },
    stems: [
      "Why should we NOT hire you?",
      "Tell me about your worst manager — what did you learn?",
      "What if we offer 20% less than your expected package?",
      "What if you get a better offer 2 weeks after joining us?",
      "Why didn't you get promoted in your last role?",
      "Are you applying because you need a job, or because you want THIS role?",
    ],
  },

  /* ─── 18. Closing questions ─── */
  "closing-questions": {
    key: "closing-questions",
    label: "Closing",
    intent: "Wrap-up + signal next steps + give the candidate a chance to ask back.",
    signals: {
      strong: "Has 2-3 sharp questions ready; uses the time to surface real concerns; closes with clear interest.",
      weak: "'No questions, you covered everything'; closes lazily.",
    },
    stems: [
      "What makes you the right fit for this role specifically?",
      "Do you have any questions for me?",
      "Anything you wanted to share that we didn't get to?",
      "What's your timeline for making a decision?",
    ],
  },

  /* ════════════════════════════════════════════════════════════════
     Candidate-asked (reverse-interview) categories. These are
     questions the CANDIDATE may ask the AI at closing. The AI must
     answer in character (as the hiring manager / panelist), giving a
     plausible role-and-company-specific response. NOT meant to leak
     internal HireStepX context.
     ════════════════════════════════════════════════════════════════ */

  "ask-about-role": {
    key: "ask-about-role",
    label: "Candidate asks about the role",
    intent: "Candidate is testing how grounded the role is. AI answers in character — plausible, role-specific, doesn't claim certainty about things a real interviewer wouldn't know.",
    signals: { strong: "", weak: "" },
    stems: [
      "What does success look like in the first 90 days?",
      "What are the biggest challenges for this role right now?",
      "What would my first project be?",
      "How is performance measured?",
      "Why is this position open?",
    ],
  },
  "ask-about-team": {
    key: "ask-about-team",
    label: "Candidate asks about the team",
    intent: "Candidate is probing team structure, working style, and decision-making. AI answers as the hiring manager would.",
    signals: { strong: "", weak: "" },
    stems: [
      "Who would I work with most closely?",
      "How is the team structured?",
      "How does the team make decisions?",
      "What's the team's biggest challenge right now?",
      "What kind of person succeeds on this team?",
    ],
  },
  "ask-about-growth": {
    key: "ask-about-growth",
    label: "Candidate asks about growth",
    intent: "Candidate is testing development pathways. AI gives plausible career-track context for the role.",
    signals: { strong: "", weak: "" },
    stems: [
      "What learning opportunities are available?",
      "What does career progression look like from this role?",
      "How often do performance reviews happen?",
      "What does the next level after this role look like?",
      "How is good performance rewarded?",
    ],
  },
  "ask-about-company": {
    key: "ask-about-company",
    label: "Candidate asks about the company / culture",
    intent: "Candidate is probing values-in-practice and company priorities. AI answers as a mid-senior manager would — honest about challenges, not corporate-speak.",
    signals: { strong: "", weak: "" },
    stems: [
      "What is the company's current priority?",
      "What's one thing you genuinely like about working here?",
      "What's one thing the company is still improving?",
      "How does leadership communicate with employees?",
      "What's the next step in the interview process?",
    ],
  },
};
