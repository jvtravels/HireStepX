/* Table-driven coverage for the number-role classifier.
 *
 * Each row is a candidate utterance + an expected role binding. New
 * phrasings are added as new rows — not as new RegExp alternatives in
 * the kernel. This is the contract enforced by the architectural
 * refactor: a fix is a row, not a regex. */

import { describe, it, expect } from "vitest";
import {
  classifyNumberRoles,
  type NumberRoleContext,
  type NumberRoleResult,
} from "../../server-handlers/_number-role-classifier";

interface Row {
  /** Short label shown in test output. */
  label: string;
  /** Candidate utterance. */
  text: string;
  /** Optional context. */
  ctx?: NumberRoleContext;
  /** Expected subset of result fields. Fields omitted are not asserted. */
  expect: Partial<NumberRoleResult>;
}

const ROWS: Row[] = [
  /* ── Current-CTC cues ──────────────────────────────────────────── */
  { label: "currently earning N",        text: "I am currently earning 18 LPA",         expect: { currentCtc: 18 } },
  { label: "my current CTC",             text: "My current CTC is 22 LPA",              expect: { currentCtc: 22 } },
  { label: "I make N",                   text: "I make 15 LPA right now",               expect: { currentCtc: 15 } },
  { label: "drawing N",                  text: "drawing 19 LPA at present",             expect: { currentCtc: 19 } },
  { label: "I'm at N",                   text: "I'm at 12 LPA",                         expect: { currentCtc: 12 } },
  { label: "told you N already",         text: "I told you, 24 LPA CTC overall",        expect: { currentCtc: 24 } },
  { label: "as I mentioned",             text: "as I mentioned, 17 LPA total CTC",      expect: { currentCtc: 17 } },
  { label: "take home N",                text: "I take home 14 LPA right now",          expect: { currentCtc: 14 } },

  /* ── Target cues — English ─────────────────────────────────────── */
  { label: "expecting N",                text: "I'm expecting 30 LPA",                  expect: { target: 30 } },
  { label: "looking for N",              text: "looking for 28 LPA",                    expect: { target: 28 } },
  { label: "would like N",               text: "I would like 32 LPA",                   expect: { target: 32 } },
  { label: "I'd like N",                 text: "I'd like 35 LPA for this role",         expect: { target: 35 } },
  { label: "hoping for N",               text: "hoping for around 26 LPA",              expect: { target: 26 } },
  { label: "aiming for N",               text: "aiming for 40 LPA",                     expect: { target: 40 } },
  { label: "target is N",                text: "my target is 33 LPA",                   expect: { target: 33 } },
  { label: "anchor around N",            text: "anchoring around 32 LPA",               expect: { target: 32 } },
  { label: "bare anchor (no unit)",      text: "the anchor I had in mind was around 28", expect: { target: 28 } },
  { label: "settle for N",               text: "I'd settle for 25 LPA",                 expect: { target: 25 } },
  { label: "comfortable with N",         text: "comfortable with 27 LPA",               expect: { target: 27 } },

  /* ── Target cues — Hindi-mix ───────────────────────────────────── */
  { label: "N LPA chahiye",              text: "Mujhe 25 LPA chahiye",                  expect: { target: 25 } },
  { label: "N lakh chahiye",             text: "Honestly, 25 lakh chahiye for this role", expect: { target: 25 } },
  { label: "N LPA ka package",           text: "Sir, 30 LPA ka package chahiye",        expect: { target: 30 } },
  { label: "N lakh mil jaye",            text: "22 lakh mil jaye to bahut accha hoga",  expect: { target: 22 } },
  { label: "rupee-sign + expect karta",  text: "Main ₹35 LPA expect karta hu",          expect: { target: 35 } },

  /* ── Competing cues ────────────────────────────────────────────── */
  { label: "competing offer of N",       text: "I have a competing offer of 28 LPA",    expect: { competing: 28 } },
  { label: "another offer at N",         text: "another offer at 30 LPA",               expect: { competing: 30 } },
  { label: "in-hand offer of N",         text: "in-hand offer of 26 LPA",               expect: { competing: 26 } },
  { label: "received an offer of N",     text: "I received an offer of 32 LPA last week", expect: { competing: 32 } },
  { label: "got an offer at N",          text: "got an offer at 24 LPA",                expect: { competing: 24 } },

  /* ── Sentence-level defaults ───────────────────────────────────── */
  {
    label: "bare reply after bot asked CTC → current",
    text: "18 LPA",
    ctx: { lastAiText: "What's your current total annual CTC?" },
    expect: { currentCtc: 18 },
  },
  {
    label: "bare reply in probe-expectations → target",
    text: "30 LPA",
    ctx: { phase: "probe-expectations" },
    expect: { target: 30 },
  },
  {
    label: "no cue, no context → no bind",
    text: "30 LPA",
    expect: { currentCtc: null, target: null, competing: null },
  },

  /* ── Compound disclosures (same utterance, multiple roles) ─────── */
  {
    label: "current + target in one breath",
    text: "I'm currently at 18 LPA and expecting 30 LPA",
    expect: { currentCtc: 18, target: 30 },
  },
  {
    label: "current + competing",
    text: "drawing 20 LPA, but I have an offer at 28 LPA",
    expect: { currentCtc: 20, competing: 28 },
  },
  {
    label: "all three roles",
    text: "currently 18 LPA, competing offer of 25 LPA, looking for 32 LPA",
    expect: { currentCtc: 18, competing: 25, target: 32 },
  },

  /* ── Magnitudes / units ────────────────────────────────────────── */
  { label: "crore on target",            text: "expecting around 2 crore",              expect: { target: 200 } },
  { label: "crore on current",           text: "currently making 1.5 crore",            expect: { currentCtc: 150 } },
  { label: "lakhs spelt out",            text: "expecting 30 lakhs",                    expect: { target: 30 } },
  { label: "lacs (alt spelling)",        text: "I make 18 lacs",                        expect: { currentCtc: 18 } },
  { label: "USD-k → LPA via FX",         text: "competing offer of $150k from a US firm", expect: { competing: 124.5 } },

  /* ── Range upper-bound ────────────────────────────────────────── */
  {
    label: "target range upper",
    text: "expecting 28-35 LPA",
    expect: { target: 35, targetAsRange: true },
  },
  {
    label: "anchoring between range",
    text: "anchoring between 30-40 LPA",
    expect: { target: 40, targetAsRange: true },
  },

  /* ── Negative cases (must NOT bind) ────────────────────────────── */
  { label: "rejects 100 crore (clamp)",  text: "I'm looking for 100 crore",             expect: { target: null } },
  { label: "rejects garbage commas",     text: "I'm expecting 30,00,000 lakhs",         expect: { target: null } },
  { label: "ignores N days",             text: "I need 30 days to decide",              expect: { currentCtc: null, target: null } },
  { label: "ignores N years YOE",        text: "I have 8 years of experience",          expect: { currentCtc: null, target: null } },
  { label: "ignores N% hike",            text: "looking for 30% hike",                  expect: { target: null } },
];

describe("number-role classifier — table-driven coverage", () => {
  for (const row of ROWS) {
    it(row.label, () => {
      const got = classifyNumberRoles(row.text, row.ctx ?? {});
      for (const [k, v] of Object.entries(row.expect) as Array<
        [keyof NumberRoleResult, NumberRoleResult[keyof NumberRoleResult]]
      >) {
        expect(got[k], `field=${k} text=${row.text!}`).toEqual(v);
      }
    });
  }
});
