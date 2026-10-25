import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { ContactDesktop as ContactDesktop2 } from "@/home2/PagesFrames";
import { ContactMobile as ContactMobile2 } from "@/home2/PagesFrames";

export default function ContactCanvas() {
  return (
    <Canvas name="contact" backgroundColor="#232323">
      <Storyboard
        id="ContactDesktop"
        name="Contact (desktop)"
        component={ContactDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 2000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ContactMobile"
        name="Contact (mobile)"
        component={ContactMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 3000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
