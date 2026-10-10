## What and why

## Risk
- [ ] Touches auth, payments, RLS/migrations, or LLM/TTS/STT providers (say which)
- [ ] Needs an env var or Supabase change before/after deploy (list it)

## Verification
- [ ] `npx tsc --noEmit` and `npm test` pass
- [ ] UI change checked in a browser (mobile width too)

## Rollback
How to undo if this misbehaves in production (Vercel Instant Rollback, revert commit, feature flag).
