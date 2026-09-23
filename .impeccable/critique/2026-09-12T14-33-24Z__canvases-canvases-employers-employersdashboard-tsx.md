---
target: Employers Dashboard — hierarchy/typography audit
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-09-12T14-33-24Z
slug: canvases-canvases-employers-employersdashboard-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sort direction/active filters are visible; no toast/confirmation after Archive or Export completes |
| 2 | Match System / Real World | 3 | Familiar ATS-table conventions, plain-language labels |
| 3 | User Control and Freedom | 3 | Clear filters, cancel on both dialogs, no undo after Archive |
| 4 | Consistency and Standards | 3 | Stock shadcn primitives used consistently; undercut by the hierarchy issue below |
| 5 | Error Prevention | 3 | Archive requires confirmation; Composer disables Create/Save on empty title |
| 6 | Recognition Rather Than Recall | 2 | With the H1 removed, the only page-identity signal left is a 14px muted breadcrumb — nothing tells you "this is Opportunities" at a glance |
| 7 | Flexibility and Efficiency | 3 | Sort, filter, search, pagination, drag-to-reorder + new keyboard Move up/down all work |
| 8 | Aesthetic and Minimalist Design | 2 | Row title and its metadata line are the same size and weight; the copper accent fires twice per row in adjacent columns |
| 9 | Error Recovery | 3 | Archive dialog, Cancel actions present |
| 10 | Help and Documentation | 2 | No inline help/tooltips on the page itself (only inside the profile menu) |
| **Total** | | **27/40** | **Solid bones, undermined by flattened text hierarchy** |

#### Anti-Patterns Verdict

**LLM assessment**: This doesn't read as an obviously-AI-generated screen — no gradient text, no hero-metric cliché, no side-stripe borders, no identical card grids. The component craft (stock shadcn, real Radix primitives, consistent spacing tokens) is genuinely above the median AI output. The "off" feeling the user is picking up on is real, but it's a **hierarchy** problem, not a slop problem: this table currently has almost no typographic contrast between things that matter (row title, page identity) and things that don't (metadata, footer counts). Top-tier SaaS tables (Linear's issue list, Stripe's payments table, Vercel's deployments table) all lean hard on one strong anchor (page title or bold primary cell) against everything else receding — this screen has flattened toward "everything is text-sm, everything is font-medium."

**Deterministic scan**: unavailable — the bundled `detect.mjs` detector could not be loaded in this environment (`bundled detector not found`). This report is manual-review only; no CLI counts to reconcile.

**Browser visualization**: no live overlay was injected (this is a canvas-devserver storyboard, not a URL browser session); verification instead used `canvas_screenshot` against the live-rendered storyboard, which is the equivalent visual evidence for this surface.

*Assessment independence: degraded — single-pass review, no isolated second sub-agent, per session constraints. Take the heuristic scores as directional, not adversarially verified.*

#### Overall Impression

The component-level craft here is strong — real shadcn primitives, working sort/filter/search/pagination, a considered color-restraint policy documented right in the file header. The imbalance the user is feeling is structural, not decorative: removing the H1 a moment ago deleted the *only* strong text anchor on the page and left the breadcrumb (a wayfinding element, never designed to carry page-identity weight) to do a job it's too quiet for. Compounding that, inside the table itself the primary signal (opportunity title) and the secondary signal (pay/type/duration) are typographically identical — same size, same weight — so the eye has nothing to land on first. The single biggest opportunity: reestablish one clear anchor at the top of the content area, and add one deliberate weight/size step between title and metadata in each row. Both are small, surgical changes; neither requires touching the parts that already work (search, filters, sorting, drag-reorder).

#### What's Working

- **Restrained, purposeful color system**: primary (indigo) for actions/navigation, copper strictly for the evidence signal, destructive red for danger — documented and mostly held to, which is rarer than it should be in a first pass.
- **Real interaction depth**: search → filter → sort → paginate all compose correctly against the same row set, and the row-reorder now has a keyboard-accessible fallback (Move up/down) alongside drag — most exploratory concepts stop at "looks right," this one actually behaves right.
- **Empty and no-results states are distinct**: "No postings yet" vs "No opportunities match" tell the user two different, correct things instead of one generic blank-slate message.

#### Priority Issues

