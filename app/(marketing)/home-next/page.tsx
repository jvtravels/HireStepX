import type { Metadata } from "next";
import Homepage2 from "@/home2/Homepage";

export const metadata: Metadata = {
  title: "HireStepX",
  alternates: { canonical: "/" },
};

export default function Page() {
  return <Homepage2 />;
}
