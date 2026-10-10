"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmployerData } from "@/employer/EmployerDataContext";

export function ResumeDownload({ matchId, fileName, size = "default" }: { matchId: string; fileName: string; size?: "default" | "sm" }) {
  const { fetchCandidateResumeUrl } = useEmployerData();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    const file = await fetchCandidateResumeUrl(matchId);
    setBusy(false);
    if (!file) {
      setFailed(true);
      return;
    }
    window.location.assign(file.url);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" size={size} onClick={() => void download()} disabled={busy} title={fileName} className="pointer-coarse:h-11">
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
        Download resume
      </Button>
      <p role="status" className="text-xs text-destructive empty:hidden">{failed ? "Couldn't prepare the file. Try again." : ""}</p>
    </div>
  );
}
