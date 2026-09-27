import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { SessionHistoryLoadingSkeleton } from "@/SessionHistoryRoute";
import Listempty from "./ListEmpty";
import Listfew from "./ListFew";
import Listpopulated from "./ListPopulated";
import Inshelldetail from "./InShellDetail";
import Inshellreport from "./InShellReport";
import { LoadingScreen } from "@/SessionDetail";
import Detailrouteerror from "./DetailRouteError";
import Detailroutenotfound from "./DetailRouteNotFound";
import Reportprocessing from "./ReportProcessing";
import Reporterrorpreliminary from "./ReportErrorPreliminary";

export default function SessionHistoryCanvas() {
  return (
    <Canvas name="session-history" backgroundColor="#232323">
      <Storyboard
        id="ListLoading"
        name="1. List — loading skeleton"
        component={SessionHistoryLoadingSkeleton}
        layout={{ x: 0, y: 0, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ListEmpty"
        name="2. List — empty (first-time)"
        component={Listempty}
        layout={{ x: 1450, y: 0, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ListFew"
        name="3. List — few sessions (persona copy)"
        component={Listfew}
        layout={{ x: 0, y: 950, width: 1400, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ListPopulated"
        name="4. List — populated, all card variants + drafts + delete"
        component={Listpopulated}
        layout={{ x: 0, y: 1900, width: 1440, height: 1400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="InShellDetail"
        name={"5. In-shell Detail view (variant=\"detail\")"}
        component={Inshelldetail}
        layout={{ x: 0, y: 3350, width: 1440, height: 1400, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="InShellReport"
        name={"6. In-shell Report view (variant=\"report\")"}
        component={Inshellreport}
        layout={{ x: 0, y: 4800, width: 1440, height: 1600, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="DetailRouteLoading"
        name="7. Detail route — loading"
        component={LoadingScreen}
        layout={{ x: 0, y: 6450, width: 1000, height: 700, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="DetailRouteError"
        name="8. Detail route — load error"
        component={Detailrouteerror}
        layout={{ x: 0, y: 7200, width: 1000, height: 700, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="DetailRouteNotFound"
        name="9. Detail route — not found"
        component={Detailroutenotfound}
        layout={{ x: 0, y: 7950, width: 1000, height: 700, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ReportProcessing"
        name="10. Report generation — processing"
        component={Reportprocessing}
        layout={{ x: 0, y: 8700, width: 1000, height: 800, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="ReportErrorPreliminary"
        name="11. Report generation — error, preliminary scores available"
        component={Reporterrorpreliminary}
        layout={{ x: 0, y: 9550, width: 1000, height: 900, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
