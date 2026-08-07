/* HireStepX — Employer console mock fixtures.
   This pass integrates real routes/chrome/auth into production, but the
   requirement → shortlist → unlock data is fixture-backed (no Supabase
   tables, no analyze-jd-match wiring, no Razorpay). See CLAUDE.md scope note
   in app/(employer). */

export interface Candidate {
  id: string;
  name: string;
  targetRole: string;
  city: string;
  experienceYears: number;
  matchScore: number; // fit against THIS requirement only
  rosterScore: number; // lifetime performance across all practice sessions
  sessionsCompleted: number;
  lastActiveDaysAgo: number;
  skills: string[];
  noticePeriodDays: number;
  exclusiveToUs: boolean;
  ctcAdvisory: { low: number; high: number; asOf: string; basis: string };
  unlocked: boolean;
  contact?: { email: string; phone: string };
}

export type RequirementStatus = "generating" | "ready" | "partial" | "zero" | "failed" | "closed";

export interface Requirement {
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: RequirementStatus;
  createdAt: string;
  candidates: Candidate[];
}

const rohit: Candidate = {
  id: "22",
  name: "Rohit Sharma",
  targetRole: "Senior Frontend Engineer",
  city: "Bengaluru",
  experienceYears: 4,
  matchScore: 91,
  rosterScore: 88,
  sessionsCompleted: 14,
  lastActiveDaysAgo: 2,
  skills: ["React", "TypeScript", "System Design", "Node.js"],
  noticePeriodDays: 30,
  exclusiveToUs: false,
  ctcAdvisory: { low: 1800000, high: 2400000, asOf: "2026-07-01", basis: "AmbitionBox + Naukri bands, Bengaluru tier-1, 4 YOE frontend" },
  unlocked: false,
};

const seedCandidates: Candidate[] = [
  rohit,
  {
    id: "31",
    name: "Priya Nair",
    targetRole: "Senior Frontend Engineer",
    city: "Bengaluru",
    experienceYears: 5,
    matchScore: 87,
    rosterScore: 92,
    sessionsCompleted: 21,
    lastActiveDaysAgo: 1,
    skills: ["React", "GraphQL", "Performance", "Accessibility"],
    noticePeriodDays: 60,
    exclusiveToUs: true,
    ctcAdvisory: { low: 2000000, high: 2600000, asOf: "2026-07-01", basis: "AmbitionBox + Naukri bands, Bengaluru tier-1, 5 YOE frontend" },
    unlocked: false,
  },
  {
    id: "18",
    name: "Arjun Mehta",
    targetRole: "Frontend Engineer",
    city: "Pune",
    experienceYears: 3,
    matchScore: 76,
    rosterScore: 74,
    sessionsCompleted: 6,
    lastActiveDaysAgo: 9,
    skills: ["React", "JavaScript", "CSS"],
    noticePeriodDays: 15,
    exclusiveToUs: false,
    ctcAdvisory: { low: 1200000, high: 1600000, asOf: "2026-06-15", basis: "AmbitionBox + Naukri bands, Pune, 3 YOE frontend" },
    unlocked: false,
  },
];

export const seedRequirements: Requirement[] = [
  {
    id: "req-1",
    title: "Senior Frontend Engineer",
    location: "Bengaluru (hybrid)",
    noticePeriodPref: "Immediate–30 days",
    status: "ready",
    createdAt: "2026-08-05",
    candidates: seedCandidates,
  },
  {
    id: "req-2",
    title: "Backend Engineer (Node.js)",
    location: "Remote",
    noticePeriodPref: "Any",
    status: "partial",
    createdAt: "2026-08-04",
    candidates: [
      {
        id: "40",
        name: "Sanjay Iyer",
        targetRole: "Backend Engineer",
        city: "Chennai",
        experienceYears: 2,
        matchScore: 68,
        rosterScore: 70,
        sessionsCompleted: 4,
        lastActiveDaysAgo: 12,
        skills: ["Node.js", "Postgres"],
        noticePeriodDays: 30,
        exclusiveToUs: false,
        ctcAdvisory: { low: 900000, high: 1300000, asOf: "2026-06-20", basis: "AmbitionBox + Naukri bands, Chennai, 2 YOE backend" },
        unlocked: false,
      },
    ],
  },
  {
    id: "req-3",
    title: "Product Designer",
    location: "Mumbai",
    noticePeriodPref: "Immediate",
    status: "zero",
    createdAt: "2026-08-02",
    candidates: [],
  },
  {
    id: "req-4",
    title: "QA Engineer",
    location: "Hyderabad",
    noticePeriodPref: "Any",
    status: "failed",
    createdAt: "2026-08-01",
    candidates: [],
  },
  {
    id: "req-5",
    title: "DevOps Engineer",
    location: "Bengaluru",
    noticePeriodPref: "30 days",
    status: "closed",
    createdAt: "2026-07-20",
    candidates: [],
  },
];

export function formatCtc(low: number, high: number): string {
  const fmt = (n: number) => `₹${(n / 100000).toFixed(1)}L`;
  return `${fmt(low)}–${fmt(high)}`;
}
