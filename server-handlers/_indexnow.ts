/* IndexNow: tells Bing, Yandex and partner engines a URL changed so they crawl it
 * now instead of waiting for the sitemap. Google does not read it. The key is
 * public by design; it must match the file served at /<key>.txt. */

export const INDEXNOW_KEY = "dbd7961b10553b9ee761364f553f86d7";
const HOST = "hirestepx.com";

export function buildIndexNowPayload(paths: string[]) {
  return {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: [...new Set(paths)].map((p) => `https://${HOST}${p}`),
  };
}

export async function pingIndexNow(paths: string[], fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; status: number; count: number }> {
  if (paths.length === 0) return { ok: true, status: 0, count: 0 };
  const res = await fetchImpl("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(buildIndexNowPayload(paths)),
    signal: AbortSignal.timeout(8000),
  });
  // 200 and 202 both mean accepted.
  return { ok: res.status === 200 || res.status === 202, status: res.status, count: paths.length };
}
