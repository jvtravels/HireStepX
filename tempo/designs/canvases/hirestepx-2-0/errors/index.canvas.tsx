import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { NotFoundDesktop, NotFoundMobile, ServerErrorDesktop, ServerErrorMobile, GlobalErrorDesktop } from "@/home2/PagesFrames";

export default function ErrorsCanvas() {
  return (
    <Canvas name="errors" backgroundColor="#232323">
      <Storyboard
        id="NotFoundDesktop"
        name="404 Not found (desktop)"
        component={NotFoundDesktop}
        layout={{ x: 0, y: 0, width: 1728, height: 1100, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="NotFoundMobile"
        name="404 Not found (mobile)"
        component={NotFoundMobile}
        layout={{ x: 1778, y: 0, width: 390, height: 1900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ServerErrorDesktop"
        name="500 Route error (desktop)"
        component={ServerErrorDesktop}
        layout={{ x: 0, y: 1300, width: 1728, height: 1100, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ServerErrorMobile"
        name="500 Route error (mobile)"
        component={ServerErrorMobile}
        layout={{ x: 2218, y: 0, width: 390, height: 1900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="GlobalErrorDesktop"
        name="Global layout error (desktop)"
        component={GlobalErrorDesktop}
        layout={{ x: 0, y: 2600, width: 1728, height: 720, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
