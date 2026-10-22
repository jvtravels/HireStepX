/* ResumeV2 canvas harness — mounts the real production ResumeV2 screen
   under mock AuthContext/UIContext values instead of the real
   AuthProvider/DashboardProvider (which perform live Supabase calls). This
   is the escape hatch for a component whose only external dependencies are
   two context hooks with no prop-driven equivalent. */
import { AuthContext } from "@/AuthContext";
import { UIContext, CoreContext } from "@/DashboardContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import ResumeV2 from "@/ResumeV2";
import { MOCK_AUTH_VALUE, MOCK_UI_VALUE, MOCK_CORE_VALUE } from "./resumeV2Fixtures";

export default function ResumeV2Harness() {
  return (
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <UIContext.Provider value={MOCK_UI_VALUE}>
        <CoreContext.Provider value={MOCK_CORE_VALUE}>
          <SidebarProvider>
            <ResumeV2 />
          </SidebarProvider>
        </CoreContext.Provider>
      </UIContext.Provider>
    </AuthContext.Provider>
  );
}
