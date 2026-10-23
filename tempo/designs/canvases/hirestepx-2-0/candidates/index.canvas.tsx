import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { CandidatesDesktop as CandidatesDesktop2 } from "@/home2/PagesFrames";
import { CandidatesMobile as CandidatesMobile2 } from "@/home2/PagesFrames";

export default function CandidatesCanvas() {
  return (
    <Canvas name="candidates" backgroundColor="#232323">
      <Storyboard
        id="CandidatesDesktop"
        name="Candidates Desktop"
        component={CandidatesDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 5500, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="CandidatesMobile"
        name="Candidates Mobile"
        component={CandidatesMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 8000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
