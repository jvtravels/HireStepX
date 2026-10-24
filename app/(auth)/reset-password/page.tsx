import type { Metadata } from "next";
import { AuthSkin } from "@/home2/AuthSkin";
import ResetPassword from "@/ResetPassword";

export const metadata: Metadata = {
  title: "Reset Password | HireStepX",
  description: "Reset your HireStepX account password.",
};

export default function Page() {
  return (
    <AuthSkin>
      <ResetPassword />
    </AuthSkin>
  );
}
