import { Canvas, Storyboard } from "tempo-sdk/canvas";
import V2ListLoading from "./V2ListLoading";
import V2ListEmpty from "./V2ListEmpty";
import V2ListFew from "./V2ListFew";
import V2ListPopulated from "./V2ListPopulated";

export default function SessionsCanvas() {
  return (
    <Canvas name="sessions" backgroundColor="#232323">
      {/* SessionsV2 is the CURRENT production /sessions component (see
         app/(app)/(dashboard)/sessions/page.tsx). It only needs two context
         hooks (useAuth, useDashboardSessions) with no prop-driven equivalent,
         and the real providers behind them make live Supabase calls — so
         each storyboard here mounts the real SessionsV2 under a mock
         AuthContext/SessionsContext value via SessionsV2Harness instead. */}
      <Storyboard
        id="V2ListLoading"
        name="SessionsV2 — loading skeleton"
        component={V2ListLoading}
        layout={{ x: 0, y: 0, width: 1728, height: 960, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="V2ListEmpty"
        name="SessionsV2 — empty (no sessions yet)"
        component={V2ListEmpty}
        layout={{ x: 1800, y: 0, width: 1728, height: 960, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="V2ListFew"
        name="SessionsV2 — few sessions"
        component={V2ListFew}
        layout={{ x: 0, y: 1050, width: 1728, height: 960, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="V2ListPopulated"
        name="SessionsV2 — populated, every score band + campus + no-company row"
        component={V2ListPopulated}
        layout={{ x: 1800, y: 2137, width: 1728, height: 960, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
