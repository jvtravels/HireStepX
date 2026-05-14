# SME Voice Scripts (H1-H10)

10 ready-to-record happy-path scenarios for the salary-negotiation kernel.
Each script has 6-10 verbatim speaker turns alternating Candidate / Recruiter,
a target outcome, and the kernel signals the LLM should flag.

---

## H1: Fresher first offer (₹4.5 LPA)

**Target outcome**: Candidate converts to ₹5.5 LPA + ₹50k joining bonus.
**Kernel flags expected**: `freshGradDisclosed=true`, `collegeTier=tier-2`,
opener lever = `open-with-offer`, no `domainPivot`.

1. Recruiter: "Welcome aboard. For the SDE-1 role our standard offer is ₹4.5 LPA all-in."
2. Candidate: "Thanks. I'm a 2026 NIT-Trichy grad and I have a PPO at ₹5.2 from my summer intern. Can we match?"
3. Recruiter: "Let me check — given your campus tier we can stretch to ₹4.8 LPA fixed."
4. Candidate: "Could you also look at a one-time joining bonus? I'm relocating from Pune."
5. Recruiter: "We can do a ₹50,000 joining bonus, payable after 90 days."
6. Candidate: "Appreciate it. If I commit today, can we land at ₹5.5 LPA fixed plus the joining bonus?"
7. Recruiter: "₹5.3 fixed plus ₹50k joining is our final. ESOP grant comes after probation."
8. Candidate: "Done — let's go with that. Please share the letter today."

---

## H2: Mid-IC base + variable (SWE-2, 4 YoE)

**Target outcome**: ₹24 → ₹28 LPA total with ESOP refresh discussion.
**Flags**: `tenureSignal=stable`, `infoAsked=['variable','esop']`,
`vossTactics=['mirror','calibrated-question']`.

1. Recruiter: "For the SDE-2 role we're at ₹24 LPA fixed plus 10% variable."
2. Candidate: "Twenty-four fixed? Help me understand — what's the variable trigger tied to?"
3. Recruiter: "Team-level OKRs, paid out half-yearly. Most folks hit 90-100%."
4. Candidate: "Got it. My current is ₹22 fixed plus ESOPs vesting next year. To switch I'd need ₹28 total."
5. Recruiter: "₹28 is above band. I can do ₹26 fixed plus 15% variable — gets you to ₹29.9 at target."
6. Candidate: "Variable at 15% is helpful. What about an ESOP grant on top? Refresh cycle?"
7. Recruiter: "Standard grant is ₹6L over 4 years, 1-year cliff, refresh after 18 months."
8. Candidate: "Works for me. ₹26 + 15% + ₹6L ESOP — please send the letter."

---

## H3: Senior-IC anchored ask (Staff SWE, 9 YoE)

**Target outcome**: ₹52 LPA total, walks back from ₹60 ask.
**Flags**: `candidateTarget=60`, `firstAnchoredTarget=60`,
`candidateAskedAsRange=true`, kernel `hold-firm` fires.

1. Recruiter: "Welcome. For the Staff Engineer role we're at ₹45 LPA all-in."
2. Candidate: "Thanks for the offer. Given my staff-level scope and the two competing offers I have, my expectation is ₹58 to ₹62 LPA."
3. Recruiter: "₹62 is well above our band. What's driving the 60+?"
4. Candidate: "One of the two offers is at ₹60 fixed from a Series-D unicorn. The other is a tier-1 GCC at ₹55 plus larger ESOP. I'd join you for cultural fit but I can't take a step down."
5. Recruiter: "I hear you. ₹50 fixed plus ₹12L ESOP over 4 years is what I can stretch to."
6. Candidate: "I'd need at least ₹52 fixed to make this work, given the unicorn cash."
7. Recruiter: "Let me come back to you in 24 hours. ₹52 is at the absolute ceiling — I'd need leadership sign-off."
8. Candidate: "Fair. Looking forward to the revert."

---

## H4: Engineering Manager (₹38 LPA → ₹46)

