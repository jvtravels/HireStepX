import SessionsV2Harness from "./SessionsV2Harness";
import { FEW_DASHBOARD_SESSIONS } from "./sessionsV2Fixtures";

export default function V2ListFew() {
  return <SessionsV2Harness sessionsOverrides={{ recentSessions: FEW_DASHBOARD_SESSIONS }} />;
}
