/**
 * ATS Compliance Check — client-side keyword/regex scorer.
 *
 * Pure and deterministic: no LLM call, runs instantly whenever a resume's
 * text changes. Shared by DashboardResume.tsx and ResumeV2.tsx (both
 * render the same "ATS readiness" card off the same score/found/missing
 * shape) — extracted here so neither screen owns a second copy of the
 * rubric that could drift from the other.
 */

export interface ATSResult {
  score: number;
  label: string;
  found: string[];
  missing: string[];
  suggestions: string[];
}

export function computeATSScore(resumeText: string, _targetRole?: string): ATSResult {
  const text = resumeText.toLowerCase();
  const lines = resumeText.split("\n").filter(l => l.trim().length > 0);

  // ATS-required sections — check for clear section headings (not just word mentions)
  const requiredSections = [
    { name: "Contact Info", keywords: ["email", "@", "phone", "linkedin", "github"] },
    { name: "Work Experience", keywords: ["experience", "employment", "work history", "professional experience"] },
    { name: "Education", keywords: ["education", "academic", "university", "degree", "college"] },
    { name: "Skills", keywords: ["skills", "technical skills", "technologies", "competencies", "tools"] },
  ];

  // Bonus sections
  const bonusSections = [
    { name: "Summary", keywords: ["summary", "objective", "profile", "about"] },
    { name: "Projects", keywords: ["projects", "portfolio"] },
    { name: "Certifications", keywords: ["certifications", "certificates", "licenses"] },
  ];

  // Action verbs — require more for a high score
  const actionVerbs = ["achieved", "led", "managed", "developed", "implemented", "designed", "built", "increased", "reduced", "improved", "launched", "delivered", "created", "optimized", "coordinated", "analyzed", "spearheaded", "orchestrated", "streamlined", "pioneered", "established", "transformed", "automated", "mentored", "negotiated", "resolved"];

  // Metrics/quantification patterns
  const metricPatterns = [
    /\d+%/,
    /\$[\d,]+/,
    /\d+\+?\s*(users|customers|team|members|engineers|projects|clients|people)/i,
    /\d+x\b/i,
    /\b(revenue|growth|savings|reduction|increase|improvement)\b.*\d/i,
  ];
  const metricsFound = metricPatterns.filter(p => p.test(resumeText)).length;
  const hasMetrics = metricsFound > 0;

  // Check sections
  const foundSections = requiredSections.filter(s => s.keywords.some(k => text.includes(k)));
  const missingSections = requiredSections.filter(s => !s.keywords.some(k => text.includes(k)));
  const foundBonus = bonusSections.filter(s => s.keywords.some(k => text.includes(k)));

  // Check action verbs
  const foundVerbs = actionVerbs.filter(v => new RegExp(`\\b${v}\\w*\\b`, "i").test(text));

  // Length & density checks
  const wordCount = resumeText.trim().split(/\s+/).length;
  const hasSufficientLength = wordCount >= 150;
  const hasGoodLength = wordCount >= 300 && wordCount <= 1200;
  const bulletCount = (resumeText.match(/^[\s]*[-•●◦▪]/gm) || []).length;
  const hasBullets = bulletCount >= 3;

  // Formatting red flags
  const hasLongParagraphs = lines.some(l => l.trim().split(/\s+/).length > 60);
  const hasAllCapsBlocks = (resumeText.match(/^[A-Z\s]{20,}$/gm) || []).length > 3;

  // Score: 100 points total, harder to max out
  let score = 0;

  // Sections: up to 30 pts (required) + 6 pts (bonus)
  score += foundSections.length * 7.5;  // up to 30
  score += Math.min(6, foundBonus.length * 2); // up to 6

  // Action verbs: up to 15 pts (need 8+ verbs for full marks)
  score += Math.min(15, foundVerbs.length * 1.9);

  // Metrics: up to 15 pts (more metrics = higher score)
  score += Math.min(15, metricsFound * 5);

  // Structure: up to 14 pts
  score += hasSufficientLength ? 4 : 0;
  score += hasGoodLength ? 4 : 0;
  score += hasBullets ? 4 : 0;
  score += (!hasLongParagraphs) ? 2 : 0;

  // Formatting: up to 10 pts
  score += (!hasAllCapsBlocks) ? 3 : 0;
  score += (foundSections.length >= 3) ? 4 : 0;
  score += (wordCount > 100 && bulletCount >= 5) ? 3 : 0;

  // Penalties
  if (!hasSufficientLength) score -= 5;
  if (missingSections.length >= 2) score -= 5;
  if (foundVerbs.length < 3) score -= 5;

  score = Math.min(100, Math.max(0, Math.round(score)));

  const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Work" : "Poor";

  const found = [
    ...foundSections.map(s => s.name),
    ...foundBonus.map(s => s.name),
    foundVerbs.length > 0 ? `${foundVerbs.length} action verbs` : null,
    hasMetrics ? "Quantified achievements" : null,
    hasBullets ? "Bullet-point formatting" : null,
    hasGoodLength ? "Good length" : null,
  ].filter(Boolean) as string[];

  const missing = [
    ...missingSections.map(s => `Missing: ${s.name} section`),
    foundVerbs.length < 5 ? "Add more action verbs (achieved, led, built, implemented...)" : null,
    !hasMetrics ? "Add quantified metrics (%, $, numbers)" : null,
    !hasBullets ? "Use bullet points for better readability" : null,
    !hasSufficientLength ? "Resume is too short — add more detail" : null,
    hasLongParagraphs ? "Break long paragraphs into bullet points" : null,
  ].filter(Boolean) as string[];

  const suggestions = [
    missingSections.length > 0 ? `Add clear section headers: ${missingSections.map(s => s.name).join(", ")}` : null,
    !hasMetrics ? "Quantify achievements with specific numbers (e.g., 'increased revenue by 30%')" : null,
    foundVerbs.length < 8 ? "Start bullet points with strong action verbs: achieved, led, implemented, designed" : null,
    !hasBullets ? "Format experience as bullet points for ATS readability" : null,
    hasLongParagraphs ? "Keep paragraphs under 3 lines — ATS and recruiters prefer concise bullets" : null,
    "Use standard section headings (Experience, Education, Skills) for better ATS parsing",
    "Avoid tables, graphics, and complex formatting that ATS cannot read",
  ].filter(Boolean) as string[];

  return { score, label, found, missing, suggestions: suggestions.slice(0, 5) };
}
