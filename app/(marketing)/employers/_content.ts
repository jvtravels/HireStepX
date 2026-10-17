import {
  CREDIT_BACK_SENTENCE,
  GST_STATEMENT,
  PAY_AS_YOU_GO_SENTENCE,
  unlockFeeSentence,
} from "@/employer/_employerOffer";

/* Copy for /employers shared by the page and its FAQPage JSON-LD. Scoring
   claims are checked against server-handlers/_requirement-match-helpers.ts and
   employer-requirements.ts: do not state more than those files do. */

export interface ScoringStep { title: string; body: string }

export const SCORING_STEPS: readonly ScoringStep[] = [
  {
    title: "Fit to your job",
    body: "We compare your job title, description and the skills you pick with each candidate's target role and resume skills. Location (or remote) and your experience range then adjust the score. Experience outside your range lowers the score; it never excludes anyone.",
  },
  {
    title: "Verified practice sessions",
    body: "A candidate who has completed practice interviews on HireStepX gets credit from their own session scores. A candidate with no sessions gets none, so unproven profiles do not outrank people who have practised. Candidates inactive for over 30 days are ranked lower.",
  },
  {
    title: "A second look at the shortlist",
    body: "An AI model re-reads the top of the ranked shortlist against your job and its result is blended into the score. If that step is unavailable, the rule-based score stands on its own.",
  },
];

export interface FaqEntry { question: string; answer: string }

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "What counts as a match?",
    answer:
      "A candidate on HireStepX whose target role and resume skills overlap with your job, and who has employer discovery switched on. Each match gets a 0 to 100 score and a short breakdown (role, skills, location). Candidates with no real role or skill overlap are left out rather than padded into the list.",
  },
  {
    question: "How is a candidate scored, and what does \"scored on practice sessions\" mean?",
    answer:
      "The score combines how well the candidate's role and skills fit your job with their results in practice interviews on HireStepX, which the AI evaluates against a STAR-style rubric. Those scores come from the candidate's own practice sessions on our platform. They are not proctored or independent assessments, so treat them as a signal to screen with, not a verdict.",
  },
  {
    question: "What does unlocking a candidate reveal?",
    answer:
      "Before you unlock, you see the match score and breakdown, skills, readiness and STAR scores, the resume (past employers, schools, city) and short practice-answer excerpts, all with the candidate's name, phone, LinkedIn and links removed. Unlocking adds their name, email, phone, LinkedIn, portfolio links, the original resume file where they uploaded one, and the ability to message them on HireStepX.",
  },
  {
    question: "What does it cost, and what if a candidate never replies?",
    answer: `Posting a job and browsing your shortlist is free. ${unlockFeeSentence()} ${PAY_AS_YOU_GO_SENTENCE} ${CREDIT_BACK_SENTENCE}`,
  },
  {
    question: "Do I get a GST invoice?",
    answer: GST_STATEMENT,
  },
  {
    question: "Do candidates agree to be found by employers?",
    answer:
      "Employer discovery is on by default for candidate accounts and they can switch it off at any time in Settings, which removes them from search straight away. Candidates can also block or report an employer. Employers sign up on their own and are placed in verification tiers, and our employer terms limit use of candidate data to evaluating and contacting that candidate about your job.",
  },
];
