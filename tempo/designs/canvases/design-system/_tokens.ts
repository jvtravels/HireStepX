/* HireStepX — Design System / Shared Tokens
   Single source of truth. Every storyboard imports from here.
   Token changes propagate to all 16 storyboards via this one file. */

export const tokens = {
  // Surface
  cream: "#FAF7F0",
  white: "#FFFFFF",
  creamSoft: "#F4EFE3",

  // Ink
  coal: "#0E0C08",
  indigoGray: "#3E3A6E",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",

  // Brand — interactive
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  indigoRing: "rgba(49, 46, 129, 0.20)",

  // Brand — editorial
  copper: "#B45309",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  copper100: "#F4E5D8",

  // Status
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",

  // Lines
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
} as const;

export const fonts = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const shadows = {
  card:
    "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  cta:
    "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
  modal:
    "0 2px 4px rgba(20,17,10,.06), 0 32px 64px -16px rgba(20,17,10,.24)",
} as const;
