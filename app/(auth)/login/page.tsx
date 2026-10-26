import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import { StagingLoginForm, AuthSwitchLink } from "@/home2/AuthForms";
import { Suspense } from "react";
import Login from "@/auth/Login";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Log In | HireStepX",
  description:
    "Log in to your HireStepX account to continue practicing interviews.",
};

export default function Page() {
  return (
    <AuthSkin staging={<StagingLoginForm />} top={<Suspense fallback={null}><AuthSwitchLink to="/signup" lead="New here? " label="Sign up free" /></Suspense>}>
      <Login />
    </AuthSkin>
  );
}