**Target outcome**: Manager promotion offer with retention bump.
**Flags**: `levelMismatch=null`, `competingOffer=true`, `retentionCounter` referenced.

1. Recruiter: "For the EM role our band is ₹35-42 LPA. We'd open at ₹38 plus 12% variable."
2. Candidate: "Thanks. My current is ₹34 fixed but my company offered a retention of ₹40 last month."
3. Recruiter: "Counters are real here. Is it written, or verbal?"
4. Candidate: "Written — I can share the retention letter. To leave I'd need ₹45 plus team-formation autonomy."
5. Recruiter: "₹45 fixed is above midpoint. I can do ₹42 fixed plus ₹4L sign-on plus the autonomy ask, hard-coded in offer letter."
6. Candidate: "Sign-on helps. Can you make it ₹5L? That covers the bonus I'm leaving."
7. Recruiter: "₹5L sign-on, payable on Day 1, with 1-year clawback. ₹42 fixed plus that puts you at ₹46 effective Year 1."
8. Candidate: "That works. Send the letter — include the autonomy clause."

---

## H5: BFSI March-bonus timing (₹28 → ₹34)

**Target outcome**: Joining date negotiated post-bonus payout.
**Flags**: `noticeJoining.bonusForfeitureDate=March`, `joiningBufferAsk=true`.

1. Recruiter: "We can offer you ₹28 LPA fixed for the Risk-Analytics role. Notice is 60 days, can you start by Feb 28?"
2. Candidate: "I'd be forfeiting my March variable bonus — that's ₹3.5L gross. Either I delay joining or you buy that out."
3. Recruiter: "Bonus buyout is unusual for us. How firm is the March 31 payout date?"
4. Candidate: "It's HDFC — payout is March 31 for all confirmed employees. If I leave before, I lose it entirely."
5. Recruiter: "Let me see — we can do a ₹3L sign-on bonus, payable in your first month here, contingent on Apr 7 start date."
6. Candidate: "Works. Can we put the ₹3L in writing as a sign-on with no clawback past 12 months?"
7. Recruiter: "12-month clawback is standard. I'll have the letter out by EOD."
8. Candidate: "Appreciate the flex. April 7 it is."

---

## H6: GCC arbitrage (UK product manager → Bangalore)

**Target outcome**: Cross-border comp normalised to ₹55 LPA + ESOP.
**Flags**: `competingOffer=true`, `locationMode=cross-border`,
`crossBdr:UKtoIN` (internal — should not leak to candidate).

1. Recruiter: "Welcome to the GCC. For the Senior PM role we're at ₹48 LPA all-in."
2. Candidate: "Thanks. My current is £72k base plus £8k bonus at a London fintech. PPP-adjusted that's about ₹65L equivalent."
3. Recruiter: "Indian comp doesn't PPP-adjust 1:1 — we benchmark on local tier-1 GCC bands. ₹48 is at our 75th percentile."
4. Candidate: "I get the local benchmark. I'd need ₹55 fixed plus an ESOP grant to make the move attractive."
5. Recruiter: "₹52 fixed plus ₹15L USD-denominated ESOP over 4 years is what I can stretch to."
6. Candidate: "USD-denom ESOP helps with the cross-border concern. Can you also commit to a Bangalore relocation package?"
7. Recruiter: "Yes — ₹4L relocation, one-way flights for family, 30 days temp accommodation."
8. Candidate: "Sold. Please send the offer letter."

---

## H7: Returning mom — career gap (₹18 LPA, 2-year gap)

**Target outcome**: Re-entry offer with returnship framing.
**Flags**: `careerGapMonths=24`, `returnshipMaternity=true` (sensitive — must NOT log).

