import AnalyticsNonce from "../AnalyticsNonce";
import AuthShellLoader from "./AuthShellLoader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnalyticsNonce />
      <AuthShellLoader>{children}</AuthShellLoader>
    </>
  );
}
