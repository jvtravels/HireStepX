/* HireStepX — Design System / Components · Advanced
   Modals · Tables · Navigation · Dropdowns · Breadcrumbs · Tabs · Pagination
   The composition layer above buttons + inputs. Restrained neutral grays
   carry the surface; copper is the one accent — reserved for the primary
   action and the active/selected state, never spread across hover states
   or highlights as a second co-primary hue. Real shadcn/ui primitives from
   src/components/ui — never a canvas-local fork. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, type, radius, shadows, shadcnTheme } from "./_tokens";
import { MonoLabel, SectionHead, Footer, StatePanel, PageShell, PageHeader } from "./_atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

/* ─── Main ─── */
export default function DesignSystemComponentsAdvanced() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Design System · v1.0"
        title="Components, composed."
        description="Modals, tables, navigation. The composition layer that sits above atomic buttons and inputs. Built from the same tokens — never invented."
      />

      <div style={shadcnTheme}>
        {/* 01 — MODALS */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="01"
            title="Modals & dialogs"
            desc="Three sizes. Always centered. Always with one primary action and one escape."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div
              style={{
                background: "rgba(14, 12, 8, 0.04)",
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
              }}
            >
              <MonoLabel color={t.copper}>AlertDialog · sm · 380px</MonoLabel>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete session…
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your transcript and score will be removed. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div
              style={{
                background: "rgba(14, 12, 8, 0.04)",
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
              }}
            >
              <MonoLabel color={t.copper}>Dialog · md · 480px</MonoLabel>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    End interview early…
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>End interview early?</DialogTitle>
                    <DialogDescription>
                      You've answered 3 of 5 questions. We'll score what you've completed, but the
                      report won't reflect your full readiness.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" size="sm">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button size="sm">End and score</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div
              style={{
                background: "rgba(14, 12, 8, 0.04)",
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 32,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                alignItems: "center",
              }}
            >
              <MonoLabel color={t.copper}>Dialog · lg · 600px</MonoLabel>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">Upgrade to Pro…</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Upgrade to Pro</DialogTitle>
                    <DialogDescription>
                      Unlock unlimited interviews, salary negotiation mode, and full analytics.
                      ₹149/month, cancel anytime.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" size="sm">
                        Not now
                      </Button>
                    </DialogClose>
                    <Button size="sm">Continue to payment</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: type.small.size, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> max 3
            sizes (380 / 480 / 600px) · always two actions (cancel + primary)
            · destructive actions get red primary, everything else uses the
            same copper Default button · always trap focus inside · ESC
            closes · backdrop click closes (unless mid-form).
          </p>
        </section>

        {/* 02 — TABLES */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="02"
            title="Tables"
            desc="When data has structure. Soft borders, generous row height, copper accents on user-row metrics."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {["Date", "Type", "Difficulty", "Duration", "Score", ""].map((h, i) => (
                    <TableHead key={i} className={i === 4 ? "text-right" : undefined}>
                      {h}
                      {i < 4 && <span style={{ marginLeft: 6, color: t.inkFaint, fontSize: 10 }}>↕</span>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { date: "14 May 2026", type: "Behavioral", diff: "Standard", dur: "15 min", score: 78, delta: "+6" },
                  { date: "11 May 2026", type: "Salary negotiation", diff: "Intense", dur: "20 min", score: 62, delta: "−4" },
                  { date: "08 May 2026", type: "Technical leadership", diff: "Standard", dur: "15 min", score: 71, delta: "+3" },
                  { date: "05 May 2026", type: "Behavioral", diff: "Warmup", dur: "10 min", score: 68, delta: "+2" },
                  { date: "02 May 2026", type: "Behavioral", diff: "Standard", dur: "15 min", score: 66, delta: null },
                ].map((row, i) => (
                  <TableRow key={i}>
                    <TableCell style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>
                      {row.date}
                    </TableCell>
                    <TableCell style={{ fontSize: 14, color: t.coal, fontWeight: 500 }}>{row.type}</TableCell>
                    <TableCell style={{ fontSize: 13, color: t.inkMuted }}>{row.diff}</TableCell>
                    <TableCell style={{ fontSize: 13, color: t.inkMuted }}>{row.dur}</TableCell>
                    <TableCell className="text-right">
                      <span
                        style={{
                          fontFamily: f.sans,
                          fontSize: type.h3.size,
                          fontWeight: 600,
                          color: t.copper,
                        }}
                      >
                        {row.score}
                      </span>
                      {row.delta && (
                        <span
                          style={{
                            fontSize: 11,
                            color: row.delta.startsWith("+") ? t.success : t.error,
                            marginLeft: 6,
                            fontWeight: 500,
                            fontFamily: f.mono,
                          }}
                        >
                          {row.delta}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        style={{
                          color: t.inkMuted,
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: "none",
                          borderBottom: `1px solid transparent`,
                          cursor: "pointer",
                        }}
                      >
                        View →
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Table footer · pagination */}
            <div
              style={{
                padding: "14px 24px",
                background: t.creamSoft,
                borderTop: `1px solid ${t.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: t.inkSoft,
              }}
            >
              <span>Showing 5 of 12</span>
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
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> rows
            48-56px tall · zebra-striping NOT used (cream surface is enough) ·
            score column always right-aligned, copper, weight 600 · sortable
            headers get ↕ glyph · pagination at the foot, not the head.
          </p>
        </section>

        {/* 03 — TOP NAV */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="03"
            title="Top navigation"
            desc="Wordmark left · routes center · avatar right. Cream background. No box-shadow at rest."
          />
          <div
            style={{
              background: t.cream,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              overflow: "hidden",
              boxShadow: shadows.card,
            }}
          >
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 32px",
                borderBottom: `1px solid ${t.line}`,
                background: t.cream,
              }}
            >
              <div
                style={{
                  fontFamily: f.serif,
                  fontWeight: 500,
                  fontSize: 18,
                  color: t.coal,
                }}
              >
                HireStepX
              </div>
              <div style={{ display: "flex", gap: 24, marginLeft: 48, flex: 1 }}>
                {[
                  { label: "Practice", active: true },
                  { label: "Sessions", active: false },
                  { label: "Analytics", active: false },
                  { label: "Resume", active: false },
                ].map((item) => (
                  <a
                    key={item.label}
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.active ? t.coal : t.inkMuted,
                      textDecoration: "none",
                      paddingBottom: 4,
                      borderBottom: item.active ? `2px solid ${t.copper}` : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: t.inkMuted,
                    cursor: "pointer",
                    padding: 6,
                  }}
                  aria-label="Notifications"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: t.copper100,
                    color: t.copper,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  JV
                </div>
              </div>
            </nav>
          </div>
        </section>

        {/* 04 — SIDEBAR */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="04"
            title="Sidebar navigation"
            desc="For dense apps. Coal background · cream-tinted active state · icon + label. See Layout & Navigation for the real shadcn Sidebar primitive."
          />
          <div
            style={{
              background: t.cream,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: 24,
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, alignItems: "stretch" }}>
              <aside
                style={{
                  background: t.coal,
                  borderRadius: radius.lg,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    fontWeight: 500,
                    color: t.cream,
                    padding: "10px 14px",
                    marginBottom: 12,
                  }}
                >
                  HireStepX
                </div>
                {[
                  { icon: "▶", label: "Practice", active: true },
                  { icon: "≡", label: "Sessions", active: false },
                  { icon: "▲", label: "Analytics", active: false },
                  { icon: "✎", label: "Resume", active: false },
                  { icon: "✦", label: "Calendar", active: false },
                ].map((item) => (
                  <a
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.active ? t.cream : "rgba(250,247,240,.65)",
                      background: item.active ? "rgba(187,77,0,.16)" : "transparent",
                      cursor: "pointer",
                      borderLeft: item.active ? `2px solid ${t.copper}` : "2px solid transparent",
                      paddingLeft: item.active ? 12 : 14,
                    }}
                  >
                    <span style={{ fontSize: 14, color: item.active ? t.copper : "rgba(250,247,240,.45)" }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                ))}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: `1px solid rgba(250,247,240,.10)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 14px 6px",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: t.copper100,
                      color: t.copper,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    JV
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.cream }}>Jay Vyas</div>
                    <div style={{ fontSize: 11, color: "rgba(250,247,240,.55)" }}>Pro · 12 days</div>
                  </div>
                </div>
              </aside>
              <div
                style={{
                  background: t.cream,
                  borderRadius: radius.lg,
                  padding: "32px 36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.inkSoft,
                  fontSize: 13,
                }}
              >
                Main content area
              </div>
            </div>
          </div>
        </section>

        {/* 05 — TABS + BREADCRUMBS */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="05"
            title="Tabs & breadcrumbs"
            desc="Two ways to show hierarchy. Tabs for siblings, breadcrumbs for ancestry."
          />
          <div style={{ display: "grid", gap: 16 }}>
            <StatePanel title="Tabs · shadcn/ui Tabs primitive">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="coaching">Coaching tips</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">Session overview goes here.</TabsContent>
                <TabsContent value="skills">Skill-by-skill breakdown goes here.</TabsContent>
                <TabsContent value="transcript">Full transcript goes here.</TabsContent>
                <TabsContent value="coaching">Coaching tips go here.</TabsContent>
              </Tabs>
            </StatePanel>

            <StatePanel title="Tabs · filter row">
              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="salary">Salary</TabsTrigger>
                </TabsList>
              </Tabs>
            </StatePanel>

            <StatePanel title="Breadcrumb · shadcn/ui Breadcrumb primitive">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Sessions</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Behavioral · 14 May</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Skills</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </StatePanel>
          </div>
        </section>

        {/* 06 — DROPDOWN / SELECT */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="06"
            title="Select"
            desc="Real Radix Select — coal text on white, copper focus ring, soft shadow on the open listbox."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Select · shadcn/ui Select primitive">
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: t.coal }}>
                Interview type
              </label>
              <Select defaultValue="behavioral-standard">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavioral-warmup">Behavioral · Warmup</SelectItem>
                  <SelectItem value="behavioral-standard">Behavioral · Standard</SelectItem>
                  <SelectItem value="behavioral-intense">Behavioral · Intense</SelectItem>
                  <SelectItem value="technical-leadership">Technical leadership</SelectItem>
                  <SelectItem value="salary-negotiation">Salary negotiation</SelectItem>
                </SelectContent>
              </Select>
            </StatePanel>

            <StatePanel title="Select · difficulty">
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: t.coal }}>
                Difficulty
              </label>
              <Select defaultValue="standard">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warmup">Warmup</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="intense">Intense</SelectItem>
                </SelectContent>
              </Select>
            </StatePanel>
          </div>
        </section>

        {/* 07 — SEARCH */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="07"
            title="Search & command"
            desc="Header search · Cmd-K command palette. Both real, keyboard-operable primitives."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Header search · Input + Kbd">
              <div style={{ position: "relative" }}>
                <Input
                  type="text"
                  placeholder="Search sessions, skills, companies…"
                  className="pl-10 pr-14"
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: t.inkSoft,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </span>
                <Kbd style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
                  ⌘K
                </Kbd>
              </div>
            </StatePanel>

            <StatePanel title="Command palette · real cmdk primitive">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="border-input bg-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground shadow-xs"
                  >
                    <span className="flex-1 text-left">Type a command or search…</span>
                    <Kbd>⌘K</Kbd>
                  </button>
                </DialogTrigger>
                <DialogContent className="p-0 sm:max-w-[440px]" showCloseButton={false}>
                  <Command>
                    <CommandInput placeholder="Type a command or search…" />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem>Start practice session</CommandItem>
                        <CommandItem>View all sessions</CommandItem>
                        <CommandItem>Open analytics</CommandItem>
                        <CommandItem>Update resume</CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </DialogContent>
              </Dialog>
            </StatePanel>
          </div>
        </section>

        {/* 08 — POPOVER + DROPDOWN MENU */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="08"
            title="Dropdown menu · popover"
            desc="Triggered by an action button. Neutral rows; copper only on the item that carries real emphasis (e.g. plan tier); destructive actions get the red row treatment."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <StatePanel title="Avatar dropdown · DropdownMenu">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="cursor-pointer">
                      <Avatar>
                        <AvatarFallback className="bg-[var(--copper)]/12 text-[var(--copper)]">JV</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div style={{ fontWeight: 600 }}>Jay Vyas</div>
                      <div style={{ fontWeight: 400, color: t.inkSoft, fontSize: 11 }}>jay@hirestepx.com</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--copper)]">Billing · Pro</DropdownMenuItem>
                    <DropdownMenuItem>Help &amp; support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </StatePanel>

            <StatePanel title="Row context menu (•••) · DropdownMenu">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Row actions">
                      •••
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem>View report</DropdownMenuItem>
                    <DropdownMenuItem>Re-analyze</DropdownMenuItem>
                    <DropdownMenuItem>Share link</DropdownMenuItem>
                    <DropdownMenuItem>Export PDF</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">Delete session</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </StatePanel>

            <StatePanel title="Filter popover · Popover primitive">
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Filter
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64">
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.coal, marginBottom: 8 }}>
                      Show sessions
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {["Behavioral", "Technical leadership", "Salary negotiation"].map((label) => (
                        <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.inkMuted }}>
                          <input type="checkbox" defaultChecked />
                          {label}
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </StatePanel>
          </div>
        </section>

        {/* 09 — ACCORDION */}
        <section style={{ marginBottom: 56 }}>
          <SectionHead
            num="09"
            title="Accordion"
            desc="Collapsible disclosure for FAQ-shaped content. Real Radix Accordion primitive — keyboard-navigable, one item open by default."
          />
          <div style={{ maxWidth: 640 }}>
            <StatePanel title="Accordion · shadcn/ui Accordion primitive">
              <div style={{ ...shadcnTheme }} className="[color-scheme:light]">
                <Accordion type="single" defaultValue="item-1" collapsible>
                  <AccordionItem value="item-1">
                    <AccordionTrigger>How is my score calculated?</AccordionTrigger>
                    <AccordionContent>
                      Each answer is scored against the STAR rubric (Situation, Task, Action,
                      Result) by the same model that ran your interview, then normalized against
                      role and seniority benchmarks.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Can I redo a session?</AccordionTrigger>
                    <AccordionContent>
                      Yes — reruns don't count against your streak, and only your best-scored
                      attempt is kept on your readiness index.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>What happens to my recordings?</AccordionTrigger>
                    <AccordionContent>
                      Audio is transcribed for scoring and deleted after 30 days. Transcripts stay
                      so you can review coaching tips later.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </StatePanel>
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <Footer section="Section" tagline="One primary action · ESC closes · Coal text · Copper accents." />
    </PageShell>
  );
}
