import { experienceLabel, employmentLabel, WORK_MODE_LABEL, type PublicOpening } from "./_public-openings-helpers";

const SITE = "https://hirestepx.com";

/* Google requires an employer name. Roles are anonymous by design, so the posting
 * is attributed to HireStepX hiring on behalf of a confidential employer. The real
 * employer name must never appear here (see _public-openings-helpers.ts). */
const POSTER = { "@type": "Organization", name: "HireStepX", sameAs: SITE, logo: `${SITE}/wordmark.png` };

const EMPLOYMENT_TYPE: Record<string, string> = {
  "full-time": "FULL_TIME", "part-time": "PART_TIME", contract: "CONTRACTOR", internship: "INTERN", temporary: "TEMPORARY",
};

export function openingDescriptionText(o: PublicOpening): string {
  const d = o.details;
  const parts = [o.summary, d?.about, d?.responsibilities?.length ? `Responsibilities: ${d.responsibilities.join(" ")}` : "",
    d?.requirements?.length ? `Requirements: ${d.requirements.join(" ")}` : ""];
  return parts.filter(Boolean).join("\n\n");
}

function htmlDescription(o: PublicOpening): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const d = o.details;
  const list = (title: string, items?: string[]) => (items?.length ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "");
  return [`<p>${esc(o.summary)}</p>`, d?.about ? `<p>${esc(d.about)}</p>` : "", list("Responsibilities", d?.responsibilities),
    list("Requirements", d?.requirements), list("Good to have", d?.goodToHave), list("What we offer", d?.offers)].join("");
}

export function buildJobPostingJsonLd(o: PublicOpening) {
  const remote = o.workMode === "remote" || /^remote/i.test(o.location);
  const months = o.experienceMin != null ? o.experienceMin * 12 : null;
  const city = remote ? "" : o.location.split(",")[0].trim();
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: o.title,
    description: htmlDescription(o),
    identifier: { "@type": "PropertyValue", name: "HireStepX", value: o.slug },
    datePosted: o.listedAt.slice(0, 10),
    validThrough: o.expiresAt,
    employmentType: o.employmentType ? EMPLOYMENT_TYPE[o.employmentType] : undefined,
    hiringOrganization: POSTER,
    directApply: false,
    url: `${SITE}/openings/${o.slug}`,
    ...(remote
      ? { jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "India" } }
      : { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", ...(city ? { addressLocality: city } : {}), addressCountry: "IN" } } }),
    ...(months != null ? { experienceRequirements: { "@type": "OccupationalExperienceRequirements", monthsOfExperience: months } } : {}),
    ...(o.skills.length ? { skills: o.skills.join(", ") } : {}),
  };
}

/** "Title, Hybrid, Pune | HireStepX". Commas, not brackets: many titles already end in a bracket. */
export function openingMetaTitle(o: PublicOpening): string {
  const bits = [o.workMode ? WORK_MODE_LABEL[o.workMode] : "", o.location && o.workMode !== "remote" ? o.location : ""].filter(Boolean);
  const head = bits.length ? `${o.title}, ${bits.join(", ")}` : o.title;
  const full = `${head} | HireStepX`;
  return full.length <= 62 ? full : `${o.title} | HireStepX`;
}

export function openingMetaDescription(o: PublicOpening): string {
  const facts = [employmentLabel(o.employmentType), experienceLabel(o.experienceMin, o.experienceMax), o.location].filter(Boolean).join(" · ");
  const tail = "Practise an AI mock interview for this role; employers read your scored answers.";
  const body = `${o.summary} ${facts ? facts + ". " : ""}${tail}`;
  if (body.length <= 160) return body;
  const short = `${o.summary.slice(0, 110).replace(/\s+\S*$/, "")}… ${tail}`;
  return short.length <= 200 ? short : o.summary;
}
