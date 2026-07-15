/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Sticky jump-to-section nav. SectionEyebrow moved to _primitives.tsx
 * 2026-05-29 (SrSectionShell composes it) and re-exported here for
 * back-compat with the per-panel `import { SectionEyebrow } from
 * "./sr-JumpNav"` call sites.
 * Pure presentation. */

export { SectionEyebrow } from "./_primitives";

export function JumpNav({ hideCoachNotes }: { hideCoachNotes?: boolean } = {}) {
  const allItems = [
    { num: "01", label: "Overview", href: "#ir-section-hero" },
    { num: "02", label: "Delivery", href: "#ir-section-metrics" },
    { num: "03", label: "Skills", href: "#ir-section-skills" },
    { num: "04", label: "Questions", href: "#ir-section-questions" },
    { num: "05", label: "Coach Notes", href: "#ir-section-coach-notes" },
    { num: "06", label: "Next Steps", href: "#ir-section-next" },
  ];
  const items = hideCoachNotes ? allItems.filter(i => i.label !== "Coach Notes") : allItems;
  return (
    <nav aria-label="Jump to section" className="ir-jump-nav">
      <div className="ir-jump-nav-inner">
        {items.map((i) => (
          <a key={i.href} href={i.href} className="ir-jump-link">
            <span className="ir-jump-link-num">{i.num}</span>
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
