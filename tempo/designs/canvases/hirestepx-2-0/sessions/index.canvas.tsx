import { Canvas, Storyboard } from "tempo-sdk/canvas";
import Sessionsv2 from "@/SessionsV2";
import { SessionHistoryLoadingSkeleton } from "@/SessionHistoryRoute";
import { LoadingScreen } from "@/SessionDetail";
import ListEmpty from "./ListEmpty";
import ListFew from "./ListFew";
import ListPopulated from "./ListPopulated";
import InShellDetail from "./InShellDetail";
import InShellReport from "./InShellReport";
import DetailRouteError from "./DetailRouteError";
import DetailRouteNotFound from "./DetailRouteNotFound";
import ReportProcessing from "./ReportProcessing";
import ReportErrorPreliminary from "./ReportErrorPreliminary";

export default function SessionsCanvas() {
  return (
    <Canvas name="sessions" backgroundColor="#232323">
      {/* Legacy/stale — SessionsV2 is not the production Sessions component
         and crashes here (useAuth needs AuthProvider, not present in canvas
         mode). Left in place, not touched, pending a decision on whether to
         remove it. */}
      <Storyboard
        id="Sessions"
        name="Sessions (legacy, broken — not production)"
        component={Sessionsv2}
        layout={{ x: 0, y: 0, width: 1728, height: 960, intrinsicSizing: "root-element" }}
      />

      {/* Every scenario/edge case of the real production Sessions tab,
         built from the real production components (SessionHistoryDesign,
         SessionDetail, SessionReport) — no mocks. */}
      <Storyboard
        id="ListLoading"
        name="1. List — loading skeleton"
        component={SessionHistoryLoadingSkeleton}
        layout={{ x: 0, y: 1050, width: 1400, height: 900 }}
      />
      <Storyboard
        id="ListEmpty"
        name="2. List — empty (first-time)"
        component={ListEmpty}
        layout={{ x: 1450, y: 1050, width: 1400, height: 900 }}
      />
      <Storyboard
        id="ListFew"
        name="3. List — few sessions (persona copy)"
        component={ListFew}
        layout={{ x: 0, y: 2000, width: 1400, height: 900 }}
      />
      <Storyboard
        id="ListPopulated"
        name="4. List — populated, all card variants + drafts + delete"
        component={ListPopulated}
        layout={{ x: 0, y: 2950, width: 1440, height: 1400 }}
      />
      <Storyboard
        id="InShellDetail"
        name="5. In-shell Detail view (variant=detail)"
        component={InShellDetail}
        layout={{ x: 0, y: 4400, width: 1440, height: 1400 }}
      />
      <Storyboard
        id="InShellReport"
        name="6. In-shell Report view (variant=report)"
        component={InShellReport}
        layout={{ x: 0, y: 5850, width: 1440, height: 1600 }}
      />
      <Storyboard
        id="DetailRouteLoading"
        name="7. Detail route — loading"
        component={LoadingScreen}
        layout={{ x: 0, y: 7500, width: 1000, height: 700 }}
      />
      <Storyboard
        id="DetailRouteError"
        name="8. Detail route — load error"
        component={DetailRouteError}
        layout={{ x: 0, y: 8250, width: 1000, height: 700 }}
      />
      <Storyboard
        id="DetailRouteNotFound"
        name="9. Detail route — not found"
        component={DetailRouteNotFound}
        layout={{ x: 0, y: 9000, width: 1000, height: 700 }}
      />
      <Storyboard
        id="ReportProcessing"
        name="10. Report generation — processing"
        component={ReportProcessing}
        layout={{ x: 0, y: 9750, width: 1000, height: 800 }}
      />
      <Storyboard
        id="ReportErrorPreliminary"
        name="11. Report generation — error, preliminary scores available"
        component={ReportErrorPreliminary}
        layout={{ x: 0, y: 10600, width: 1000, height: 900 }}
      />
    </Canvas>
  );
}
