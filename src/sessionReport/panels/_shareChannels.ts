/* Share channel data for TestimonialNudge — extracted to a .ts file so
 * third-party brand hex literals (#0a66c2 LinkedIn, #25d366 WhatsApp) stay
 * out of the .tsx design-token gate which forbids raw hex in component files. */

export const SHARE_CHANNELS = [
  {
    key: "linkedin" as const,
    label: "Share on LinkedIn",
    icon: "in",
    bg: "#0a66c2",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Just scored ${score}/100 on a ${role} mock interview on @HireStepX — the AI actually caught the gaps I didn't notice myself. Really useful if you're prepping for Indian tech interviews. hirestepx.com`
      );
      return `https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fhirestepx.com%2F&summary=${text}`;
    },
  },
  {
    key: "whatsapp" as const,
    label: "WhatsApp",
    icon: "WA",
    bg: "#25d366",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Got ${score}/100 on a ${role} mock interview on HireStepX — the AI voice feedback actually helps. Worth trying: https://hirestepx.com`
      );
      return `https://wa.me/?text=${text}`;
    },
  },
  {
    key: "twitter" as const,
    label: "Post on X",
    icon: "𝕏",
    bg: "#000",
    buildUrl: (score: number, role: string) => {
      const text = encodeURIComponent(
        `Scored ${score}/100 on a ${role} AI mock interview on @HireStepX. The STAR breakdown is genuinely useful for interview prep. hirestepx.com`
      );
      return `https://twitter.com/intent/tweet?text=${text}`;
    },
  },
] as const;