1. Recruiter: "Welcome back to the industry. For the Senior PMM role we're at ₹18 LPA fixed."
2. Candidate: "Thanks. I was earning ₹22 fixed before my career break — I've kept current with two certifications and a freelance engagement during the gap."
3. Recruiter: "We appreciate the work you've done. Returnship pricing is benchmarked separately — typically 15-20% below pre-gap level."
4. Candidate: "I'd want at least ₹20 fixed given the certifications and the freelance scope. Can we look at a 6-month review?"
5. Recruiter: "₹19 fixed plus an explicit 6-month review with merit-based correction to band-midpoint is what I can do."
6. Candidate: "Could you put the 6-month review correction in writing in the letter?"
7. Recruiter: "Yes — I'll include a clause specifying performance-based correction to band midpoint at month 6."
8. Candidate: "That works. Please share the letter."

---

## H8: Notice-period buyout leverage (₹40 → ₹44 + buyout)

**Target outcome**: 90-day notice bought out by employer.
**Flags**: `noticeJoining.noticeDays=90`, `noticeBuyoutAsked=true`.

1. Recruiter: "We'd like to bring you in at ₹40 LPA. When can you start?"
2. Candidate: "My notice is 90 days at the current employer. Their buyout policy is 2-month base salary — about ₹4L."
3. Recruiter: "Can you negotiate the notice down to 60?"
4. Candidate: "I've tried — they're strict. Either I do the full 90 or you cover the buyout. If you cover, I can start in 30 days."
5. Recruiter: "₹4L is steep. We can do ₹3L buyout — you cover the delta of ₹1L."
6. Candidate: "If you stretch to ₹4L buyout I can join on Day 30. That gets me onboarded 60 days earlier — that's worth more than ₹1L of cash to your team."
7. Recruiter: "Fair argument. ₹4L buyout, conditional on 30-day start, clawback if you leave before 18 months."
8. Candidate: "Done — let's lock it in."

---

## H9: Multi-offer pivot (3 active offers, ₹55 target)

**Target outcome**: Candidate stacks signals to land ₹55 LPA.
**Flags**: `competingOffer=true`, `competingOfferDetail.letterShareOffered=true`,
`offerShoppingDemand=false` (must remain false — kernel watches for this).

1. Recruiter: "We're at ₹48 LPA all-in for the Senior Data Scientist role."
2. Candidate: "Thanks. I'm in late stages with two other companies — both at the ₹52-58 range. I can share offer letters once they're in hand if helpful."
3. Recruiter: "Letter-share would help us make a stronger case internally. What's your timing?"
4. Candidate: "Both should close this week. My preference is your team for the ML platform scope — but I need to be in the same range."
5. Recruiter: "If you share the letters and they hold up, we can revisit. Tentatively ₹52 fixed is our best."
6. Candidate: "I'll share by Friday. To make this clean — if both come in above ₹55, can you commit to ₹55 today?"
7. Recruiter: "Conditional on documented offers ≥₹55, yes — ₹55 fixed plus our standard ESOP grant."
8. Candidate: "Agreed. Sharing the letters by Friday EOD."

---

## H10: ESOP-heavy offer (early-stage startup, ₹35 cash + ESOP)

**Target outcome**: Cash floor raised, ESOP vesting accelerated.
**Flags**: `equityVesting=true`, `treatsEquityAsCash=false` (kernel guards).

1. Recruiter: "For the founding engineer role: ₹35 LPA cash plus 0.5% ESOP over 4 years."
2. Candidate: "Thanks. I want to take the ESOP seriously, not as cash — so let's talk cash floor first. What's the band for cash specifically?"
3. Recruiter: "Cash band is ₹30-40 depending on level. ₹35 is mid-band."
4. Candidate: "Given I'm leaving a stable ₹38 cash role, I'd need at least ₹40 cash. The ESOP upside is real but I can't substitute it for groceries."
5. Recruiter: "₹40 cash is our ceiling. If you take ₹40, I can stretch ESOP to 0.6% with a 2-year cliff replaced by a 1-year cliff."
6. Candidate: "1-year cliff is helpful. Can we also document accelerated vesting on acquisition — 50% acceleration on single-trigger?"
7. Recruiter: "Single-trigger accel is unusual — we do double-trigger. I'll get sign-off on 50% single-trigger and revert."
8. Candidate: "Appreciate it. Cash ₹40, ESOP 0.6% with 1-year cliff and single-trigger 50% accel — pending your revert."
