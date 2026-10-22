/* HireStepX — Design System / Components
   Real shadcn/ui primitives (Button, Input, Card, Badge, Avatar, Alert,
   Progress, Checkbox, RadioGroup) imported directly from the project's
   production library at src/components/ui — never a canvas-local fork.
   Restrained neutral grays do almost all the work; copper is the one
   accent, reserved for the one primary action/state per surface — never
   used decoratively. No hand-rolled look-alikes, no beige. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, type, shadcnTheme } from "./_tokens";
import { MonoLabel, SectionHead, Footer, StatePanel, PageShell, PageHeader } from "./_atoms";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Info, CheckCircle2, AlertTriangle, XCircle, Eye } from "lucide-react";

function StateRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        alignItems: "center",
        gap: 20,
        padding: "14px 0",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          color: t.inkSoft,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemComponents() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Design System · v2.0 · shadcn/ui"
        title="Components, by state."
        description="Built on the real shadcn/ui primitives (Radix + cva) this project ships in src/components/ui — not look-alikes. Copper is the one accent, reserved for the primary action per surface; everything else stays neutral. No beige."
      />

      <div style={shadcnTheme} className="[color-scheme:light]">
          {/* 01 — BUTTONS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="01"
              title="Buttons"
              desc="shadcn Button — five variants, five sizes, every interaction state."
            />
            <div style={{ display: "grid", gap: 16 }}>
              <StatePanel title="Variants">
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Continue to practise →</Button>
                  <Button variant="secondary">Cancel</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Skip for now</Button>
                  <Button variant="destructive">Delete account</Button>
                  <Button variant="link">Forgot password?</Button>
                </div>
                <p
                  style={{
                    fontSize: type.small.size,
                    color: t.inkMuted,
                    marginTop: 16,
                    marginBottom: 0,
                    lineHeight: 1.6,
                  }}
                >
                  <b>Default</b> renders in copper under this theme's token
                  mapping — the one primary CTA per surface. Secondary,
                  outline, ghost, and link stay neutral for everything else.
                  The real Button has no separate "copper" variant — reach
                  for <b>default</b> whenever copper is the intent.
                </p>
              </StatePanel>

              <StatePanel title="Sizes">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs">Extra small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Settings">
                    <Eye />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Dismiss">
                    <Eye />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Close">
                    <Eye />
                  </Button>
                  <Button size="icon-lg" className="rounded-full" aria-label="Help">
                    <Eye />
                  </Button>
                </div>
                <p
                  style={{
                    fontSize: type.small.size,
                    color: t.inkMuted,
                    marginTop: 16,
                    marginBottom: 0,
                    lineHeight: 1.6,
                  }}
                >
                  <b>icon-xs / icon-sm / icon-lg</b> round out the icon step —
                  dismiss controls, panel-close affordances, and a floating
                  action button all reach for one of these instead of a raw
                  sized <code>&lt;button&gt;</code>.
                </p>
              </StatePanel>

              <StatePanel title="Button Group">
                <ButtonGroup>
                  <Button variant="outline">Behavioral</Button>
                  <Button variant="outline">Technical</Button>
                  <Button variant="outline">Negotiation</Button>
                </ButtonGroup>
              </StatePanel>

              <StatePanel title="States">
                <StateRow label="Default">
                  <Button>Continue</Button>
                </StateRow>
                <StateRow label="Focus">
                  <Button className="border-ring ring-3 ring-ring/50">
                    Continue
                  </Button>
                </StateRow>
                <StateRow label="Disabled">
                  <Button disabled>Continue</Button>
                </StateRow>
                <StateRow label="Loading">
                  <Button disabled>
                    <span className="border-primary-foreground/30 border-t-primary-foreground size-3.5 animate-spin rounded-full border-2" />
                    Saving…
                  </Button>
                </StateRow>
                <StateRow label="Success">
                  <Button className="bg-[--color-success,#15803D] hover:bg-[--color-success,#15803D]">
                    <CheckCircle2 /> Saved
                  </Button>
                </StateRow>
                <StateRow label="Invalid">
                  <Button aria-invalid>Retry</Button>
                </StateRow>
              </StatePanel>
            </div>
          </section>

          {/* 02 — INPUTS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="02"
              title="Inputs"
              desc="shadcn Input + Label. Every form state, no invented markup."
            />
            <div className="grid grid-cols-2 gap-4">
              <StatePanel title="Default">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-default">Email address</Label>
                  <Input id="email-default" type="email" defaultValue="jay@hirestepx.com" />
                </div>
              </StatePanel>

              <StatePanel title="Focused">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-focus">Email address</Label>
                  <Input
                    id="email-focus"
                    type="email"
                    defaultValue="jay@hirestepx.com"
                    className="border-ring ring-3 ring-ring/50"
                  />
                </div>
              </StatePanel>

              <StatePanel title="Valid · live ✓">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-valid">Email address</Label>
                  <div className="relative">
                    <Input id="email-valid" type="email" defaultValue="jay@hirestepx.com" className="pr-9" />
                    <CheckCircle2 className="text-[color:var(--color-success,#15803D)] absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                  </div>
                </div>
              </StatePanel>

              <StatePanel title="Error">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-error">Email address</Label>
                  <Input
                    id="email-error"
                    type="email"
                    defaultValue="not-an-email"
                    aria-invalid
                  />
                  <p className="text-destructive text-xs font-medium">
                    Please enter a valid email.
                  </p>
                </div>
              </StatePanel>

              <StatePanel title="Password · with toggle">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type="password" defaultValue="securepass123" className="pr-9" />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Show password"
                      className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                    >
                      <Eye className="size-4" />
                    </Button>
                  </div>
                </div>
              </StatePanel>

              <StatePanel title="Disabled">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email-disabled" className="text-muted-foreground">
                    Email address
                  </Label>
                  <Input id="email-disabled" type="email" defaultValue="locked@email.com" disabled />
                </div>
              </StatePanel>
            </div>
          </section>

          {/* 03 — CARDS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="03"
              title="Cards"
              desc="shadcn Card. Default, muted, and a copper-accent elevation."
            />
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-7">
                <MonoLabel>Default · interactive</MonoLabel>
                <h3 style={{ fontFamily: f.sans, fontSize: type.h3.size, fontWeight: type.h3.weight, lineHeight: type.h3.lineHeight, margin: "12px 0 8px" }}>
                  Behavioral interview
                </h3>
                <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                  15-minute session. Questions tailored to your resume.
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge>15 min</Badge>
                  <Badge variant="secondary">Standard</Badge>
                </div>
              </Card>

              <Card className="bg-muted/40 p-7 shadow-none">
                <MonoLabel>Muted · informational</MonoLabel>
                <h3 style={{ fontFamily: f.sans, fontSize: type.h3.size, fontWeight: type.h3.weight, lineHeight: type.h3.lineHeight, margin: "12px 0 8px" }}>
                  Your weakest area
                </h3>
                <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                  Salary negotiation — practice this 3 more times.
                </p>
              </Card>

              <Card className="border-[var(--copper)]/30 bg-[var(--copper)]/[0.06] p-7">
                <MonoLabel color={t.copper}>Accent · premium</MonoLabel>
                <h3 style={{ fontFamily: f.sans, fontSize: type.h3.size, fontWeight: type.h3.weight, lineHeight: type.h3.lineHeight, margin: "12px 0 8px", color: t.copper }}>
                  Pro plan
                </h3>
                <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                  Unlimited interviews. AI feedback. Priority support.
                </p>
                <Button size="sm" className="mt-4">
                  Upgrade
                </Button>
              </Card>
            </div>
          </section>

          {/* 04 — BADGES */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="04"
              title="Badges"
              desc="shadcn Badge. Default now renders in copper — used sparingly for the one thing worth flagging; the rest stay neutral or status-driven."
            />
            <StatePanel title="Variants">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge className="bg-[color:var(--color-success,#15803D)] border-transparent">✓ Verified</Badge>
                <Badge variant="secondary">15 min</Badge>
                <Badge>Fair · 62/100</Badge>
                <Badge className="bg-[color:var(--color-warning,#A16207)] border-transparent">3 sessions left</Badge>
                <Badge variant="destructive">Subscription expired</Badge>
                <Badge variant="outline">Behavioral</Badge>
                <Badge variant="outline">SaaS · AI</Badge>
              </div>
            </StatePanel>
          </section>

          {/* 05 — AVATARS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="05"
              title="Avatars"
              desc="shadcn Avatar. Initials on a neutral secondary tint, or copper-soft for the current user."
            />
            <StatePanel title="Sizes & variants">
              <div className="flex items-center gap-6">
                <Avatar size="sm"><AvatarFallback className="text-xs">JV</AvatarFallback></Avatar>
                <Avatar><AvatarFallback>JV</AvatarFallback></Avatar>
                <Avatar size="lg"><AvatarFallback className="text-lg">JV</AvatarFallback></Avatar>
                <div className="bg-border h-14 w-px" />
                <Avatar><AvatarFallback className="bg-[var(--copper)]/10 text-[var(--copper)]">AM</AvatarFallback></Avatar>
                <Avatar size="lg"><AvatarFallback className="bg-[var(--copper)]/10 text-[var(--copper)] text-lg">AM</AvatarFallback></Avatar>
              </div>
              <p style={{ fontSize: type.small.size, color: t.inkMuted, marginTop: 20, marginBottom: 0, lineHeight: 1.6 }}>
                Default avatars use the neutral secondary tint. Copper is
                reserved for the current-user moment — top-right header,
                settings, profile. Never both on the same screen. The real
                Avatar exposes sm/default/lg sizes via a `size` prop rather
                than raw `size-*` classes.
              </p>
            </StatePanel>
          </section>

          {/* 06 — ALERTS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="06"
              title="Alerts"
              desc="shadcn Alert. Inline notifications, semantic icons, no beige tint."
            />
            <div className="grid gap-3">
              <Alert>
                <CheckCircle2 />
                <AlertTitle>Reset link sent.</AlertTitle>
                <AlertDescription>Check your inbox — it usually arrives within 30 seconds.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <XCircle />
                <AlertTitle>Couldn't sign you in.</AlertTitle>
                <AlertDescription>The email or password you entered doesn't match our records.</AlertDescription>
              </Alert>
              <Alert>
                <AlertTriangle />
                <AlertTitle>Subscription expires in 3 days.</AlertTitle>
                <AlertDescription>Renew now to keep unlimited interview access.</AlertDescription>
              </Alert>
              {/* The real Alert ships default/destructive only — no "copper"
                  variant. `default` already renders copper under this
                  theme's --primary mapping, so it's the right choice here. */}
              <Alert className="border-[var(--copper)]/30 bg-[var(--copper)]/10 text-[var(--copper)] [&>svg]:text-[var(--copper)]">
                <Info />
                <AlertTitle>New: Salary negotiation mode.</AlertTitle>
                <AlertDescription className="text-[var(--copper)]/80">Practice realistic offer conversations with phase-aware AI.</AlertDescription>
              </Alert>
            </div>
          </section>

          {/* 07 — PROGRESS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="07"
              title="Progress"
              desc="shadcn Progress. Copper fill on a neutral track."
            />
            <div className="grid grid-cols-2 gap-4">
              <StatePanel title="Linear · 4 segments">
                {[
                  { label: "Weak", pct: 25 },
                  { label: "Fair", pct: 50 },
                  { label: "Good", pct: 75 },
                  { label: "Strong", pct: 100 },
                ].map((row) => (
                  <div key={row.label} className="mb-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span style={{ color: t.coal, fontWeight: 500 }}>{row.label}</span>
                      <span style={{ color: t.inkSoft, fontFamily: f.mono }}>{row.pct}%</span>
                    </div>
                    <Progress value={row.pct} />
                  </div>
                ))}
              </StatePanel>

              <StatePanel title="Score arc · circular">
                <div style={{ position: "relative", width: 200, height: 120, margin: "0 auto" }}>
                  <svg width="200" height="120" viewBox="0 0 200 120">
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={t.creamSoft} strokeWidth="10" strokeLinecap="round" />
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={t.copper} strokeWidth="10" strokeLinecap="round" strokeDasharray="155 1000" />
                  </svg>
                  <div style={{ position: "absolute", top: 28, left: 0, right: 0, textAlign: "center" }}>
                    <MonoLabel>Clarity</MonoLabel>
                    <div style={{ fontFamily: f.sans, fontSize: 32, fontWeight: 600, lineHeight: 1, color: t.copper, marginTop: 4, letterSpacing: "-0.01em" }}>
                      62
                    </div>
                  </div>
                </div>
              </StatePanel>
            </div>
          </section>

          {/* 08 — CHECKBOXES + RADIOS */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="08"
              title="Checkboxes & radios"
              desc="shadcn Checkbox / Switch / RadioGroup — real Radix primitives. Copper when checked."
            />
            <div className="grid grid-cols-3 gap-4">
              <StatePanel title="Switches">
                {[
                  { label: "Practice reminders", checked: true },
                  { label: "Share progress with mentor", checked: false },
                ].map((row, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 py-2 text-sm" style={{ color: t.coal }}>
                    <Switch defaultChecked={row.checked} />
                    {row.label}
                  </label>
                ))}
              </StatePanel>

              <StatePanel title="Checkboxes">
                {[
                  { label: "Stay signed in on this device", checked: true },
                  { label: "Email me weekly tips", checked: false },
                  { label: "Use my resume for personalization", checked: true },
                ].map((row, i) => (
                  <label key={i} className="flex cursor-pointer items-center gap-3 py-2 text-sm" style={{ color: t.coal }}>
                    <Checkbox defaultChecked={row.checked} />
                    {row.label}
                  </label>
                ))}
              </StatePanel>

              <StatePanel title="Radios">
                <RadioGroup defaultValue="behavioral">
                  {[
                    { label: "Behavioral interview", value: "behavioral" },
                    { label: "Technical leadership", value: "technical" },
                    { label: "Salary negotiation", value: "negotiation" },
                  ].map((row) => (
                    <label key={row.value} className="flex cursor-pointer items-center gap-3 py-2 text-sm" style={{ color: t.coal }}>
                      <RadioGroupItem value={row.value} />
                      {row.label}
                    </label>
                  ))}
                </RadioGroup>
              </StatePanel>
            </div>
          </section>

          {/* 09 — BREADCRUMB */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="09"
              title="Breadcrumb"
              desc="shadcn Breadcrumb — composed from List/Item/Link/Page/Separator, not a string-array prop."
            />
            <StatePanel title="Default">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Settings</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </StatePanel>
          </section>

          {/* 10 — EMPTY STATE */}
          <section style={{ marginBottom: 56 }}>
            <SectionHead
              num="10"
              title="Empty state"
              desc="Calm, instructive, single primary CTA. Copper icon, no beige fill."
            />
            <Card className="p-10 text-center">
              <div className="bg-[var(--copper)]/10 text-[var(--copper)] mx-auto mb-5 flex size-14 items-center justify-center rounded-full">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <h3 style={{ fontFamily: f.sans, fontSize: type.h2.size, fontWeight: type.h2.weight, lineHeight: type.h2.lineHeight, margin: "0 0 8px", letterSpacing: type.h2.letterSpacing }}>
                No interviews yet.
              </h3>
              <p style={{ color: t.inkMuted, fontSize: type.body.size, margin: "0 0 24px", maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
                Run your first mock interview in 90 seconds. Three free
                sessions, no card needed.
              </p>
              <Button size="lg">Start your first interview →</Button>
            </Card>
          </section>
        </div>

      {/* FOOTER */}
      <Footer section="Section" tagline="Built on real shadcn/ui primitives. Never invented." />
    </PageShell>
  );
}
