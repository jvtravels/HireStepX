import type { Metadata } from "next";
import SessionHistoryRoute from "@/SessionHistoryRoute";

export const metadata: Metadata = {
  title: "Sessions | HireStepX",
  description:
    "View your past interview practice sessions and feedback.",
};

export default function Page() {
  return <SessionHistoryRoute />;
}
