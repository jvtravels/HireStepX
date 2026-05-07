/* ─── Text-to-Speech Service ─── */
/* Primary: Azure TTS (Indian English neural voices) via /api/azure-tts proxy
   Fallback: Cartesia TTS via WebSocket + /api/tts REST proxy
   Last resort: Browser Web Speech API */

import { safeUUID } from "./utils";

/* Module-level Window augmentation — exposes the Cartesia AudioContext so
 * useMobileAudioResilience in Interview.tsx can resume it after iOS Safari
 * suspends the page. Was previously read/written via `as unknown as` casts;
 * a typed global removes the cast and gets IDE autocomplete + safety. */
declare global {
  interface Window {
    __hirestepxAudioCtx?: AudioContext;
  }
}

/* Unlock audio playback — call this on a user gesture (button click)
   before navigating to pages that auto-play audio. This creates a
   silent AudioContext that satisfies the browser's autoplay policy. */
let _audioUnlocked = false;
/** Track if autoplay is blocked — once detected, skip all TTS providers immediately */
let _autoplayBlocked = false;
export function isAutoplayBlocked(): boolean { return _autoplayBlocked; }

export function unlockAudio() {
  if (_audioUnlocked) return;
  try {
    const ctx = new AudioContext();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    // Also play a silent HTML5 audio to unlock that pathway
    const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    audio.volume = 0;
    audio.play().then(() => {
      _autoplayBlocked = false;
    }).catch(() => {});
    _audioUnlocked = true;
    _autoplayBlocked = false;
  } catch { /* expected: audio unlock may fail before user gesture */ }
}

/** Call on any user click/tap inside the interview page to retry unlocking audio */
export function retryUnlockAudio() {
  _audioUnlocked = false;
  _autoplayBlocked = false;
  unlockAudio();
}

/** Reset the autoplay-blocked flag without recreating the AudioContext.
 *  Used when the tab returns to foreground — gives the next TTS attempt a
 *  fresh shot before we declare playback dead and show the recovery overlay. */
export function clearAutoplayBlock() {
  _autoplayBlocked = false;
}

/** Check if a play() error is an autoplay policy block */
function isAutoplayError(err: unknown): boolean {
  if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) return true;
  if (err instanceof Error && /not.allowed|interact.*document|autoplay/i.test(err.message)) return true;
  return false;
}

const TTS_SETTINGS_KEY = "hirestepx_tts";

export interface TTSSettings {
  provider: "azure" | "cartesia" | "browser";
  voiceId: string;
  voiceName: string;
  language?: string;
}

export interface CartesiaVoice {
  id: string;
  name: string;
  desc: string;
  gender: string;
}

/* Default voice — confirmed working Cartesia voice */
const DEFAULT_VOICE_ID = "e07c00bc-4134-4eae-9ea4-1a55fb45746b";

/* Fallback voice list (used until dynamic fetch completes) */
export const CARTESIA_VOICES: CartesiaVoice[] = [
  { id: DEFAULT_VOICE_ID, name: "Default", desc: "Professional, clear voice", gender: "female" },
];

/* Dynamically loaded voices from /api/voices */
const _voiceCache: Record<string, CartesiaVoice[]> = {};
const _fetchPromises: Record<string, Promise<CartesiaVoice[]>> = {};

export function fetchCartesiaVoices(language = "en_IN"): Promise<CartesiaVoice[]> {
  if (_voiceCache[language]) return Promise.resolve(_voiceCache[language]);
  if (language in _fetchPromises) return _fetchPromises[language];

  _fetchPromises[language] = fetch(`/api/voices?language=${encodeURIComponent(language)}`)
    .then(res => res.ok ? res.json() : [])
    .then((voices: CartesiaVoice[]) => {
      if (voices.length > 0) _voiceCache[language] = voices;
      return _voiceCache[language] || CARTESIA_VOICES;
    })
    .catch(() => CARTESIA_VOICES);

  return _fetchPromises[language];
}

export function getCachedVoices(language = "en_IN"): CartesiaVoice[] {
  return _voiceCache[language] || CARTESIA_VOICES;
}

const DEFAULT_SETTINGS: TTSSettings = {
  provider: "azure",
  voiceId: "en-IN-NeerjaNeural",
  voiceName: "Neerja (Indian English)",
  language: "en_IN",
};

