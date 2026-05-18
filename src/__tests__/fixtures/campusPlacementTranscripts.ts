/* Phase-4 (4.1) — deterministic campus-placement fixture suite.
 *
 * One representative transcript per high-volume Indian campus archetype.
 * Each fixture is hand-crafted to either pass cleanly OR trip a specific
 * named flag set, so the matching test in `campusPlacementFixtures.test.ts`
 * can assert the analyzer's expected verdict end-to-end.
 *
 * These fixtures are the regression net for the rubric — when we tune
 * a flag's regex or threshold, this suite tells us which archetype's
 * outcome shifted. Keep transcripts realistic and concise (~6 turns).
 *
 * Conventions:
 *  - Each transcript is a `TranscriptTurn[]` consumable directly by
 *    `SessionRowForAnalysis.transcript`.
 *  - Fixtures expose their target archetype + the flag IDs we expect
 *    the analyzer to emit. The test asserts containment, not exact
 *    equality, so adding NEW flags doesn't break the regression.
 */

import type { TranscriptTurn } from "../../../server-handlers/analyzers/_types";

export interface CampusPlacementFixture {
  id: string;
  description: string;
  targetCompany: string;
  expectedArchetype: "tcs-ninja" | "tcs-digital" | "wipro-nlth" | "top-tier-campus" | "unknown";
  /** Flags the analyzer MUST emit on this fixture. */
  mustHaveFlags: string[];
  /** Flags the analyzer MUST NOT emit on this fixture (negative assertion). */
  mustNotHaveFlags?: string[];
  transcript: TranscriptTurn[];
}

/* TCS NQT Ninja — clean baseline candidate. Below-cutoff CGPA (5.8 < 6.0)
 * with no framing context, no academic project, generic "great brand"
 * filler on why-this-company. Triggers cgpa_low_no_framing +
 * no_academic_project_discussed + generic_why_this_company. */
const tcsNinjaBaseline: CampusPlacementFixture = {
  id: "tcs-ninja-baseline-weak",
  description: "TCS NQT (Ninja) — weak baseline with low CGPA + generic filler",
  targetCompany: "TCS",
  expectedArchetype: "tcs-ninja",
  mustHaveFlags: [
    "campus_archetype_tcs_ninja",
    "cgpa_low_no_framing",
  ],
  transcript: [
    { speaker: "ai", text: "Good morning. Please introduce yourself — your background, projects, and why you chose to apply with us.", time: "00:00" },
    { speaker: "user", text: "Good morning sir. Myself Anjali, I am a final year student. My CGPA is 5.8. I want to join TCS because it has a great brand name and reputation.", time: "00:05" },
    { speaker: "ai", text: "Can you tell me about a project from your college?", time: "01:00" },
    { speaker: "user", text: "Sir, actually I focused more on theory subjects than projects. I am willing to learn anything you assign.", time: "01:15" },
    { speaker: "ai", text: "Why this company specifically?", time: "02:00" },
    { speaker: "user", text: "TCS is a great MNC with good culture and growth opportunities. It will help me learn and grow.", time: "02:15" },
  ],
};

/* TCS Digital — strong candidate with explicit Power Programmer mention,
 * 8.3 CGPA, deployed project with applied tech stack, GitHub link.
 * Should resolve to tcs-digital archetype (transcript hint wins) and
 * emit positive portfolio_link_present signal. */
const tcsDigitalStrong: CampusPlacementFixture = {
  id: "tcs-digital-strong",
  description: "TCS Digital — strong candidate with applied tech stack + portfolio link",
  targetCompany: "TCS",
  expectedArchetype: "tcs-digital",
  mustHaveFlags: [
    "campus_archetype_tcs_digital",
    "portfolio_link_present",
  ],
  mustNotHaveFlags: [
    "cgpa_low_no_framing",
    "generic_passion_no_substance",
    "tech_named_but_not_applied",
  ],
  transcript: [
    { speaker: "ai", text: "Hi. Walk me through your background — I see you cleared the TCS Digital track.", time: "00:00" },
    { speaker: "user", text: "Yes, I cleared TCS Digital this year. CGPA 8.3. I built a FastAPI microservice with 7 REST endpoints, Postgres with 4 tables, deployed on Render at gradetracker.onrender.com. Source is on github.com/me/gradetracker.", time: "00:05" },
    { speaker: "ai", text: "Nice. Talk me through the hardest part.", time: "01:00" },
    { speaker: "user", text: "Schema migrations under load — I shipped a blue-green deploy script and a Postgres logical-replication fallback. Currently at 250+ solved on LeetCode, Knight on Codeforces.", time: "01:15" },
    { speaker: "ai", text: "Any questions for us?", time: "02:00" },
    { speaker: "user", text: "Two — what's the typical Digital cohort exit destination after the 2-year bond, and which internal teams have shipped to production in the last quarter?", time: "02:15" },
  ],
};

