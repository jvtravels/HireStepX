/* HireStepX — Prosody markup → provider-specific SSML translator
 *
 * The LLM marks emphasis and pauses in aiText with a tiny markup
 * vocabulary. We translate per-provider so each TTS engine renders
 * the prosody natively.
 *
 * Markup vocabulary (intentionally small — easier for the LLM to use
 * consistently and easier to test):
 *
 *   _word_         emphasis (slight stress)
 *   __word__       strong emphasis
 *   [pause]        short pause (~250ms)
 *   [pause:long]   longer pause (~600ms)
 *   [breath]       breath pause + audible inhale
 *
 * Per-provider rendering:
 *
 *   cartesia       Punctuation-driven: emphasis stays plain (Cartesia
 *                  doesn't expose SSML on the realtime endpoint), but
 *                  pauses become ellipsis ("…" or "… …"). Cartesia
 *                  treats ellipsis as a measurable pause.
 *
 *   azure          Full SSML envelope: <prosody>, <break>, <emphasis>.
 *                  Azure expects valid SSML or will reject the request,
 *                  so we wrap and validate.
 *
 *   browser        Strip all markup. Web Speech API has limited
 *                  prosody control via .rate / .pitch on the utterance,
 *                  not inline. Falls back to plain text.
 *
 * Failure mode: if anything goes wrong (malformed markup, regex panic,
 * unknown provider), we return the input with markup stripped — never
 * a half-formed SSML string. The fallback is always sayable.
 *
 * See src/__tests__/prosody.test.ts.
 */

export type TTSProvider = "cartesia" | "azure" | "browser";

/**
 * Strip ALL prosody markup, returning plain text suitable for any provider.
 * Used as the safety fallback when SSML rendering fails for any reason.
 */
export function stripProsodyMarkup(text: string): string {
  if (!text) return text;
  return text
    .replace(/__([^_\n]+)__/g, "$1")              // strong emphasis (underscore)
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")     // emphasis (underscore)
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")          // strong emphasis (asterisk)
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1") // emphasis (asterisk)
    .replace(/\[pause:long\]/gi, ", ")            // long pause → comma + space
    .replace(/\[pause:short\]/gi, " ")            // short pause variant
    .replace(/\[pause\]/gi, " ")                  // short pause → whitespace
    .replace(/\[breath\]/gi, " ")                 // breath → whitespace
    .replace(/\[emotion:[^\]]*\]/gi, " ")         // any emotion directive
    // Catch-all for stage directions the LLM invents beyond the known
    // pause/breath/emotion vocabulary ([smile], [warmly], [clears throat],
    // [laughs]). Drift past the prescribed set is observed live, so strip
    // any bracketed token that is letters/spaces/'/- (optionally :modifier).
    // Tokens containing digits or symbols ([L5], [0], [v2]) are left intact.
    .replace(/\[[a-z][a-z' -]{0,24}(?::[a-z]+)?\]/gi, " ")
    .replace(/\*+/g, "")                          // any stray asterisks
    .replace(/\s+([,.!?;:])/g, "$1")              // tidy punctuation spacing
    .replace(/\s{2,}/g, " ")                      // collapse double-spaces
    .trim();
}

/**
 * Render markup for Cartesia's real-time WS endpoint. Cartesia respects
 * punctuation as prosody — `…` is a longer pause than `,` than ` `.
 * We translate emphasis to nothing (no inline emphasis support) and
 * pauses to ellipsis variants.
 */
export function renderForCartesia(text: string): string {
  if (!text) return text;
  try {
    return text
      .replace(/__([^_\n]+)__/g, "$1")           // strong → drop emphasis (no inline support)
      .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")  // emphasis → drop
      .replace(/\[pause:long\]/gi, "… … ")       // long pause → double ellipsis
      .replace(/\[pause\]/gi, "… ")              // short pause → ellipsis
      .replace(/\[breath\]/gi, "… ")             // breath → ellipsis (closest analogue)
      .replace(/\s{2,}/g, " ")
      .trim();
  } catch {
    return stripProsodyMarkup(text);
  }
}

/**
 * Render markup as SSML for Azure TTS. Wraps the result in a <speak>
 * envelope. Validates that no special chars escape into attribute
 * values (defense against prompt injection through aiText).
 */
export function renderForAzure(text: string, voiceName?: string): string {
  if (!text) return text;
  try {
    // 1. Escape any literal &, <, > so they don't break the SSML.
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 2. Translate markup → SSML tags. Order matters (longest match first).
    let ssml = text
      .replace(/__([^_\n]+)__/g, (_, w) => `<emphasis level="strong">${escape(w)}</emphasis>`)
      .replace(/(?<!_)_([^_\n]+)_(?!_)/g, (_, w) => `<emphasis level="moderate">${escape(w)}</emphasis>`)
      .replace(/\[pause:long\]/gi, '<break time="600ms"/>')
      .replace(/\[pause\]/gi, '<break time="250ms"/>')
      .replace(/\[breath\]/gi, '<break strength="medium"/>');

    // 3. Anything that wasn't markup needs &-escaping for the SSML body.
    //    Split ONLY on the tags we ourselves emitted (emphasis, break) —
    //    not on any HTML-looking sequence in the input, which would let
    //    user-supplied "<fast>" pass through unescaped. The split keeps
    //    our tag pieces intact while letting us escape everything else.
    const ourTagRe = /(<emphasis level="(?:strong|moderate)">[^<]*<\/emphasis>|<break(?:\s+(?:time|strength)="[^"]+")\s*\/>)/g;
    ssml = ssml.split(ourTagRe).map((piece, i) => {
      if (i % 2 === 1) return piece; // our tags pass through
      // The piece's body might already contain &amp; from step 1's first
      // pass — preserve those by escaping only literal & < > that aren't
      // already part of an entity.
      return piece
        .replace(/&(?!(?:amp|lt|gt|apos|quot);)/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }).join("");

    // 4. Wrap in the SSML envelope. Voice name is optional — Azure will
    //    use the default voice if omitted, or apply a specific neural one.
    const voiceTag = voiceName
      ? `<voice name="${escape(voiceName)}">${ssml}</voice>`
      : ssml;
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">${voiceTag}</speak>`;
  } catch {
    // Anything goes wrong → return plain text wrapped in minimal SSML
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN">${stripProsodyMarkup(text)}</speak>`;
  }
}

/**
 * Top-level dispatcher. Returns the rendered string ready for the
 * provider's `text` (Cartesia) or `ssml` (Azure) input field.
 */
export function renderProsody(text: string, provider: TTSProvider, voiceName?: string): string {
  switch (provider) {
    case "cartesia": return renderForCartesia(text);
    case "azure":    return renderForAzure(text, voiceName);
    case "browser":  return stripProsodyMarkup(text);
    default:         return stripProsodyMarkup(text);
  }
}
