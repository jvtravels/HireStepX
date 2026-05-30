import type { Metadata } from "next";
import { CompareChatGPTV2 } from "@/marketing-v2/MarketingPagesV2";
import { breadcrumb, ldJson } from "@/marketing-v2/_schema";

export const metadata: Metadata = {
  title: "HireStepX vs ChatGPT for interview practice",
  description:
    "Honest, side-by-side comparison. Voice vs text, scored STAR vs prose feedback, resume-personalised vs generic, spaced repetition vs none.",
  alternates: { canonical: "/compare/chatgpt" },
};

export const dynamic = "force-static";
export const revalidate = 3600;

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldJson(
          breadcrumb([
            { name: "Compare", path: "/compare/chatgpt" },
            { name: "ChatGPT", path: "/compare/chatgpt" },
          ]),
        )}
      />
      <CompareChatGPTV2 />
    </>
  );
}
