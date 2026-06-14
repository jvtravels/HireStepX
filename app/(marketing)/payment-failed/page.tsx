import type { Metadata } from "next";
import { PaymentFailedPage } from "@/marketing-v2/MarketingPagesV2";

export const metadata: Metadata = {
  title: "Payment Failed | HireStepX",
  description: "Your payment didn't go through. Your money has not been debited. You can try again safely.",
  robots: { index: false },
};

export default function Page() {
  return <PaymentFailedPage />;
}
