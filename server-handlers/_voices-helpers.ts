export type RawCartesiaVoice = { id?: string; name?: string; description?: string; gender?: string; language?: string };
export type VoiceEntry = { id: string; name: string; desc: string; gender: string; language: string };

// Cartesia's API returns "masculine"/"feminine" (confirmed live, 2026-10-04),
// not the "male"/"female" the client filters voices by in tts.ts's
// cartesiaFallback(). Left unnormalized, that string mismatch made
// genderMatches always empty for every gendered request, silently skipping
// Cartesia straight to Azure on every single Sarvam failure in production —
// the entire 2nd-tier fallback never fired despite being wired correctly.
export function normalizeGender(raw: string | undefined): string {
  if (raw === "masculine") return "male";
  if (raw === "feminine") return "female";
  return raw || "unknown";
}

export function normalizeVoices(rawVoices: RawCartesiaVoice[], fallbackLanguage: string): VoiceEntry[] {
  return rawVoices.map((v) => ({
    id: v.id ?? "",
    name: v.name ?? "",
    desc: v.description || "",
    gender: normalizeGender(v.gender),
    language: v.language || fallbackLanguage,
  }));
}
