/* HireStepX — Design System / Feedback & Loading
   Toast (sonner), Skeleton, Spinner, Empty, Collapsible, Aspect Ratio,
   Scroll Area. The vocabulary for "something is loading / something
   happened / there's nothing here yet." */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronsUpDown, Inbox, ImageIcon } from "lucide-react";

export default function DesignSystemFeedback() {
  const [open, setOpen] = React.useState(false);
  return (
    <PageShell>
      <PageHeader
        title="Feedback & loading."
        description="Toast, Skeleton, Spinner, Empty, Collapsible, Aspect Ratio, Scroll Area — what the interface shows while working, when something happens, and when there's nothing yet."
      />
      <Toaster />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="Toast" desc="Transient feedback (sonner-based) — not for anything the user must acknowledge (use Alert Dialog)." />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="outline" onClick={() => toast("Session saved.")}>Show toast</Button>
            <Button variant="outline" onClick={() => toast.success("Report ready — score 78/100")}>Success toast</Button>
            <Button variant="outline" onClick={() => toast.error("Couldn't reach the STT service.")}>Error toast</Button>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="02" title="Skeleton & Spinner" desc="Skeleton for layout-shaped loading; Spinner for an inline/indeterminate wait." />
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div className="flex flex-col gap-2 w-56">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Button variant="outline" disabled><Spinner className="mr-2" />Scoring…</Button>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="03" title="Empty" desc="No-data state — icon, title, description, optional action." />
          <Empty className="max-w-sm">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
              <EmptyTitle>No interviews yet</EmptyTitle>
              <EmptyDescription>Start your first mock interview to see it here.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm">Start interview</Button>
            </EmptyContent>
          </Empty>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="04" title="Collapsible" desc="Single expand/collapse — for one section, not a list (use Accordion)." />
          <Collapsible open={open} onOpenChange={setOpen} className="w-80">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Show scoring rubric</span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon"><ChevronsUpDown className="size-4" /></Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 text-sm text-muted-foreground border-t border-border pt-2">
              Structure (STAR) 40% · Relevance 30% · Delivery 20% · Confidence 10%.
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="05" title="Aspect Ratio" desc="Locks a media box's ratio — e.g. a company logo tile or video thumbnail." />
          <div className="w-56">
            <AspectRatio ratio={16 / 9} className="bg-muted rounded-md flex items-center justify-center">
              <ImageIcon className="text-muted-foreground size-6" />
            </AspectRatio>
          </div>
        </section>

        <section>
          <SectionHead num="06" title="Scroll Area" desc="Styled scrollbar over a fixed-height region — the transcript panel's real scroll container." />
          <ScrollArea className="h-40 w-72 rounded-md border border-border p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <p key={i} className="text-sm text-muted-foreground py-1">Transcript line {i + 1} — the candidate's answer continues here.</p>
            ))}
          </ScrollArea>
        </section>
      </div>
      <Footer section="Feedback & Loading" tagline="Try the toast buttons." />
    </PageShell>
  );
}
