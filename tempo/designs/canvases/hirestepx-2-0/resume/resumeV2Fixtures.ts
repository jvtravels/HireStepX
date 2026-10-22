/* ResumeV2 canvas — mock context values fed into the real ResumeV2
   component. AuthProvider/DashboardProvider perform live Supabase network
   calls (unsuitable for canvas mode), so we supply the raw context values
   directly instead of rendering those providers. */
import type { AuthContextType, User } from "@/AuthContext";
import type { UIContextValue, CoreContextValue } from "@/DashboardContext";
import type { PersistedState } from "@/dashboardTypes";
import type { ResumeProfile } from "@/dashboardData";

/* Populated resume analysis — feeds useResumeUpload() via user.resumeData
   so the storyboard shows the real analysis screen (summary, score
   breakdown, ATS readiness, experience, skills) instead of the empty
   upload state, which is what renders whenever profile is null. */
export const MOCK_RESUME_PROFILE: ResumeProfile = {
  headline: "Staff Software Engineer",
  summary: "Backend-leaning full-stack engineer with 8 years building payments and marketplace infrastructure at scale, most recently leading a 5-person platform team at Razorpay.",
  yearsExperience: 8,
  seniorityLevel: "Staff",
  topSkills: ["TypeScript", "Node.js", "PostgreSQL", "Kafka", "AWS", "System Design"],
  keyAchievements: [
    "Led migration of the payments ledger to an event-sourced architecture, cutting reconciliation incidents by 90%.",
    "Scaled the checkout service to 4,000 RPS during Diwali sale peak with zero downtime.",
    "Mentored 6 engineers into senior roles over 3 years.",
  ],
  industries: ["Fintech", "E-commerce"],
  interviewStrengths: [
    "Clear STAR framing with quantified outcomes",
    "Strong system-design tradeoff reasoning",
    "Demonstrated technical leadership and mentorship",
  ],
  interviewGaps: [
    "Limited discussion of failure/postmortem stories",
    "Sparse detail on cross-team stakeholder conflict",
  ],
  careerTrajectory: "Positioned for a Staff or Principal Engineer role at a Series C+ fintech or marketplace, with a path toward Engineering Manager if leadership scope keeps expanding.",
  resumeScore: 82,
  scoreBreakdown: {
    quantifiedAchievements: 17,
    relevantSkills: 18,
    experienceProgression: 18,
    formattingStructure: 12,
    summaryClarity: 12,
    educationCerts: 8,
  },
  improvements: [
    "Add a metric to the Kafka migration bullet — reviewers want to see scale, not just architecture.",
    "Tighten the summary to 2 sentences; the third sentence repeats the headline.",
    "List certifications (if any) in a dedicated section rather than inline.",
  ],
  noticePeriod: "60 days",
  currentCtc: "₹42 LPA",
  promotionSignals: ["Promoted to Staff Engineer in 2 years at Razorpay"],
  experiences: [
    {
      company: "Razorpay",
      title: "Staff Software Engineer",
      start: "2022",
      end: "Present",
      scope: "Own the payments ledger platform end-to-end; lead a 5-engineer team across ledger, reconciliation, and settlement services.",
      teamSize: 5,
      partners: ["Product", "Risk", "Finance"],
      topProjects: ["Event-sourced ledger migration", "Real-time settlement pipeline"],
    },
    {
      company: "Flipkart",
      title: "Senior Software Engineer",
      start: "2019",
      end: "2022",
      scope: "Built and scaled checkout and cart services for peak sale traffic.",
      teamSize: 3,
      partners: ["Checkout", "Catalog"],
      topProjects: ["Checkout service scale-out"],
    },
  ],
  skillsDetailed: [
    { name: "TypeScript", depth: "primary", yearsUsed: 6, recent: true },
    { name: "Node.js", depth: "primary", yearsUsed: 6, recent: true },
    { name: "PostgreSQL", depth: "primary", yearsUsed: 5, recent: true },
    { name: "Kafka", depth: "secondary", yearsUsed: 3, recent: true },
    { name: "AWS", depth: "secondary", yearsUsed: 5, recent: true },
    { name: "System Design", depth: "primary", yearsUsed: 8, recent: true },
  ],
};

