import type { Metadata } from "next";
import SessionHistoryDesign from "@/SessionHistoryDesign";

export const metadata: Metadata = {
  title: "Sessions | HireStepX",
  description:
    "View your past interview practice sessions and feedback.",
};

export default function Page() {
  return <SessionHistoryDesign />;
}