/* Wipro NLTH — bond-aware candidate but trips relocation refusal +
 * shift refusal which are dealbreakers at NLTH. */
const wiproNlthBondAware: CampusPlacementFixture = {
  id: "wipro-nlth-bond-aware-but-rigid",
  description: "Wipro NLTH — bond-aware candidate but refuses relocation",
  targetCompany: "Wipro",
  expectedArchetype: "wipro-nlth",
  mustHaveFlags: [
    "campus_archetype_wipro_nlth",
    "relocation_refusal",
  ],
  transcript: [
    { speaker: "ai", text: "Hi. Quick one — are you flexible on location? Wipro allocates pan-India.", time: "00:00" },
    { speaker: "user", text: "Honestly no, I cannot relocate outside Bangalore under any circumstances.", time: "00:05" },
    { speaker: "ai", text: "Understood. Are you comfortable with the 15-month service agreement and ₹2L bond?", time: "01:00" },
    { speaker: "user", text: "Yes, I've read the bond document. 15 months is fine, and I can sign the ₹2L buyout commitment.", time: "01:15" },
    { speaker: "ai", text: "Tell me about a project you built.", time: "02:00" },
    { speaker: "user", text: "My final-year project is a Django REST backend for a college event manager, deployed on Render with 5 endpoints and Postgres. github.com/me/eventbook.", time: "02:15" },
  ],
};

/* Top-tier campus — Google candidate naming many tech areas without
 * applied evidence. Should trip tech_named_but_not_applied. */
const topTierBuzzwordy: CampusPlacementFixture = {
  id: "top-tier-buzzword-soup",
  description: "Top-tier campus — name-drops many tech areas without depth",
  targetCompany: "Google",
  expectedArchetype: "top-tier-campus",
  mustHaveFlags: [
    "campus_archetype_top_tier_campus",
    "tech_named_but_not_applied",
  ],
  transcript: [
    { speaker: "ai", text: "Hi, good to meet you. Quick intro — 90 seconds on your background.", time: "00:00" },
    { speaker: "user", text: "Hi, I'm Rohan, 4th year CS. I built a project using Python, React, MongoDB, Redis, Docker and AWS. I'm passionate about technology.", time: "00:05" },
    { speaker: "ai", text: "Walk me through one project deep-dive.", time: "01:00" },
    { speaker: "user", text: "My project used multiple frameworks — Flask, Express, Angular — for full-stack. We covered everything end to end.", time: "01:15" },
    { speaker: "ai", text: "Any questions for us?", time: "02:00" },
    { speaker: "user", text: "What's the work culture like at Google? Also curious about the growth trajectory for new grads and what teams the cohort typically gets allocated to.", time: "02:15" },
  ],
};

/* Generic / unknown company — falls back to the coarse tier cutoff
 * and the unknown archetype. No campus_archetype_* flag should emit. */
const unknownGenericCo: CampusPlacementFixture = {
  id: "unknown-generic-co",
  description: "Unknown campus firm — falls back to default companyTier",
  targetCompany: "SomeRandomCo Pvt Ltd",
  expectedArchetype: "unknown",
  mustHaveFlags: [],
  mustNotHaveFlags: [
    "campus_archetype_tcs_ninja",
    "campus_archetype_tcs_digital",
    "campus_archetype_wipro_nlth",
    "campus_archetype_top_tier_campus",
  ],
  transcript: [
    { speaker: "ai", text: "Tell me about yourself.", time: "00:00" },
    { speaker: "user", text: "I'm a final-year CS student building a recommender system in Python and PyTorch, deployed at reco.streamlit.app. Source on github.com/me/recsys.", time: "00:05" },
    { speaker: "ai", text: "Why this company?", time: "01:00" },
    { speaker: "user", text: "I read your founder's recent blog post on inventory ML and it lines up with the work I want to do.", time: "01:15" },
    { speaker: "ai", text: "Any questions?", time: "02:00" },
    { speaker: "user", text: "How is the team structured for ML projects, and how long is the typical onboarding ramp?", time: "02:15" },
  ],
};

export const CAMPUS_PLACEMENT_FIXTURES: CampusPlacementFixture[] = [
  tcsNinjaBaseline,
  tcsDigitalStrong,
  wiproNlthBondAware,
  topTierBuzzwordy,
  unknownGenericCo,
];
