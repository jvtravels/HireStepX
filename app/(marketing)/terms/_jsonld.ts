import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

/* Shared source of truth for /terms's JSON-LD, used by both the page
 * (renders it) and scripts/generate-jsonld-csp-hashes.mts (hashes the
 * JSON-LD for the CSP header). Keeping this in one place guarantees the
 * hash always matches what the page actually renders. */

export function buildTermsJsonLd(): { __html: string }[] {
  return [ldJson(breadcrumb([{ name: "Terms", path: "/terms" }]))];
}
