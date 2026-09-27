import { Canvas, Storyboard } from "tempo-sdk/canvas";
import ResumeV2Harness from "./ResumeV2Harness";

export default function ResumeCanvas() {
  return (
    <Canvas name="resume" backgroundColor="#232323">
      <Storyboard
        id="Resume"
        component={ResumeV2Harness}
        layout={{ x: 0, y: 0, width: 1728, height: 1400, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
