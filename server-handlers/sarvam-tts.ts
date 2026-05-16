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

import { handleCorsPreflightOrMethod, corsHeaders, isRateLimited, getClientIp, rateLimitResponse, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId, logServiceUsage } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || "";
const SARVAM_TTS_ENDPOINT = "https://api.sarvam.ai/text-to-speech";

/* Sarvam Bulbul voice roster (en-IN). Names map 1:1 to the API's
 * `speaker` field. Picked from Sarvam's published v2 speaker list. */
const VOICES = {
  female: ["anushka", "manisha", "vidya", "arya"],
  male: ["abhilash", "karun", "hitesh"],
} as const;

function pickSpeaker(gender?: "male" | "female", voiceHint?: string): string {
  // Allow client to pin a specific Sarvam speaker by passing its name in voiceId
  if (voiceHint) {
    const lower = voiceHint.toLowerCase();
    if ((VOICES.female as readonly string[]).includes(lower)) return lower;
    if ((VOICES.male as readonly string[]).includes(lower)) return lower;
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

    const speaker = pickSpeaker(gender, voiceId);

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
        model: "bulbul:v2",
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
      if (firstData.offset > 0) {
        const newDataSize = firstData.size + extraLen;
        const sizeAt = firstData.offset - 4;
        merged[sizeAt] = newDataSize & 0xff;
        merged[sizeAt + 1] = (newDataSize >> 8) & 0xff;
        merged[sizeAt + 2] = (newDataSize >> 16) & 0xff;
        merged[sizeAt + 3] = (newDataSize >> 24) & 0xff;
      }
      audioBytes = merged;
    }

    if (audioBytes.byteLength < 100) {
      logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "error", latencyMs: latency, requestChars: trimmedText.length, errorMessage: "Audio bytes too small" });
      return new Response(JSON.stringify({ error: "Empty audio response" }), { status: 502, headers });
    }

    logServiceUsage({ service: "sarvam_tts", endpoint: "text-to-speech", userId: auth.userId, status: "success", latencyMs: latency, requestChars: trimmedText.length, responseBytes: audioBytes.byteLength });

    const audioHeaders: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Content-Length": String(audioBytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-TTS-Provider": "sarvam",
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
