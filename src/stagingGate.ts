export const STAGING_HOST = "staging.hirestepx.com";

export function isStagingHost(hostname: string): boolean {
  return hostname.toLowerCase() === STAGING_HOST;
}

// Length-independent comparison so response timing doesn't leak the secret.
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Fails closed: an unset or malformed `expected` ("user:pass") rejects everyone. */
export function isStagingAuthorized(authHeader: string | null, expected: string | undefined): boolean {
  if (!expected || !expected.includes(":")) return false;
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return false;
  }
  return safeEqual(decoded, expected);
}
