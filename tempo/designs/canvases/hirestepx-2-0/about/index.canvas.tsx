import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { AboutDesktop as AboutDesktop2 } from "@/home2/PagesFrames";
import { AboutMobile as AboutMobile2 } from "@/home2/PagesFrames";

export default function AboutCanvas() {
  return (
    <Canvas name="about" backgroundColor="#232323">
      <Storyboard
        id="AboutDesktop"
        name="About (desktop)"
        component={AboutDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 2000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="AboutMobile"
        name="About (mobile)"
        component={AboutMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 3000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
