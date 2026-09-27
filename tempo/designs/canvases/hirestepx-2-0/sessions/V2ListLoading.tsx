import SessionsV2Harness from "./SessionsV2Harness";

export default function V2ListLoading() {
  return <SessionsV2Harness sessionsOverrides={{ sessionsLoading: true }} />;
}
