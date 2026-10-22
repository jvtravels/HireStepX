"use client";

import { SendIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/* The header's actions: message the employer, plus the overflow menu that
   holds the interested / not interested answer. Wide screens show it in the
   header; narrow ones pin it to a bar so Message stays one tap away. */
export default function ResponseActions({ showMessage, onMessage, menu, fill }: {
  showMessage: boolean;
  onMessage: () => void;
  menu: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${fill ? "w-full" : "shrink-0"}`}>
      {showMessage && (
        <Button size="sm" onClick={onMessage} className={`flex items-center justify-center gap-1.5 ${fill ? "flex-1" : "shrink-0"}`}>
          <SendIcon size={13} aria-hidden="true" /> Message employer
        </Button>
      )}
      {menu}
    </div>
  );
}
