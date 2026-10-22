/** Decode a base64 string into bytes. Edge-safe — atob exists on globalThis. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Map a sniffed MIME type to a file extension we'll use in Storage. */
export function inferExtension(contentType: string, fileName: string): string {
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("wordprocessingml") || contentType.includes("docx")) return "docx";
  if (contentType.includes("text/plain")) return "txt";
  // Fallback: last segment of the file name
  const m = fileName.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "bin";
}

/** Regex that all resumeVersionId values must pass before touching Storage. */
export const VERSION_ID_RE = /^[0-9a-f-]{32,}$/i;
