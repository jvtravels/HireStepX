/* SessionsV2 canvas — fixture data + mock context values.
   Pure mock-data harness (§5.1 escape hatch): crafted DashboardSession
   arrays and AuthContextType/SessionsContextValue mocks fed into the real
   SessionsV2 component. AuthProvider/DashboardProvider perform live
   Supabase network calls (unsuitable for canvas mode), so we supply the
   raw context values directly instead of rendering those providers. */
import type { DashboardSession, PersistedState } from "@/dashboardTypes";
import type { AuthContextType, User } from "@/AuthContext";
import type { SessionsContextValue, SubscriptionContextValue, UIContextValue, CoreContextValue } from "@/DashboardContext";

export const MOCK_USER: User = {
  id: "canvas-user-1",
  name: "Priya Narayan",
  email: "priya.narayan@example.com",
  targetRole: "Staff Engineer",
  resumeFileName: "priya-narayan-resume.pdf",
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

const BASE_SESSIONS_VALUE: SessionsContextValue = {
  recentSessions: [],
  scoreTrend: [],
  skills: [],
  skillVelocity: [],
  overallStats: { sessionsCompleted: 0, avgScore: 0, improvement: 0, hoursLogged: 0 },
  hasData: false,
  weekActivity: [],
  currentStreak: 0,
  readinessScore: 0,
  calendarEvents: [],
  sessionsLoading: false,
  eventsLoading: false,
  topGaps: [],
  refreshSessions: () => {},
  invalidateSessions: () => {},
  sessionVersion: 0,
};

export function mockSessionsValue(overrides: Partial<SessionsContextValue>): SessionsContextValue {
  return { ...BASE_SESSIONS_VALUE, ...overrides };
}

/* DashboardLayout (the real production sidebar shell) also reads
   Subscription/UI/Core — mocked here purely so the sidebar and its plan
   card / user footer render, not because SessionsV2 itself needs them. */
export const MOCK_SUBSCRIPTION_VALUE: SubscriptionContextValue = {
  isFree: false,
  isStarter: true,
  atSessionLimit: false,
  sessionsUsed: 6,
  sessionsRemaining: 0,
  starterRemaining: 3,
  sessionsThisWeek: 2,
  sessionsThisMonth: 6,
  creditBalance: 2,
  creditsLoaded: true,
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

export const FEW_DASHBOARD_SESSIONS: DashboardSession[] = [
  {
    id: "few-1",
    date: "2026-09-25T09:30:00Z",
    dateLabel: "2 days ago",
    type: "Behavioral",
    role: "Senior PM",
    company: "Razorpay",
    score: 82,
    change: 5,
    duration: "38m",
    topStrength: "Crisp STAR framing",
    topWeakness: "Quantify impact",
    difficulty: "Medium",
  },
  {
    id: "few-2",
    date: "2026-09-18T18:00:00Z",
    dateLabel: "Last week",
    type: "Salary Neg.",
    role: "Senior PM",
    company: "Razorpay",
    score: 74,
    change: -2,
    duration: "29m",
    topStrength: "Anchored high, calm",
    topWeakness: "Equity literacy",
    difficulty: "Medium",
  },
];

/* Covers every SessionsV2 row variant in one populated list: each score
   band (good/developing/needsFocus), a zero-score "incomplete" row, a
   campus-placement focus remap, structured coaching vs. plain topStrength/
   topWeakness fallback, positive and negative delta, and a company-less
   row (empty-company guard in toRow). */
export const RICH_DASHBOARD_SESSIONS: DashboardSession[] = [
  {
    id: "rich-good",
    date: "2026-09-26T14:00:00Z",
    dateLabel: "Yesterday",
    type: "Behavioral",
    role: "Staff Engineer",
    company: "Flipkart",
    score: 88,
    change: 7,
    duration: "44m",
    topStrength: "Crisp STAR framing",
    topWeakness: "Quantify impact",
    coaching: {
      strength: { headline: "Crisp STAR framing", meaning: "Every answer had a clear situation → action → result arc." },
      gap: {
        headline: "Quantify impact",
        meaning: "Strong stories, but the outcome is rarely a number.",
        example: "Instead of \"it went well\", say \"cut review time from 3 days to 6 hours\".",
      },
    },
    difficulty: "Hard",
  },
  {
    id: "rich-developing",
    date: "2026-09-24T11:00:00Z",
    dateLabel: "3 days ago",
    type: "System Design",
    role: "Staff Engineer",
    company: "PhonePe",
    score: 78,
    change: 3,
    duration: "58m",
    topStrength: "Tradeoff thinking",
    topWeakness: "Capacity math",
    difficulty: "Hard",
  },
  {
    id: "rich-needs-focus",
    date: "2026-09-15T15:00:00Z",
    dateLabel: "2 weeks ago",
    type: "Tech Screen",
    role: "Backend Engineer",
    company: "Zomato",
    score: 58,
    change: -6,
    duration: "24m",
    topStrength: "Clean syntax",
    topWeakness: "Edge-case coverage",
    difficulty: "Medium",
  },
  {
    id: "rich-incomplete",
    date: "2026-09-10T12:00:00Z",
    dateLabel: "3 weeks ago",
    type: "Hiring Mgr",
    role: "Engineering Manager",
    company: "Cred",
    score: 0,
    change: 0,
    duration: "4m",
    topStrength: "",
    topWeakness: "Session ended before any answers were recorded.",
    difficulty: "Easy",
  },
  {
    id: "rich-campus",
    date: "2026-08-30T10:30:00Z",
    dateLabel: "Last month",
    type: "Behavioral",
    role: "New Grad SWE",
    company: "Infosys",
    score: 76,
    change: 2,
    duration: "33m",
    topStrength: "Enthusiastic delivery",
    topWeakness: "Vague project ownership",
    focus: "campus-placement",
    difficulty: "Easy",
  },
  {
    id: "rich-no-company",
    date: "2026-08-20T16:00:00Z",
    dateLabel: "5 weeks ago",
    type: "HR Round",
    role: "Senior PM",
    score: 81,
    change: 4,
    duration: "22m",
    topStrength: "Honest about tradeoffs",
    topWeakness: "Notice-period framing",
    difficulty: "Medium",
  },
];
