import type { Preview } from "@storybook/react";
import React from "react";

/* Webfont loading strategy:
   1. Try locally self-hosted WOFF2s via /fonts/fonts.css (no CDN dependency)
   2. Fall back to Google Fonts + Fontshare CDNs if local files are missing
   The browser will use whichever resolves first; missing local files don't
   throw — they 404 silently and CDN takes over. */
const localFontsHref = "/fonts/fonts.css";
const googleFontsHref =
  "https://fonts.googleapis.com/css2" +
  "?family=Instrument+Serif:ital@0;1" +
  "&family=JetBrains+Mono:wght@400;500;600" +
  "&display=swap";
const satoshiHref =
  "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap";

if (typeof document !== "undefined" && !document.getElementById("hsx-fonts")) {
  for (const href of [localFontsHref, googleFontsHref, satoshiHref]) {
    const link = document.createElement("link");
    link.id = "hsx-fonts";
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "cream",
      values: [
        { name: "cream", value: "#FAF7F0" },
        { name: "coal", value: "#0E0C08" },
        { name: "white", value: "#FFFFFF" },
      ],
    },
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    chromatic: {
      // Single canonical viewport for the design system.
      // Override per-story when a board needs a wider/narrower capture.
      viewports: [1280],
      // Pause animations + delay capture so Instrument Serif actually loads.
      pauseAnimationAtEnd: true,
      delay: 800,
    },
  },
  decorators: [
    (Story) => (
      <div style={{ background: "#FAF7F0", minHeight: "100vh" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