export function loadTTSSettings(): TTSSettings {
  try {
    const raw = localStorage.getItem(TTS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old providers to Azure
      if (parsed.provider === "elevenlabs" || parsed.provider === "google" || parsed.provider === "cartesia") {
        parsed.provider = "azure";
        parsed.voiceId = DEFAULT_SETTINGS.voiceId;
        parsed.voiceName = DEFAULT_SETTINGS.voiceName;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch { /* expected: localStorage/JSON.parse may fail */ }
  return DEFAULT_SETTINGS;
}

export function saveTTSSettings(settings: TTSSettings) {
  try {
    localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* expected: localStorage may be unavailable */ }
}

/** Set TTS language for the current session */
export function setTTSLanguage(lang: string) {
  const settings = loadTTSSettings();
  settings.language = lang;
  saveTTSSettings(settings);
}

/* ─── Cartesia API Key Cache ─── */
let _cachedApiKey: string | null = null;
let _apiKeyExpiry = 0;
const API_KEY_TTL = 5 * 60 * 1000; // 5 min

let _refreshPromise: Promise<string | null> | null = null;

async function getCartesiaApiKey(): Promise<string | null> {
  // Refresh at 80% TTL to avoid mid-session expiry
  const refreshAt = _apiKeyExpiry - API_KEY_TTL * 0.2;
  if (_cachedApiKey && refreshAt > 0 && Date.now() < refreshAt) return _cachedApiKey;
  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const { authHeaders } = await import("./supabase");
      const headers = await authHeaders();
      const res = await fetch("/api/tts-token", { method: "POST", headers });
      if (!res.ok) return null;
      const data = await res.json();
      _cachedApiKey = data.apiKey || null;
      _apiKeyExpiry = Date.now() + API_KEY_TTL;
      return _cachedApiKey;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

/* ─── TTS Audio Pre-fetch Cache (LRU, max 10, 5-min TTL) ─── */
const PREFETCH_MAX = 10;
const PREFETCH_TTL = 5 * 60 * 1000; // 5 minutes
const _prefetchCache = new Map<string, { promise: Promise<Blob | null>; createdAt: number }>();

/** Clear the entire prefetch cache — call on memory pressure or page cleanup */
export function clearPrefetchCache(): void {
  _prefetchCache.clear();
}

/* Pre-fetch TTS audio for a text so it's ready when needed.
   Pass gender so the correct voice (male/female) is cached. */
export async function prefetchTTS(text: string, gender?: "male" | "female"): Promise<void> {
  if (!text) return;
  // Sanitize first so prefetch keys collide on equivalent text — caller
  // and speak() both apply the same transform.
  text = sanitizeForTTS(text);
  if (!text) return;
  // Cache key includes gender so male/female prefetches don't clash
  const cacheKey = gender ? `${gender}::${text}` : text;
  const existing = _prefetchCache.get(cacheKey);
  if (existing && Date.now() - existing.createdAt < PREFETCH_TTL) return;
  const settings = loadTTSSettings();
  if (settings.provider === "browser") return;

  // Evict expired entries first
  for (const [key, entry] of _prefetchCache) {
    if (Date.now() - entry.createdAt >= PREFETCH_TTL) _prefetchCache.delete(key);
  }
  // LRU eviction: remove the oldest entry (first inserted in Map iteration order)
  while (_prefetchCache.size >= PREFETCH_MAX) {
    const oldest = _prefetchCache.keys().next().value;
    if (oldest !== undefined) _prefetchCache.delete(oldest);
    else break;
  }

  const promise = (async (): Promise<Blob | null> => {
    try {
      const { authHeaders } = await import("./supabase");
      const headers = await authHeaders();
      // Use Azure TTS endpoint (primary) for prefetch
      const endpoint = settings.provider === "azure" ? "/api/azure-tts" : "/api/tts";
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voiceId: settings.voiceId, ...(gender ? { gender } : {}) }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      // Validate non-empty audio
      if (!blob || blob.size < 100) return null;
      return blob;
    } catch {
      return null;
    }
  })();

  _prefetchCache.set(cacheKey, { promise, createdAt: Date.now() });
}

function consumePrefetch(text: string, gender?: "male" | "female"): Promise<Blob | null> | undefined {
  const cacheKey = gender ? `${gender}::${text}` : text;
  const entry = _prefetchCache.get(cacheKey);
  if (!entry) {
    // Fall back to non-gendered key (e.g. prefetched from SessionSetup without gender)
    // Only consume (delete) the fallback if no gender was requested — otherwise just read it
    // so other panel members can still use the non-gendered entry
    const fallback = _prefetchCache.get(text);
    if (!fallback) return undefined;
    if (Date.now() - fallback.createdAt >= PREFETCH_TTL) { _prefetchCache.delete(text); return undefined; }
    if (!gender) _prefetchCache.delete(text); // Only delete if non-gendered request
    return fallback.promise;
  }
  _prefetchCache.delete(cacheKey);
  if (Date.now() - entry.createdAt >= PREFETCH_TTL) return undefined; // expired
  return entry.promise;
}

/* ─── WebSocket Streaming TTS (persistent connection) ─── */
const CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket";
const WS_SAMPLE_RATE = 24000;
const WS_IDLE_TIMEOUT = 30_000; // close idle connection after 30s

// Persistent WebSocket pool — reuse across questions
let _persistentWs: WebSocket | null = null;
let _persistentWsApiKey: string | null = null;
let _wsIdleTimer: ReturnType<typeof setTimeout> | null = null;
let _wsMessageHandler: ((event: MessageEvent) => void) | null = null;

// Utterance queue — prevents concurrent WebSocket messages from interleaving
let _utteranceQueue: Promise<void> = Promise.resolve();

function resetWsIdleTimer() {
  if (_wsIdleTimer) clearTimeout(_wsIdleTimer);
  _wsIdleTimer = setTimeout(() => {
    if (_persistentWs && _persistentWs.readyState === WebSocket.OPEN) {
      _persistentWs.close();
    }
    _persistentWs = null;
  }, WS_IDLE_TIMEOUT);
}

async function getOrCreateWs(apiKey: string): Promise<WebSocket | null> {
  // Reuse if open and same key
  if (_persistentWs && _persistentWs.readyState === WebSocket.OPEN && _persistentWsApiKey === apiKey) {
    resetWsIdleTimer();
    return _persistentWs;
  }
  // Close stale or dead connection (CLOSED / CLOSING / mismatched key)
  if (_persistentWs) {
    if (_persistentWs.readyState === WebSocket.CLOSED || _persistentWs.readyState === WebSocket.CLOSING) {
      console.warn("[TTS-WS] detected CLOSED/CLOSING socket, creating fresh connection");
    }
    try { _persistentWs.close(); } catch { /* expected: WebSocket may already be closed */ }
    _persistentWs = null;
    _persistentWsApiKey = null;
  }

  return new Promise((resolve) => {
    const wsUrl = `${CARTESIA_WS_URL}?api_key=${apiKey}&cartesia_version=2026-03-01`;
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        resolve(null);
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      _persistentWs = ws;
      _persistentWsApiKey = apiKey;
      resetWsIdleTimer();
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
    ws.onclose = () => {
      if (_persistentWs === ws) {
        _persistentWs = null;
          }
    };
  });
}

async function speakWithWebSocket(
  text: string,
  voiceId: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  // Serialize utterances to prevent WebSocket message interleaving
  let resolveQueue: () => void;
  const prevQueue = _utteranceQueue;
  _utteranceQueue = new Promise(r => { resolveQueue = r; });
  await prevQueue;
  const markDone = () => resolveQueue!();
  const wrappedOnEnd = () => { markDone(); onEnd(); };
  const wrappedOnError = () => { markDone(); onError(); };
  return _speakWithWebSocketInner(text, voiceId, wrappedOnEnd, wrappedOnError, markDone, false, gender, onDurationKnown);
}

async function _speakWithWebSocketInner(
  text: string,
  voiceId: string,
  onEnd: () => void,
  onError: () => void,
  markDone: () => void,
  isRetry: boolean,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  let settled = false;
  let cancelled = false;
  const settle = (cb: () => void) => { if (!settled && !cancelled) { settled = true; cb(); } };
  let audioCtx: AudioContext | null = null;
  const closeCtx = () => { try { audioCtx?.close(); } catch { /* expected: AudioContext cleanup errors are non-critical */ } audioCtx = null; };

  let nextStartTime = 0;
  let chunksReceived = 0;
  let allChunksReceived = false;
  let chunksPlayed = 0;
  let totalChunksScheduled = 0;
  let totalPcmBytes = 0;
  let durationReported = false;

  const checkPlaybackComplete = () => {
    if (allChunksReceived && chunksPlayed >= totalChunksScheduled) {
      resetWsIdleTimer();
      settle(onEnd);
    }
  };

  try {
    const apiKey = await getCartesiaApiKey();
    if (!apiKey) {
      console.warn("[TTS-WS] no API key, falling back to REST");
      return speakWithProxy(text, voiceId, onEnd, onError, gender);
    }

    let ws = await getOrCreateWs(apiKey);
    if ((!ws || ws.readyState !== WebSocket.OPEN) && !isRetry) {
      // First attempt failed — try one more time with a fresh connection
      console.warn("[TTS-WS] connection failed, attempting one reconnect");
      _persistentWs = null;
      _persistentWsApiKey = null;
      ws = await getOrCreateWs(apiKey);
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[TTS-WS] connection failed after retry, falling back to REST");
      return speakWithProxy(text, voiceId, onEnd, onError, gender);
    }

    audioCtx = new AudioContext({ sampleRate: WS_SAMPLE_RATE });
    nextStartTime = audioCtx.currentTime;
    // Expose on window so Interview.tsx's useMobileAudioResilience hook can
    // resume it after backgrounding / rotation on iOS Safari, which otherwise
    // suspends it silently and breaks mid-interview TTS.
    try { window.__hirestepxAudioCtx = audioCtx; } catch { /* SSR / restricted */ }
    const capturedCtx = audioCtx;
    const contextId = safeUUID();

    // Timeout: if no data in 10s, fall back
    const wsTimeout = setTimeout(() => {
      if (chunksReceived === 0 && !cancelled) {
        console.warn("[TTS-WS] timeout — no data received, falling back to REST");
        closeCtx();
        settle(() => {});
        speakWithProxy(text, voiceId, onEnd, onError, gender, onDurationKnown);
      }
    }, 10000);

    // Set message handler for this utterance
    const handler = (event: MessageEvent) => {
      if (cancelled) return;
      clearTimeout(wsTimeout);

      try {
        const msg = JSON.parse(event.data);

        // Drop chunks belonging to a previous utterance — when speak() is called
        // back-to-back rapidly, in-flight chunks from the prior context can leak
        // into the new handler and play garbled audio.
        if (msg.context_id && msg.context_id !== contextId) return;

        if (msg.type === "chunk" && msg.data) {
          chunksReceived++;
          const binaryStr = atob(msg.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const float32 = new Float32Array(bytes.buffer);
          totalPcmBytes += bytes.length;

          // Emit a coarse estimate now so consumers (avatar mouth animation)
          // have a duration during playback. The accurate value supersedes
          // it at "done" — consumers must accept the later update.
          if (!durationReported && onDurationKnown) {
            const estimatedTotalMs = (text.split(/\s+/).length / 150) * 60 * 1000;
            onDurationKnown(Math.max(2000, estimatedTotalMs));
            durationReported = true;
          }

          const buffer = capturedCtx.createBuffer(1, float32.length, WS_SAMPLE_RATE);
          buffer.getChannelData(0).set(float32);

          const source = capturedCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(capturedCtx.destination);

          const scheduleTime = Math.max(capturedCtx.currentTime, nextStartTime);
          source.start(scheduleTime);
          nextStartTime = scheduleTime + buffer.duration;
          totalChunksScheduled++;

          source.onended = () => {
            chunksPlayed++;
            checkPlaybackComplete();
          };

          if (chunksReceived === 1) {
            /* first chunk received — playback starts automatically */
          }
        } else if (msg.type === "done" || msg.done) {
          allChunksReceived = true;
          // Report accurate duration from total PCM bytes: bytes / (sampleRate * 4 bytes per float32)
          if (onDurationKnown && totalPcmBytes > 0) {
            const accurateMs = (totalPcmBytes / (WS_SAMPLE_RATE * 4)) * 1000;
            onDurationKnown(accurateMs);
          }
          // Don't close WS — reuse for next question
          if (totalChunksScheduled === 0) settle(onEnd);
          else checkPlaybackComplete();
        } else if (msg.type === "error") {
          console.warn("[TTS-WS] server error:", msg);
          clearTimeout(wsTimeout);
          closeCtx();
          settle(() => {});
          speakWithProxy(text, voiceId, onEnd, onError, gender, onDurationKnown);
        }
      } catch (e) {
        console.warn("[TTS-WS] message parse error:", e);
      }
    };

    // Replace previous handler
    if (_wsMessageHandler) ws.removeEventListener("message", _wsMessageHandler);
    ws.addEventListener("message", handler);
    _wsMessageHandler = handler;

    // Handle connection loss mid-utterance (including partial playback)
    const closeHandler = () => {
      clearTimeout(wsTimeout);
      if (cancelled) return;
      if (!allChunksReceived) {
        if (chunksReceived === 0 && !isRetry) {
          // No chunks received — attempt ONE reconnect before falling back to REST
          console.warn("[TTS-WS] closed before any chunks, attempting reconnect (1 retry)");
          closeCtx();
          // Force-clear the dead socket so getOrCreateWs creates a fresh one
          _persistentWs = null;
          _speakWithWebSocketInner(text, voiceId, onEnd, onError, markDone, true, gender, onDurationKnown)
            .then((retryHandle) => {
              // Propagate the new cancel handle up to _activeCancel
              _activeCancel = retryHandle.cancel;
            });
        } else if (chunksReceived === 0 && isRetry) {
          // Already retried once — fall back to REST
          console.warn("[TTS-WS] reconnect also failed, falling back to REST");
          closeCtx();
          speakWithProxy(text, voiceId, onEnd, onError, gender, onDurationKnown);
        } else {
          // Partial playback — some chunks received but connection dropped.
          // Mark as done so remaining queued chunks play out, then onEnd fires.
          console.warn(`[TTS-WS] closed after ${chunksReceived} chunks (partial), completing playback`);
          allChunksReceived = true;
          checkPlaybackComplete();
        }
      }
    };
    ws.addEventListener("close", closeHandler, { once: true });

    // Send the utterance
    ws.send(JSON.stringify({
      context_id: contextId,
      model_id: "sonic-3",
      transcript: text.trim().slice(0, 2000),
      voice: { mode: "id", id: voiceId },
      language: loadTTSSettings().language || "en_IN",
      output_format: {
        container: "raw",
        encoding: "pcm_f32le",
        sample_rate: WS_SAMPLE_RATE,
      },
      add_timestamps: false,
    }));

  } catch (err: unknown) {
    console.warn("[TTS-WS] setup error:", err instanceof Error ? err.message : err);
    closeCtx();
    return speakWithProxy(text, voiceId, onEnd, onError, gender, onDurationKnown);
  }

  const capturedCtx = audioCtx;
  return {
    cancel: () => {
      if (cancelled) return; // Prevent double-cancel race
      cancelled = true;
      settled = true;
      markDone(); // Release utterance queue so next utterance can proceed
      // Detach message handler to prevent stale callbacks
      if (_wsMessageHandler && _persistentWs) {
        _persistentWs.removeEventListener("message", _wsMessageHandler);
        _wsMessageHandler = null;
      }
      // Don't close the WS — just stop the audio
      try { capturedCtx?.close(); } catch { /* expected: AudioContext cleanup errors are non-critical */ }
      resetWsIdleTimer();
    },
  };
}

/* ─── Cartesia TTS via REST Server Proxy (fallback) ─── */
async function speakWithProxy(
  text: string,
  voiceId: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  // If autoplay is blocked, skip immediately
  if (_autoplayBlocked) {
    onEnd();
    return { cancel: () => {} };
  }

  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let settled = false;
  const settle = (cb: () => void) => { if (!settled) { settled = true; cb(); } };

  try {
    let blob: Blob | null = null;

    // Check pre-fetch cache first (pass gender for gender-keyed cache lookups)
    const cached = consumePrefetch(text, gender);
    if (cached) {
      blob = await cached;
    }

    if (!blob) {
      const { authHeaders } = await import("./supabase");
      const headers = await authHeaders();

      const res = await fetch("/api/tts", {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voiceId, language: loadTTSSettings().language, ...(gender ? { gender } : {}) }),
        signal: controller.signal,
      });

      if (!res.ok) {
        settle(onError);
        return { cancel: () => {} };
      }

      blob = await res.blob();
    }

    // Validate non-empty audio blob
    if (!blob || blob.size < 100) {
      console.warn("[TTS] empty or invalid audio blob");
      settle(onError);
      return { cancel: () => {} };
    }

    const url = URL.createObjectURL(blob);
    audio = new Audio(url);

    audio.onloadedmetadata = () => {
      if (audio && isFinite(audio.duration) && audio.duration > 0 && onDurationKnown) {
        onDurationKnown(audio.duration * 1000);
      }
    };
    audio.onended = () => {
      URL.revokeObjectURL(url);
      settle(onEnd);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      settle(onError);
    };

    await audio.play();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      if (!settled) settle(onError); // Timeout abort — trigger fallback
      return { cancel: () => {} };
    }
    if (isAutoplayError(err)) {
      _autoplayBlocked = true;
      settle(onEnd);
      return { cancel: () => {} };
    }
    settle(onError);
    return { cancel: () => {} };
  }

  const capturedAudio = audio;
  return {
    cancel: () => {
      controller.abort();
      settled = true;
      if (capturedAudio) {
        capturedAudio.pause();
        capturedAudio.onended = null;
        capturedAudio.onerror = null;
      }
    },
  };
}

/* ─── Azure TTS (primary provider — Indian English neural voices) ─── */
async function speakWithAzure(
  text: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  voiceId?: string,
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  // If autoplay is already known to be blocked, skip immediately
  if (_autoplayBlocked) {
    console.warn("[TTS-Azure] autoplay blocked, skipping");
    onEnd(); // Treat as silent success — let interview proceed without voice
    return { cancel: () => {} };
  }

  const controller = new AbortController();
  let audio: HTMLAudioElement | null = null;
  let settled = false;
  const settle = (cb: () => void) => { if (!settled) { settled = true; cb(); } };

  try {
    let blob: Blob | null = null;

    // Check prefetch cache first — avoids duplicate request on cold start (Q1)
    const cached = consumePrefetch(text, gender);
    if (cached) {
      blob = await cached;
    }

    if (!blob) {
      const { authHeaders } = await import("./supabase");
      const headers = await authHeaders();

      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch("/api/azure-tts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: text.trim().slice(0, 2000),
          voiceId: voiceId || loadTTSSettings().voiceId,
          gender,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn("[TTS-Azure] API error:", res.status);
        settle(onError);
        return { cancel: () => {} };
      }

      blob = await res.blob();
    }

    if (!blob || blob.size < 100) {
      console.warn("[TTS-Azure] empty audio");
      settle(onError);
      return { cancel: () => {} };
    }

    const url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.onloadedmetadata = () => {
      if (audio && isFinite(audio.duration) && audio.duration > 0 && onDurationKnown) {
        onDurationKnown(audio.duration * 1000);
      }
    };
    audio.onended = () => { URL.revokeObjectURL(url); settle(onEnd); };
    audio.onerror = () => { URL.revokeObjectURL(url); settle(onError); };
    await audio.play();
  } catch (err: unknown) {
    // Timeout abort (not user-cancel) — trigger fallback chain
    if (err instanceof Error && err.name === "AbortError") {
      if (!settled) settle(onError);
      return { cancel: () => {} };
    }
    // Detect autoplay policy block — skip ALL TTS providers, proceed silently
    if (isAutoplayError(err)) {
      console.warn("[TTS-Azure] autoplay blocked by browser policy — disabling voice for session");
      _autoplayBlocked = true;
      settle(onEnd); // Silent success — let interview proceed without voice
      return { cancel: () => {} };
    }
    console.warn("[TTS-Azure] error:", err instanceof Error ? err.message : err);
    settle(onError);
    return { cancel: () => {} };
  }

  const capturedAudio = audio;
  return {
    cancel: () => {
      controller.abort();
      settled = true;
      if (capturedAudio) {
        capturedAudio.pause();
        capturedAudio.onended = null;
        capturedAudio.onerror = null;
      }
    },
  };
}

/* ─── Browser TTS (fallback) ─── */
function speakWithBrowser(
  text: string,
  onEnd: () => void,
  onError: () => void,
): { cancel: () => void } {
  // If autoplay is blocked, skip — browser TTS also requires user gesture
  if (_autoplayBlocked) {
    onEnd();
    return { cancel: () => {} };
  }
  if (!window.speechSynthesis) {
    console.warn("Browser speech synthesis not available");
    onError();
    return { cancel: () => {} };
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  // Prefer Indian English voices, fall back to US English. MVP is
  // English-only; Hindi voice fallback removed (was hinting Hindi
  // pronunciation when no Indian-English voice was available).
  const preferred = voices.find(
    (v) =>
      v.lang === "en-IN" ||
      v.name.includes("Indian"),
  ) || voices.find(
    (v) =>
      v.name.includes("Samantha") ||
      v.name.includes("Google US English") ||
      v.name.includes("Daniel") ||
      (v.lang === "en-US" && v.localService),
  );
  if (preferred) utter.voice = preferred;
  let fired = false;
  let speechStarted = false;
  utter.onstart = () => { speechStarted = true; };
  utter.onend = () => { if (!fired) { fired = true; clearTimeout(safetyTimer); onEnd(); } };
  utter.onerror = (e) => {
    if (!fired) { fired = true; clearTimeout(safetyTimer); console.warn("Browser TTS error:", e); onError(); }
  };

  // Safety timer: only fire if speech never started (some browsers report speaking=false immediately)
  const safetyTimer = setTimeout(() => {
    if (!fired && !speechStarted) {
      fired = true;
      console.warn("Browser TTS silent failure — speech never started after 2s");
      onError();
    }
  }, 2000);

  window.speechSynthesis.speak(utter);

  return {
    cancel: () => { fired = true; clearTimeout(safetyTimer); window.speechSynthesis.cancel(); },
  };
}

/* ─── Cleanup for page unload ─── */
let _activeCancel: (() => void) | null = null;
/** Version counter — prevents stale fallback chains from overwriting the current cancel handle */
let _ttsGeneration = 0;

// Auto-cleanup on page unload to prevent WebSocket/AudioContext leaks
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => cleanupTTS());
  // Also clean up when navigating away (SPA route changes via pagehide)
  window.addEventListener("pagehide", () => cleanupTTS());
}

