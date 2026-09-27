/* SessionsV2 canvas harness — mounts the real production SessionsV2Screen
   under mock AuthContext/SessionsContext values instead of the real
   AuthProvider/DashboardProvider (which perform live Supabase calls). This
   is the escape hatch for a component whose only external dependencies are
   two context hooks with no prop-driven equivalent. */
import { AuthContext } from "@/AuthContext";
import { SessionsContext } from "@/DashboardContext";
import SessionsV2 from "@/SessionsV2";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MOCK_AUTH_VALUE, mockSessionsValue } from "./sessionsV2Fixtures";
import type { SessionsContextValue } from "@/DashboardContext";

export default function SessionsV2Harness({
  sessionsOverrides,
}: {
  sessionsOverrides: Partial<SessionsContextValue>;
}) {
  return (
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <SessionsContext.Provider value={mockSessionsValue(sessionsOverrides)}>
        <SidebarProvider>
          <SessionsV2 />
        </SidebarProvider>
      </SessionsContext.Provider>
    </AuthContext.Provider>
  );
}
