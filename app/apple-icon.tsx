import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/* Generates /apple-icon.png — the PNG icon iOS Safari requires for
   "Add to Home Screen". SVG favicons are silently ignored by iOS;
   this route produces a proper rasterised 512×512 PNG at request time.
   512px clears Lighthouse's installable-manifest icon-size floor (192px min). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#B45309",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 108,
        }}
      >
        <div
          style={{
            color: "#FAF7F0",
            fontSize: 273,
            fontWeight: 700,
            fontFamily: "Georgia, serif",
            letterSpacing: -11,
            lineHeight: 1,
          }}
        >
          H
        </div>
      </div>
    ),
    { ...size },
  );
}
