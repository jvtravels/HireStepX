/* Clears only the browser storage this app owns. localStorage.clear() also wipes
   keys written by extensions and other apps on the same origin (and the cookie
   consent choice), which a sign-out has no business touching. */

const APP_STORAGE_PREFIXES = ["hirestepx", "hsx", "sb-"] as const;
// A deliberate choice the user made about the site, not account state.
const KEEP_KEYS: ReadonlySet<string> = new Set(["hirestepx_cookie_consent"]);

export function isAppOwnedStorageKey(key: string): boolean {
  if (KEEP_KEYS.has(key)) return false;
  return APP_STORAGE_PREFIXES.some((p) => key.startsWith(p));
}

export function clearAppOwnedStorage(storage: Pick<Storage, "length" | "key" | "removeItem">): number {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isAppOwnedStorageKey(key)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  return doomed.length;
}
