/* HireStepX — Design System / Themes
   Light & dark mode, side by side, driven by the same shadcnTheme /
   darkShadcnTheme CSS-variable objects every other storyboard consumes.
   No new components here — same shadcn/ui primitives, both bodies just
   swap which theme object drives their CSS variables.

   The canvas for these components is this folder's index.canvas.tsx. If you
   adjust a component here, keep its defineAsset declaration in sync. */
import React, { useState } from "react";
import "../../../public/fonts/af-sobremesa.css";
import { fonts as f, radius, shadcnTheme, darkShadcnTheme } from "./_tokens";
import { PageShell, PageHeader, SectionHead, Footer, StatePanel } from "./_atoms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Info, Sun, Moon } from "lucide-react";

/* ─── One theme's live body — buttons, badges, a card, an alert, a form
   field, all reading their colors off CSS variables so flipping `theme`
   between shadcnTheme and darkShadcnTheme repaints every element ─── */
function ThemeBody({
  theme,
  mode,
}: {
  theme: Record<string, string>;
  mode: "light" | "dark";
}) {
  return (
    <div
      style={{ ...theme, borderRadius: radius.lg }}
      className={`${mode === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} bg-background text-foreground border border-border p-8 flex flex-col gap-6`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode === "dark" ? (
            <Moon className="size-4 text-muted-foreground" />
          ) : (
            <Sun className="size-4 text-muted-foreground" />
          )}
          <span
            style={{ fontFamily: f.mono, letterSpacing: "0.08em" }}
            className="text-xs uppercase text-muted-foreground"
          >
            {mode === "dark" ? "Dark body" : "Light body"}
          </span>
        </div>
        <Badge variant="secondary">bg-background</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button>Continue to practise →</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="outline">Outline</Button>
        {/* The real Button ships default/secondary/outline/ghost/destructive/link — no
            "copper" variant. `default` already renders copper under this theme's
            --primary mapping, so it's the right choice for the accent CTA here. */}
        <Button>Upgrade to Pro</Button>
        <Button variant="destructive">Delete account</Button>
      </div>

      <Card className="bg-card text-card-foreground border-border">
        <CardHeader>
          <CardTitle>Behavioral interview</CardTitle>
          <CardDescription>Scheduled session, tailored to your resume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>JV</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Badge>Confirmed</Badge>
              <Progress value={62} className="w-40" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button size="sm" variant="outline">
            Reschedule
          </Button>
        </CardFooter>
      </Card>

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Need time to prepare?</AlertTitle>
        <AlertDescription>
          The board is yours until you're ready — nothing here starts automatically.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <Label htmlFor={`email-${mode}`}>Email address</Label>
        <Input id={`email-${mode}`} placeholder="jv@hirestepx.com" />
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemThemes() {
  const [active, setActive] = useState<"light" | "dark" | "both">("both");

  return (
    <PageShell>
        <PageHeader
          eyebrow="Design System · v1.0 · Theming"
          title="Light body, dark body."
          description="Every primitive in this system reads its colors off shadcnTheme's CSS variables — never a hardcoded hex. Swapping the theme object swaps the whole body: background, card, border, text, and the one accent (copper) repaint together. Indigo plays no role in this UI chrome — it's reserved for data viz."
          metaRight={
            <>
              _tokens.ts
              <br />
              shadcnTheme · darkShadcnTheme
            </>
          }
        />

        {/* 01 — TOGGLE */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="01"
            title="Toggle"
            desc="One state variable, two CSS-variable objects — nothing else changes."
          />
          <StatePanel title="View">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={active === "light" ? "default" : "outline"}
                onClick={() => setActive("light")}
              >
                Light only
              </Button>
              <Button
                size="sm"
                variant={active === "dark" ? "default" : "outline"}
                onClick={() => setActive("dark")}
              >
                Dark only
              </Button>
              <Button
                size="sm"
                variant={active === "both" ? "default" : "outline"}
                onClick={() => setActive("both")}
              >
                Side by side
              </Button>
            </div>
          </StatePanel>
        </section>

        {/* 02 — BODIES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Bodies"
            desc="Same components, same tokens file — only the theme object changes."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: active === "both" ? "1fr 1fr" : "1fr",
              gap: 24,
            }}
          >
            {(active === "light" || active === "both") && (
              <ThemeBody theme={shadcnTheme} mode="light" />
            )}
            {(active === "dark" || active === "both") && (
              <ThemeBody theme={darkShadcnTheme} mode="dark" />
            )}
          </div>
        </section>

        <Footer section="Themes" tagline="Light body · dark body · one source of truth" />
    </PageShell>
  );
}
