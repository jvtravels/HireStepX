import { LoadErrorScreen } from "@/SessionDetail";

export default function DetailRouteError() {
  return (
    <LoadErrorScreen
      message="fetch failed: /api/sessions/rich-strong (timeout after 8000ms)"
      onRetry={() => {}}
      onBack={() => {}}
    />
  );
}
