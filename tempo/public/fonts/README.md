# Self-hosted webfonts

The HireStepX brand uses three families. They're hosted locally so:

1. **No third-party CDN dependency** (Google Fonts, Fontshare can go down)
2. **Privacy** — no visitor IPs leak to font CDNs (GDPR + Indian DPDP Act)
3. **Performance** — one same-origin request, no extra DNS lookups
4. **Stability** — font files don't change under us between deploys

## Files needed (all WOFF2)

Drop these into this directory. **They're not committed** — `.gitignore` skips
binaries to keep the repo lean. Each developer/CI run downloads them once.

| File | Source | License |
|---|---|---|
| `Satoshi-Regular.woff2` | https://www.fontshare.com/fonts/satoshi | Free for commercial use |
| `Satoshi-Medium.woff2` | (same) | (same) |
| `Satoshi-Bold.woff2` | (same) | (same) |
| `Satoshi-Black.woff2` | (same) | (same) |
| `InstrumentSerif-Regular.woff2` | https://fonts.google.com/specimen/Instrument+Serif | OFL |
| `InstrumentSerif-Italic.woff2` | (same) | (same) |
| `JetBrainsMono-Regular.woff2` | https://fonts.google.com/specimen/JetBrains+Mono | OFL |
| `JetBrainsMono-Medium.woff2` | (same) | (same) |

## Quick install

```sh
cd tempo/public/fonts

# Satoshi — download the full family, extract WOFF2s
curl -L "https://api.fontshare.com/v2/fonts/download/satoshi" -o satoshi.zip
unzip satoshi.zip 'web/*.woff2' -d satoshi-tmp
mv satoshi-tmp/web/Satoshi-Regular.woff2 .
mv satoshi-tmp/web/Satoshi-Medium.woff2 .
mv satoshi-tmp/web/Satoshi-Bold.woff2 .
mv satoshi-tmp/web/Satoshi-Black.woff2 .
rm -rf satoshi.zip satoshi-tmp

# Instrument Serif + JetBrains Mono — google-webfonts-helper has clean WOFF2s
# https://gwfh.mranftl.com/fonts/instrument-serif?subsets=latin
# https://gwfh.mranftl.com/fonts/jetbrains-mono?subsets=latin
```

## How it's wired

- `fonts.css` (this directory) declares `@font-face` for each family
- `tempo/styles.css` `@import`s this file at the top
- `_tokens.ts` references `'Satoshi'`, `'Instrument Serif'`, `'JetBrains Mono'` in the font stack
- Browser picks up the local WOFF2s automatically

## Fallback

If any file is missing, the canvas components still ship an inline `@import`
to the CDN. The local files override at runtime — you'll get either local
or CDN, never broken text.

Once the WOFF2s are committed (or fetched in CI), the CDN `@import`s in
`_auth-styles.ts` and `DesignSystem*.tsx` can be removed for the ~80ms
first-paint win.