**[P1] No page-identity anchor above the toolbar**
- *Why it matters*: The breadcrumb ("Dashboard > Opportunities") is 14px, `text-muted-foreground`, and shares visual weight with a dozen other secondary strings on the page. Every top-tier reference (Linear, Stripe, Vercel) keeps *some* stronger anchor in the content area itself, even a compact one — never relies on the breadcrumb alone to say "you are here." Right now the search bar is the first thing your eye actually registers, which reads as a toolbar floating with nothing above it.
- *Fix*: Reintroduce a single, lighter-weight line above the toolbar — not the old `text-2xl` H1 + subtitle pair (that was too loud for the amount of real content below it), but something like a `text-base font-semibold` label, or fold the count into it ("7 opportunities"). One line, no subtitle.
- *Suggested command*: `impeccable layout` or `impeccable typeset`

**[P1] Row title and metadata line have identical typographic weight**
- *Why it matters*: `EmployersDashboard.tsx:1290-1297` — both the opportunity title (`text-foreground font-medium`) and the pay/type/duration line (`text-foreground font-medium` for the pay figure) are set at the same size and the same weight. There's no "this is the headline, this is supporting detail" contrast within the row itself, which is exactly the kind of flatness that reads as unpolished at a glance.
- *Fix*: Step the title up (`font-semibold`, optionally a hair larger) and let the metadata line recede further (drop `font-medium` off the pay figure, or keep it but tint it into `text-muted-foreground` like the rest of the line).
- *Suggested command*: `impeccable typeset`

**[P2] The copper "evidence" accent fires twice per row, in adjacent columns**
- *Why it matters*: `EmployersDashboard.tsx:1310` (avg evidence score) and `:1322` (Score range) both render in the same copper token, side by side in neighboring columns. The file's own header comment describes copper as reserved for "the evidence signal only," singular — two adjacent copper strings per row dilutes that into decoration rather than a single deliberate cue, and it's part of why the table feels visually busier than it needs to.
- *Fix*: Keep copper on exactly one of the two (the avg score, since it's the header-level KPI too) and let Score range render in `text-muted-foreground` like its sibling "N evaluated" line.
- *Suggested command*: `impeccable colorize`

**[P2] Abrupt vertical rhythm under the header**
- *Why it matters*: With the H1 block gone, the search/filter/create toolbar now sits directly under `p-4` (16px) padding beneath the 64px header bar. Combined with the missing anchor above, the top of the page feels compressed rather than composed.
- *Fix*: Once a lighter page-identity line is reintroduced (P1 above), give it deliberate spacing (not the old `mt-1` tight subtitle rhythm) so the toolbar has room to breathe underneath it.
- *Suggested command*: `impeccable layout`

**[P3] Footer row (selection count, rows-per-page, pagination) is uniformly `text-sm font-medium`**
- *Why it matters*: Minor, but every string in the footer currently carries the same weight regardless of importance — "Page 1 of 1" doesn't need the same visual weight as "Rows per page."
- *Fix*: Drop `font-medium` from the lower-priority labels; keep it only where a value is being read (the page-count number itself).
- *Suggested command*: `impeccable typeset`

#### Persona Red Flags

**Priya (busy hiring manager, scans fast between meetings)**: Lands on the page and has to actually read the breadcrumb to confirm she's on Opportunities — there's no bigger visual cue confirming it. Once in the table, "Product Designer" and "₹1,20,000/month · Contract · 16 Weeks..." compete for her eye at equal weight, so the fast scan she's expecting (this product's own stated design principle: "scannability over density") doesn't actually happen here — she has to read the whole line instead of catching the title first.

**Rohan (first-time employer, cautious, low trust in an unfamiliar tool)**: The flattened hierarchy reads as "unfinished" rather than "clean," which works against the credibility this product needs from a new user in its first session. Nothing is broken, but nothing signals "this was crafted by people who do this for a living" either — which is precisely the gap between "functional" and "top-tier."

#### Minor Observations

- The "AI Screening" column header is the only one without a sort affordance and without a `SortableHead` chevron — intentional (it's not a sortable field) but visually it sits slightly oddly next to four sortable neighbors; consider a subtler visual cue that it's a fixed label, not a missed sort control.
- `stageIconClass` gives "Hired" a filled indigo icon while the other three stages are outlined/muted — a nice touch that already does real hierarchy work; worth reusing that same weight-contrast idea (bold vs. quiet) elsewhere on the page.

#### Questions to Consider

- What if the page-identity anchor were folded into the toolbar itself (e.g., "Opportunities · 7") rather than sitting above it as its own line?
- Does every row need a two-line cell, or would a single, denser line (title inline with a de-emphasized meta string) read faster for the "busy hiring manager between meetings" persona?
- If copper is retired from one of the two per-row spots, does the header-level "avg evidence score" summary still feel connected to it, or does it need its own visual echo elsewhere?
