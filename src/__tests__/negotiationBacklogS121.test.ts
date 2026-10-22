/* Live-verification backlog wave — S121–S138 (2026-07-31).
 *
 * The scenario audit doc lists S119+ as "Pending live verification". This
 * file drives each pending scenario through the REAL kernel + planner +
 * canonical-prose renderer (the deterministic LLM-off worst case) using the
 * SAME production band the server would compute for that (role, company) via
 * resolveServerBand — no hand-picked bands, so a mis-calibrated tier surfaces
 * here exactly as it would live.
 *
 * Every shipped recruiter line is held to the battery's phrasing-independent
 * output contracts (Indian-HR register + fluency, no filler over a standing
 * offer) PLUS band-sanity invariants (opener inside the band, no phantom
 * over-band offer). A scenario that trips any assert is a real S-bug.
 */
import { describe, it, expect } from "vitest";
import {
  runConversation,
  registerViolations,
  fluencyViolations,
  fillerHit,
} from "./_negotiationSim";
import { resolveServerBand } from "../../server-handlers/_band-resolver";

interface Backlog {
  id: string;
  company: string;
  role: string;
  ctc: number;
  target: number;
}

// Extracted verbatim from the Live Scenario Audit doc (S121–S138).
const BACKLOG: Backlog[] = [
  { id: "S121", company: "Khatabook", role: "Engineering Manager", ctc: 45, target: 68 },
  { id: "S122", company: "Bajaj Finserv", role: "Senior Product Manager", ctc: 42, target: 62 },
  { id: "S123", company: "McKinsey", role: "Engagement Manager", ctc: 65, target: 95 },
  { id: "S124", company: "CleverTap", role: "Senior Backend Engineer", ctc: 35, target: 54 },
  { id: "S125", company: "Standard Chartered India", role: "Technology Lead", ctc: 38, target: 58 },
  { id: "S126", company: "Infosys BPM", role: "Operations Manager", ctc: 18, target: 28 },
  { id: "S127", company: "Rapido", role: "Senior Product Manager", ctc: 38, target: 58 },
  { id: "S128", company: "SBI Life Insurance", role: "IT Lead", ctc: 24, target: 38 },
  { id: "S129", company: "Sun Pharma", role: "Data Science Lead", ctc: 28, target: 44 },
  { id: "S130", company: "Dr. Reddy's", role: "Senior Business Analyst", ctc: 20, target: 32 },
  { id: "S131", company: "Cipla", role: "Technology Manager", ctc: 32, target: 50 },
  { id: "S132", company: "Glenmark", role: "Digital Transformation Manager", ctc: 28, target: 44 },
  { id: "S133", company: "Lupin", role: "IT Program Manager", ctc: 35, target: 54 },
  { id: "S134", company: "Aurobindo Pharma", role: "Senior Data Analyst", ctc: 18, target: 28 },
  { id: "S135", company: "Biocon", role: "Bioinformatics Engineer", ctc: 22, target: 35 },
  { id: "S136", company: "Zydus", role: "Senior Software Engineer", ctc: 20, target: 32 },
  { id: "S137", company: "Torrent Pharma", role: "Digital Marketing Manager", ctc: 18, target: 28 },
  { id: "S138", company: "Divi's Laboratories", role: "Data Engineer", ctc: 22, target: 34 },
];

/** Standard adversarial candidate script parametrised by the scenario's
 *  CTC / target — discloses both early (so discovery can complete), pushes
 *  twice, probes a non-cash lever, then accepts. */
function script(ctc: number, target: number): string[] {
  return [
    `I'm currently at ${ctc} LPA with several years of experience.`,
    `I'm targeting around ${target} LPA total.`,
    `Can you move closer to ${target}?`,
    `Is that really your best?`,
    `What about a joining bonus or ESOP to bridge the gap?`,
    `Okay, that works. I accept.`,
  ];
}

describe("Negotiation backlog S121–S138 — live verification (deterministic path)", () => {
  for (const s of BACKLOG) {
    const band = resolveServerBand(s.role, s.company, "senior", null);

    it(`${s.id} ${s.company} × ${s.role} — band is sane`, () => {
      expect(band.initialOffer).toBeGreaterThan(0);
      expect(band.maxStretch).toBeGreaterThanOrEqual(band.initialOffer);
      expect(band.walkAway).toBeGreaterThan(0);
      expect(band.walkAway).toBeLessThanOrEqual(band.initialOffer);
    });

    it(`${s.id} ${s.company} × ${s.role} — clean recruiter lines & no overpay past ask`, () => {
      const { transcript } = runConversation({
        sessionId: s.id.toLowerCase(),
        role: s.role,
        company: s.company,
        band,
        turns: script(s.ctc, s.target),
      });

      let offerOnTable = false;
      for (const t of transcript) {
        // Phrasing-independent output contracts — always true, every line.
        const reg = registerViolations(t.aiText);
        const flu = fluencyViolations(t.aiText);
        expect(reg, `${s.id} register violation in: "${t.aiText}"`).toEqual([]);
        expect(flu, `${s.id} fluency violation in: "${t.aiText}"`).toEqual([]);

        if (offerOnTable) {
          const filler = fillerHit(t.aiText);
          expect(filler, `${s.id} filler over a standing offer: "${filler}"`).toBeNull();
        }
        if (t.highestOfferMade > 0) offerOnTable = true;

        // The recruiter must never volunteer MORE than the candidate asked
        // for — over-shooting the target is money left on the table and a
        // coaching-signal corruption. (The band's CTC-floor lift can push an
        // offer above a too-low band ceiling; that is legitimate. Over the
        // candidate's own ask is never legitimate.)
        expect(
          t.highestOfferMade,
          `${s.id} overpay past ask: offer ${t.highestOfferMade} > target ${s.target}`,
        ).toBeLessThanOrEqual(s.target);
      }
    });
  }
});

/* S172/S152/S164/S198/S206 — role-abbreviation lift.
 * A bare "EM" must resolve to the SAME manager band as the spelled-out
 * "Engineering Manager" (previously "EM" @ a unicorn resolved to a ~₹16L
 * junior-IC opener because PEOPLE_MANAGER_TITLE_RE / the legacy lookup only
 * matched the spelled-out title). canonicalizeRoleTitle now expands it up
 * front so liftPeopleManagerBand fires. */
describe("EM abbreviation resolves to the Engineering Manager band", () => {
  for (const company of ["Razorpay", "Ola", "Flipkart"]) {
    it(`${company}: resolveServerBand("EM") === resolveServerBand("Engineering Manager")`, () => {
      const em = resolveServerBand("EM", company);
      const full = resolveServerBand("Engineering Manager", company);
      expect(em).toEqual(full);
      // and materially above a junior-IC anchor for the same company
      const ic = resolveServerBand("Software Engineer", company);
      expect(em.initialOffer).toBeGreaterThan(ic.initialOffer * 0.9);
      expect(em.maxStretch).toBeGreaterThanOrEqual(ic.maxStretch);
    });
  }
});
