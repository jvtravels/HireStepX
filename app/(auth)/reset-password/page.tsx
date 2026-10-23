import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import ResetPassword from "@/ResetPassword";

export const metadata: Metadata = {
  title: "Reset Password | HireStepX",
  description: "Reset your HireStepX account password.",
};

export default function Page() {
  return (
    <AuthSkin top={<>Remembered it?<a href="/login">Log in</a></>} headline={<>Back in a minute.</>} sub="Choose a new password. Your reports and scores stay exactly as they were.">
      <ResetPassword />
    </AuthSkin>
  );
}
