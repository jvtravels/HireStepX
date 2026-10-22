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
  | "failure-learning"
  | "collaboration"
  | "communication"
  | "leadership"
  | "adaptability-learning"
  | "self-awareness"
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
  /** What the interviewer is actually probing for, drives scoreNote. */
  intent: string;
  /** Signal markers, drives the AI's evaluation lens. */
  signals: { strong: string; weak: string };
  /** Representative stems, LLM should paraphrase + personalise, not copy. */
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
      "Tell me about yourself, the 90-second version.",
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
      "Pick one project you led, walk me through what you actually shipped.",
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
    intent: "Probes the candidate's daily craft, their default process, quality bar, and tools. 2026 standard: tests AI-tooling discipline (when to lean on Cursor/Copilot/Claude Code vs. when to verify by hand).",
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
      "Tell me about a problem you'd never seen before, how did you start?",
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
      "Tell me about a recent mistake, what did you do after?",
      "Tell me about a time you missed a deadline. What did you do next?",
      "Tell me about a time you flagged a risk early.",
      "What does ownership mean to you in your day-to-day?",
      "Tell me about a time you protected quality even when there was pressure to ship.",
      "Tell me about a time you had to manage something end-to-end.",
      "Tell me about a time you had to deliver without enough support.",
      "Tell me about a time you fixed a problem that was not directly assigned to you.",
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
      "Tell me about a real failure at work, not a near miss.",
      "Tell me about your most stressful work week, what got you through it?",
      "Tell me about your most stressful work situation.",
      "Tell me about feedback that stung. How did you use it?",
      "What do you do when you're overwhelmed and can't see a path forward?",
      "What's the biggest professional setback you've faced, and how did it change how you work?",
      "Tell me about a time you had a very tight deadline.",
      "How do you stay calm when things are uncertain?",
      "Tell me about a time something went wrong at the last minute.",
      "Tell me about a time you had to deliver quality work quickly.",
    ],
  },

  /* ─── 6b. Failure & learning, dedicated maturity-arc category.
        Failure stories used to be split across pressure-resilience +
        ownership + adaptability-learning. Pulling them into a first-
        class category lets the report score "did the candidate own
        the failure → reflect → change behaviour" as a discrete
        signal, separate from raw resilience or one-off ownership. */
  "failure-learning": {
    key: "failure-learning",
    label: "Failure & learning",
    intent: "Tests maturity through the failure → reflection → behaviour-change arc. A strong candidate names a real failure, identifies their specific role in it, articulates what they learned in concrete terms, and shows what's now different in how they work.",
    signals: {
      strong: "Picks a real failure with their fingerprints on it; explains specifically what went wrong and why; names a concrete behavioural change that's now habit; doesn't blame team/client/manager for the whole thing.",
      weak: "Picks a 'failure' that's actually a humble-brag; externalises blame; learning is generic ('I learned to communicate better') with no specific change; same mistake pattern recurs.",
    },
    stems: [
      "Tell me about a time you failed.",
      "What is your biggest professional mistake?",
      "Tell me about a time your work did not get the expected result.",
      "Tell me about a time your idea was rejected.",
      "Tell me about a time you received tough feedback.",
      "Tell me about a time you had to redo your work.",
      "Tell me about a time you made a wrong decision.",
      "What did you learn from your biggest failure?",
      "How has failure changed the way you work?",
      "What would you do differently if you faced the same situation again?",
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
      "Tell me about a time you disagreed with your manager, and how you raised it.",
      "Tell me about a time you had conflict with a stakeholder.",
      "Tell me about a time you changed your mind after hearing someone else out.",
      "How do you handle a teammate who's slow to respond or unreliable?",
      "Tell me about a time you helped a junior teammate get unstuck.",
      "How do you handle difficult colleagues?",
      "Tell me about a time you had to convince someone.",
      "Tell me about a time you had to depend on another team.",
      "How do you build trust with new teammates?",
      "Tell me about a time you supported someone who was struggling.",
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
      "Tell me about a time your communication solved a problem.",
      "How do you communicate bad news, a delay, a regression, a hard 'no'?",
      "How do you communicate delays to stakeholders?",
      "How do you handle a stakeholder who keeps changing requirements?",
      "How do you adapt your communication for different people in the room?",
      "Tell me about a time you had to align multiple people.",
      "Tell me about a time you had to simplify a complex topic.",
      "How do you make sure everyone understands next steps?",
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
      "Tell me about a time you mentored someone.",
      "Tell me about a time you helped create clarity for the team.",
      "How do you motivate others when morale is low?",
      "What kind of leader are you? Give me an example that backs that up.",
      "Tell me about a time you improved team performance.",
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
      "How has GenAI changed how you do your job in the last 12 months, concretely, not abstractly?",
      "Tell me about a moment you'd been doing something a certain way for years and you scrapped it for a new approach.",
      "How do you handle unclear requirements?",
      "Tell me about a time your role changed.",
      "Tell me about a time you worked in an unfamiliar area.",
      "How do you respond to last-minute changes?",
    ],
  },

  /* ─── 10b. Self-awareness & growth, dedicated coachability category.
        Strengths/weaknesses/motivation/manager-fit questions used to
        live only in hr-essentials, so behavioral focus never surfaced
        them. Pulling them out lets the report score self-awareness
        as a discrete signal, critical for senior+ candidates where
        coachability outweighs raw output. */
  "self-awareness": {
    key: "self-awareness",
    label: "Self-awareness & growth",
    intent: "Probes coachability and self-knowledge. A strong candidate has a calibrated read on their strengths and weaknesses, can name specific feedback they've received, and is actively working on something concrete, not because the interviewer asked, but because they want to.",
    signals: {
      strong: "Names a real weakness with a real plan; quotes specific feedback from a manager or peer; describes a habit they actually changed and how they noticed it; speaks honestly about what kind of work drains them and what energises them.",
      weak: "Fake weakness ('I work too hard', 'I'm too detail-oriented'); generic strengths; can't name recent feedback; growth statements without specifics; rehearsed-sounding answers.",
    },
    stems: [
      "What is your biggest strength?",
      "What is one weakness you are actively improving?",
      "What feedback do you often receive?",
      "How do you respond to feedback?",
      "What skill are you currently improving and why?",
      "What is one habit you changed recently?",
      "What kind of work drains you?",
      "What motivates you?",
      "What kind of manager helps you grow?",
      "What have you learned about yourself in your career?",
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
      "Tell me about a decision you regret, what would you do differently?",
      "How do you decide when to escalate vs. decide yourself?",
      "How do you get buy-in for a decision that's unpopular?",
      "How do you decide between two good options?",
      "Tell me about a time you had to defend your decision.",
      "Tell me about a time you trusted your judgment.",
      "Tell me about a time data changed your decision.",
      "What is your decision-making process?",
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
      "Tell me about a customer pain point you solved, and how you measured the fix.",
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
    intent: "The real Indian HR round, a 7-dimension gate (logistics, stability, compliance, commitment, benefits, fit, motivation). Salary discovery happens here but the negotiation itself is a separate focus. Tests whether the candidate is hireable AND joinable on plausible terms, with documents and consent in order.",
    signals: {
      strong: "Crisp on notice period + LWD + buyout stance; honest on reason-for-leaving without bad-mouthing; ready with documents (payslips, Form 16, relieving letters, marksheets, PAN/Aadhaar/UAN); names a real weakness with a real plan; specific 'why us' tied to a product/leader/domain; commits to not taking a counter-offer if accepting; clear-eyed on bond/probation/benefits.",
      weak: "Vague notice period; inflated current CTC that won't survive BGV; 'looking for growth' as the only reason; rehearsed weakness ('I'm a perfectionist'); generic 'why us'; unwilling to share payslips; dodges counter-offer commitment; surprised by bond/clawback/probation terms.",
    },
    stems: [
      /*, Reason for leaving / stability, */
      "Why are you leaving your current company? Be specific.",
      "Why is there a gap from {date} to {date}?",
      "Why have you switched jobs every {N} years?",
      "What would convince you to stay at your current company instead?",
      "You've had four companies in five years, walk me through that.",
      "You resigned before having an offer in hand, why?",
      "Were you ever on a PIP? Walk me through what happened.",
      "Were you part of a layoff or a performance-based exit?",
      "Your last startup shut down, what was your role in the wind-down?",
      "Why didn't you get promoted in your last cycle?",
      "At {N} years of experience, why aren't you a lead/manager yet?",
      "Why did you leave a product company to join a services firm, or vice versa?",
      "You took a pay cut at your last move, what was that about?",
      "You've been job-hopping in adjacent roles, why no domain commitment?",
      /*, Notice period & LWD, */
      "What's your official notice period, 30, 60, or 90 days?",
      "Does your current company allow notice buyout? Will you pay or expect us to reimburse?",
      "Our buyout reimbursement is capped at ₹{X} or {N} months, does that work?",
      "What's the earliest possible LWD you can commit to?",
      "Walk me through your exit plan, have you informed your manager?",
      "If we need you to join by {date}, can you make it?",
      "Have you ever dropped out of a job after accepting the offer? Why?",
      /*, Compensation discovery (not negotiation), */
      "What's your current CTC, fixed, variable, joining/retention bonus, RSUs, all in?",
      "What are your salary expectations, and what hike % is that on your current?",
      "Can you share your last 3 payslips and Form 16 to validate current CTC?",
      "What's the variable payout history at your current company, has it actually paid out?",
      "Your declared CTC seems above the band for your level, help me understand.",
      "Are you open to a fixed/variable split different from what you have today?",
      "Do you have a joining bonus pending clawback at your current employer?",
      "Break down your current CTC for me, fixed base, variable %, what's actually paid out, joining bonus, RSU vest schedule.",
      "What's your expected fixed vs variable split? Are you comfortable with 70/30, 80/20, or do you want flat?",
      "Has your variable actually paid out the last two years? At what %?",
      /*, Document readiness / BGV, */
      "We'll run BGV through a third party, are you okay sharing PAN, Aadhaar, UAN, and all relieving letters?",
      "Are there any prior employers we won't find a relieving letter from? Why?",
      "Walk me through your education, 10th, 12th, degree. Any gaps or backlogs?",
      "Two professional references, preferably ex-managers. Who would you pick and why?",
      "Can you give us at least one reference from your current company? Even a senior peer is fine.",
      "If we can't reach your last manager, who else from that team can corroborate your role?",
      "Is your UAN linked to all your prior employers? Any overlaps we should know about?",
      "Your resume designation is {X} but payslip is {Y}, which is correct?",
      "Did you ever have a probation extension or a confirmation delay?",
      "Will your current manager be reachable for a reference check?",
      "Any disputes, legal issues, or unresolved exits with prior employers?",
      "Are you currently engaged in any other paid work, contract, freelancing, or moonlighting?",
      /*, Other offers & commitment extraction, */
      "Are you interviewing elsewhere? At what stages?",
      "If we make an offer, will you accept and stop interviewing?",
      "If your current company counter-offers, will you stay or honour ours?",
      "If a better offer comes 2 weeks after you join us, what would you do?",
      "We'd need a commitment within {N} days of the offer, can you work to that?",
      "Our verbal-to-written offer turnaround is typically {N} business days, does that timeline work for you?",
      "If we extend a verbal offer today, when would you need the written offer letter to decide?",
      "Are you applying through any referral or family connection here? Disclose now.",
      "Anyone in your immediate family currently working at our company or a direct competitor?",
      /*, Benefits, bond, probation, */
      "Joining bonus has a 12-month clawback. Are you comfortable with that?",
      "Probation here is 6 months with a 15-day notice. Any concerns?",
      "There's a {N}-month service agreement for training. Will you sign it?",
      "ESOPs vest over 4 years with a 1-year cliff. How does that factor into your decision?",
      "Health insurance covers self + spouse + 2 kids + parents up to ₹{X} lakh, does that work for your family situation?",
      "We restructure CTC into NPS (14% employer) for tax efficiency, open to that?",
      "Do you have any active bond with your current/previous employer? Buyout amount?",
      /*, Logistics: location / shift / relocation, */
      "This role is WFO from {city}, are you willing to relocate? Family support?",
      "We're returning to office 5 days/week from {date}, workable for you?",
      "Shift timings overlap US hours till 11 PM IST. Can you sustain that?",
      "Are you the sole earner? How does that influence your decision here?",
      "Are you returning from abroad? Walk me through your relocation timeline.",
      "Any travel or onsite expectation issues, visa, family, health?",
      /*, Self-awareness (HR-flavoured), */
      "What's a real weakness, something a manager has actually given you feedback on?",
      "What feedback came up in your last performance review?",
      "What kind of manager helps you do your best work?",
      "Tell me about a manager you struggled with, what did you do?",
      /*, Motivation / fit, */
      "What do you actually know about our company and team?",
      "Why this role, why this company, why now, give me the specific version.",
      "What would make you accept this offer over another?",
      "Where do you see yourself in 3–5 years?",
      "You applied here {N} months ago and didn't progress, what's changed?",
      "Why this domain switch, fintech → edtech / services → product?",
      /*, Health / compliance disclosures, */
      "Pre-employment medical is part of onboarding, any concerns we should know about?",
      "Any chronic condition or accommodation we should plan for?",
      /*, Deflection-required (illegal but happens in Indian HR), */
      "Are you married? Any plans soon?",
      "Are you planning to start a family in the next year or two?",
      "Where are you from originally? Mother tongue?",
      "What is your caste / community?",
      "Which religion do you follow?",
      /*, Compliance / legal edge cases, */
      "Have you ever failed a background check at any previous employer?",
      "Are you bound by a non-compete or non-solicit clause from your current employer?",
      "Do you have any NDA or IP-assignment restrictions that would affect what you can work on here?",
      "Were you ever asked to leave a company earlier than your notice, gardening leave or sudden release?",
      "Are you on a payroll-of-record / vendor / staffing-firm arrangement currently?",
      "Are any of your degrees correspondence / distance / part-time? Any ATKT or backlogs?",
      "Has any prior employer marked your exit as 'not eligible for rehire'?",
      /*, Diversity / identity tracks, */
      "Are you applying through our women-returner / second-careers track?",
      "Do you require any workplace accommodation under the PwD Act?",
      "Are you applying as a lateral entry from the armed forces?",
      /*, Family / life-stage realities, */
      "Is your spouse's career mobile? Will the relocation work for both of you?",
      "Are your parents dependent on you? Will they relocate with you or stay back?",
      "Do you have eldercare or childcare commitments we should plan around?",
      "Do you eventually plan to join a family business or take over family responsibilities?",
      "Was your career break related to health or burnout? How are you doing now?",
      /*, Visa / mobility / placement nuance, */
      "Are you returning from a US/UK assignment? What's your visa status?",
      "Have you been on long-term onsite deputation? How many years cumulatively?",
      "If this role is via our GCC / captive vs vendor model, are you comfortable with that?",
      /*, 2025-2026 hot topics, */
      "Did you use ChatGPT or any GenAI tool during your take-home or coding round?",
      "Your current company was recently acquired / announced layoffs, what's your status?",
      "You worked here before and left, what's different this time? Why come back?",
      "We typically convert contract-to-hire after 6 months, comfortable starting on contract?",
      /*, Process moments, */
      "Your number is about 30% above our band for this role, what's your real floor?",
      "Can you promise you won't leave us in the first 2 years? We invest a lot in ramp-up.",
      "You mentioned wanting to start your own company in a few years, why join us now?",
      "Do you have any questions for me? (closing, expect 2-3 substantive questions)",
    ],
  },

  /* ─── 16. Managerial round ─── */
  managerial: {
    key: "managerial",
    label: "Managerial round",
    intent: "Tests how they operate with a manager, planning, escalation, scope of independence, stakeholder handling.",
    signals: {
      strong: "Has a planning rhythm; escalates with a recommendation, not just a problem; manages up clearly.",
      weak: "Waits to be told what to do; surprises their manager with delays; can't articulate what support they need.",
    },
    stems: [
      "How do you plan your week when priorities are unclear?",
      "How do you escalate a risk to a manager who's hard to reach?",
      "What support do you expect from a manager, what do you NOT need?",
      "Tell me about a time you handled a difficult stakeholder.",
      "What would you do in your first 30 days here?",
    ],
  },

  /* ─── 17. Trap questions ─── */
  trap: {
    key: "trap",
    label: "Trap questions",
    intent: "Questions designed to catch rehearsed answers, expose ego, or surface red flags. Use sparingly, 1 per session max.",
    signals: {
      strong: "Doesn't get defensive; gives a real answer instead of the 'right' answer; admits limits with confidence.",
      weak: "Visibly rehearsed; deflects to a humble-brag; gets defensive or political.",
    },
    stems: [
      "Why should we NOT hire you?",
      "Tell me about your worst manager, what did you learn?",
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
    intent: "Candidate is testing how grounded the role is. AI answers in character, plausible, role-specific, doesn't claim certainty about things a real interviewer wouldn't know.",
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
    intent: "Candidate is probing values-in-practice and company priorities. AI answers as a mid-senior manager would, honest about challenges, not corporate-speak.",
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
