import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import Login from "@/auth/Login";

export const metadata: Metadata = {
  title: "Log In | HireStepX",
  description:
    "Log in to your HireStepX account to continue practicing interviews.",
};

export default function Page() {
  return (
    <AuthSkin top={<>New here?<a href="/signup">Sign up free</a></>} headline={<>Pick up where you left off.</>} sub="Your reports and scores are waiting. Candidates and companies log in here.">
      <Login />
    </AuthSkin>
  );
}
