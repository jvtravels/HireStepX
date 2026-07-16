/* Vercel Edge Function — Sarvam AI TTS Proxy (Primary TTS Provider) */
/* Indian English / Hinglish voices via the Bulbul model.
 *
 * Sarvam's text-to-speech endpoint accepts an array of up to 3 inputs
 * (each ≤500 chars) and returns base64-encoded WAV audio at the
 * requested sample rate. We coalesce into a single audio/wav response
 * for the browser <audio> element by stitching the WAV bodies; when
 * only one input is sent (the common case) we return it verbatim.
 *
 * Falls back to 502 on upstream errors — the client TTS chain then
 * fails over to Cartesia → Azure → browser TTS.
 */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage, redisIncrByWithExpiry, redisGet, redisSetEx, hashStable, getSubscriptionTier } from "./_shared";

/* TTS cost circuit breaker — Sarvam Bulbul is billed per character.
 *
 * Without a cap, a runaway client or a compromised key could rack up
 * thousands of dollars overnight. We INCR a per-user daily counter on
 * every accepted TTS request and reject with 429 once the user crosses
 * the limit. The limit is generous (~10 minutes of speech/day) and
 * applies uniformly while the product is in testing — once tiered
 * pricing ships we'll lift the cap for paid users by reading the tier
 * from the JWT app_metadata.
 *
 * Fails open on Redis outage so a Redis blip doesn't kill the voice
 * pipeline for everyone. */
const TTS_DAILY_CHAR_CAP = 30_000;
const SECONDS_PER_DAY = 86_400;

/* Audio cache — repeated questions ("Tell me about a time…", canned greetings,
 * panelist intros) dominate the prompt distribution. Caching the WAV body
 * keyed by (model, speaker, text) collapses these to a single Sarvam call.
 * 24h TTL keeps Redis tidy; cap the cacheable payload at 1500 chars so we
 * don't blow Upstash memory on multi-paragraph monologues. */
const TTS_CACHE_TTL_SEC = 86_400;
const TTS_CACHE_MAX_BYTES = 256 * 1024; // 256 KB — covers ~10s of 22 kHz WAV
const TTS_CACHE_VERSION = "v1";

/** base64-encode a Uint8Array — Edge-safe (no Buffer). */
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

declare const process: { env: Record<string, string | undefined> };
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const SARVAM_TTS_ENDPOINT = "https://api.sarvam.ai/text-to-speech";

/* Voice cost policy — paid TTS (Sarvam) is a paying-tier benefit by DEFAULT.
 * Free users fail over to the zero-cost browser TTS chain (Cartesia → Azure →
 * Web Speech). This makes the expensive path opt-in instead of opt-out, so a
 * traffic spike on free users can never run up a Sarvam bill.
 *   - VOICE_FREE_TIER=1        → let free users use paid Sarvam TTS too.
 *   - SARVAM_TTS_FREE_DISABLED=1 → legacy hard kill switch (still honoured).
 * Either guard active ⇒ free tier is pushed to the browser fallback. */
const VOICE_FREE_TIER = process.env.VOICE_FREE_TIER === "1";
const SARVAM_TTS_FREE_DISABLED = process.env.SARVAM_TTS_FREE_DISABLED === "1";

/* COST GUARDRAIL — pin to bulbul:v2.
 *
 * DO NOT change this to bulbul:v3 (or any newer tier) without a
 * pricing review. v3 is materially more expensive per character and
 * the v2 audio quality is already production-acceptable for our
 * Indian-English mock-interview use case. If a future Sarvam model
 * ships at v2 price parity, update this constant in one place rather
 * than threading the model string through the request body literal.
 *
 * Sentinel: the request payload below uses `SARVAM_TTS_MODEL` instead
 * of an inline string so a grep for "bulbul:v3" stays clean and PR
 * review catches any drift. */
const SARVAM_TTS_MODEL = "bulbul:v2" as const;

/* Sarvam Bulbul voice roster (en-IN). Names map 1:1 to the API's
 * `speaker` field. Picked from Sarvam's published v2 speaker list. */
