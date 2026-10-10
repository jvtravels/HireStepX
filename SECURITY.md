# Security policy

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting:
**Security tab → "Report a vulnerability"** on this repository.

Include steps to reproduce and the affected URL or file. We aim to acknowledge
within 3 business days.

## Scope

In scope: hirestepx.com, app.hirestepx.com and the `/api/*` endpoints.
Out of scope: social engineering, denial-of-service, findings that require
a compromised device, and third-party services (Supabase, Vercel, Razorpay).

## Secrets

Secret scanning and push protection are enabled on this repository. Never
commit keys; if one leaks, rotate it first, then remove it.