export function cleanupTTS() {
  _activeCancel?.();
  _activeCancel = null;
  clearPrefetchCache();
  // Close persistent WebSocket and remove listeners
  if (_persistentWs) {
    if (_wsMessageHandler) {
      _persistentWs.removeEventListener("message", _wsMessageHandler);
      _wsMessageHandler = null;
    }
    try { _persistentWs.close(); } catch { /* expected: WebSocket may already be closed */ }
    _persistentWs = null;
  }
  if (_wsIdleTimer) { clearTimeout(_wsIdleTimer); _wsIdleTimer = null; }
}

/**
 * Hard-mute the TTS pipeline NOW. Used by skipSpeaking() to silence
 * already-buffered audio that the regular cancel() handler can't yank
 * fast enough. Cartesia's WebSocket has up to ~1.5s of pre-decoded
 * PCM in flight when you cancel; Azure has the entire sentence
 * pre-rendered. Both leak after the user pressed Space.
 *
 * Suspend (not close) the AudioContext: suspend silences output
 * within a frame and is reversible — the next speak() call resumes it
 * and works normally. Closing would force a costly recreate cycle.
 *
 * Also stops every <audio> element on the page that's currently
 * playing — Azure speakWithBrowser path uses HTMLAudioElement.
 */
export function hardMuteTTS() {
  // 1. Cancel the current handle (idempotent w/ cleanupTTS)
  _activeCancel?.();
  _activeCancel = null;

  // 2. Suspend the Cartesia AudioContext immediately (silences in-flight PCM)
  try {
    const ctx = window.__hirestepxAudioCtx;
    if (ctx && ctx.state !== "closed") {
      ctx.suspend().catch(() => { /* best effort */ });
    }
  } catch { /* SSR / restricted */ }

  // 3. Pause any HTMLAudioElement currently rendering Azure / browser TTS
  try {
    document.querySelectorAll("audio").forEach((el) => {
      try { el.pause(); } catch { /* expected */ }
    });
  } catch { /* DOM unavailable */ }

  // 4. Cancel native speechSynthesis (browser TTS fallback)
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch { /* expected */ }
}

