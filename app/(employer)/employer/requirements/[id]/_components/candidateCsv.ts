import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { candidateSkillFit, evidenceLinks, interviewScore } from "@/employer/_jobDetailHelpers";
import type { Candidate } from "@/employer/mockData";

const HEADER = ["Name", "Email", "Phone", "Target role", "City", "Notice period", "Match score", "Interview score", "Practice sessions", "Skills matched", "Skills missing", "Stage", "LinkedIn", "GitHub", "Portfolio"];

/* A cell that opens with =, +, - or @ is run as a formula by Excel and Sheets, and these
   fields are written by candidates. A leading apostrophe keeps them as plain text. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Only unlocked candidates are exported; a locked one has no name or contact the employer has paid for. */
export function exportableCandidates(candidates: Candidate[]): Candidate[] {
  return candidates.filter((c) => c.unlocked);
}

export function candidatesToCsv(candidates: Candidate[], requiredSkills: string[]): string {
  const rows = exportableCandidates(candidates).map((c) => {
    const fit = candidateSkillFit(c, requiredSkills);
    const links = evidenceLinks(c);
    return [
      c.name,
      c.contact?.email,
      c.contact?.phone,
      c.targetRole,
      c.city === "Not specified" ? "" : c.city,
      c.resume?.noticePeriod,
      c.matchScore,
      interviewScore(c),
      c.sessionsCompleted,
      fit.matched.join("; "),
      fit.gaps.join("; "),
      CANDIDATE_STATUS_LABEL[c.candidateStatus],
      c.resume?.linkedin,
      links.github,
      links.web,
    ];
  });
  return [HEADER, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function csvFileName(requirementTitle: string): string {
  const slug = requirementTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return `${slug || "candidates"}-unlocked-candidates.csv`;
}

/** BOM first so Excel reads names and cities in Devanagari and other scripts as UTF-8. */
export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
