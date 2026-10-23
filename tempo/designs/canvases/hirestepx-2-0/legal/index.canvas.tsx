import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { LegalCookiesDesktop as LegalCookiesDesktop2 } from "@/home2/PagesFrames";
import { LegalCookiesMobile as LegalCookiesMobile2 } from "@/home2/PagesFrames";

export default function LegalCanvas() {
  return (
    <Canvas name="legal" backgroundColor="#232323">
      <Storyboard
        id="LegalCookiesDesktop"
        name="Legal, Cookie Policy (desktop)"
        component={LegalCookiesDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 2000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="LegalCookiesMobile"
        name="Legal, Cookie Policy (mobile)"
        component={LegalCookiesMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 3200, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