/* ─── Speak with a specific voice (for panel interviews) ─── */
export async function speakAs(
  text: string,
  voiceId: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  text = addBreathCues(sanitizeForTTS(text));
  const settings = loadTTSSettings();
  if (settings.provider === "browser") {
    return speak(text, onEnd, onError);
  }

  // Versioned cancel: each new speakAs/speak call gets a generation ID.
  // Stale fallback chains won't overwrite the current cancel handle.
  const gen = ++_ttsGeneration;
  const setCancel = (fn: () => void) => { if (gen === _ttsGeneration) _activeCancel = fn; };

  let handle: { cancel: () => void };

  const cartesiaFallback = async () => {
    console.warn("Trying Cartesia TTS fallback (speakAs)");
    handle = await speakWithWebSocket(text, voiceId, onEnd, async () => {
      console.warn("Cartesia WS failed (speakAs), trying REST");
      handle = await speakWithProxy(text, voiceId, onEnd, () => {
        console.warn("Cartesia REST also failed (speakAs), falling back to browser TTS");
        const browserHandle = speakWithBrowser(text, onEnd, onError);
        handle = browserHandle;
        setCancel(browserHandle.cancel);
      }, gender, onDurationKnown);
      setCancel(handle.cancel);
    }, gender, onDurationKnown);
    setCancel(handle.cancel);
  };

  // Azure primary → Cartesia fallback → Browser fallback
  handle = await speakWithAzure(text, onEnd, async () => {
    console.warn("Azure TTS failed (speakAs), trying Cartesia");
    await cartesiaFallback();
  }, gender, voiceId, onDurationKnown);

  setCancel(handle.cancel);
  return handle;
}

