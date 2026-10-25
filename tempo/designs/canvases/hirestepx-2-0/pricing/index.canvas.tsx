import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { PricingCandidatesDesktop as PricingCandidatesDesktop2 } from "@/home2/PagesFrames";
import { PricingEmployersDesktop as PricingEmployersDesktop2 } from "@/home2/PagesFrames";
import { PricingCandidatesMobile as PricingCandidatesMobile2 } from "@/home2/PagesFrames";
import { PricingEmployersMobile as PricingEmployersMobile2 } from "@/home2/PagesFrames";

export default function PricingCanvas() {
  return (
    <Canvas name="pricing" backgroundColor="#232323">
      <Storyboard
        id="PricingCandidatesDesktop"
        name="Pricing, candidates (desktop)"
        component={PricingCandidatesDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 2500, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PricingEmployersDesktop"
        name="Pricing, employers (desktop)"
        component={PricingEmployersDesktop2}
        layout={{ x: 0, y: 2600, width: 1728, height: 2300, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PricingCandidatesMobile"
        name="Pricing, candidates (mobile)"
        component={PricingCandidatesMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 3000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="PricingEmployersMobile"
        name="Pricing, employers (mobile)"
        component={PricingEmployersMobile2}
        layout={{ x: 2218, y: 0, width: 390, height: 3000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
