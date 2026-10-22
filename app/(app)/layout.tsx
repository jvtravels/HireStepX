import AnalyticsNonce from "../AnalyticsNonce";
import AppShell from "./AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsNonce />
      <AppShell>{children}</AppShell>
    </>
  );
}
