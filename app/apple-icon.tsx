import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/* iOS ignores SVG favicons, so this route rasterises the logo mark to a 512px PNG
   (above Lighthouse's 192px installable-manifest floor). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#312E81",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 108,
        }}
      >
        <svg width="300" height="300" viewBox="214 229 653 622" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M214.396 229L349.67 229L544.568 454.795L730.945 229L866.218 229L610.602 540L866.218 851H727.76L540.307 623.075L353.844 851H214.396L472.143 540L214.396 229Z" fill="#F4F4FA" />
          <path d="M553.422 453.873L617.882 532.687L625.821 542.394L617.62 551.88L553.159 626.435L541.78 639.596L530.516 626.337L467.169 551.783L459.189 542.391L466.91 532.786L530.257 453.972L541.778 439.638L553.422 453.873Z" fill="#F4F4FA" stroke="#312E81" strokeWidth="29.8219" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