/* ─── Unified speak function ─── */
import { stripProsodyMarkup, renderForCartesia } from "./_prosody";

/* Prosody-rendering feature flag. When ON, `_emphasis_` and `[pause]`
   markers in the LLM output get rendered to provider-native cadence
   (Cartesia respects ellipsis as a measurable pause, so the renderer
   converts `[pause]` → `… ` and drops the inline emphasis markers
   since Cartesia doesn't expose SSML on the realtime endpoint). When
   OFF, markers are stripped entirely — the safe default until we've
   verified the rendered audio sounds right on real devices.

   Same shape as the backchannels flag — flip via DevTools or the
   exported helper below. */
const PROSODY_FLAG_KEY = "hsx-prosody";
function isProsodyEnabled(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(PROSODY_FLAG_KEY) === "on"; }
  catch { return false; }
}
export function setProsodyEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (enabled) localStorage.setItem(PROSODY_FLAG_KEY, "on");
    else localStorage.removeItem(PROSODY_FLAG_KEY);
  } catch { /* localStorage may be blocked (Safari private mode) */ }
}

/**
 * Strip markdown / collapse whitespace before sending text to TTS providers.
 * Saves billable characters on the free tier and removes literal "**" / "##"
 * that some engines pronounce. Idempotent.
 *
 * Prosody markup handling: when the feature flag is ON, `[pause]` and
 * friends are converted to provider-native pauses (ellipsis for the
 * Cartesia/browser path). When OFF (default), they're stripped — same
 * defensive guard as before, so a model emitting markup before we
 * live-test never speaks "underscore time underscore" literally.
 */