const VOICES = {
  female: ["anushka", "manisha", "vidya", "arya"],
  male: ["abhilash", "karun", "hitesh"],
} as const;

function pickSpeaker(gender?: "male" | "female", voiceHint?: string): string {
  // Allow client to pin a specific Sarvam speaker by passing its name in voiceId,
  // but only if the speaker matches the requested gender. A Cartesia UUID passed
  // as voiceHint won't match any Sarvam name and falls through safely.
  if (voiceHint) {
    const lower = voiceHint.toLowerCase();
    if ((VOICES.female as readonly string[]).includes(lower) && gender !== "male") return lower;
    if ((VOICES.male as readonly string[]).includes(lower) && gender !== "female") return lower;
  }
  const pool = VOICES[gender || "female"];
  if (voiceHint) {
    // Deterministic per-voiceHint pick so panel members keep a stable voice
    const hash = voiceHint.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return pool[Math.abs(hash) % pool.length];
  }
  return pool[0];
}

/** Decode base64 string → Uint8Array (Edge-runtime safe — no Buffer). */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 1048576) {
    return new Response(JSON.stringify({ error: "Request too large" }), { status: 413, headers });
  }

  if (!SARVAM_API_KEY) {
    return new Response(JSON.stringify({ error: "Sarvam TTS not configured" }), { status: 503, headers });
  }

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  const ip = getClientIp(req);
  if (await isRateLimited(ip, "sarvam-tts", 30, 60_000)) {
    return rateLimitResponse(headers);
  }

  try {
    const { text, voiceId, gender } = await req.json() as {
      text: string; voiceId?: string; gender?: "male" | "female";
    };

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), { status: 400, headers });
    }

    const trimmedText = text.trim().slice(0, 1500); // 3 chunks × 500 chars max
    if (trimmedText.length === 0) {
      return new Response(JSON.stringify({ error: "Text is empty" }), { status: 400, headers });
    }

    // Paid voice is a paying-tier benefit by default — push free users to the
    // Cartesia → Azure → browser TTS fallback chain (zero cost). We resolve the
    // tier from the profiles table; the client already handles 503 by failing
    // over, so we don't need to surface a special error code. Operators can
    // open paid voice to free users with VOICE_FREE_TIER=1.
    if (!VOICE_FREE_TIER || SARVAM_TTS_FREE_DISABLED) {
      const tier = await getSubscriptionTier(auth.userId!);
      if (tier === "free") {
        logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", requestChars: trimmedText.length, errorMessage: "free_tier_disabled" });
        return new Response(JSON.stringify({ error: "Sarvam TTS unavailable for free tier", code: "tts_free_disabled" }), { status: 503, headers });
      }
    }

    const speakerForCache = pickSpeaker(gender, voiceId);

    // Audio cache — repeat prompts (panelist intros, canned questions) hit
    // here without spending a single Sarvam character. Key is content-addressed
    // so any (model, speaker, text) triple is shareable across users. We skip
    // the cache for very short or empty payloads and re-check the daily char
    // counter even on hits so a user can't bypass the budget via cache abuse.
    const cacheKey = `tts_cache:${TTS_CACHE_VERSION}:${SARVAM_TTS_MODEL}:${speakerForCache}:${await hashStable(trimmedText)}`;
    const cached = trimmedText.length >= 8 ? await redisGet(cacheKey) : null;
    if (cached) {
      const used = await redisIncrByWithExpiry(`tts_chars_today:${auth.userId}:${new Date().toISOString().slice(0, 10)}`, trimmedText.length, SECONDS_PER_DAY);
      if (used !== null && used > TTS_DAILY_CHAR_CAP) {
        logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", requestChars: trimmedText.length, errorMessage: `Daily char cap exceeded (${used}/${TTS_DAILY_CHAR_CAP})` });
        return new Response(JSON.stringify({ error: "Daily voice quota exceeded. Try again tomorrow or continue in text mode.", code: "tts_daily_cap", usedChars: used, capChars: TTS_DAILY_CHAR_CAP }), { status: 429, headers });
      }
      const audioBytes = b64ToBytes(cached);
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "success", latencyMs: 0, requestChars: trimmedText.length, responseBytes: audioBytes.byteLength });
      const audioHeaders: Record<string, string> = {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-TTS-Provider": "sarvam",
        "X-TTS-Cache": "hit",
      };
      const origin = headers["Access-Control-Allow-Origin"];
      if (origin) { audioHeaders["Access-Control-Allow-Origin"] = origin; audioHeaders["Vary"] = "Origin"; }
      const body = new Blob([new Uint8Array(audioBytes)], { type: "audio/wav" });
      return new Response(body, { status: 200, headers: audioHeaders });
    }

    // Cost circuit breaker — count chars before the upstream call so we don't
    // pay for one final blowout request. INCRBY returns the post-increment
    // value; if it would exceed the cap, refund (no, we already incremented)
    // and reject. We over-count by the rejected request's chars, which is
    // fine — the next day's window resets it and the cap is a soft ceiling.
    const dayKey = `tts_chars_today:${auth.userId}:${new Date().toISOString().slice(0, 10)}`;
    const used = await redisIncrByWithExpiry(dayKey, trimmedText.length, SECONDS_PER_DAY);
    if (used !== null && used > TTS_DAILY_CHAR_CAP) {
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", requestChars: trimmedText.length, errorMessage: `Daily char cap exceeded (${used}/${TTS_DAILY_CHAR_CAP})` });
      return new Response(JSON.stringify({
        error: "Daily voice quota exceeded. Try again tomorrow or continue in text mode.",
        code: "tts_daily_cap",
        usedChars: used,
        capChars: TTS_DAILY_CHAR_CAP,
      }), { status: 429, headers });
    }

    const speaker = speakerForCache;

    // Sarvam caps each input at 500 chars — split on sentence/word
    // boundaries so we don't cut mid-word. Max 3 inputs per request.
    const chunks: string[] = [];
    let remaining = trimmedText;
    while (remaining.length > 0 && chunks.length < 3) {
      if (remaining.length <= 500) { chunks.push(remaining); break; }
      // Prefer to split at the last sentence terminator within the window
      const window = remaining.slice(0, 500);
      let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
      if (cut < 200) cut = window.lastIndexOf(" "); // fall back to last space
      if (cut < 1) cut = 500;                       // hard cut if no spaces at all
      chunks.push(remaining.slice(0, cut + 1).trim());
      remaining = remaining.slice(cut + 1);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const t0 = Date.now();

    const res = await fetch(SARVAM_TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: chunks,
        target_language_code: "en-IN",
        speaker,
        pitch: 0,
        pace: 1.0,
        loudness: 1.2,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: SARVAM_TTS_MODEL,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("Sarvam TTS error:", res.status, errText);
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", latencyMs: latency, requestChars: trimmedText.length, errorMessage: `${res.status}: ${errText.slice(0, 200)}` });
      return new Response(JSON.stringify({ error: "TTS generation failed", status: res.status, detail: errText.slice(0, 200) }), { status: 502, headers });
    }

    const json = await res.json() as { audios?: string[] };
    if (!json.audios || !Array.isArray(json.audios) || json.audios.length === 0) {
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", latencyMs: latency, requestChars: trimmedText.length, errorMessage: "Empty audios array" });
      return new Response(JSON.stringify({ error: "Empty audio response" }), { status: 502, headers });
    }

    // Single chunk → return verbatim. Multi-chunk → concat WAV payloads
    // by keeping the first file's RIFF header and appending each subsequent
    // file's PCM data section. Safe because all chunks share sample rate /
    // channel count from the same request.
    let audioBytes: Uint8Array;
    if (json.audios.length === 1) {
      audioBytes = b64ToBytes(json.audios[0]);
    } else {
      const parts = json.audios.map(b64ToBytes);
      // Find 'data' chunk in each WAV and concat PCM payloads
      const findData = (buf: Uint8Array): { offset: number; size: number } => {
        // RIFF header is 12 bytes, then chunks: 4-byte id + 4-byte size + payload
        for (let i = 12; i < buf.length - 8; ) {
          const id = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
          const size = buf[i + 4] | (buf[i + 5] << 8) | (buf[i + 6] << 16) | (buf[i + 7] << 24);
          if (id === "data") return { offset: i + 8, size };
          i += 8 + size;
        }
        return { offset: -1, size: 0 };
      };
      const firstData = findData(parts[0]);
      // Guard: if the first chunk has no 'data' sub-chunk (negative offset),
      // merging would produce a corrupt WAV. Fall back to the raw first part
      // rather than emitting garbage audio. Subsequent chunks are discarded.
      if (firstData.offset < 0) {
        console.error("[sarvam-tts] WAV merge skipped: first chunk has no data sub-chunk — returning parts[0] verbatim");
        audioBytes = parts[0];
      } else {
        const extraPcm: Uint8Array[] = [];
        let extraLen = 0;
        for (let k = 1; k < parts.length; k++) {
          const d = findData(parts[k]);
          if (d.offset < 0) continue;
          const pcm = parts[k].subarray(d.offset, d.offset + d.size);
          extraPcm.push(pcm);
          extraLen += pcm.length;
        }
        // Build merged buffer = first WAV (header + data) + extra PCM
        const merged = new Uint8Array(parts[0].length + extraLen);
        merged.set(parts[0], 0);
        let cursor = parts[0].length;
        for (const pcm of extraPcm) {
          merged.set(pcm, cursor);
          cursor += pcm.length;
        }
        // Patch RIFF size (offset 4, little-endian uint32) and data size
        const newRiffSize = merged.length - 8;
        merged[4] = newRiffSize & 0xff;
        merged[5] = (newRiffSize >> 8) & 0xff;
        merged[6] = (newRiffSize >> 16) & 0xff;
        merged[7] = (newRiffSize >> 24) & 0xff;
        const newDataSize = firstData.size + extraLen;
        const sizeAt = firstData.offset - 4;
        merged[sizeAt] = newDataSize & 0xff;
        merged[sizeAt + 1] = (newDataSize >> 8) & 0xff;
        merged[sizeAt + 2] = (newDataSize >> 16) & 0xff;
        merged[sizeAt + 3] = (newDataSize >> 24) & 0xff;
        audioBytes = merged;
      }
    }

    if (audioBytes.byteLength < 100) {
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", latencyMs: latency, requestChars: trimmedText.length, errorMessage: "Audio bytes too small" });
      return new Response(JSON.stringify({ error: "Empty audio response" }), { status: 502, headers });
    }

    logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "success", latencyMs: latency, requestChars: trimmedText.length, responseBytes: audioBytes.byteLength });

    // Populate audio cache for next time — best-effort, swallow failures.
    // Skip oversized payloads so Redis stays lean.
    if (trimmedText.length >= 8 && audioBytes.byteLength <= TTS_CACHE_MAX_BYTES) {
      void redisSetEx(cacheKey, TTS_CACHE_TTL_SEC, bytesToB64(audioBytes));
    }

    const audioHeaders: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Content-Length": String(audioBytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-TTS-Provider": "sarvam",
      "X-TTS-Cache": "miss",
    };
    const origin = headers["Access-Control-Allow-Origin"];
    if (origin) {
      audioHeaders["Access-Control-Allow-Origin"] = origin;
      audioHeaders["Vary"] = "Origin";
    }

    // Wrap in a Blob so Response always gets a BodyInit-compatible body —
    // direct Uint8Array passing trips TS 5's stricter ArrayBuffer typing
    // (SharedArrayBuffer ambiguity) under the edge runtime lib.
    const body = new Blob([new Uint8Array(audioBytes)], { type: "audio/wav" });
    return new Response(body, { status: 200, headers: audioHeaders });
  } catch (err) {
    console.error("Sarvam TTS proxy error:", err);
    logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", status: "timeout", errorMessage: err instanceof Error ? err.message : "Unknown error" });
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers });
  }
}
