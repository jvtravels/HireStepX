import SessionsV2Harness from "./SessionsV2Harness";

export default function V2ListEmpty() {
  return <SessionsV2Harness sessionsOverrides={{ recentSessions: [] }} />;
}
