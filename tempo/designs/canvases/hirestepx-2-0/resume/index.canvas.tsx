import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Resumev2 from "@/ResumeV2";

export default function ResumeCanvas() {
  return (
    <Canvas name="resume" backgroundColor="#232323">
      <Storyboard
        id="Resume"
        component={Resumev2}
        layout={{ x: 0, y: 0, width: 1728, height: 1400, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
