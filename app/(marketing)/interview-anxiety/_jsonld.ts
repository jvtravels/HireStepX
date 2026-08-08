import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Pure JSON-LD builder shared by the page (renders it) and
 * scripts/generate-jsonld-csp-hashes.mts (hashes it for the CSP header).
 * Keeping this logic in one place guarantees the hash always matches what
 * the page actually renders — duplicating it in the generator would drift. */

export function buildInterviewAnxietyJsonLd(): { __html: string }[] {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Why do I get so nervous before interviews?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Interview anxiety is your nervous system responding to three things at once: an unfamiliar format, high perceived stakes, and genuine uncertainty about what's coming next. It is a normal physiological response, not a sign you are unprepared or unsuited for the role. The uncertainty component is the one most within your control: it drops sharply with repeated, realistic practice.",
        },
      },
      {
        "@type": "Question",
        name: "How can I calm my nerves right before an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Slow, deliberate breathing (4 seconds in, hold 2, 6 seconds out) for a minute beforehand lowers heart rate directly. Having your opening 'tell me about yourself' answer fully rehearsed removes the hardest, most improvised moment of the interview. Arriving 10 minutes early rather than rushing in also measurably reduces pre-interview cortisol.",
        },
      },
      {
        "@type": "Question",
        name: "Does mock interview practice actually reduce anxiety?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes: anxiety driven by uncertainty fades with exposure. Practicing out loud against realistic, unpredictable questions repeatedly is what actually lowers the uncertainty component of interview anxiety, unlike silently reviewing notes. AI mock interviews let you get that repetition, including live follow-up questions, without scheduling a person each time, at 2am the night before if needed.",
        },
      },
      {
        "@type": "Question",
        name: "Is it normal to blank out during an interview?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, and it happens most often on questions you haven't said out loud before. It's rarely about not knowing the answer; it's the gap between having an idea and having rehearsed saying it under pressure. Practicing your key stories out loud in advance, several times, closes that gap.",
        },
      },
      {
        "@type": "Question",
        name: "How many mock interviews should I do before a real one?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "There's no fixed number, but the anxiety-reduction effect compounds with repetition: most candidates notice a real drop in nervousness by their third or fourth full practice session, particularly once they've been asked unexpected follow-up questions and recovered from them at least once.",
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Overcome Interview Anxiety",
    description:
      "Why interview anxiety happens, techniques that reduce it, and how repeated practice builds real confidence before the interview that counts.",
    image: "https://hirestepx.com/opengraph-image",
    url: "https://hirestepx.com/interview-anxiety",
    publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
    author: { "@type": "Organization", name: "HireStepX" },
    datePublished: "2026-07-31",
    dateModified: "2026-08-05",
  };

  return [
    ldJson(faqSchema),
    ldJson(articleSchema),
    ldJson(breadcrumb([{ name: "Interview Anxiety", path: "/interview-anxiety" }])),
  ];
}
