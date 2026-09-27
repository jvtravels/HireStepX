/* SessionsV2 canvas harness — mounts the real production SessionsV2Screen
   inside the real production sidebar shell (DashboardLayout), under mock
   Auth/Sessions/Subscription/UI/Core context values instead of the real
   AuthProvider/DashboardProvider (which perform live Supabase calls). This
   is the escape hatch for components whose only external dependencies are
   context hooks with no prop-driven equivalent. */
import { AuthContext } from "@/AuthContext";
import { SessionsContext, SubscriptionContext, UIContext, CoreContext } from "@/DashboardContext";
import SessionsV2 from "@/SessionsV2";
import DashboardLayout from "@/DashboardLayout";
import {
  MOCK_AUTH_VALUE,
  mockSessionsValue,
  MOCK_SUBSCRIPTION_VALUE,
  MOCK_UI_VALUE,
  MOCK_CORE_VALUE,
} from "./sessionsV2Fixtures";
import type { SessionsContextValue } from "@/DashboardContext";

export default function SessionsV2Harness({
  sessionsOverrides,
}: {
  sessionsOverrides: Partial<SessionsContextValue>;
}) {
  return (
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <SessionsContext.Provider value={mockSessionsValue(sessionsOverrides)}>
        <SubscriptionContext.Provider value={MOCK_SUBSCRIPTION_VALUE}>
          <UIContext.Provider value={MOCK_UI_VALUE}>
            <CoreContext.Provider value={MOCK_CORE_VALUE}>
              <DashboardLayout>
                <SessionsV2 />
              </DashboardLayout>
            </CoreContext.Provider>
          </UIContext.Provider>
        </SubscriptionContext.Provider>
      </SessionsContext.Provider>
    </AuthContext.Provider>
  );
}
