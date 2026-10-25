import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { EmployersDesktop as EmployersDesktop2 } from "@/home2/PagesFrames";
import { EmployersMobile as EmployersMobile2 } from "@/home2/PagesFrames";

export default function EmployersCanvas() {
  return (
    <Canvas name="employers" backgroundColor="#232323">
      <Storyboard
        id="EmployersDesktop"
        name="Employers Desktop"
        component={EmployersDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 5600, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="EmployersMobile"
        name="Employers Mobile"
        component={EmployersMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 8000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
