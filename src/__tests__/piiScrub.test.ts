import { describe, it, expect } from "vitest";
import { scrubPii, restorePii, isValidLuhn, isValidVerhoeff } from "../../server-handlers/_pii-scrub";

const scrub = (t: string) => scrubPii(t).text;

describe("scrubPii: identifiers", () => {
  it("replaces emails and reuses the same placeholder for repeats (case-insensitive)", () => {
    const r = scrubPii("Mail rahul.sharma+jobs@gmail.com or RAHUL.SHARMA+jobs@gmail.com, cc priya@corp.co.in");
    expect(r.text).toBe("Mail [EMAIL_1] or [EMAIL_1], cc [EMAIL_2]");
    expect(r.map["[EMAIL_1]"]).toBe("rahul.sharma+jobs@gmail.com");
  });

  it("replaces Indian mobile numbers in common formats", () => {
    for (const p of ["9876543210", "98765 43210", "+91 98765 43210", "+91-9876543210", "91 9876543210", "098765 43210", "987 654 3210", "+919876543210"]) {
      expect(scrub(`Call ${p} today`)).toBe("Call [PHONE_1] today");
    }
  });

  it("replaces international phone numbers", () => {
    expect(scrub("US office +1 (415) 555-0132 anytime")).toBe("US office [PHONE_1] anytime");
    expect(scrub("UK +44 20 7946 0958.")).toBe("UK [PHONE_1].");
  });

  it("replaces Aadhaar in grouped form, contiguous valid form and labelled form", () => {
    expect(scrub("UID 2345 6789 0124 end")).toBe("UID [AADHAAR_1] end");
    expect(scrub("2345-6789-0124")).toBe("[AADHAAR_1]");
    expect(scrub("number 234567890124 here")).toBe("number [AADHAAR_1] here");
    expect(scrub("Aadhaar No: 1111 2222 3333")).toBe("Aadhaar No: [AADHAAR_1]");
    expect(scrub("aadhaar card number 111122223333")).toBe("aadhaar card number [AADHAAR_1]");
  });

  it("replaces PAN numbers", () => {
    expect(scrub("PAN: ABCPE1234F.")).toBe("PAN: [PAN_1].");
  });

  it("replaces passport numbers only when labelled", () => {
    expect(scrub("Passport No: K1234567")).toBe("Passport No: [PASSPORT_1]");
    expect(scrub("passport number Z9876543 valid till 2030")).toBe("passport number [PASSPORT_1] valid till 2030");
    expect(scrub("my passport renewal is pending")).toBe("my passport renewal is pending");
    expect(scrub("model K1234567 shipped")).toBe("model K1234567 shipped");
  });

  it("replaces labelled bank account numbers and IFSC codes", () => {
    expect(scrub("A/c No. 123456789012 at SBIN0001234")).toBe("A/c No. [BANK_ACCT_1] at [IFSC_1]");
    expect(scrub("Account number: 00112233445566")).toBe("Account number: [BANK_ACCT_1]");
  });

  it("replaces Luhn-valid card numbers (grouped, contiguous, amex)", () => {
    expect(scrub("Card 4111 1111 1111 1111 exp")).toBe("Card [CARD_1] exp");
    expect(scrub("5500005555555559")).toBe("[CARD_1]");
    expect(scrub("3782 822463 10005")).toBe("[CARD_1]");
    expect(scrub("4111-1111-1111-1111")).toBe("[CARD_1]");
  });

  it("replaces UPI IDs but leaves ordinary emails to the email rule", () => {
    expect(scrub("pay rahul.k@okhdfcbank now")).toBe("pay [UPI_1] now");
    expect(scrub("pay 9876543210@ybl now")).toBe("pay [UPI_1] now");
    expect(scrub("mail me at a.b@company.com")).toBe("mail me at [EMAIL_1]");
  });

  it("replaces labelled dates of birth in several layouts and keeps the label", () => {
    expect(scrub("DOB: 14/03/1996")).toBe("DOB: [DOB_1]");
    expect(scrub("Date of Birth - 14 March 1996")).toBe("Date of Birth - [DOB_1]");
    expect(scrub("D.O.B 1996-03-14")).toBe("D.O.B [DOB_1]");
    expect(scrub("Born on March 14, 1996 in Pune")).toBe("Born on [DOB_1] in Pune");
  });

  it("replaces personal LinkedIn and GitHub profile URLs", () => {
    expect(scrub("https://www.linkedin.com/in/rahul-sharma-123/ and linkedin.com/in/priya")).toBe("[LINKEDIN_1] and [LINKEDIN_2]");
    expect(scrub("github.com/rahul-s/payments-service")).toBe("[GITHUB_1]/payments-service");
    expect(scrub("see https://github.com/features/actions")).toBe("see https://github.com/features/actions");
  });

  it("replaces labelled and multi-part address lines", () => {
    const r = scrub("Name: Rahul\nAddress: Flat 402, Sunrise Apartments, MG Road, Bengaluru 560001\nSkills: Go");
    expect(r).toBe("Name: Rahul\nAddress: [ADDRESS_1]\nSkills: Go");
    expect(scrub("Flat 402, Sunrise Apartments, MG Road, Bengaluru - 560001")).toBe("[ADDRESS_1]");
    expect(scrub("12/4 Gandhi Nagar, Sector 5, Near Metro, Noida 201301, India")).toBe("[ADDRESS_1]");
  });

  it("replaces labelled PIN codes", () => {
    expect(scrub("Pincode: 560 001")).toBe("Pincode: [PIN_1]");
    expect(scrub("PIN - 400001")).toBe("PIN - [PIN_1]");
  });

  it("can skip kinds", () => {
    const r = scrubPii("a@b.com 9876543210", { skip: ["PHONE"] });
    expect(r.text).toBe("[EMAIL_1] 9876543210");
  });

  it("returns empty and non-string input untouched", () => {
    expect(scrubPii("")).toEqual({ text: "", map: {} });
    expect(scrubPii("plain text")).toEqual({ text: "plain text", map: {} });
  });
});