// Indic / non-Latin script ranges that, when present, cause TTS providers
// (Cartesia, Azure) to auto-detect language and switch voice mid-sentence.
// The most common offender is Devanagari leaking from the LLM output (the
// model occasionally code-switches to Hindi when the candidate's STT had
// Hindi tokens in it). Stripping these here pins the AI's voice to en-IN
// regardless of provider language-detection. We do NOT touch the candidate's
// own answer text — only what the AI is about to say.
//
// Uses Unicode property escapes (the `u` flag + `\p{Script=…}`) for clarity
// and to avoid the eslint no-misleading-character-class warning on raw
// codepoint ranges that include surrogate pairs.
const NON_LATIN_SCRIPT_RE = /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const NON_LATIN_SCRIPT_STRIP_RE = /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

function sanitizeForTTS(text: string): string {
  if (!text) return text;
  // Render or strip prosody markup first — the markdown stripper below
  // would otherwise treat _word_ italic as content to preserve.
  const prosodyHandled = isProsodyEnabled() ? renderForCartesia(text) : stripProsodyMarkup(text);
  let cleaned = prosodyHandled
    .replace(/```[\s\S]*?```/g, " ")          // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")        // bold
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1") // italic
    .replace(/^#{1,6}\s+/gm, "")              // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // links
    .replace(/[ \t]+/g, " ")                  // collapse spaces
    .replace(/\s*\n\s*/g, " ")                // collapse newlines
    .trim();
  // Hindi-voice-leak guard. If any non-Latin script slipped through (LLM
  // code-switching), strip it and warn so we can trace which prompt let
  // it through. Replacement char is " " so we don't merge words.
  if (NON_LATIN_SCRIPT_RE.test(cleaned)) {
    console.warn("[tts] non-Latin script detected in AI output — stripping to pin en-IN voice");
    cleaned = cleaned.replace(NON_LATIN_SCRIPT_STRIP_RE, " ").replace(/\s{2,}/g, " ").trim();
  }
  return cleaned;
}

/**
 * Insert breath pauses into long clauses so synthesized speech doesn't read
 * as a wall of words. Real humans pause every 8-14 words; most TTS engines
 * (Cartesia included) respect commas and ellipses as breath cues.
 */
function addBreathCues(text: string): string {
  if (!text || text.length < 80) return text;
  // Replace "..." → "… " (Cartesia respects ellipsis as a longer pause)
  let out = text.replace(/\.{3,}/g, "… ");
  // Insert a comma before connector words when the preceding clause is >12 words
  // and there's no comma already.
  out = out.replace(/(\b\w+(?:\s+\w+){11,})\s+(but|and|so|because|then|however|although)\b/gi, "$1, $2");
  return out;
}

export async function speak(
  text: string,
  onEnd: () => void,
  onError: () => void,
  gender?: "male" | "female",
  onDurationKnown?: (ms: number) => void,
): Promise<{ cancel: () => void }> {
  text = addBreathCues(sanitizeForTTS(text));
  const settings = loadTTSSettings();
  let handle: { cancel: () => void };

  // Versioned cancel to prevent stale fallback chains from overwriting current handle
  const gen = ++_ttsGeneration;
  const setCancel = (fn: () => void) => { if (gen === _ttsGeneration) _activeCancel = fn; };

  // Cartesia fallback chain (before browser TTS)
  const cartesiaFallback = async () => {
    console.warn("Trying Cartesia TTS fallback");
    // Prefer an Indian-English voice when one is available — matches the
    // Azure primary (en-IN-NeerjaNeural) so users in our target market don't
    // hear a sudden accent change when Azure fails over.
    let cartesiaVoice = DEFAULT_VOICE_ID;
    try {
      const enInVoices = await fetchCartesiaVoices("en_IN");
      const preferred = (gender && enInVoices.find(v => v.gender === gender)) || enInVoices[0];
      if (preferred?.id) cartesiaVoice = preferred.id;
    } catch { /* keep default voice on fetch failure */ }
    const prefetchEntry = _prefetchCache.get(text);
    const hasPrefetch = !!prefetchEntry && Date.now() - prefetchEntry.createdAt < PREFETCH_TTL;
    if (hasPrefetch) {
      handle = await speakWithProxy(text, cartesiaVoice, onEnd, () => {
        console.warn("Cartesia REST also failed, falling back to browser TTS");
        const browserHandle = speakWithBrowser(text, onEnd, onError);
        handle = browserHandle;
        setCancel(browserHandle.cancel);
      }, undefined, onDurationKnown);
    } else {
      handle = await speakWithWebSocket(text, cartesiaVoice, onEnd, async () => {
        console.warn("Cartesia WS failed, trying REST");
        handle = await speakWithProxy(text, cartesiaVoice, onEnd, () => {
          console.warn("Cartesia REST also failed, falling back to browser TTS");
          const browserHandle = speakWithBrowser(text, onEnd, onError);
          handle = browserHandle;
          setCancel(browserHandle.cancel);
        }, undefined, onDurationKnown);
        setCancel(handle.cancel);
      }, undefined, onDurationKnown);
    }
    setCancel(handle.cancel);
  };

  if (settings.provider === "browser") {
    handle = speakWithBrowser(text, onEnd, onError);
  } else {
    // Azure primary → Cartesia fallback → Browser fallback
    handle = await speakWithAzure(text, onEnd, async () => {
      console.warn("Azure TTS failed, trying Cartesia fallback");
      await cartesiaFallback();
    }, gender, undefined, onDurationKnown);
  }

  setCancel(handle.cancel);
  return handle;
}
