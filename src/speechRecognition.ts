/* ─── Speech Recognition (Web Speech API) ─── */

import { getSpeechRecognitionCtor } from "./_browser-api-guards";

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

/** Detect iOS/iPadOS (Safari Web Speech API has different behavior) */
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function createSpeechRecognition(): SpeechRecognitionInstance | null {
  const SR = getSpeechRecognitionCtor();
  if (!SR) return null;
  const recognition = new SR() as SpeechRecognitionInstance;
  // iOS Safari doesn't support continuous mode well — use single-shot with manual restart
  recognition.continuous = !isIOS;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  return recognition;
}