describe("scrubPii: false-positive guards", () => {
  it("leaves years, ranges and year runs alone", () => {
    for (const t of ["2019-2023", "worked 2018 to 2022", "2019 2020 2021 2022", "2019-2020-2021", "FY 2023-24", "Class of 2021"]) {
      expect(scrub(t)).toBe(t);
    }
  });

  it("leaves Indian salaries, LPA and currency amounts alone", () => {
    for (const t of ["CTC ₹12,00,000", "12 LPA to 18 LPA", "Rs. 1,25,00,000 per annum", "$150,000 base", "₹98,76,54,321", "salary 1200000 INR", "turnover of 8000000000 rupees"]) {
      expect(scrub(t)).toBe(t);
    }
  });

  it("leaves percentages, CGPA, versions and IPs alone", () => {
    for (const t of ["improved latency by 98.5%", "CGPA 9.12/10", "upgraded to Node 20.11.1 and v3.2.0", "host 192.168.100.200", "scored 96.5 percentile", "+20% growth"]) {
      expect(scrub(t)).toBe(t);
    }
  });

  it("leaves large order-of-magnitude numbers in answers alone", () => {
    for (const t of ["served 10000000 requests a day", "handled 250000 users", "a 1000000000000 row table", "processed 100000 pincodes", "ran for 3000000 ms"]) {
      expect(scrub(t)).toBe(t);
    }
  });

  it("does not treat Luhn-invalid or non-card-prefix digit runs as cards", () => {
    expect(scrub("order 4111 1111 1111 1112")).toBe("order 4111 1111 1111 1112");
    expect(scrub("ID 1000000000000008")).toBe("ID 1000000000000008");
  });

  it("does not treat bare 12-digit runs failing Verhoeff as Aadhaar", () => {
    expect(scrub("transaction 234567890125 closed")).toBe("transaction 234567890125 closed");
  });

  it("does not mistake prose with keywords for an address", () => {
    const t = "I led a cross-functional team, shipped 100000 units, and grew the block rate, near plot twist";
    expect(scrub(t)).toBe(t);
  });

  it("does not eat the word pin or PAN-lookalike words", () => {
    expect(scrub("I pin 100000 requests per second")).toBe("I pin 100000 requests per second");
    expect(scrub("AMAZON1234 ABCDE")).toBe("AMAZON1234 ABCDE");
  });

  it("leaves names, employers and plain answers intact", () => {
    const t = "My name is Rahul Sharma. I worked at Infosys in Pune and reduced churn by 18% in Q3 2022.";
    expect(scrub(t)).toBe(t);
  });

  it("keeps phone-length digits glued to identifiers", () => {
    expect(scrub("ticket ID9876543210X")).toBe("ticket ID9876543210X");
  });
});

describe("restorePii", () => {
  it("round-trips scrubbed text", () => {
    const original = "Reach Rahul at rahul@x.com or +91 98765 43210. PAN ABCPE1234F. DOB: 14/03/1996.";
    const { text, map } = scrubPii(original);
    expect(text).not.toMatch(/rahul@x\.com|98765|ABCPE1234F|14\/03\/1996/);
    expect(restorePii(text, map)).toBe(original);
  });

  it("restores placeholders the model re-cased or spaced", () => {
    const { map } = scrubPii("a@b.com");
    expect(restorePii("write to [email_1] now", map)).toBe("write to a@b.com now");
    expect(restorePii("write to [EMAIL 1] now", map)).toBe("write to a@b.com now");
  });

  it("leaves unknown placeholders and bracket text alone", () => {
    const { map } = scrubPii("a@b.com");
    expect(restorePii("see [EMAIL_9] and [note] and [1]", map)).toBe("see [EMAIL_9] and [note] and [1]");
  });

  it("json mode escapes restored values so JSON stays parseable", () => {
    const { text, map } = scrubPii('Address: Flat 4, "Rose" Apts, MG Road, Pune 411001\\n');
    const llmReply = JSON.stringify({ addr: text.split(": ")[1] });
    const plain = restorePii(llmReply, map, { json: true });
    expect(() => JSON.parse(plain)).not.toThrow();
    expect(JSON.parse(plain).addr).toContain('"Rose"');
  });

  it("is a no-op with an empty map", () => {
    expect(restorePii("[EMAIL_1]", {})).toBe("[EMAIL_1]");
  });
});

describe("checksums", () => {
  it("Luhn", () => {
    expect(isValidLuhn("4111111111111111")).toBe(true);
    expect(isValidLuhn("4111111111111112")).toBe(false);
  });
  it("Verhoeff", () => {
    expect(isValidVerhoeff("234567890124")).toBe(true);
    expect(isValidVerhoeff("234567890125")).toBe(false);
  });
});