/* Full-length mock resume body so computeATSScore() (keyword/section/verb/
   metric scan over this raw text) reflects a realistic "good" resume
   instead of scoring near-zero against a one-line stub. */
const MOCK_RESUME_TEXT = `PRIYA NARAYAN
Staff Software Engineer
priya.narayan@example.com | +91-98765-43210 | linkedin.com/in/priyanarayan | github.com/priyanarayan

SUMMARY
Backend-leaning full-stack engineer with 8 years building payments and marketplace
infrastructure at scale, most recently leading a 5-person platform team at Razorpay.

WORK EXPERIENCE

Staff Software Engineer — Razorpay (2022 - Present)
- Led migration of the payments ledger to an event-sourced architecture, cutting
  reconciliation incidents by 90%.
- Scaled the checkout service to 4,000 RPS during Diwali sale peak with zero downtime.
- Mentored 6 engineers into senior roles over 3 years.
- Designed and implemented the real-time settlement pipeline used by 200+ merchants.

Senior Software Engineer — Flipkart (2019 - 2022)
- Built and scaled checkout and cart services for peak sale traffic.
- Reduced checkout latency by 35% through caching and query optimization.
- Delivered a cart-recovery feature that increased conversion by 12%.

EDUCATION
B.Tech in Computer Science, Indian Institute of Technology (2015)

SKILLS
TypeScript, Node.js, PostgreSQL, Kafka, AWS, System Design, Distributed Systems

CERTIFICATIONS
AWS Certified Solutions Architect – Professional
`;

export const MOCK_USER: User = {
  id: "canvas-user-1",
  name: "Priya Narayan",
  email: "priya.narayan@example.com",
  targetRole: "Staff Engineer",
  resumeFileName: "priya-narayan-resume.pdf",
  resumeText: MOCK_RESUME_TEXT,
  resumeData: { _type: "ai", ...MOCK_RESUME_PROFILE },
  hasCompletedOnboarding: true,
  subscriptionTier: "starter",
  emailVerified: true,
};

export const MOCK_AUTH_VALUE: AuthContextType = {
  user: MOCK_USER,
  isLoggedIn: true,
  loading: false,
  login: async () => ({ success: true }),
  signup: async () => ({ success: true }),
  loginWithGoogle: async () => ({ success: true }),
  logout: async () => {},
  updateUser: async () => {},
  resetPassword: async () => ({ success: true }),
};

export const MOCK_UI_VALUE: UIContextValue = {
  showUpgradeModal: false,
  setShowUpgradeModal: () => {},
  dataLoading: false,
  isMobile: false,
  paymentBanner: null,
  setPaymentBanner: () => {},
  syncError: "",
  setSyncError: () => {},
  toast: null,
  showToast: () => {},
  refreshCreditBalance: () => {},
  setCreditBalanceDirect: () => {},
};

const MOCK_PERSISTED_STATE: PersistedState = {
  hasCompletedFirstSession: true,
  dismissedNotifs: [],
  userName: MOCK_USER.name,
  targetRole: MOCK_USER.targetRole ?? "Staff Engineer",
  resumeFileName: MOCK_USER.resumeFileName ?? null,
  interviewDate: "",
};

/* useResumeUpload() only reads updatePersisted off CoreContext; the rest of
   this mock exists purely to satisfy CoreContextValue's shape. */
export const MOCK_CORE_VALUE: CoreContextValue = {
  persisted: MOCK_PERSISTED_STATE,
  updatePersisted: () => {},
  displayName: MOCK_USER.name,
  isNewUser: false,
  daysLeft: 0,
  aiInsights: [],
  notifications: [],
  upcomingGoals: [],
  returnContext: null,
  smartSchedule: null,
  prepPlan: null,
  companyReadiness: null,
  curriculumState: null,
  badges: [],
  dailyChallenge: { id: "canvas-daily", label: "Practice a behavioral round", description: "", type: "behavioral", difficulty: "Medium", completed: false },
  practiceReminder: null,
  googleSyncStatus: "idle",
  googleSyncError: null,
  hasGoogleToken: false,
  syncGoogleCalendar: async () => {},
  handleStartSession: () => {},
  handleExport: () => {},
  handleDownload: () => {},
  handleExportCSV: () => {},
  handleExportPDF: () => {},
};
