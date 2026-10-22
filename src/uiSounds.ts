import { useSyncExternalStore } from "react";

export type UiSoundCue = "send" | "receive" | "notification";

const STORAGE_KEY = "hsx_ui_sounds";
const CHANGE_EVENT = "hsx-ui-sounds-change";
const FILES: Record<UiSoundCue, string> = {
  send: "/sounds/send.mp3",
  receive: "/sounds/receive.mp3",
  notification: "/sounds/notification.mp3",
};
const VOLUME = 0.5;
// A new message usually also creates a notification; one sound per burst.
const MIN_GAP_MS = 1500;

let lastPlayedAt = 0;
const audioCache = new Map<UiSoundCue, HTMLAudioElement>();

export function getUiSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setUiSoundsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch { /* expected: storage blocked (private mode) — preference just won't persist */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useUiSoundsEnabled(): boolean {
  return useSyncExternalStore(subscribe, getUiSoundsEnabled, () => true);
}

export function playUiSound(cue: UiSoundCue): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  if (!getUiSoundsEnabled()) return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  try {
    let audio = audioCache.get(cue);
    if (!audio) {
      audio = new Audio(FILES[cue]);
      audio.volume = VOLUME;
      audioCache.set(cue, audio);
    }
    audio.currentTime = 0;
    // Autoplay policy rejects until the user has interacted with the page; that's fine.
    audio.play().catch(() => {});
  } catch { /* expected: audio unsupported or blocked — sounds are best-effort */ }
}
