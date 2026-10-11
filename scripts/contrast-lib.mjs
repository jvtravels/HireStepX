/* Pure colour/contrast maths shared by scripts/check-contrast.mjs and
   src/__tests__/designTokensContrast.test.ts. Understands the subset of CSS
   colour syntax used in src/auth/_tokens.ts: #rgb(a), rgb()/rgba(), oklch().
   Alpha colours are composited over a backdrop before measuring. */

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function oklchToLinearSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const toSrgb = (c) => {
  const v = clamp01(c);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Returns { rgb: [0-255 x3] (gamut-clipped sRGB), a: 0-1 }. */
export function parseColor(input) {
  const s = input.trim();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(s))) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    const n = (i) => parseInt(hex.slice(i, i + 2), 16);
    return { rgb: [n(0), n(2), n(4)], a: hex.length === 8 ? n(6) / 255 : 1 };
  }
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(s))) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p[3] ?? 1 };
  }
  if ((m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(s))) {
    const lin = oklchToLinearSrgb(+m[1], +m[2], +m[3]);
    return { rgb: lin.map((c) => Math.round(toSrgb(c) * 255)), a: m[4] === undefined ? 1 : +m[4] };
  }
  throw new Error(`Unsupported colour: ${input}`);
}

export function composite(fg, bg) {
  const f = parseColor(fg);
  if (f.a >= 1) return f.rgb;
  const b = parseColor(bg);
  return f.rgb.map((c, i) => Math.round(c * f.a + b.rgb[i] * (1 - f.a)));
}

export function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => toLinear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of fg over bg (fg alpha composited onto bg). */
export function contrast(fg, bg) {
  const bgRgb = parseColor(bg).rgb;
  const l1 = luminance(composite(fg, bg));
  const l2 = luminance(bgRgb);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Parse `key: "value"` pairs out of the `tokens` object in src/auth/_tokens.ts. */
export function parseTokens(source) {
  const body = /export const tokens = \{([\s\S]*?)\n\} as const;/.exec(source)?.[1] ?? "";
  const out = {};
  for (const m of body.matchAll(/^\s*(\w+):\s*"([^"]+)"/gm)) out[m[1]] = m[2];
  return out;
}

/* Surfaces that are not tokens (shadcn --muted in index.css). */
export const EXTRA_SURFACES = { muted: "oklch(0.963 0.002 197.1)" };

const LIGHT = ["white", "creamSoft", "creamRaised", "pageBg", "muted"];

/** [foreground token, background token, minimum ratio, why]. Only pairs the
 *  app actually renders are listed; 4.5 = WCAG 1.4.3 text, 3 = 1.4.11 UI. */
export const CONTRAST_PAIRS = [
  ...LIGHT.map((bg) => ["inkSoft", bg, 4.5, "body/secondary text"]),
  ...LIGHT.map((bg) => ["inkFaint", bg, 4.5, "tertiary text"]),
  ["inkSoft", "copper100", 4.5, "text on copper chips"],
  ["inkFaintWeak", "white", 3, "decorative icons/dots (UI 3:1)"],
  ["inkFaintWeak", "creamSoft", 3, "decorative icons/dots (UI 3:1)"],
  ["indigoGray", "white", 4.5, "headings"],
  ["indigo", "white", 4.5, "links/buttons"],
  ["indigo", "creamSoft", 4.5, "links on cream"],
  ["indigo", "indigo100", 4.5, "selected chips"],
  ["white", "indigo", 4.5, "primary button label"],
  ["copper", "white", 4.5, "score text"],
  ["copper", "creamSoft", 4.5, "score text on cream"],
  ["copper", "pageBg", 4.5, "score text on app shell"],
  ["copper", "copper100", 4.5, "12px copper chips"],
  ["copper", "warning100", 4.5, "copper on amber chips"],
  ["copperDark", "copper100", 4.5, "chip text"],
  ["warning", "white", 4.5, "warning text"],
  ["warning", "creamSoft", 4.5, "warning text on cream"],
  ["warning", "warning100", 4.5, "warning chips"],
  ["warningInk", "warning100", 4.5, "warning chips (ink)"],
  ["successInk", "success100", 4.5, "success chips"],
  ["success", "white", 4.5, "success text"],
  ["errorInk", "error100", 4.5, "error chips"],
  ["error", "white", 4.5, "error text"],
  ["levelBeginner", "white", 4.5, "blog level badge"],
  ["levelIntermediate", "white", 4.5, "blog level badge"],
  ["levelAdvanced", "white", 4.5, "blog level badge"],
  ["cream", "coal", 4.5, "text on dark"],
  ["creamMuted", "coal", 4.5, "secondary text on dark (e.g. 'No credit card required')"],
  ["creamFaded", "coal", 4.5, "tertiary text on dark"],
  ["copperOnDark", "coal", 4.5, "eyebrow / score text on dark"],
  ["copperOnDark", "indigoDeep", 4.5, "eyebrow on dark indigo"],
  ["copper", "white", 3, "focus ring vs page (WCAG 2.4.11/1.4.11)"],
];

/** Evaluates CONTRAST_PAIRS against the token map. */
export function evaluatePairs(tokens, pairs = CONTRAST_PAIRS) {
  const val = (k) => tokens[k] ?? EXTRA_SURFACES[k];
  return pairs.map(([fg, bg, min, why]) => {
    if (!val(fg) || !val(bg)) throw new Error(`Unknown token in pair ${fg} / ${bg}`);
    const ratio = contrast(val(fg), val(bg));
    return { fg, bg, min, why, ratio, pass: ratio >= min };
  });
}
