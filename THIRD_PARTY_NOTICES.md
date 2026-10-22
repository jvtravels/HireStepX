# Third-party notices

HireStepX bundles or serves the following third-party material. This file is
the attribution record; first-party code is not listed.

## Fonts (SIL Open Font License 1.1)

- **Instrument Serif** - Copyright 2022 The Instrument Serif Project Authors
  (https://github.com/Instrument/instrument-serif). Loaded via `next/font`
  (Google Fonts, self-hosted at build time). OFL 1.1:
  https://openfontlicense.org
- **Geist Sans / Geist Mono** - Copyright 2024 The Geist Project Authors
  (https://github.com/vercel/geist-font), published by Vercel. Self-hosted in
  `public/fonts/geist-*-var.woff2`. Full licence text:
  [`public/fonts/OFL-geist.txt`](public/fonts/OFL-geist.txt).

The "AF Sobremesa" typeface (Personal Use licence) is NOT part of the shipped
product and must not be committed under `public/`.

## Audio

`public/sounds/*.mp3` are dedicated to the public domain under CC0 1.0. See
[`public/sounds/LICENSE-AUDIO.txt`](public/sounds/LICENSE-AUDIO.txt).

## npm dependencies with notice requirements

- **sharp-libvips** (`@img/sharp-libvips-*`, bundled by `sharp` via Next.js
  image optimisation) - LGPL-3.0-or-later. Source and licence:
  https://github.com/lovell/sharp-libvips. Used unmodified as a dynamically
  loaded binary.
- **caniuse-lite** - CC-BY-4.0. Browser-support data (c) Alexis Deveria and
  contributors, https://github.com/browserslist/caniuse-lite. Used at build
  time only (Browserslist / Autoprefixer).

All other npm dependencies are under permissive licences (MIT, Apache-2.0,
ISC, BSD) declared in their own packages.

## Images

Blog hero images are hotlinked from **Unsplash** (https://unsplash.com) under
the Unsplash License (https://unsplash.com/license): free to use, attribution
not required. Photographers retain their copyright.

Company and partner logos shown on the site (for example
`public/logos/sarvam-ai-wordmark.png`) are trademarks of their respective
owners and are used only to identify the company discussed in editorial
content (nominative use).
