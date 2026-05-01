import type { Metadata } from "next";
import ForgotPassword from "@/auth/ForgotPassword";

export const metadata: Metadata = {
  title: "Reset Password | HireStepX",
  description:
    "Enter your account email and we'll send you a link to reset your password.",
};

export default function Page() {
  return <ForgotPassword />;
}
