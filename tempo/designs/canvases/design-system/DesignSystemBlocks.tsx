/* HireStepX — Design System / Blocks
   shadcn.io-style composed page sections — not atoms, not a full page.
   Every block below is built ONLY from already-declared real components
   (Card, Field, Select, Table, Command, Empty, …); nothing here is a new
   primitive. Copy and data shapes are borrowed from the real product
   surfaces (DashboardHome, SessionSetup, SessionReportView) so these read
   as HireStepX blocks, not generic SaaS filler. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, type, shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { Inbox } from "lucide-react";

/* ─── Main ─── */
export default function DesignSystemBlocks() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Design System · v1.0"
        title="Blocks."
        description="Composed page sections built from the components above — settings forms, empty states, data tables. UI scaffolding only, no real logic. Grounded in HireStepX's actual dashboard, setup flow, and report copy."
      />

      <div style={shadcnTheme}>
        {/* 01 — SETTINGS / PROFILE FORM */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="01"
            title="Settings · profile form"
            desc="Field + Input + Avatar + Button. The shape of the account-settings page."
          />
          <Card className="max-w-[560px]">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>This is how coaches and shared reports will see your name.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="bg-[var(--copper)]/12 text-base text-[var(--copper)]">JV</AvatarFallback>
                </Avatar>
                <Button variant="outline" size="sm">
                  Change photo
                </Button>
              </div>
              <Field>
                <FieldLabel htmlFor="settings-name">Full name</FieldLabel>
                <Input id="settings-name" defaultValue="Jay Vyas" />
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-email">Email</FieldLabel>
                <Input id="settings-email" type="email" defaultValue="jay@hirestepx.com" disabled />
                <FieldDescription>Contact support to change your login email.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-role">Target role</FieldLabel>
                <Input id="settings-role" placeholder="e.g. Senior Engineering Manager…" defaultValue="Senior Product Manager" />
              </Field>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" size="sm">
                Cancel
              </Button>
              <Button size="sm">Save changes</Button>
            </CardFooter>
          </Card>
        </section>

        {/* 02 — INVITE A PRACTICE PARTNER */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="02"
            title="Invite a practice partner"
            desc="Select + Input + Button. Share a mock-interview session so a friend can sit in and give feedback."
          />
          <Card className="max-w-[560px]">
            <CardHeader>
              <CardTitle>Invite to your session</CardTitle>
              <CardDescription>They'll get a link to watch and leave comments — no account required.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input id="invite-email" type="email" placeholder="friend@example.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-access">Access level</FieldLabel>
                <Select defaultValue="viewer">
                  <SelectTrigger id="invite-access" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Can view report</SelectItem>
                    <SelectItem value="commenter">Can view and comment</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" size="sm">
                Cancel
              </Button>
              <Button size="sm">Send invite</Button>
            </CardFooter>
          </Card>
        </section>

        {/* 03 — LOGIN CARD */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="03"
            title="Login card"
            desc="Card + Input + Label + Button. The shape of the /login screen."
          />
          <Card className="max-w-[400px]">
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>Log in to pick up where you left off.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" placeholder="you@example.com" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input id="login-password" type="password" placeholder="••••••••" />
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button className="w-full">Log in</Button>
              <Separator />
              <Button variant="outline" className="w-full">
                Continue with Google
              </Button>
            </CardFooter>
          </Card>
        </section>

        {/* 04 — EMPTY STATE */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="04"
            title="Empty state"
            desc="Empty + Button. First-session onboarding — the exact copy shown when a new user has no sessions yet."
          />
          <Empty className="max-w-[560px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>No sessions yet</EmptyTitle>
              <EmptyDescription>
                Your first session takes 15 minutes. You'll get a score, STAR breakdown, and the exact
                phrases to improve — emailed to you right after.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm">
                Start your first free session
              </Button>
            </EmptyContent>
          </Empty>
        </section>

        {/* 05 — STATS / KPI ROW */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="05"
            title="Stats · KPI row"
            desc="Card + Badge. The three numbers at the top of the dashboard."
          />
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div style={{ fontSize: 12, color: t.inkSoft, marginBottom: 6 }}>Practice this week</div>
                <div style={{ fontFamily: f.sans, fontSize: type.h1.size, fontWeight: 600, color: t.coal }}>
                  12.4h
                </div>
                <Badge variant="secondary" className="mt-2">
                  78th percentile
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div style={{ fontSize: 12, color: t.inkSoft, marginBottom: 6 }}>Average score</div>
                <div style={{ fontFamily: f.sans, fontSize: type.h1.size, fontWeight: 600, color: t.copper }}>
                  84<span style={{ fontSize: 16, color: t.inkSoft, fontWeight: 400 }}>/100</span>
                </div>
                <Badge variant="secondary" className="mt-2">
                  72nd percentile · last 10 sessions
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div style={{ fontSize: 12, color: t.inkSoft, marginBottom: 6 }}>Day streak</div>
                <div style={{ fontFamily: f.sans, fontSize: type.h1.size, fontWeight: 600, color: t.coal }}>
                  7 🔥
                </div>
                <Badge className="mt-2">Milestone at 7 days</Badge>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 06 — DATA TABLE WITH PAGINATION */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="06"
            title="Recent sessions"
            desc="Table + Pagination. The dashboard's session history, same shape as the live data."
          />
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: "Salary negotiation, Razorpay PM", type: "Salary negotiation", score: 88 },
                  { name: "System design, Stripe Staff PM", type: "Technical leadership", score: 82 },
                  { name: "Behavioral, Atlassian Senior PM", type: "Behavioral", score: 76 },
                  { name: "Resume deep-dive coaching", type: "Coaching", score: 91 },
                ].map((row) => (
                  <TableRow key={row.name}>
                    <TableCell style={{ fontWeight: 500, color: t.coal }}>{row.name}</TableCell>
                    <TableCell style={{ color: t.inkMuted }}>{row.type}</TableCell>
                    <TableCell className="text-right" style={{ fontWeight: 600, color: t.copper }}>
                      {row.score}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div
              style={{
                padding: "14px 24px",
                borderTop: `1px solid ${t.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: t.inkSoft,
              }}
            >
              <span>Showing 4 of 23</span>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" />
                  </PaginationItem>
                  {[1, 2, 3].map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink href="#" isActive={p === 1}>{p}</PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </Card>
        </section>

        {/* 07 — COMMAND PALETTE TRIGGER */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="07"
            title="Command palette trigger"
            desc="Button + Command, in a Dialog. Jump to a session, a report, or start a new interview from anywhere."
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full max-w-[420px] justify-between">
                <span>Search sessions, skills, companies…</span>
                <Kbd>⌘K</Kbd>
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 sm:max-w-[440px]" showCloseButton={false}>
              <Command>
                <CommandInput placeholder="Type a command or search…" />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem>Start a new interview</CommandItem>
                    <CommandItem>View session report</CommandItem>
                    <CommandItem>Open dashboard</CommandItem>
                    <CommandItem>Update resume</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </DialogContent>
          </Dialog>
        </section>
      </div>

      {/* FOOTER */}
      <Footer section="Section" tagline="Compose, never reimplement — every block above is real components only." />
    </PageShell>
  );
}
