import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { ResourcesDesktop as ResourcesDesktop2 } from "@/home2/PagesFrames";
import { ResourcesMobile as ResourcesMobile2 } from "@/home2/PagesFrames";
import { ResourcesDesktopFiltered as ResourcesDesktopFiltered2 } from "@/home2/PagesFrames";
import { ResourcesMobileSheet as ResourcesMobileSheet2 } from "@/home2/PagesFrames";
import { ResourcesDesktopSearch as ResourcesDesktopSearch2 } from "@/home2/PagesFrames";

export default function ResourcesCanvas() {
  return (
    <Canvas name="resources" backgroundColor="#232323">
      <Storyboard
        id="ResourcesDesktop"
        name="Resources (desktop)"
        component={ResourcesDesktop2}
        layout={{ x: 0, y: 0, width: 1728, height: 4000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ResourcesMobile"
        name="Resources (mobile)"
        component={ResourcesMobile2}
        layout={{ x: 1778, y: 0, width: 390, height: 6000, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ResourcesDesktopFiltered"
        name="Resources, search and filters active (desktop)"
        component={ResourcesDesktopFiltered2}
        layout={{ x: 0, y: 4400, width: 1728, height: 3400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ResourcesDesktopSearch"
        name="Resources, search opened (desktop)"
        component={ResourcesDesktopSearch2}
        layout={{ x: 0, y: 8200, width: 1728, height: 2400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ResourcesMobileSheet"
        name="Resources, filter sheet open (mobile)"
        component={ResourcesMobileSheet2}
        layout={{ x: 2218, y: 0, width: 390, height: 6000, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
