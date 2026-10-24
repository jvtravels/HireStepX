import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import ForgotPassword from "@/auth/ForgotPassword";

export const metadata: Metadata = {
  title: "Reset Password | HireStepX",
  description:
    "Enter your account email and we'll send you a link to reset your password.",
};

export default function Page() {
  return (
    <AuthSkin top={<>Remembered it?<a href="/login">Log in</a></>}>
      <ForgotPassword />
    </AuthSkin>
  );
}
