import { useSyncExternalStore } from "react";

const STORAGE_KEY = "hsx_employer_shortcuts";
const CHANGE_EVENT = "hsx-employer-shortcuts-change";

export function getShortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setShortcutsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch { /* expected: storage blocked (private mode), the choice just won't persist */ }
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

export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribe, getShortcutsEnabled, () => true);
}
