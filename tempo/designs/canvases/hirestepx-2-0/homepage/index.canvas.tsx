import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Homepage from "../../../../../src/home2/Homepage";
import HomepageMobile from "../../../../../src/home2/HomepageMobile";

export function DesktopFrame() {
  return (
    <div style={{ width: 1728 }}>
      <Homepage />
    </div>
  );
}

export default function HomepageCanvas() {
  return (
    <Canvas name="homepage" backgroundColor="#232323">
      <Storyboard
        id="HomepageDesktop"
        name="Homepage Desktop"
        component={DesktopFrame}
        layout={{ x: -628, y: 0, width: 1728, height: 5000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="HomepageMobile"
        name="Homepage Mobile"
        component={HomepageMobile}
        layout={{ x: 1490, y: 0, width: 390, height: 8000, intrinsicSizing: "root-element" }}
      />
</Canvas>
  );
}
