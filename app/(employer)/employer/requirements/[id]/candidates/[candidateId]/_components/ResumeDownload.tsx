"use client";

import { Download } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/Toast";
import { useEmployerData } from "@/employer/EmployerDataContext";

/* Lives in the header's More menu so the one primary action stays the invite. */
export function ResumeDownloadItem({ matchId, fileName }: { matchId: string; fileName: string }) {
  const { fetchCandidateResumeUrl } = useEmployerData();
  const { toast } = useToast();

  async function download() {
    const file = await fetchCandidateResumeUrl(matchId);
    if (!file) {
      toast("Couldn't prepare the file. Try again.", "error");
      return;
    }
    window.location.assign(file.url);
  }

  return (
    <DropdownMenuItem title={fileName} onSelect={() => void download()}>
      <Download size={14} aria-hidden="true" /> Download resume
    </DropdownMenuItem>
  );
}
