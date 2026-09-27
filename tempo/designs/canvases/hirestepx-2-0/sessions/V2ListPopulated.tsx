import SessionsV2Harness from "./SessionsV2Harness";
import { RICH_DASHBOARD_SESSIONS } from "./sessionsV2Fixtures";

export default function V2ListPopulated() {
  return <SessionsV2Harness sessionsOverrides={{ recentSessions: RICH_DASHBOARD_SESSIONS }} />;
}
