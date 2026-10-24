import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import { StagingLoginForm } from "@/home2/AuthForms";
import Login from "@/auth/Login";

export const metadata: Metadata = {
  title: "Log In | HireStepX",
  description:
    "Log in to your HireStepX account to continue practicing interviews.",
};

export default function Page() {
  return (
    <AuthSkin staging={<StagingLoginForm />} top={<>New here?<a href="/signup">Sign up free</a></>}>
      <Login />
    </AuthSkin>
  );
}
