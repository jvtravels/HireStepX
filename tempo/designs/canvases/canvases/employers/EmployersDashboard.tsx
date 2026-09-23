/* HireStepX — Employers Opportunities
   Exploratory design-only concept for a broader employer-facing portal.
   A real, live employer console already ships at
   app/(employer)/employer/requirements/[id]/page.tsx with pay-per-unlock
   monetization (tiered ₹999/₹1,999 pricing gating candidate identity and
   contact info only — match score, roster score, sessions, notice
   period, and CTC stay visible either way); this canvas explores a
   fuller Opportunities-list + details experience around that same
   unlock model using its own mock candidate pool, not that route's data.

   Fully self-contained: no imports from this project's @/components/ui/*
   and no dependency on this project's customized theme tokens. Every
   primitive below is the literal stock shadcn/ui component source
   (Button, Badge, Avatar, Input, Table, Tooltip, DropdownMenu,
   Pagination), scoped to this file only via inline CSS variables so the
   project's real theme is untouched. The neutral/zinc "default" shadcn
   palette is used throughout; the only customized tokens are a
   deliberate two-color brand pair, each with a fixed job so they never
   compete for the same signal:
     - --primary / --sidebar-primary — indigo. The product's own voice:
       primary actions (Create), active navigation, checked/selected
       state, focus rings.
     - --copper (custom token, same value the old single-accent amber
       used, matching the HireStepX logo mark below) — the evidence
       signal only: the "avg evidence score" line and the Top Matches
       score, never used for actions or navigation.
   Semantic destructive red is kept as shadcn ships it (Archive, the
   unread-notification dot) — that's a functional danger/alert color,
   not a decorative brand choice, so it sits outside the two-color rule
   on purpose. Every color-coded stage/status signal is paired with a
   distinct icon shape or label text, never color alone.
   --ring / --sidebar-ring are set to indigo rather than shadcn's
   default flat gray: the default gray ring measures under 3:1 against
   a white page (fails WCAG 1.4.11 non-text contrast), while indigo
   clears ~6.3:1 as both a ring and as white-on-indigo button text.

   Posting lifecycle (Active/Paused/Expired) is modeled separately
   from pipeline stage (Matching/Review/Interviewing/Hired) — they're
   different axes, previously conflated into one "Stage" column.

   Product framing, deliberately not a generic ATS/job board: HireStepX
   does not surface a pile of resumes/portfolios for an employer to sift
   through. The AI evaluates the full candidate pool who've practiced on
   the platform and pushes forward only a curated shortlist of 5-10 top
   matches per posting, each carrying an "avg evidence score" — an
   AI-generated audit/analysis/report from that candidate's practice
   history, not a self-reported resume claim. The "Top Matches" column
   is the moat: "Top N" + the amber evidence-score line, backed by
   "AI Screening" showing how many candidates were evaluated to produce
   that shortlist. The page-level summary leads with the average
   evidence score across those shortlists, not a raw headcount.

   Follow-up pass, closing gaps an audit found and deepening the moat
   from an employer's actual decision-making needs:
     - AI Screening no longer repeats the Top Matches line ("curated
       from evidence" said nothing new). It now shows the shortlist's
       "Score range" (min-max), a distinct trust signal from the
       average: a narrow high band means a confident, low-risk hire; a
       wide band means the pool is more mixed and the employer should
       look closer before picking a next step.
     - The per-row "Needs attention" timestamp marker and its "Updated"
       column were removed; the underlying attention-filter checkbox
       stays as the way to surface stalled postings (active, not yet
       hired, stalled 3h+) without dedicating a column to it.
     - Search, the stage/attention filter (the previously-inert
       SlidersHorizontal icon), and pagination are now real: they
       filter, then sort, then page the same underlying rows. Rows per
       page defaults to 5 (this product surfaces a curated handful of
       postings, not a job-board-scale table) precisely so pagination
       is visibly working with the seed data, not just present as UI.
     - A distinct "no results" empty state (search/filters clear
       button) is shown separately from the true "no postings yet"
       empty state — they mean different things to the employer.
     - Select-all and the selection count now scope to the current
       page/filtered view, matching standard table semantics.

   Density pass: the table card now stretches to fill the remaining
   viewport height (flex-1 column, scrollable body, footer pinned to
   the bottom) instead of shrink-wrapping its rows and leaving a bare
   page background below it. Row/head padding was tightened and the
   default page size raised to 10 so the full seed set renders on one
   page without empty space — a real employer with more postings will
   fill and scroll this same layout instead of the layout floating in
   whitespace above their data.

   Static mock data, not wired into prod. */
import * as React from "react";
import { cn } from "cn";
import { cva, type VariantProps } from "class-variance-authority";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Avatar as AvatarPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
  Checkbox as CheckboxPrimitive,
  AlertDialog as AlertDialogPrimitive,
  Dialog as DialogPrimitive,
  Tooltip as TooltipPrimitive,
  HoverCard as HoverCardPrimitive,
  Progress as ProgressPrimitive,
  Tabs as TabsPrimitive,
  Separator as SeparatorPrimitive,
  Label as LabelPrimitive,
  Select as SelectPrimitive,
  Slot,
} from "radix-ui";
import {
  Home,
  Info,
  Briefcase,
  Bookmark,
  MessageSquare,
  CreditCard,
  HelpCircle,
  Settings,
  LogOut,
  Bell,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  Columns3,
  PanelLeft,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  MoreVertical,
  CheckCircle2,
  LoaderCircle,
  ClipboardList,
  Check,
  Minus,
  BadgeCheck,
  Pencil,
  Archive as ArchiveIcon,
  Eye,
  Users,
  Sun,
  Moon,
  X,
  Calendar,
  Building2,
  LayoutGrid,
  Folder,
  GraduationCap,
  Clock,
  MapPin,
  IndianRupee,
  CalendarClock,
  FileDown,
  Link2,
  Hourglass,
  MailQuestion,
  XCircle,
  Lock,
  ArrowRight,
  ShieldCheck,
  Video,
  FileText,
  ExternalLink,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  MinusCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────
   Stock shadcn/ui default theme (neutral), scoped to this file only.
   Values are shadcn's own shipped defaults — not this project's palette.
   ───────────────────────────────────────────────────────────────────── */
const shadcnDefaultTheme = {
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.145 0 0)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.145 0 0)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.145 0 0)",
  "--primary": "#312e81",
  "--primary-foreground": "oklch(0.985 0 0)",
  "--secondary": "oklch(0.97 0 0)",
  "--secondary-foreground": "oklch(0.205 0 0)",
  "--muted": "oklch(0.97 0 0)",
  "--muted-foreground": "oklch(0.556 0 0)",
  "--accent": "oklch(0.97 0 0)",
  "--accent-foreground": "oklch(0.205 0 0)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.922 0 0)",
  "--input": "oklch(0.922 0 0)",
  "--ring": "#312e81",
  "--radius": "0.625rem",
  "--sidebar": "oklch(0.985 0 0)",
  "--sidebar-foreground": "oklch(0.145 0 0)",
  "--sidebar-primary": "#312e81",
  "--sidebar-primary-foreground": "oklch(0.985 0 0)",
  "--sidebar-accent": "oklch(0.97 0 0)",
  "--sidebar-accent-foreground": "oklch(0.205 0 0)",
  "--sidebar-border": "oklch(0.922 0 0)",
  "--sidebar-ring": "#312e81",
  /* Custom token, not part of stock shadcn: the evidence-score accent.
     Same value the old single-accent amber used (HireStepX logo mark). */
  "--copper": "#b45309",
  "--copper-foreground": "oklch(0.985 0 0)",
  /* This project's global src/index.css redefines Tailwind's --text-xs/sm/base
     scale to 11px/12px/13px (below the 14px minimum), which silently shrinks
     every text-sm/text-base class in this canvas even though the code reads
     like stock Tailwind. Re-pin them to stock Tailwind's own values here so
     nothing in this canvas renders under 14px, without touching the app's
     global typography scale. */
  "--text-xs": "0.875rem",
  "--text-sm": "0.875rem",
  "--text-base": "1rem",
  /* Tokens for the always-dark tooltip/hovercard surface (an inverted chip,
     by convention dark regardless of page theme, for contrast against
     whatever content it floats over) and the Experience badge — both used
     to be hardcoded hex scattered across call sites; centralized here so a
     future palette change only happens in one place. */
  "--tooltip-bg": "#1c1c1e",
  "--tooltip-fg": "#ffffff",
  "--tooltip-border": "oklch(1 0 0 / 10%)",
  "--experience-badge-bg": "#e3edfa",
  "--experience-badge-fg": "#1d5fad",
} as React.CSSProperties;

/* ─────────────────────────────────────────────────────────────────────────
   Dark counterpart — stock shadcn/ui dark neutral defaults, keeping the
   same two-color brand pair (indigo primary, copper evidence accent) but
   lightened so each still clears contrast against a dark surface.
   ───────────────────────────────────────────────────────────────────── */
const shadcnDarkTheme = {
  "--background": "oklch(0.145 0 0)",
  "--foreground": "oklch(0.985 0 0)",
  "--card": "oklch(0.205 0 0)",
  "--card-foreground": "oklch(0.985 0 0)",
  "--popover": "oklch(0.205 0 0)",
  "--popover-foreground": "oklch(0.985 0 0)",
  "--primary": "#818cf8",
  "--primary-foreground": "oklch(0.145 0 0)",
  "--secondary": "oklch(0.269 0 0)",
  "--secondary-foreground": "oklch(0.985 0 0)",
  "--muted": "oklch(0.269 0 0)",
  "--muted-foreground": "oklch(0.708 0 0)",
  "--accent": "oklch(0.269 0 0)",
  "--accent-foreground": "oklch(0.985 0 0)",
  "--destructive": "oklch(0.704 0.191 22.216)",
  "--border": "oklch(1 0 0 / 10%)",
  "--input": "oklch(1 0 0 / 15%)",
  "--ring": "#818cf8",
  "--radius": "0.625rem",
  "--sidebar": "oklch(0.205 0 0)",
  "--sidebar-foreground": "oklch(0.985 0 0)",
  "--sidebar-primary": "#818cf8",
  "--sidebar-primary-foreground": "oklch(0.145 0 0)",
  "--sidebar-accent": "oklch(0.269 0 0)",
  "--sidebar-accent-foreground": "oklch(0.985 0 0)",
  "--sidebar-border": "oklch(1 0 0 / 10%)",
  "--sidebar-ring": "#818cf8",
  "--copper": "#f59e0b",
  "--copper-foreground": "oklch(0.145 0 0)",
  "--text-xs": "0.875rem",
  "--text-sm": "0.875rem",
  "--text-base": "1rem",
  "--tooltip-bg": "#1c1c1e",
  "--tooltip-fg": "#ffffff",
  "--tooltip-border": "oklch(1 0 0 / 15%)",
  "--experience-badge-bg": "#12283f",
  "--experience-badge-fg": "#93c5fd",
} as React.CSSProperties;

/* ─────────────────────────────────────────────────────────────────────────
   Theme context — lets Radix portal content (dialogs, dropdowns) that
   renders outside this component's DOM subtree still pick up the active
   theme's CSS variables, since they escape the root div's inline style.
   ───────────────────────────────────────────────────────────────────── */
const ThemeContext = React.createContext<React.CSSProperties>(shadcnDefaultTheme);

/* ─────────────────────────────────────────────────────────────────────────
   Button — literal port of this project's real src/components/ui/button.tsx
   ───────────────────────────────────────────────────────────────────── */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Badge — literal port of this project's real src/components/ui/badge.tsx
   ───────────────────────────────────────────────────────────────────── */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Card — stock shadcn/ui
   ───────────────────────────────────────────────────────────────────── */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)", className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Avatar — literal port of this project's real src/components/ui/avatar.tsx
   ───────────────────────────────────────────────────────────────────── */
function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { size?: "default" | "sm" | "lg" }) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Tooltip — stock shadcn/ui (Radix)
   ───────────────────────────────────────────────────────────────────── */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  arrowClassName,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { arrowClassName?: string }) {
  const theme = React.useContext(ThemeContext);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        style={theme}
        className={cn(
          "employers-dashboard-portal z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className={cn(
            "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
            arrowClassName ?? "bg-foreground fill-foreground"
          )}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HoverCard — stock shadcn/ui (Radix)
   Unlike Tooltip, HoverCard content stays mounted/interactive when the
   pointer moves from the trigger into the card itself — the right
   primitive whenever hover-revealed content needs to hold clickable rows
   (e.g. the Strong Match candidate list), not just static text.
   ───────────────────────────────────────────────────────────────────── */
function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" openDelay={150} closeDelay={100} {...props} />;
}

function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  const theme = React.useContext(ThemeContext);
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        style={theme}
        className={cn(
          "employers-dashboard-portal z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Input — literal port of this project's real src/components/ui/input.tsx
   ───────────────────────────────────────────────────────────────────── */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Label — literal port of this project's real src/components/ui/label.tsx
   ───────────────────────────────────────────────────────────────────── */
function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Textarea — literal port of this project's real src/components/ui/textarea.tsx
   ───────────────────────────────────────────────────────────────────── */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Select — literal port of this project's real src/components/ui/select.tsx
   ───────────────────────────────────────────────────────────────────── */
function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const theme = React.useContext(ThemeContext);
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-align-trigger={position === "item-aligned"}
        style={theme}
        className={cn(
          "employers-dashboard-portal relative z-50 max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className={cn(
            "data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)",
            position === "popper" && ""
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUp />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDown />
    </SelectPrimitive.ScrollDownButton>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Table — stock shadcn/ui
   ───────────────────────────────────────────────────────────────────── */
function Table({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-x-auto", containerClassName)}>
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<"tr">>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        data-slot="table-row"
        className={cn(
          "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
          className
        )}
        {...props}
      />
    );
  },
);
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-2 py-2.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Checkbox — literal port of this project's real src/components/ui/checkbox.tsx.
   One documented, minimal extension: real project checkbox.tsx has no
   tri-state (indeterminate) styling, but the table's select-all checkbox
   needs it — data-[state=indeterminate] rules are added alongside the
   real data-checked ones so a partial-page-selection reads the same as
   fully-checked instead of falling back to the unchecked border.
   ───────────────────────────────────────────────────────────────────── */
function Checkbox({
  className,
  checked,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        {checked === "indeterminate" ? <Minus /> : <Check />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Alert — literal port of this project's real src/components/ui/alert.tsx.
   Added for the Settings storyboard's "saving re-triggers review" banner —
   this canvas had no prior use case for a standalone (non-dialog) alert.
   ───────────────────────────────────────────────────────────────────── */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AlertDialog — stock shadcn/ui (Radix)
   ───────────────────────────────────────────────────────────────────── */
function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}
function AlertDialogPortal(props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}
function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}
function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & { size?: "default" | "sm" }) {
  const theme = React.useContext(ThemeContext);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        style={theme}
        className={cn(
          "employers-dashboard-portal group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}
function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  );
}
function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  );
}
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<VariantProps<typeof buttonVariants>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={cn(className)} {...props} />
    </Button>
  );
}
function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<VariantProps<typeof buttonVariants>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={cn(className)} {...props} />
    </Button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Dialog — stock shadcn/ui (Radix). Unlike AlertDialog (reserved for
   destructive confirmations), this is the non-confirm modal container:
   used below for the "view shortlist" drill-down.
   ───────────────────────────────────────────────────────────────────── */
function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  const theme = React.useContext(ThemeContext);
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={theme}
        className={cn(
          "employers-dashboard-portal fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
              <X />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}
function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  );
}
function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DropdownMenu — stock shadcn/ui (Radix)
   ───────────────────────────────────────────────────────────────────── */
function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}
function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}
function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}
function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const theme = React.useContext(ThemeContext);
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        style={theme}
        className={cn(
          "employers-dashboard-portal z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  );
}
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Check />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  );
}
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(
        "group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
        className
      )}
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="item-separator" orientation="horizontal" className={cn("my-2", className)} {...props} />;
}

const itemVariants = cva(
  "group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted",
  {
    variants: {
      variant: {
        default: "border-transparent",
        outline: "border-border",
        muted: "border-transparent bg-muted/50",
      },
      size: {
        default: "gap-2.5 px-3 py-2.5",
        sm: "gap-2.5 px-3 py-2.5",
        xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Item({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return (
    <div
      data-slot="item"
      data-variant={variant}
      data-size={size}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "[&_svg:not([class*='size-'])]:size-4",
        image:
          "size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return <div data-slot="item-media" data-variant={variant} className={cn(itemMediaVariants({ variant, className }))} {...props} />;
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none", className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn("line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4", className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

function Breadcrumb(props: React.ComponentProps<"nav">) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Progress — literal port of src/components/ui/progress.tsx, with one
   documented, minimal extension: an indicatorClassName prop (stock hardcodes
   bg-primary on the indicator) so the evidence-signal bars can use --copper
   instead of the indigo action color, per this file's two-color rule above.
   ───────────────────────────────────────────────────────────────────── */
function Progress({ className, value, indicatorClassName, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("size-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Tabs — literal port of this project's real src/components/ui/tabs.tsx
   (stock shadcn/ui, "default" variant only — the pill/segmented list this
   product actually ships elsewhere, not an invented underline style).
   Groups the Candidate Profile's evidence sections into named panes instead
   of one long undifferentiated scroll — local, uncontrolled UI state only,
   nothing persisted.
   ───────────────────────────────────────────────────────────────────── */
function Tabs({ className, orientation = "horizontal", ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 text-sm outline-none", className)} {...props} />;
}

/* ─────────────────────────────────────────────────────────────────────────
   HireStepX logo mark — inlined from public/favicon.svg (root-relative
   /favicon.svg collides with the canvas devserver's own favicon route).
   ───────────────────────────────────────────────────────────────────── */
function HireStepXMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1080 1080" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="1080" height="1080" fill="#FAF7F0" />
      <path
        d="M214.396 229L349.67 229L544.568 454.795L730.945 229L866.218 229L610.602 540L866.218 851H727.76L540.307 623.075L353.844 851H214.396L472.143 540L214.396 229Z"
        fill="#B45309"
      />
      <path
        d="M553.422 453.873L617.882 532.687L625.821 542.394L617.62 551.88L553.159 626.435L541.78 639.596L530.516 626.337L467.169 551.783L459.189 542.391L466.91 532.786L530.257 453.972L541.778 439.638L553.422 453.873Z"
        fill="#B45309"
        stroke="#FAF7F0"
        strokeWidth="29.8219"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mock data
   ───────────────────────────────────────────────────────────────────── */
const navItems = [
  { label: "Dashboard", icon: Home },
  { label: "Opportunities", icon: Briefcase, active: true },
  { label: "Saved Talent", icon: Bookmark },
  { label: "Messages", icon: MessageSquare },
  { label: "Payments", icon: CreditCard },
];

/* Admin console left-nav — a subset of src/AdminDashboard.tsx's TABS list
   (Overview/Users/Sessions/Financials/Employers/Promo Codes/Calendar),
   translated from that file's emoji icons to this canvas's lucide set.
   "Employers" is the tab this canvas's admin storyboards are grounded in. */
const adminNavItems = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Users", icon: Users },
  { label: "Sessions", icon: ClipboardList },
  { label: "Financials", icon: CreditCard },
  { label: "Employers", icon: Building2 },
  { label: "Promo Codes", icon: BadgeCheck },
  { label: "Calendar", icon: Calendar },
];

const stageIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  Matching: LoaderCircle,
  Review: ClipboardList,
  Interviewing: MessageSquare,
  Hired: CheckCircle2,
};

const stageIconClass: Record<string, string> = {
  Matching: "size-3.5 animate-spin text-muted-foreground",
  Review: "size-3.5 text-[var(--copper)]",
  Interviewing: "size-3.5 text-primary",
  Hired: "size-3.5 fill-primary stroke-primary-foreground",
};

const stageLabel: Record<string, string> = {
  Matching: "AI Matching",
  Review: "Ready for Review",
  Interviewing: "Interviewing",
  Hired: "Hired",
};

interface Opportunity {
  id: string;
  title: string;
  type: string;
  duration: string;
  hours: string;
  pay: string;
  location: string;
  experience: string;
  dueDate: string;
  strongMatches: number;
  strongMatchInitials: string[];
  stage: string;
  postingStatus: "Active" | "Paused" | "Expired";
  evaluated: number;
  topMatches: number;
  avgScore: number;
  scoreLow: number;
  scoreHigh: number;
  nextStep: string;
  updated: string;
  updatedMinutes: number;
  createdDaysAgo: number;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  talentPreferences: {
    experienceLevel: string;
    availability: string;
    preferredIndustry: string;
    preferredDomain: string;
    workSchedule: string;
    portfolioRequired: boolean;
    relevantExperience: string;
  };
}

const initialOpportunities: Opportunity[] = [
  { id: "2", title: "Product Designer", type: "Contract", duration: "16 Weeks", hours: "30hrs/week", pay: "₹1,20,000/month", location: "Bengaluru · Hybrid", experience: "2-4yrs", dueDate: "16 days left", strongMatches: 2, strongMatchInitials: ["AK", "RS"], stage: "Review", postingStatus: "Active", evaluated: 54, topMatches: 6, avgScore: 82, scoreLow: 74, scoreHigh: 91, nextStep: "Review Top Matches", updated: "15m ago", updatedMinutes: 15, createdDaysAgo: 4,
    description: "Design end-to-end product experiences for our core SaaS platform, partnering closely with product and engineering to ship features used by enterprise customers.",
    responsibilities: ["Own interaction and visual design for 2-3 concurrent feature workstreams", "Run lightweight usability checks with the product team before handoff", "Maintain and extend the shared design system components", "Present design rationale in weekly product reviews"],
    requiredSkills: ["Figma", "Design Systems", "Interaction Design"],
    niceToHaveSkills: ["SaaS Experience", "Motion Design"],
    talentPreferences: { experienceLevel: "2-4 years", availability: "Within 2 weeks", preferredIndustry: "Software/IT", preferredDomain: "Product Design", workSchedule: "Hybrid, 3 days/week", portfolioRequired: true, relevantExperience: "B2B SaaS product design" },
  },
  { id: "7", title: "Brand Identity System", type: "Freelance", duration: "4 Weeks", hours: "15hrs/week", pay: "₹45,000 fixed", location: "Remote", experience: "4-6yrs", dueDate: "21 days left", strongMatches: 3, strongMatchInitials: ["NV", "SJ", "PT"], stage: "Review", postingStatus: "Active", evaluated: 71, topMatches: 8, avgScore: 88, scoreLow: 79, scoreHigh: 95, nextStep: "Review Top Matches", updated: "2d ago", updatedMinutes: 2880, createdDaysAgo: 2,
    description: "Create a complete brand identity system, logo suite, and guidelines for a consumer app preparing for its public launch.",
    responsibilities: ["Deliver a primary and secondary logo lockup", "Define color, type, and iconography guidelines", "Produce a brand guideline document for handoff", "Apply the system to 3 sample marketing templates"],
    requiredSkills: ["Illustrator", "Brand Identity", "Typography"],
    niceToHaveSkills: ["Motion Logo", "Packaging Design"],
    talentPreferences: { experienceLevel: "4-6 years", availability: "Within 1 week", preferredIndustry: "Consumer/D2C", preferredDomain: "Branding", workSchedule: "Flexible", portfolioRequired: true, relevantExperience: "Brand systems for consumer apps" },
  },
  { id: "6", title: "Analytics Support", type: "Project", duration: "6 Weeks", hours: "20hrs/week", pay: "₹80,000 fixed", location: "Remote", experience: "5-6yrs", dueDate: "8 days left", strongMatches: 2, strongMatchInitials: ["DG", "LM"], stage: "Interviewing", postingStatus: "Active", evaluated: 38, topMatches: 5, avgScore: 91, scoreLow: 85, scoreHigh: 96, nextStep: "View Interviews", updated: "2d ago", updatedMinutes: 2880, createdDaysAgo: 9,
    description: "Support the growth team with recurring analytics reporting and ad-hoc data pulls across acquisition and retention funnels.",
    responsibilities: ["Build and maintain weekly growth dashboards", "Pull cohort and funnel data on request", "Flag anomalies in acquisition metrics", "Document query logic for handoff"],
    requiredSkills: ["Excel", "SQL", "Data Visualization"],
    niceToHaveSkills: ["Looker/Tableau", "Growth Analytics"],
    talentPreferences: { experienceLevel: "5-6 years", availability: "Immediately", preferredIndustry: "Software/IT", preferredDomain: "Analytics", workSchedule: "Flexible", portfolioRequired: false, relevantExperience: "Growth or marketing analytics" },
  },
  { id: "1", title: "Saas Onboarding Design", type: "Project", duration: "6 Weeks", hours: "20hrs/week", pay: "₹80,000/month", location: "Remote", experience: "10-15yrs", dueDate: "13 days left", strongMatches: 0, strongMatchInitials: [], stage: "Matching", postingStatus: "Active", evaluated: 0, topMatches: 0, avgScore: 0, scoreLow: 0, scoreHigh: 0, nextStep: "Continue Matching", updated: "2hr ago", updatedMinutes: 120, createdDaysAgo: 6,
    description: "Redesign the first-run onboarding flow for our SaaS product to reduce drop-off between signup and first meaningful action.",
    responsibilities: ["Map the current onboarding drop-off points with the PM", "Design a revised flow with progressive disclosure", "Prototype key screens for user testing", "Collaborate with engineering on rollout"],
    requiredSkills: ["Figma", "User Research", "Prototyping"],
    niceToHaveSkills: ["SaaS Experience", "Startup Experience", "Design Systems"],
    talentPreferences: { experienceLevel: "1-3 years", availability: "Within 2 weeks", preferredIndustry: "Software/IT", preferredDomain: "Product Design", workSchedule: "Flexible", portfolioRequired: true, relevantExperience: "SaaS product design" },
  },
  { id: "4", title: "Brand Identity System", type: "Freelance", duration: "4 Weeks", hours: "15hrs/week", pay: "₹45,000 fixed", location: "Remote", experience: "5+yrs", dueDate: "19 days left", strongMatches: 3, strongMatchInitials: ["SJ", "PT", "DG"], stage: "Review", postingStatus: "Paused", evaluated: 63, topMatches: 7, avgScore: 89, scoreLow: 81, scoreHigh: 95, nextStep: "Review Top Matches", updated: "3hr ago", updatedMinutes: 180, createdDaysAgo: 12,
    description: "A second brand refresh engagement — a light-touch identity update ahead of a rebrand announcement.",
    responsibilities: ["Refresh the existing logo mark for a modern feel", "Update the brand color palette", "Deliver a revised guideline addendum"],
    requiredSkills: ["Illustrator", "Brand Identity"],
    niceToHaveSkills: ["Motion Logo"],
    talentPreferences: { experienceLevel: "5+ years", availability: "Within 1 month", preferredIndustry: "Consumer/D2C", preferredDomain: "Branding", workSchedule: "Flexible", portfolioRequired: true, relevantExperience: "Rebrand or refresh projects" },
  },
  { id: "3", title: "UX Research Intern", type: "Internship", duration: "12 Weeks", hours: "20hrs/week", pay: "₹20,000/month", location: "Mumbai · Hybrid", experience: "5-6yrs", dueDate: "6 days left", strongMatches: 2, strongMatchInitials: ["LM", "DG"], stage: "Interviewing", postingStatus: "Active", evaluated: 41, topMatches: 5, avgScore: 93, scoreLow: 88, scoreHigh: 98, nextStep: "View Interviews", updated: "1hr ago", updatedMinutes: 60, createdDaysAgo: 15,
    description: "Support the research team by running moderated usability sessions and synthesizing findings for the product roadmap.",
    responsibilities: ["Assist in scheduling and running usability sessions", "Synthesize findings into shareable reports", "Maintain the research repository", "Shadow senior researchers on stakeholder readouts"],
    requiredSkills: ["User Research", "Notion"],
    niceToHaveSkills: ["Survey Design", "Figma"],
    talentPreferences: { experienceLevel: "0-1 years", availability: "Within 2 weeks", preferredIndustry: "Software/IT", preferredDomain: "User Research", workSchedule: "Hybrid, 3 days/week", portfolioRequired: false, relevantExperience: "Academic or internship research projects" },
  },
  { id: "5", title: "Website Redesign", type: "Contract", duration: "6 Weeks", hours: "20hrs/week", pay: "₹60,000 fixed", location: "Remote", experience: "2-6yrs", dueDate: "Overdue", strongMatches: 2, strongMatchInitials: ["AK", "DG"], stage: "Hired", postingStatus: "Expired", evaluated: 52, topMatches: 6, avgScore: 87, scoreLow: 79, scoreHigh: 94, nextStep: "View Outcome", updated: "2m ago", updatedMinutes: 2, createdDaysAgo: 21,
    description: "Redesign the marketing website ahead of a funding announcement, refreshing the visual design while keeping the existing CMS.",
    responsibilities: ["Redesign the homepage and 4 core marketing pages", "Deliver a responsive design across breakpoints", "Hand off components to engineering with specs"],
    requiredSkills: ["Figma", "Web Design", "Responsive Design"],
    niceToHaveSkills: ["Webflow", "Copywriting"],
    talentPreferences: { experienceLevel: "2-6 years", availability: "Immediately", preferredIndustry: "Software/IT", preferredDomain: "Web Design", workSchedule: "Flexible", portfolioRequired: true, relevantExperience: "Marketing site redesigns" },
  },
  { id: "8", title: "Senior Backend Engineer", type: "Contract", duration: "12 Weeks", hours: "40hrs/week", pay: "₹1,80,000/month", location: "Bengaluru · Remote", experience: "4-8yrs", dueDate: "24 days left", strongMatches: 3, strongMatchInitials: ["AK", "RS", "MP"], stage: "Review", postingStatus: "Active", evaluated: 132, topMatches: 24, avgScore: 86, scoreLow: 68, scoreHigh: 97, nextStep: "Review Top Matches", updated: "40m ago", updatedMinutes: 40, createdDaysAgo: 3,
    /* Only opportunity in the seed set with topMatches > BUNDLE_SIZE — exists
       so the details screen's multi-batch unlock flow (batch 1 unlocked,
       batches 2-3 still locked; then all three unlocked) has a shortlist
       long enough to actually demonstrate, instead of every other seed
       opportunity topping out inside a single batch of 10. */
    description: "Own backend services for a fintech platform processing high-volume transaction data, working closely with the payments and infra teams.",
    responsibilities: ["Design and ship REST/gRPC services handling transaction workflows", "Own schema migrations and query performance for core tables", "Partner with infra on scaling and observability", "Participate in on-call rotation"],
    requiredSkills: ["Node.js", "PostgreSQL", "System Design"],
    niceToHaveSkills: ["Kafka", "Fintech Experience"],
    talentPreferences: { experienceLevel: "4-8 years", availability: "Within 2 weeks", preferredIndustry: "Fintech", preferredDomain: "Backend Engineering", workSchedule: "Remote", portfolioRequired: false, relevantExperience: "High-scale backend systems" },
  },
];

const ALL_STAGES = ["Matching", "Review", "Interviewing", "Hired"] as const;

const AVATAR_COLORS = [
  "bg-[#e8ddf5] text-[#6b3fa0] dark:bg-[#3d2a52] dark:text-[#d4b8f0]",
  "bg-[#dde9f5] text-[#3a6ea5] dark:bg-[#1f3a52] dark:text-[#a8cdf0]",
  "bg-[#f5e3dd] text-[#a5543a] dark:bg-[#4a2e22] dark:text-[#f0b8a0]",
  "bg-[#ddf5e6] text-[#3a9a5c] dark:bg-[#1f3d2a] dark:text-[#a0f0be]",
];

const STRONG_MATCH_PROFILES: Record<string, { name: string; yrs: number; tags: string }> = {
  AK: { name: "Ankit Kumar", yrs: 3, tags: "Figma · SaaS" },
  RS: { name: "Riya Sharma", yrs: 2, tags: "Figma · UX Research" },
  MP: { name: "Meera Pillai", yrs: 4, tags: "Figma · UI/UX" },
  NV: { name: "Nisha Verma", yrs: 5, tags: "Illustrator · Branding" },
  SJ: { name: "Sanjay Joshi", yrs: 6, tags: "Illustrator · Identity" },
  PT: { name: "Priya Tiwari", yrs: 3, tags: "Figma · Branding" },
  DG: { name: "Devika Gupta", yrs: 4, tags: "Excel · Analytics" },
  LM: { name: "Lakshmi Menon", yrs: 1, tags: "Notion · Research" },
};

function rowNeedsAttention(o: Opportunity): boolean {
  /* Stage "Matching" is excluded: the AI is still screening the full
     practicing pool, which is advertised elsewhere as a normal 1-2 day
     process (see the AI Matching stat card copy) — flagging it as
     needing attention after just 3 hours would contradict that SLA. */
  return (
    o.postingStatus === "Active" &&
    o.stage !== "Hired" &&
    o.stage !== "Matching" &&
    o.updatedMinutes >= 180
  );
}

const ALL_POSTING_STATUSES = ["Active", "Paused", "Expired"] as const;

type SortColumn = "title" | "stage" | "talent";

const sortAccessor: Record<Exclude<SortColumn, "talent">, (o: Opportunity) => string | number> = {
  title: (o) => o.title,
  stage: (o) => o.stage,
};

function SortableHead<T extends string>({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: T;
  activeColumn: T | null;
  direction: "asc" | "desc";
  onSort: (column: T) => void;
}) {
  const active = column === activeColumn;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="hover:text-foreground inline-flex items-center gap-1.5 outline-none"
      aria-label={`Sort by ${label}${active ? (direction === "asc" ? ", ascending" : ", descending") : ""}`}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )
      ) : (
        <ChevronDown className="text-muted-foreground/50 size-3" />
      )}
    </button>
  );
}

/* Sort-header affordance for the shortlist table, wired to TanStack Table's
   own column-sorting API instead of local column/direction state (see
   SortableHead above, still used by the separate Opportunities table).
   Structural (duck-typed) prop type — accepts TanStack's real Column object
   without importing its generic-heavy Column<...> type. */
type SortableTableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
};

function TanStackSortableHead({ label, column }: { label: string; column: SortableTableColumn }) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className="hover:text-foreground inline-flex items-center gap-1.5 outline-none"
      aria-label={`Sort by ${label}${sorted ? (sorted === "asc" ? ", ascending" : ", descending") : ""}`}
    >
      {label}
      {sorted === "asc" ? (
        <ChevronUp className="size-3" />
      ) : sorted === "desc" ? (
        <ChevronDown className="size-3" />
      ) : (
        <ChevronDown className="text-muted-foreground/50 size-3" />
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Opportunity Details

   Reached by clicking an opportunity's title or its "View details" row
   action. HireStepX doesn't hand an employer a resume pile to sift through —
   the AI has already evaluated the full practicing candidate pool and
   surfaced only a curated, evidence-scored shortlist, so this screen leads
   with that shortlist and its evidence, not a generic ATS funnel/headcount
   widget. There's no staffing-agency layer either: the logged-in employer
   IS the hiring manager, so there's no separate "assigned to" contact card.
   ───────────────────────────────────────────────────────────────────── */
const postingStatusBadgeVariant: Record<Opportunity["postingStatus"], "default" | "secondary" | "outline"> = {
  Active: "default",
  Paused: "secondary",
  Expired: "outline",
};

function candidateStageFor(opportunityStage: string, index: number): string {
  if (opportunityStage === "Hired") return index === 0 ? "Hired" : "Not selected";
  if (opportunityStage === "Interviewing") return index < 2 ? "Interviewing" : "Shortlisted";
  return "Shortlisted";
}

/* For candidates who didn't make it, "Not selected" alone hides where they
   actually dropped out of the process — round-level detail (which round
   they reached, or that they're still waiting to hear back) is what a
   hiring manager actually wants to see at a glance.

   The index % 4 cycling below only SEEDS the mock "Not selected" candidates
   that come out of buildShortlist — it's mock-data flavor, not a real
   assignment rule. Once an employer takes a live action (advance/reject),
   that candidate's stage and round status are tracked for real via
   stageOverrides (see advanceCandidateStage / rejectCandidate) and this
   pool is never consulted for them again. */
const ROUND_STATUS_POOL = ["Round 2", "Round 1", "Awaiting reply", "Refused"] as const;

function candidateRoundStatus(stage: string, index: number): string {
  if (stage !== "Not selected") return stage;
  return ROUND_STATUS_POOL[index % ROUND_STATUS_POOL.length];
}

function candidateDisplayName(c: { unlocked: boolean; originalIndex: number; profile: { name: string } }): string {
  return c.unlocked ? c.profile.name : `Candidate ${c.originalIndex + 1}`;
}

const roundStatusIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  Hired: CheckCircle2,
  Interviewing: MessageSquare,
  Shortlisted: ClipboardList,
  "Round 1": Hourglass,
  "Round 2": Hourglass,
  "Awaiting reply": MailQuestion,
  Refused: XCircle,
};

/* Copper is the evidence-score/pipeline-stat accent (see --copper theme
   var above). Centralized here so the ~10 call sites that color a number
   with it don't each hand-roll the same arbitrary-value string. */
const COPPER_TEXT = "text-[var(--copper)]";
const COPPER_BG = "bg-[var(--copper)]";

/* Full-shortlist synthesis for the details page. The main Opportunities
   table only ever needs 2-3 strongMatchInitials for its row-level avatar
   preview, but the details page's stat card promises `topMatches`
   candidates (the actual shortlist size) — this pool exists so that
   number is always backed by real, openable candidate rows instead of
   silently stopping at 2-3. */
const CANDIDATE_NAME_POOL: { name: string; yrs: number }[] = [
  { name: "Ankit Kumar", yrs: 3 },
  { name: "Riya Sharma", yrs: 2 },
  { name: "Meera Pillai", yrs: 4 },
  { name: "Nisha Verma", yrs: 5 },
  { name: "Sanjay Joshi", yrs: 6 },
  { name: "Priya Tiwari", yrs: 3 },
  { name: "Devika Gupta", yrs: 4 },
  { name: "Lakshmi Menon", yrs: 1 },
];

/* Matches the real employer console's notice-period options
   (app/(employer)/employer/requirements/[id]/page.tsx) — resume-derived,
   self-reported, shown regardless of unlock state. */
const NOTICE_PERIOD_POOL: string[] = ["Immediate", "15 days", "30 days", "60 days"];

function initialsFor(name: string): string {
  return name.split(" ").map((part) => part[0]).join("");
}

/* Standing pricing model: candidates unlock in fixed batches of
   BUNDLE_SIZE for a flat BATCH_PRICE. A shortlist longer than one batch
   needs a separate ₹299 purchase per additional batch (see
   purchasedBatches in OpportunityDetailsView). An employer who only
   wants one specific candidate can instead unlock them individually for
   SINGLE_UNLOCK_PRICE via the row action menu (see purchasedSingles) —
   the per-candidate price is set above the effective per-candidate batch
   rate (₹29.90) so batch unlock stays the better deal at scale. */
const BUNDLE_SIZE = 10;
const BATCH_PRICE_INR = 299;
const BATCH_PRICE = `₹${BATCH_PRICE_INR}`;
const SINGLE_UNLOCK_PRICE_INR = 59;
const SINGLE_UNLOCK_PRICE = `₹${SINGLE_UNLOCK_PRICE_INR}`;
const CANDIDATE_PAGE_SIZE = 20;

function buildShortlist(opportunity: Opportunity) {
  const n = opportunity.topMatches;
  if (n === 0) return [];
  const skillPool = [...opportunity.requiredSkills, ...opportunity.niceToHaveSkills];
  const spread = opportunity.scoreHigh - opportunity.scoreLow;
  return Array.from({ length: n }, (_, index) => {
    const person = CANDIDATE_NAME_POOL[index % CANDIDATE_NAME_POOL.length];
    const score = n <= 1 ? opportunity.avgScore : Math.round(opportunity.scoreHigh - (spread * index) / (n - 1));
    const stage = candidateStageFor(opportunity.stage, index);
    const tags = skillPool.length
      ? [skillPool[index % skillPool.length], skillPool[(index + 1) % skillPool.length]].join(" · ")
      : opportunity.type;
    /* CANDIDATE_NAME_POOL only has 8 entries; every shortlist so far
       tops out at 8, so this never wrapped. A shortlist longer than
       the pool (e.g. the 24-candidate multi-batch demo opportunity)
       would otherwise recycle the same initials for rows 9-16 and
       17-24, colliding on every initials-keyed Set/Record in this
       screen (selectedCandidates, stageOverrides, React keys). Suffix
       a wrap counter so identity stays unique past the 8th candidate. */
    const wrapCount = Math.floor(index / CANDIDATE_NAME_POOL.length);
    return {
      initials: wrapCount > 0 ? `${initialsFor(person.name)}${wrapCount + 1}` : initialsFor(person.name),
      profile: { name: person.name, yrs: person.yrs, tags },
      score,
      stage,
      roundStatus: candidateRoundStatus(stage, index),
      /* Only identity/contact is unlock-gated — every evidence signal
         (score, roster, sessions, notice period, CTC, skills) is visible
         to the employer either way, matching the real console's rule.
         Locked by default; unlocked either via a BUNDLE_SIZE batch
         purchase or a single-candidate purchase (see purchasedBatches /
         purchasedSingles in OpportunityDetailsView). */
      unlocked: false,
      rosterScore: Math.min(99, score + 4),
      sessionsCompleted: 8 + ((person.yrs * 7) % 20),
      noticePeriod: NOTICE_PERIOD_POOL[index % NOTICE_PERIOD_POOL.length],
      currentCtc: 6 + person.yrs * 3,
    };
  });
}

/* Full data-table parity migration (TanStack Table v9, "Base UI" headless
   API — see src/components/data-table.tsx for this project's reference
   implementation): row selection, column visibility, and sorting for the
   shortlist table below are now driven by TanStack Table state rather than
   hand-rolled useState. Deliberately NOT ported from that reference: its
   @dnd-kit drag-to-reorder (rank here is fixed by match score/originalIndex;
   reordering would corrupt batch-membership math) and its Drawer-based
   TableCellViewer (a row click here already opens a full candidate profile
   page, so a drawer would be a redundant second affordance). Pagination and
   the stage/search filters stay external pre-filters, same as before. */
type CandidateRow = ReturnType<typeof buildShortlist>[number] & { originalIndex: number; unlocked: boolean };

const candidateTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const candidateColumnHelper = createColumnHelper<typeof candidateTableFeatures, CandidateRow>();

/* Friendly labels for the "Columns" visibility dropdown — column ids like
   "ctc"/"notice" don't read well title-cased on their own. */
const candidateColumnLabels: Record<string, string> = {
  experience: "Experience",
  roster: "Roster & sessions",
  notice: "Notice period",
  ctc: "Current CTC",
  skills: "Skills",
  score: "Match %",
  stage: "Stage",
};

function evidenceTier(score: number): string {
  if (score >= 90) return "Strong signal";
  if (score >= 75) return "Solid signal";
  return "Mixed signal";
}

function synthesizeStarBreakdown(profile: { name: string; yrs: number; tags: string }, score: number) {
  const skills = profile.tags.split(" · ");
  return [
    { label: "Situation", note: `Framed the problem in a live ${skills[0] ?? "practice"} session`, score: Math.max(0, Math.min(100, score + 3)) },
    { label: "Task", note: "Defined the specific goal and constraints up front", score: Math.max(0, Math.min(100, score - 4)) },
    { label: "Action", note: `Applied ${skills.join(" and ")} to work through it`, score },
    { label: "Result", note: "Delivered a measurable outcome, reviewed by the AI panel", score: Math.max(0, Math.min(100, score + 2)) },
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   Candidate Profile — synthesized evidence

   Session history and portfolio artifacts aren't first-class fields on
   buildShortlist's candidate shape, so these derive deterministically from
   fields that already exist (initials, tags, score, sessionsCompleted) —
   same output every render for the same candidate, never Math.random(), so
   the profile page never flickers between opens and never desyncs from the
   row it was opened from. */
function seededVariance(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % mod;
}

function synthesizeSessionHistory(candidate: {
  initials: string;
  profile: { tags: string };
  sessionsCompleted: number;
  score: number;
}): Array<{ label: string; daysAgo: number; score: number }> {
  const skills = candidate.profile.tags.split(" · ");
  const count = Math.min(3, Math.max(1, Math.round(candidate.sessionsCompleted / 4)));
  return Array.from({ length: count }, (_, index) => {
    const skill = skills[index % skills.length] ?? "General practice";
    const variance = seededVariance(`${candidate.initials}-score-${index}`, 9) - 4;
    return {
      label: `${skill} mock interview`,
      daysAgo: 2 + index * 5 + seededVariance(`${candidate.initials}-days-${index}`, 4),
      score: Math.max(50, Math.min(99, candidate.score + variance)),
    };
  });
}

/* Portfolio catalog keyed by the same skill tags buildShortlist already
   assigns — every seed opportunity's requiredSkills/niceToHaveSkills has an
   entry, so every candidate on every posting gets plausible artifacts
   instead of a generic placeholder. Titles/types are portfolio EVIDENCE, so
   they stay visible regardless of lock state; only the outbound "View"
   action gates on `unlocked`, matching the rest of this screen's rule. */
const PORTFOLIO_CATALOG: Record<string, Array<{ title: string; type: string }>> = {
  Figma: [{ title: "Mobile onboarding redesign", type: "Case study" }],
  "Design Systems": [{ title: "Component library rebuild", type: "Case study" }],
  "Interaction Design": [{ title: "Checkout flow micro-interactions", type: "Prototype" }],
  "SaaS Experience": [{ title: "B2B dashboard information architecture", type: "Case study" }],
  "Motion Design": [{ title: "Onboarding motion prototype", type: "Prototype" }],
  Illustrator: [{ title: "Icon set for a fintech app", type: "Visual assets" }],
  "Brand Identity": [{ title: "Full brand identity system", type: "Case study" }],
  Typography: [{ title: "Editorial type system", type: "Case study" }],
  "Motion Logo": [{ title: "Animated logo lockup", type: "Motion sample" }],
  "Packaging Design": [{ title: "Retail packaging suite", type: "Visual assets" }],
  Excel: [{ title: "Growth dashboard model", type: "Data model" }],
  SQL: [{ title: "Cohort analysis query set", type: "Data model" }],
  "Data Visualization": [{ title: "Retention funnel dashboard", type: "Dashboard" }],
  "Looker/Tableau": [{ title: "Acquisition metrics dashboard", type: "Dashboard" }],
  "Growth Analytics": [{ title: "Funnel anomaly writeup", type: "Report" }],
  "User Research": [{ title: "Usability study — 12 participants", type: "Research report" }],
  Prototyping: [{ title: "Clickable onboarding prototype", type: "Prototype" }],
  "Startup Experience": [{ title: "0-to-1 product build notes", type: "Case study" }],
  Notion: [{ title: "Research repository template", type: "Toolkit" }],
  "Survey Design": [{ title: "Candidate survey instrument", type: "Toolkit" }],
  "Web Design": [{ title: "Marketing site redesign", type: "Case study" }],
  "Responsive Design": [{ title: "Responsive component audit", type: "Case study" }],
  Webflow: [{ title: "No-code marketing site build", type: "Case study" }],
  Copywriting: [{ title: "Landing page copy deck", type: "Writing sample" }],
  "Node.js": [{ title: "Payments service architecture", type: "Technical writeup" }],
  PostgreSQL: [{ title: "Schema migration playbook", type: "Technical writeup" }],
  "System Design": [{ title: "High-scale transaction system design", type: "Technical writeup" }],
  Kafka: [{ title: "Event streaming pipeline design", type: "Technical writeup" }],
  "Fintech Experience": [{ title: "Ledger reconciliation notes", type: "Technical writeup" }],
};

function synthesizePortfolioArtifacts(candidate: {
  profile: { tags: string };
}): Array<{ title: string; type: string; skill: string }> {
  const skills = candidate.profile.tags.split(" · ");
  const items = skills.flatMap((skill) => (PORTFOLIO_CATALOG[skill] ?? []).map((item) => ({ ...item, skill })));
  return items.length > 0
    ? items
    : [{ title: `${skills[0] ?? "Recent"} work sample`, type: "Work sample", skill: skills[0] ?? "General" }];
}

function computeSkillMatch(
  candidate: { profile: { tags: string } },
  opportunity: Opportunity,
): { matched: string[]; missing: string[] } {
  const candidateSkills = new Set(candidate.profile.tags.split(" · "));
  return {
    matched: opportunity.requiredSkills.filter((skill) => candidateSkills.has(skill)),
    missing: opportunity.requiredSkills.filter((skill) => !candidateSkills.has(skill)),
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   "Why this candidate" — the case for the role

   The screen's evidence sections (STAR, sessions, portfolio) are raw
   signal; an employer scanning a shortlist still has to do the work of
   connecting them to THIS opportunity. These two helpers do that
   connecting work explicitly — reusing only fields that already exist
   on the candidate/opportunity (skillMatch, STAR scores, notice period,
   currentCtc, opportunity.pay) rather than inventing new data — and
   render as the fit reasoning + pricing guidance a recruiter would
   otherwise have to derive by hand from the raw evidence below. */
function synthesizeFitReasons(
  candidate: {
    profile: { yrs: number };
    score: number;
    noticePeriod: string;
    sessionsCompleted: number;
  },
  opportunity: Opportunity,
  skillMatch: { matched: string[]; missing: string[] },
  starBreakdown: Array<{ label: string; score: number }>,
): string[] {
  const reasons: string[] = [];

  reasons.push(
    skillMatch.missing.length === 0
      ? `Demonstrates all ${skillMatch.matched.length} required skills for this role, not just a resume claim — each is backed by a scored practice session.`
      : `Demonstrates ${skillMatch.matched.length} of ${skillMatch.matched.length + skillMatch.missing.length} required skills (${skillMatch.matched.join(", ")}); ${skillMatch.missing.join(", ")} untested — probe this in the interview.`,
  );

  const strongestStar = starBreakdown.reduce((best, star) => (star.score > best.score ? star : best), starBreakdown[0]);
  reasons.push(
    `Strongest evidence in ${strongestStar.label} (${strongestStar.score}%) — ${strongestStar.note.charAt(0).toLowerCase()}${strongestStar.note.slice(1)}.`,
  );

  const experienceLevel = opportunity.talentPreferences.experienceLevel;
  reasons.push(
    `${candidate.profile.yrs} yrs of experience against a role calling for ${experienceLevel}, verified across ${candidate.sessionsCompleted} AI-evaluated practice sessions.`,
  );

  const availability = opportunity.talentPreferences.availability;
  const noticeDaysMap: Record<string, number> = { Immediate: 0, "15 days": 15, "30 days": 30, "60 days": 60 };
  const noticeDays = noticeDaysMap[candidate.noticePeriod] ?? 30;
  const availabilityThreshold = availability.toLowerCase().includes("immediate")
    ? 0
    : availability.toLowerCase().includes("1 week")
      ? 7
      : availability.toLowerCase().includes("2 week")
        ? 14
        : 30;
  reasons.push(
    noticeDays <= availabilityThreshold
      ? `${candidate.noticePeriod} notice period lines up with this role's need for talent ${availability.toLowerCase()}.`
      : `${candidate.noticePeriod} notice period is slower than this role's ${availability.toLowerCase()} target — factor that into your timeline.`,
  );

  return reasons;
}

function parsePayAmount(pay: string): { amount: number; period: "month" | "fixed" } | null {
  const match = pay.match(/([\d,]+)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, period: pay.includes("/month") ? "month" : "fixed" };
}

function synthesizeOfferRecommendation(
  candidate: { currentCtc: number; score: number },
  opportunity: Opportunity,
): {
  recommended: number;
  period: "month" | "fixed";
  budgetAmount: number;
  candidateMonthlyEquivalent: number;
  deltaPct: number;
  stance: "premium" | "at-budget" | "negotiate-down";
  rationale: string;
} | null {
  const parsed = parsePayAmount(opportunity.pay);
  if (!parsed) return null;

  const candidateMonthlyEquivalent = Math.round((candidate.currentCtc * 100000) / 12);
  const tier = evidenceTier(candidate.score);
  const multiplier = tier === "Strong signal" ? 1.08 : tier === "Solid signal" ? 1.0 : 0.9;
  const recommended = Math.round((parsed.amount * multiplier) / 500) * 500;
  const deltaPct = Math.round(((recommended - parsed.amount) / parsed.amount) * 100);
  const stance: "premium" | "at-budget" | "negotiate-down" =
    deltaPct > 2 ? "premium" : deltaPct < -2 ? "negotiate-down" : "at-budget";

  const rationale =
    stance === "premium"
      ? `${tier} evidence justifies offering above the listed budget to close quickly, before a competing posting does.`
      : stance === "negotiate-down"
        ? `Evidence shows gaps against this role's required skills — anchor below the listed budget and let the STAR breakdown explain why.`
        : `Evidence lines up cleanly with the listed budget — no premium or discount is warranted either way.`;

  return { recommended, period: parsed.period, budgetAmount: parsed.amount, candidateMonthlyEquivalent, deltaPct, stance, rationale };
}

/* ─────────────────────────────────────────────────────────────────────────
   Resume intelligence + skill-trend analytics

   Mirrors the field shapes the real product already captures elsewhere —
   ResumeProfile from /api/analyze-resume (headline, seniorityLevel,
   industries, interviewStrengths/Gaps, careerTrajectory, resumeScore,
   promotionSignals) and the per-skill progress-tracking analytics
   (SkillTrend: latestScore, deltaVsLast, trend, sparkline) — so this
   employer-facing profile reads like a real synthesis of the candidate's
   resume analysis and practice-session analytics, not a one-off invention.
   Same deterministic-seed pattern as the rest of this file: no
   Math.random(), so the profile never flickers between opens. */
const SENIORITY_BANDS: Array<{ maxYrs: number; label: string }> = [
  { maxYrs: 2, label: "Early career" },
  { maxYrs: 5, label: "Mid-level" },
  { maxYrs: 8, label: "Senior" },
  { maxYrs: Infinity, label: "Lead / Staff" },
];

const PROMOTION_SIGNAL_POOL = [
  "Promoted twice in the last 3 roles",
  "One promotion, on track for the next review cycle",
  "Lateral moves so far, no promotion signal yet",
  "Fast-tracked once, currently in a stretch role",
];

function synthesizeResumeIntelligence(
  candidate: { initials: string; profile: { yrs: number; tags: string }; score: number; currentCtc: number },
  opportunity: Opportunity,
): {
  headline: string;
  seniorityLevel: string;
  industries: string[];
  strengths: string[];
  gaps: string[];
  careerTrajectory: string;
  resumeScore: number;
  promotionSignal: string;
} {
  const tags = candidate.profile.tags.split(" · ");
  const seniorityLevel = SENIORITY_BANDS.find((band) => candidate.profile.yrs <= band.maxYrs)!.label;
  const secondaryIndustryPool = ["Software/IT", "Fintech", "Consumer/D2C"].filter(
    (industry) => industry !== opportunity.talentPreferences.preferredIndustry,
  );
  const industries = [
    opportunity.talentPreferences.preferredIndustry,
    secondaryIndustryPool[seededVariance(`${candidate.initials}-industry`, secondaryIndustryPool.length)],
  ];

  const ctcPerYear = candidate.currentCtc / Math.max(1, candidate.profile.yrs);
  const careerTrajectory =
    ctcPerYear >= 4.5
      ? "Compensation has grown faster than tenure alone would predict — a strong external-market or high-performer signal."
      : ctcPerYear >= 2.5
        ? "Compensation has tracked roughly in line with years of experience — a steady, unremarkable trajectory."
        : "Compensation has grown slower than tenure would predict — worth asking why in the interview.";

  const resumeScore = Math.max(40, Math.min(99, candidate.score - 3 + seededVariance(`${candidate.initials}-resume`, 7)));
  const promotionSignal = PROMOTION_SIGNAL_POOL[seededVariance(`${candidate.initials}-promo`, PROMOTION_SIGNAL_POOL.length)];

  return {
    headline: `${seniorityLevel} ${opportunity.talentPreferences.preferredDomain} professional`,
    seniorityLevel,
    industries,
    strengths: tags.slice(0, 2),
    gaps: tags.slice(2, 3),
    careerTrajectory,
    resumeScore,
    promotionSignal,
  };
}

function synthesizeSkillTrends(candidate: {
  initials: string;
  profile: { tags: string };
  score: number;
}): Array<{ skill: string; latestScore: number; deltaVsLast: number; sparkline: number[] }> {
  const skills = candidate.profile.tags.split(" · ");
  return skills.map((skill, skillIndex) => {
    const sparkline = Array.from({ length: 5 }, (_, pointIndex) => {
      const drift = seededVariance(`${candidate.initials}-${skill}-${pointIndex}`, 10) - 4;
      const progression = pointIndex * 2;
      return Math.max(45, Math.min(99, candidate.score - 8 + progression + drift));
    });
    const latestScore = sparkline[sparkline.length - 1];
    const deltaVsLast = latestScore - sparkline[sparkline.length - 2];
    return { skill, latestScore, deltaVsLast, sparkline };
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Practice depth & communication — mirrors the candidate-side Readiness
   Index (server-handlers/_readiness-core.ts): verdict mix, round-type
   breadth, and a collapsed composure signal. Deliberately excludes RI
   fields that are candidate-private (blind spots, skills going cold,
   negotiation strategy, raw filler/pace/hedging numbers) — an employer
   only sees the aggregate signals that support a hiring decision, never
   the candidate's own coaching or negotiation leverage. Same seeded,
   deterministic pattern as the rest of this file. */
/* Mirrors the real per-focus analyzer pipeline's SessionFocus union
   (server-handlers/analyzers/_types.ts:8-19) minus the "unknown"
   fallback — every one of these has a dedicated scoring module, so an
   employer sees the same round-type vocabulary the AI actually scores
   against, not a generic placeholder list. */
const ROUND_TYPES = [
  "Behavioral",
  "Technical",
  "System design",
  "Strategic",
  "Case study",
  "Salary negotiation",
  "Panel",
  "Campus placement",
  "HR round",
  "Management",
  "Government/PSU",
];

/* Each focus type's analyzer scores a different rubric (technical.ts,
   system-design.ts, hr-round.ts, etc.) — this pulls ONE factual,
   outcome-shaped highlight per type, chosen from the audit of what's
   genuinely differentiated hiring signal vs. candidate-private coaching
   detail (delivery/filler patterns, per-turn remediation, negotiation
   demeanour axes stay excluded, same boundary as synthesizeCommunicationSignals). */
function synthesizeFocusSignal(candidate: { initials: string; score: number }, type: string): string {
  const seed = `${candidate.initials}-focus-${type}`;
  const pct = (mod: number, floor: number) => Math.max(floor, Math.min(99, candidate.score - 5 + seededVariance(seed, mod)));
  switch (type) {
    case "Behavioral":
      return `STAR coverage: ${pct(10, 55)}% of answers hit all four elements`;
    case "Technical":
      return `Edge cases addressed unprompted in ${pct(10, 40)}% of problems`;
    case "System design":
      return `Capacity sizing done in ${pct(10, 35)}% of sessions · ${1 + seededVariance(seed, 3)} failure modes discussed on average`;
    case "Strategic":
      return `${1 + seededVariance(seed, 4)} stakeholders considered per answer · risk ownership named ${pct(10, 40)}% of the time`;
    case "Case study":
      return `Structured framework held through to a stated recommendation in ${pct(10, 45)}% of sessions`;
    case "Salary negotiation": {
      const battaScore = pct(10, 40);
      const label = battaScore >= 80 ? "Strong" : battaScore >= 60 ? "Moderate" : "Developing";
      return `BATNA strength: ${label} · anchored ${2 + seededVariance(seed, 12)}% above the opening offer`;
    }
    case "Panel":
      return `Tone adapted across ${1 + seededVariance(seed, 3)} of the panel's personas`;
    case "Campus placement":
      return `Project ownership demonstrated in ${pct(10, 45)}% of technical answers`;
    case "HR round": {
      const flags = seededVariance(seed, 3);
      return `${flags} HR red flag${flags === 1 ? "" : "s"} surfaced · counter-offer handling stayed on-message`;
    }
    case "Management":
      return `Decision ownership shown in ${pct(10, 45)}% of scenarios · ${1 + seededVariance(seed, 3)} coaching examples cited`;
    case "Government/PSU":
      return `Public-service motivation cited in ${pct(10, 45)}% of answers`;
    default:
      return `${pct(10, 50)}% average rubric score across evaluated sessions`;
  }
}

function synthesizeVerdictMix(candidate: {
  initials: string;
  score: number;
  sessionsCompleted: number;
}): Array<{ label: string; count: number; tone: "positive" | "neutral" | "negative" }> {
  const tier = evidenceTier(candidate.score);
  const weights =
    tier === "Strong signal"
      ? [0.12, 0.55, 0.27, 0.06, 0]
      : tier === "Solid signal"
        ? [0.04, 0.34, 0.44, 0.15, 0.03]
        : [0, 0.14, 0.44, 0.32, 0.1];
  const total = Math.max(1, candidate.sessionsCompleted);
  const raw = weights.map((w) => w * total);
  const counts = raw.map(Math.floor);
  const remainder = total - counts.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || seededVariance(`${candidate.initials}-vm-${b.i}`, 10) - seededVariance(`${candidate.initials}-vm-${a.i}`, 10));
  for (let k = 0; k < remainder; k++) counts[byFraction[k].i] += 1;
  const labels = ["Strong hire", "Hire", "Lean hire", "No hire", "Strong no"];
  const tones: Array<"positive" | "neutral" | "negative"> = ["positive", "positive", "neutral", "negative", "negative"];
  return labels.map((label, i) => ({ label, count: counts[i], tone: tones[i] }));
}

function synthesizeCadence(candidate: {
  initials: string;
  sessionsCompleted: number;
}): { totalSessions: number; totalHours: number; practiced: string[]; notPracticed: string[] } {
  const totalHours = Math.round(candidate.sessionsCompleted * 0.6 * 10) / 10;
  const practicedCount = Math.min(ROUND_TYPES.length, Math.max(1, Math.round(candidate.sessionsCompleted / 3)));
  const start = seededVariance(`${candidate.initials}-roundstart`, ROUND_TYPES.length);
  const ordered = [...ROUND_TYPES.slice(start), ...ROUND_TYPES.slice(0, start)];
  return {
    totalSessions: candidate.sessionsCompleted,
    totalHours,
    practiced: ordered.slice(0, practicedCount),
    notPracticed: ordered.slice(practicedCount),
  };
}

function synthesizeCommunicationSignals(candidate: {
  initials: string;
  score: number;
}): { quantifiedPct: number; ownershipPct: number; composureScore: number; composureNote: string } {
  const quantifiedPct = Math.max(40, Math.min(97, candidate.score - 6 + seededVariance(`${candidate.initials}-quant`, 9)));
  const ownershipPct = Math.max(40, Math.min(97, candidate.score - 3 + seededVariance(`${candidate.initials}-own`, 9)));
  const composureScore = Math.max(45, Math.min(99, candidate.score - 7 + seededVariance(`${candidate.initials}-composure`, 11)));
  const composureNote =
    composureScore >= 85
      ? "Calm, measured pace under follow-up pressure — minimal filler words."
      : composureScore >= 65
        ? "Generally composed, with brief hesitation on tougher follow-ups."
        : "Shows strain under pressure — pace and filler words spike on harder questions.";
  return { quantifiedPct, ownershipPct, composureScore, composureNote };
}

function synthesizeReadinessTrend(candidate: { initials: string; score: number }): number[] {
  return Array.from({ length: 5 }, (_, index) => {
    const drift = seededVariance(`${candidate.initials}-ri-${index}`, 8) - 3;
    const progression = index * 3;
    return Math.max(35, Math.min(99, candidate.score - 12 + progression + drift));
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   AI verdict, risk flags & education — the remaining unused-but-real data

   Mirrors fields the real session report already computes per interview
   (SessionReportView.tsx: verdict, redFlags, biasFindings/fairnessSignals)
   and the resume parser's education/certifications arrays — surfaced here
   because an employer deciding to hire wants the AI's bottom-line call and
   any risk it flagged, not just the raw scores above. Same deterministic
   seed pattern as the rest of this file. */
const RISK_FLAG_POOL = [
  "One answer's timeline didn't fully line up with the resume — worth clarifying live.",
  "Ran long past the STAR window in one response; watch for concise communication under pressure.",
  "Leaned on vague terms (\"a lot\", \"significant\") instead of hard numbers in one session.",
  "Showed hesitation on a follow-up probe question in one session.",
];

const DEGREE_POOL = [
  "B.Tech, Computer Science",
  "B.Des, Visual Communication",
  "MBA, Marketing",
  "B.Com, Finance",
  "M.Sc, Data Science",
];

const CERTIFICATION_POOL = [
  "Google UX Design Certificate",
  "AWS Certified Solutions Architect",
  "Meta Front-End Developer Certificate",
  "PMP",
  "Certified ScrumMaster",
];

function synthesizeVerdictAndRisk(candidate: {
  initials: string;
  score: number;
}): { verdict: string; verdictNote: string; flags: string[]; fairnessNote: string } {
  const tier = evidenceTier(candidate.score);
  const verdict =
    tier === "Strong signal" ? "Strong hire" : tier === "Solid signal" ? "Hire" : "Proceed with caution";
  const verdictNote =
    tier === "Strong signal"
      ? "Consistently scored above-bar across every practice session the AI evaluated."
      : tier === "Solid signal"
        ? "Solid, consistent performance with no major gaps flagged by the AI panel."
        : "Evidence is mixed across sessions — validate the flagged areas below before advancing.";
  const flagCount =
    tier === "Strong signal"
      ? seededVariance(`${candidate.initials}-flagcount`, 2)
      : tier === "Solid signal"
        ? seededVariance(`${candidate.initials}-flagcount`, 3)
        : 1 + seededVariance(`${candidate.initials}-flagcount`, 2);
  const flags = Array.from({ length: flagCount }, (_, i) =>
    RISK_FLAG_POOL[(seededVariance(`${candidate.initials}-flag-${i}`, RISK_FLAG_POOL.length) + i) % RISK_FLAG_POOL.length],
  ).filter((flag, index, arr) => arr.indexOf(flag) === index);
  const fairnessNote = "No bias indicators detected across sessions — scoring is based solely on response content.";
  return { verdict, verdictNote, flags, fairnessNote };
}

function synthesizeEducation(candidate: { initials: string }): {
  degree: string;
  certification: string | null;
} {
  const degree = DEGREE_POOL[seededVariance(`${candidate.initials}-degree`, DEGREE_POOL.length)];
  const hasCert = seededVariance(`${candidate.initials}-hascert`, 3) !== 0;
  const certification = hasCert
    ? CERTIFICATION_POOL[seededVariance(`${candidate.initials}-cert`, CERTIFICATION_POOL.length)]
    : null;
  return { degree, certification };
}

function SnapshotCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-md">
        <Icon className="text-muted-foreground size-3.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-[11px]">{label}</span>
        <span className="text-foreground text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Candidate Profile

   The full-page destination for a single candidate, reached by clicking
   their shortlist row. This is the moment an employer actually decides
   whether to unlock/advance someone, so it's deliberately the most
   evidence-dense screen in the product: every signal the row-level Evidence
   dialog shows PLUS roster/session detail, per-competency STAR notes,
   synthesized practice-session history, portfolio artifacts, and a
   required-skills match against this specific opportunity — all visible
   regardless of lock state, per the "evidence always visible, only identity
   gated" rule. Only identity (name, resume download, LinkedIn, portfolio
   links) stays behind the same unlock gate as everywhere else on this
   screen. */
function CandidateProfileView({
  candidate,
  opportunity,
  postingActive,
  onUnlockSingle,
  onAdvanceStage,
  onReject,
}: {
  candidate: ReturnType<typeof buildShortlist>[number] & { originalIndex: number; unlocked: boolean };
  postingActive: boolean;
  opportunity: Opportunity;
  onUnlockSingle: () => void;
  onAdvanceStage: () => void;
  onReject: () => void;
}) {
  const c = candidate;
  const canAdvance = postingActive && c.unlocked && (c.stage === "Shortlisted" || c.stage === "Interviewing");
  const canReject = postingActive && c.unlocked && c.stage !== "Hired" && c.roundStatus !== "Refused";
  const canUnlockSingle = postingActive && !c.unlocked;
  const RoundIcon = roundStatusIcon[c.roundStatus];
  const starBreakdown = synthesizeStarBreakdown(c.profile, c.score);
  const sessions = synthesizeSessionHistory(c);
  const portfolio = synthesizePortfolioArtifacts(c);
  const skillMatch = computeSkillMatch(c, opportunity);
  const fitReasons = synthesizeFitReasons(c, opportunity, skillMatch, starBreakdown);
  const offer = synthesizeOfferRecommendation(c, opportunity);
  const OfferStanceIcon = offer?.stance === "premium" ? TrendingUp : offer?.stance === "negotiate-down" ? TrendingDown : Minus;
  const resumeIntel = synthesizeResumeIntelligence(c, opportunity);
  const skillTrends = synthesizeSkillTrends(c);
  const offerTier = evidenceTier(c.score);
  const offerMultiplier = offerTier === "Strong signal" ? 1.08 : offerTier === "Solid signal" ? 1.0 : 0.9;
  const verdictAndRisk = synthesizeVerdictAndRisk(c);
  const education = synthesizeEducation(c);
  const verdictMix = synthesizeVerdictMix(c);
  const cadence = synthesizeCadence(c);
  const communication = synthesizeCommunicationSignals(c);
  const readinessTrend = synthesizeReadinessTrend(c);
  const totalVerdictSessions = Math.max(1, c.sessionsCompleted);

  const verdictBadgeVariant =
    verdictAndRisk.verdict === "Strong hire" ? "default" : verdictAndRisk.verdict === "Hire" ? "secondary" : "outline";

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            className={cn("size-14", c.unlocked ? AVATAR_COLORS[c.originalIndex % AVATAR_COLORS.length] : "bg-muted")}
          >
            <AvatarFallback className={cn("text-lg", !c.unlocked && "text-muted-foreground")}>
              {c.unlocked ? c.initials : <Lock className="size-5" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground text-xl font-semibold">{candidateDisplayName(c)}</h1>
              <Badge
                variant={c.stage === "Hired" ? "default" : c.roundStatus === "Refused" ? "outline" : "secondary"}
                className="gap-1.5"
              >
                {RoundIcon && <RoundIcon className="size-3.5" />}
                {c.roundStatus}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="size-3.5" />
                {c.profile.yrs} yrs experience
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                {c.noticePeriod} notice
              </span>
              <span className="flex items-center gap-1.5">
                <IndianRupee className="size-3.5" />
                {c.currentCtc} LPA current CTC
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!c.unlocked ? (
            <Button onClick={onUnlockSingle} disabled={!canUnlockSingle}>
              <Lock className="size-4" />
              Unlock candidate — {SINGLE_UNLOCK_PRICE}
            </Button>
          ) : (
            <>
              <Button variant="outline">
                <FileDown className="size-4" />
                Download resume
              </Button>
              <Button variant="outline">
                <Link2 className="size-4" />
                View LinkedIn
              </Button>
            </>
          )}
          {canAdvance && (
            <Button onClick={onAdvanceStage}>
              <ArrowRight className="size-4" />
              {c.stage === "Shortlisted" ? "Advance to interviewing" : "Mark as hired"}
            </Button>
          )}
          {canReject && (
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={onReject}>
              <XCircle className="size-4" />
              Reject
            </Button>
          )}
        </div>
      </div>

      {/* Evidence KPI cards — the shadcn/ui "Section Cards" dashboard
          pattern (description → big tabular number → corner badge → two-line
          footer insight), ported directly from ui.shadcn.com/blocks
          (dashboard-01 / section-cards.tsx) instead of a hand-rolled flat
          strip. Copper stays reserved for evidence-signal numerals per this
          file's convention; card chrome itself stays neutral. */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardDescription>Evidence score</CardDescription>
            <CardTitle className={cn(COPPER_TEXT, "text-2xl font-semibold tabular-nums")}>{c.score}%</CardTitle>
            <CardAction>
              <Badge variant="outline">
                <ShieldCheck className={cn(COPPER_TEXT, "size-3")} />
                {evidenceTier(c.score)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 font-medium">Backed by {c.sessionsCompleted} AI-evaluated sessions</div>
            <div className="text-muted-foreground">STAR-scored across every practice round</div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>AI verdict</CardDescription>
            <CardTitle className="text-2xl font-semibold">{verdictAndRisk.verdict}</CardTitle>
            <CardAction>
              <Badge variant={verdictBadgeVariant}>{verdictAndRisk.verdict}</Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 font-medium">{verdictAndRisk.verdictNote}</div>
            <div className="text-muted-foreground">{totalVerdictSessions} sessions considered</div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Required skills</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {skillMatch.matched.length}/{opportunity.requiredSkills.length}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {skillMatch.missing.length === 0 ? (
                  <Check className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {skillMatch.missing.length === 0 ? "Full match" : `${skillMatch.missing.length} gap`}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 font-medium">
              {skillMatch.matched.length} of {opportunity.requiredSkills.length} required skills demonstrated
            </div>
            <div className="text-muted-foreground">
              {skillMatch.missing.length === 0 ? "No gaps against this role" : `Untested: ${skillMatch.missing.join(", ")}`}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Practice sessions</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{c.sessionsCompleted}</CardTitle>
            <CardAction>
              <Badge variant="outline">
                <TrendingUp className="size-3" />
                {cadence.totalHours}h
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 font-medium">{cadence.practiced.length} of {ROUND_TYPES.length} round types practiced</div>
            <div className="text-muted-foreground">
              {cadence.notPracticed.length === 0 ? "Full round-type coverage" : `Not yet: ${cadence.notPracticed.join(", ")}`}
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Risk flags</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{verdictAndRisk.flags.length}</CardTitle>
            <CardAction>
              <Badge variant={verdictAndRisk.flags.length === 0 ? "outline" : "destructive"}>
                {verdictAndRisk.flags.length === 0 ? <Check className="size-3" /> : <TrendingDown className="size-3" />}
                {verdictAndRisk.flags.length === 0 ? "Clean" : "Flagged"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <div className="line-clamp-1 font-medium">
              {verdictAndRisk.flags.length === 0 ? "Nothing surfaced across sessions" : verdictAndRisk.flags[0]}
            </div>
            <div className="text-muted-foreground">{verdictAndRisk.fairnessNote}</div>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <Tabs defaultValue="overview" className="gap-4">
          <div className="bg-muted/40 border-border/60 sticky top-0 z-10 -mx-6 border-b px-6 py-3 md:-mx-8 md:px-8 lg:mx-0 lg:px-0">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="practice">Practice & communication</TabsTrigger>
              <TabsTrigger value="resume">Resume & portfolio</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className={cn(COPPER_TEXT, "size-4")} />
                  Why this candidate fits {opportunity.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex max-w-[70ch] flex-col gap-2">
                  {fitReasons.map((reason, index) => (
                    <li key={index} className="text-foreground flex gap-2.5 text-sm">
                      <Check className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Practice track record</CardTitle>
                <CardDescription>Verdict mix across {c.sessionsCompleted} practice sessions</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-foreground max-w-[70ch] text-sm">{verdictAndRisk.verdictNote}</p>
                <div className="flex flex-col gap-1.5">
                  <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
                    {verdictMix
                      .filter((v) => v.count > 0)
                      .map((v, index) => (
                        <div
                          key={index}
                          className={cn(
                            "h-full",
                            v.tone === "positive" ? COPPER_BG : v.tone === "neutral" ? "bg-muted-foreground/40" : "bg-destructive",
                          )}
                          style={{ width: `${(v.count / totalVerdictSessions) * 100}%` }}
                        />
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {verdictMix.map((v) => (
                      <span key={v.label} className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            v.tone === "positive" ? COPPER_BG : v.tone === "neutral" ? "bg-muted-foreground/40" : "bg-destructive",
                          )}
                        />
                        {v.label} {v.count}
                      </span>
                    ))}
                  </div>
                </div>
                {verdictAndRisk.flags.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-[11px]">Risk flags ({verdictAndRisk.flags.length})</span>
                    <ul className="flex max-w-[70ch] flex-col gap-1.5">
                      {verdictAndRisk.flags.map((flag, index) => (
                        <li key={index} className="text-foreground flex gap-2 text-sm">
                          <span className="text-destructive mt-0.5 shrink-0">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <p className="text-muted-foreground max-w-[70ch] text-[11px]">{verdictAndRisk.fairnessNote}</p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">STAR evidence breakdown</CardTitle>
                <CardDescription>Per-competency, from AI-evaluated sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {starBreakdown.map((star) => (
                    <div key={star.label} className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-[11px]">{star.label}</span>
                      <span className={cn(COPPER_TEXT, "text-2xl font-semibold tabular-nums")}>{star.score}%</span>
                      <p className="text-muted-foreground text-[11px] leading-snug">{star.note}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Skill trend across sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {skillTrends.map((trend) => (
                    <div key={trend.skill} className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-foreground text-sm font-medium">{trend.skill}</span>
                        <span className="text-muted-foreground text-[11px]">
                          {trend.deltaVsLast > 0 ? "+" : ""}
                          {trend.deltaVsLast} pts vs. previous session
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 items-end gap-0.5">
                          {trend.sparkline.map((point, index) => (
                            <div
                              key={index}
                              className={cn("w-1.5 rounded-sm", index === trend.sparkline.length - 1 ? COPPER_BG : "bg-muted")}
                              style={{ height: `${Math.max(15, point)}%` }}
                            />
                          ))}
                        </div>
                        <span className={cn(COPPER_TEXT, "w-9 text-right text-sm font-medium tabular-nums")}>
                          {trend.latestScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="practice" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Round types & readiness</CardTitle>
                <CardDescription>
                  {cadence.totalSessions} sessions · {cadence.totalHours} hrs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-[11px]">Round types practiced</span>
                    <span className="text-foreground text-sm font-medium">
                      {cadence.practiced.length} of {ROUND_TYPES.length}: {cadence.practiced.join(", ")}
                    </span>
                    {cadence.notPracticed.length > 0 && (
                      <span className="text-muted-foreground text-[11px]">Not yet: {cadence.notPracticed.join(", ")}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-[11px]">Readiness trend</span>
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 items-end gap-0.5">
                        {readinessTrend.map((point, index) => (
                          <div
                            key={index}
                            className={cn("w-1.5 rounded-sm", index === readinessTrend.length - 1 ? COPPER_BG : "bg-muted")}
                            style={{ height: `${Math.max(15, point)}%` }}
                          />
                        ))}
                      </div>
                      <span className={cn(COPPER_TEXT, "text-sm font-medium tabular-nums")}>
                        {readinessTrend[readinessTrend.length - 1] - readinessTrend[0] >= 0 ? "+" : ""}
                        {readinessTrend[readinessTrend.length - 1] - readinessTrend[0]} pts across sessions
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Focus-specific signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col divide-y">
                  {cadence.practiced.map((type) => (
                    <div key={type} className="flex items-baseline gap-3 py-1.5 first:pt-0 last:pb-0">
                      <span className="text-foreground w-32 shrink-0 text-sm font-medium">{type}</span>
                      <span className="text-muted-foreground max-w-[55ch] text-sm">{synthesizeFocusSignal(c, type)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Communication signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Quantified answers</span>
                    <span className="text-foreground text-lg font-semibold tabular-nums">{communication.quantifiedPct}%</span>
                    <span className="text-muted-foreground text-[11px]">Answers backed by a metric</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Clear ownership</span>
                    <span className="text-foreground text-lg font-semibold tabular-nums">{communication.ownershipPct}%</span>
                    <span className="text-muted-foreground text-[11px]">"I" vs. "we"-framed answers</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Composure under pressure</span>
                    <span className="text-foreground text-lg font-semibold tabular-nums">{communication.composureScore}/100</span>
                    <span className="text-muted-foreground text-[11px]">{communication.composureNote}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resume intelligence</CardTitle>
                <CardAction>
                  <Badge variant="outline" className="font-normal">
                    AI resume score {resumeIntel.resumeScore}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-foreground max-w-[70ch] text-sm font-medium">{resumeIntel.headline}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Industry background</span>
                    <span className="text-foreground text-sm">{resumeIntel.industries.join(", ")}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Career trajectory</span>
                    <span className="text-foreground text-sm">{resumeIntel.careerTrajectory}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px]">Promotion signal</span>
                    <span className="text-foreground text-sm">{resumeIntel.promotionSignal}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col items-start gap-2 sm:flex-row sm:gap-8">
                <p className="text-sm">
                  <span className="text-muted-foreground">Interview strengths: </span>
                  <span className="text-foreground font-medium">{resumeIntel.strengths.join(", ")}</span>
                </p>
                {resumeIntel.gaps.length > 0 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Interview gaps: </span>
                    <span className="text-foreground font-medium">{resumeIntel.gaps.join(", ")}</span>
                  </p>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent practice sessions</CardTitle>
                <CardDescription>{c.sessionsCompleted} sessions completed</CardDescription>
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {sessions.map((session, index) => (
                    <React.Fragment key={index}>
                      <Item variant="outline">
                        <ItemMedia variant="icon">
                          <Video className="text-muted-foreground" />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{session.label}</ItemTitle>
                          <ItemDescription>{session.daysAgo} days ago · AI-evaluated</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <span className={cn(COPPER_TEXT, "text-sm font-medium tabular-nums")}>{session.score}%</span>
                        </ItemActions>
                      </Item>
                      {index < sessions.length - 1 && <ItemSeparator className="my-0" />}
                    </React.Fragment>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Portfolio & work samples</CardTitle>
                {opportunity.talentPreferences.portfolioRequired && (
                  <CardAction>
                    <Badge variant="outline" className="font-normal">
                      Required for this role
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                <ItemGroup>
                  {portfolio.map((item, index) => (
                    <React.Fragment key={index}>
                      <Item variant="outline">
                        <ItemMedia variant="icon">
                          <FileText className="text-muted-foreground" />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{item.title}</ItemTitle>
                          <ItemDescription>
                            {item.type} · {item.skill}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          {c.unlocked ? (
                            <Button variant="ghost" size="sm" className="gap-1.5">
                              View
                              <ExternalLink className="size-3.5" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <Lock className="size-3.5" />
                              Unlock to view
                            </span>
                          )}
                        </ItemActions>
                      </Item>
                      {index < portfolio.length - 1 && <ItemSeparator className="my-0" />}
                    </React.Fragment>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-6">
          {offer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Suggested offer</CardTitle>
                <CardAction>
                  <Badge
                    variant={offer.stance === "premium" ? "default" : offer.stance === "negotiate-down" ? "outline" : "secondary"}
                    className="gap-1"
                  >
                    <OfferStanceIcon className="size-3" />
                    {offer.stance === "premium" ? "Above budget" : offer.stance === "negotiate-down" ? "Below budget" : "At budget"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-foreground text-2xl font-semibold tabular-nums">
                      ₹{offer.recommended.toLocaleString("en-IN")}
                    </span>
                    <span className="text-muted-foreground text-sm">{offer.period === "month" ? "/ month" : "fixed"}</span>
                  </div>
                  {offer.deltaPct !== 0 && (
                    <span className={cn("text-xs font-medium tabular-nums", offer.deltaPct > 0 ? COPPER_TEXT : "text-muted-foreground")}>
                      {offer.deltaPct > 0 ? "+" : ""}
                      {offer.deltaPct}% vs. the ₹{offer.budgetAmount.toLocaleString("en-IN")} listed budget
                    </span>
                  )}
                </div>

                <p className="text-foreground max-w-[70ch] text-sm">{offer.rationale}</p>

                <div className="rounded-lg border">
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Listed budget</span>
                    <span className="text-foreground font-medium tabular-nums">
                      ₹{offer.budgetAmount.toLocaleString("en-IN")} {offer.period === "month" ? "/mo" : "fixed"}
                    </span>
                  </div>
                  <div className="border-t px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Evidence tier multiplier</span>
                      <span className="text-foreground font-medium tabular-nums">×{offerMultiplier.toFixed(2)}</span>
                    </div>
                    <span className="text-muted-foreground text-[11px]">
                      {offerTier} ({c.score}% evidence score)
                    </span>
                  </div>
                  <div className="bg-muted/40 flex items-center justify-between border-t px-3 py-2 text-sm">
                    <span className="text-foreground font-medium">Suggested offer</span>
                    <span className={cn(COPPER_TEXT, "font-semibold tabular-nums")}>
                      ₹{offer.recommended.toLocaleString("en-IN")} {offer.period === "month" ? "/mo" : "fixed"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Candidate's current comp</span>
                  <span className="text-right">
                    <span className="text-foreground font-medium tabular-nums">
                      ~₹{offer.candidateMonthlyEquivalent.toLocaleString("en-IN")} /mo
                    </span>
                    <span className="text-muted-foreground block text-[11px]">for reference, not part of the calc</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Candidate snapshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <SnapshotCell icon={GraduationCap} label="Experience" value={`${c.profile.yrs} yrs`} />
                <SnapshotCell icon={CalendarClock} label="Notice period" value={c.noticePeriod} />
                <SnapshotCell icon={IndianRupee} label="Current CTC" value={`${c.currentCtc} LPA`} />
                <SnapshotCell
                  icon={ClipboardList}
                  label="Roster & sessions"
                  value={`${c.rosterScore} · ${c.sessionsCompleted}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Skills</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {c.profile.tags.split(" · ").map((tag) => (
                  <Badge
                    key={tag}
                    variant={skillMatch.matched.includes(tag) ? "default" : "outline"}
                    className="font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              {skillMatch.missing.length > 0 && (
                <p className="text-muted-foreground text-[11px]">Not yet demonstrated: {skillMatch.missing.join(", ")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Education</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <SnapshotCell icon={GraduationCap} label="Degree" value={education.degree} />
                {education.certification && (
                  <SnapshotCell icon={BadgeCheck} label="Certification" value={education.certification} />
                )}
              </div>
            </CardContent>
          </Card>

          {!c.unlocked && (
            <div className="bg-muted/40 flex flex-col gap-3 rounded-xl border border-dashed p-5">
              <div className="flex items-center gap-2">
                <Lock className="text-muted-foreground size-4" />
                <h2 className="text-foreground text-sm font-semibold">Identity locked</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Every evidence signal above is real and doesn't depend on unlocking. Name, contact details, resume
                download, and portfolio links reveal once you unlock this candidate.
              </p>
              <Button onClick={onUnlockSingle} disabled={!canUnlockSingle}>
                <Lock className="size-4" />
                Unlock candidate — {SINGLE_UNLOCK_PRICE}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateActionsMenu({
  candidate,
  postingActive,
  onViewEvidence,
  onAdvanceStage,
  onReject,
  onUnlockSingle,
}: {
  candidate: ReturnType<typeof buildShortlist>[number] & { originalIndex: number; unlocked: boolean };
  /* opportunity.postingStatus === "Active". A Paused or Expired posting
     is no longer live: the employer shouldn't be able to spend on new
     unlocks or move candidates through a pipeline that isn't running. */
  postingActive: boolean;
  onViewEvidence: () => void;
  onAdvanceStage: () => void;
  onReject: () => void;
  onUnlockSingle: () => void;
}) {
  const c = candidate;
  /* Advancing/rejecting changes who gets hired, so it only makes sense
     once identity is unlocked — a locked row can still be evidence-
     reviewed, just not progressed. Both also require the posting to
     still be active: a paused/expired posting isn't being staffed. */
  const canAdvance = postingActive && c.unlocked && (c.stage === "Shortlisted" || c.stage === "Interviewing");
  const canReject = postingActive && c.unlocked && c.stage !== "Hired" && c.roundStatus !== "Refused";
  const canUnlockSingle = postingActive && !c.unlocked;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-11"
          aria-label={`Actions for ${candidateDisplayName(c)}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {c.unlocked ? (
          <>
            <DropdownMenuItem>
              <Link2 className="size-4" />
              View LinkedIn profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileDown className="size-4" />
              Download resume
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onUnlockSingle} disabled={!canUnlockSingle}>
            <Lock className="size-4" />
            Unlock this candidate — {SINGLE_UNLOCK_PRICE}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onViewEvidence}>
          <MessageSquare className="size-4" />
          View evidence report
        </DropdownMenuItem>
        {(canAdvance || canReject) && <DropdownMenuSeparator />}
        {canAdvance && (
          <DropdownMenuItem onSelect={onAdvanceStage}>
            <ArrowRight className="size-4" />
            {c.stage === "Shortlisted" ? "Advance to interviewing" : "Mark as hired"}
          </DropdownMenuItem>
        )}
        {canReject && (
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
            onSelect={onReject}
          >
            <XCircle className="size-4" />
            Reject candidate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OpportunityDetailsView({
  opportunity,
  onEdit,
  onArchive,
  onProfileCandidateChange,
  closeProfileRef,
  initialPurchasedBatches,
  initialStageFilter = null,
  initialSelectedCandidates,
  initialCompareOpen = false,
  initialEvidenceTarget = null,
  initialPurchaseHistory,
  initialUnlockConfirmation = null,
  initialProfileTarget = null,
}: {
  opportunity: Opportunity;
  onEdit: () => void;
  onArchive: () => void;
  onProfileCandidateChange?: (name: string | null) => void;
  closeProfileRef?: React.MutableRefObject<(() => void) | null>;
  /* Storyboard-only seeding: lets the canvas demonstrate lock-state,
     stage-filter, bulk-selection, and dialog-open scenarios (e.g. "batch 1
     unlocked, batch 2 still locked", "filtered to Hired with zero matches",
     "3 locked candidates selected", "compare dialog open") as static entry
     points, without changing the default empty/null/closed behavior every
     other caller relies on. Never wired to anything beyond initial React
     state. */
  initialPurchasedBatches?: number[];
  initialStageFilter?: string | null;
  initialSelectedCandidates?: string[];
  initialCompareOpen?: boolean;
  initialEvidenceTarget?: string | null;
  initialPurchaseHistory?: Array<{ batches: number[]; at: number }>;
  initialUnlockConfirmation?: string | null;
  initialProfileTarget?: string | null;
}) {
  const [evidenceTarget, setEvidenceTarget] = React.useState<string | null>(initialEvidenceTarget);
  /* Which candidate's full-page profile is open — separate from
     evidenceTarget, which only drives the lighter-weight per-row dialog.
     Opening a profile doesn't close that dialog's state; the two are
     mutually exclusive in practice because the profile page is the only
     place the dialog isn't reachable from. */
  const [profileTarget, setProfileTarget] = React.useState<string | null>(initialProfileTarget);
  const [compareList, setCompareList] = React.useState<Array<
    ReturnType<typeof buildShortlist>[number] & { originalIndex: number; unlocked: boolean }
  > | null>(null);
  const [selectedCandidates, setSelectedCandidates] = React.useState<Set<string>>(
    () => new Set(initialSelectedCandidates ?? []),
  );
  /* TanStack Table state for the shortlist table (see candidateTableFeatures
     above) — sorting/column-visibility/pagination. Row selection stays
     sourced from selectedCandidates below rather than its own useState;
     see candidateRowSelection. */
  const [candidateSorting, setCandidateSorting] = React.useState<SortingState>([]);
  const [candidateColumnVisibility, setCandidateColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [candidatePagination, setCandidatePagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: CANDIDATE_PAGE_SIZE,
  });
  /* Which BUNDLE_SIZE-candidate batches have been purchased — index 0 is
     candidates 1-10, index 1 is 11-20, etc. */
  const [purchasedBatches, setPurchasedBatches] = React.useState<Set<number>>(
    () => new Set(initialPurchasedBatches ?? []),
  );
  /* Individually-purchased candidates, keyed by originalIndex — the
     single-candidate alternative to a full batch purchase. Kept as its
     own Set (rather than folded into purchasedBatches) since one
     candidate unlocking alone must never unlock the other 9 in their
     batch. */
  const [purchasedSingles, setPurchasedSingles] = React.useState<Set<number>>(() => new Set());
  const [unlockConfirmation, setUnlockConfirmation] = React.useState<string | null>(initialUnlockConfirmation);
  /* Repeat-unlock instrumentation (YC-partner retention finding): every
     purchaseBatches()/purchaseSingle() call logs a timestamped event here,
     purely so this screen can surface an employer's own real unlock
     history on this posting. This is deliberately NOT a cross-employer "N
     others are viewing" scarcity signal (that would need real backing
     telemetry and legal sign-off under India's 2023 CCPA dark-pattern
     guidelines, which name fabricated urgency/scarcity as a prohibited
     pattern) — it only ever reflects this employer's own confirmed
     purchases. */
  const [purchaseHistory, setPurchaseHistory] = React.useState<
    Array<({ batches: number[]; at: number } | { single: string; at: number }) & { seq: number }>
  >(() => (initialPurchaseHistory ?? []).map((entry, index) => ({ ...entry, seq: index })));
  /* Date.now() alone can collide when two purchases land in the same
     millisecond, which would hand the "Unlock history" list a duplicate
     React key — this counter guarantees a unique key regardless of timing. */
  const purchaseHistorySeq = React.useRef(purchaseHistory.length);
  /* Batch indices staged for a confirmation prompt before any real charge —
     null while no confirmation is pending. Both the single-batch and the
     bulk unlock buttons route through this instead of charging directly. */
  const [pendingPurchase, setPendingPurchase] = React.useState<number[] | null>(null);
  /* Single-candidate unlock staged for confirmation — separate from
     pendingPurchase since it charges SINGLE_UNLOCK_PRICE for exactly one
     candidate rather than a whole batch. */
  const [pendingSingleUnlock, setPendingSingleUnlock] = React.useState<
    { initials: string; name: string; originalIndex: number } | null
  >(null);
  /* Advance/reject also route through a confirmation prompt before touching
     stageOverrides — these change who gets hired, so a misclick shouldn't
     silently commit. */
  const [pendingStageAction, setPendingStageAction] = React.useState<
    { type: "advance" | "reject"; initials: string; name: string } | null
  >(null);
  /* The most recent stage change, kept around so the confirmation banner can
     offer an immediate Undo — the only recovery path for advance/reject,
     since there's no separate "revert stage" action in the row menu. */
  const [lastStageAction, setLastStageAction] = React.useState<{
    initials: string;
    name: string;
    label: string;
    previousOverride: { stage: string; roundStatus: string } | undefined;
  } | null>(null);
  /* Pipeline-stage changes made from the row action menu — keyed by
     initials, keeping the underlying deterministic buildShortlist()
     data pure while still letting an employer advance/reject a
     candidate from this screen. */
  const [stageOverrides, setStageOverrides] = React.useState<Record<string, { stage: string; roundStatus: string }>>(
    {},
  );
  const [stageFilter, setStageFilter] = React.useState<string | null>(initialStageFilter);
  const [candidateSearchQuery, setCandidateSearchQuery] = React.useState("");
  const isMatching = opportunity.stage === "Matching";
  /* A Paused or Expired posting isn't being staffed anymore — spending on
     new unlocks, or moving candidates through its pipeline, shouldn't be
     possible once it's off. */
  const postingActive = opportunity.postingStatus === "Active";
  const StageIcon = stageIcon[opportunity.stage];
  const shortlistRef = React.useRef<HTMLDivElement>(null);

  const baseCandidates = React.useMemo(() => buildShortlist(opportunity), [opportunity]);
  /* originalIndex is the candidate's fixed rank (by match score, set at
     build time) — batch membership and the anonymized "Candidate #XX0"
     label are keyed off it, NOT the row's on-screen position, so
     re-sorting the table never changes which batch a row belongs to. */
  const candidates = React.useMemo(
    () =>
      baseCandidates.map((c, index) => {
        const override = stageOverrides[c.initials];
        const unlocked = purchasedBatches.has(Math.floor(index / BUNDLE_SIZE)) || purchasedSingles.has(index);
        /* advanceCandidateStage/rejectCandidate (via canAdvance/canReject)
           only ever fire once a candidate is unlocked, so a real "Hired" /
           "Interviewing" / "Refused" can't exist on a still-locked row. But
           buildShortlist's mock seed data assigns stage purely from
           (opportunityStage, index), with no knowledge of lock state — left
           alone, that could render a locked, never-identified candidate as
           already "Hired". Clamp to the one pre-decision state until either
           an override exists (a real action, which implies it was unlocked
           when taken) or the candidate is actually unlocked. */
        const seededStage = override ?? (unlocked ? {} : { stage: "Shortlisted", roundStatus: "Shortlisted" });
        return {
          ...c,
          ...seededStage,
          originalIndex: index,
          unlocked,
        };
      }),
    [baseCandidates, purchasedBatches, purchasedSingles, stageOverrides],
  );
  const advanceCandidateStage = (initials: string, currentStage: string, name: string) => {
    const nextStage = currentStage === "Shortlisted" ? "Interviewing" : "Hired";
    setStageOverrides((prev) => ({ ...prev, [initials]: { stage: nextStage, roundStatus: nextStage } }));
    setLastStageAction({
      initials,
      name,
      label: nextStage === "Hired" ? "marked as hired" : "advanced to interviewing",
      previousOverride: stageOverrides[initials],
    });
  };
  const rejectCandidate = (initials: string, name: string) => {
    setStageOverrides((prev) => ({ ...prev, [initials]: { stage: "Not selected", roundStatus: "Refused" } }));
    setLastStageAction({ initials, name, label: "rejected", previousOverride: stageOverrides[initials] });
  };
  /* Stage filter and search are external pre-filters (pill row + search box
     above the table), same as before the TanStack migration — only sorting,
     pagination, row selection, and column visibility move into the table
     itself. Sorting is no longer applied here: filtering commutes with a
     stable sort (removing rows never changes the relative order of the ones
     that remain), so handing TanStack the unsorted, pre-filtered rows and
     letting it sort them internally produces the exact same on-screen order
     as the old sort-then-filter chain did. */
  const displayCandidates = stageFilter ? candidates.filter((c) => c.stage === stageFilter) : candidates;
  const candidateSearchTerm = candidateSearchQuery.trim().toLowerCase();
  const searchedCandidates = candidateSearchTerm
    ? displayCandidates.filter(
        (c) =>
          (c.unlocked && c.profile.name.toLowerCase().includes(candidateSearchTerm)) ||
          c.profile.tags.toLowerCase().includes(candidateSearchTerm),
      )
    : displayCandidates;

  /* Row selection's durable source of truth stays selectedCandidates (a
     Set<string> of initials, consumed well beyond the table — see
     selectedCandidateList/selectedLockedBatches/the bulk-actions bar below).
     TanStack's rowSelection state is just a derived view of it, keyed by
     initials (getRowId), converted back to the Set in onRowSelectionChange. */
  const candidateRowSelection = React.useMemo<RowSelectionState>(
    () => Object.fromEntries([...selectedCandidates].map((initials) => [initials, true])),
    [selectedCandidates],
  );

  const candidateColumns = React.useMemo(
    () =>
      candidateColumnHelper.columns([
        candidateColumnHelper.display({
          id: "select",
          enableHiding: false,
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
              onCheckedChange={(checked) => table.toggleAllPageRowsSelected(!!checked)}
              aria-label={
                stageFilter ? `Select all candidates in ${stageFilter} on this page` : "Select all candidates on this page"
              }
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(!!checked)}
              aria-label={`Select ${row.original.unlocked ? row.original.profile.name : "locked candidate"}`}
            />
          ),
        }),
        candidateColumnHelper.display({
          id: "candidate",
          enableHiding: false,
          header: "Candidate",
          cell: ({ row }) => {
            const c = row.original;
            return (
              <div className="flex items-center gap-2.5">
                <Avatar
                  className={cn("size-8", c.unlocked ? AVATAR_COLORS[c.originalIndex % AVATAR_COLORS.length] : "bg-muted")}
                >
                  <AvatarFallback className={cn(!c.unlocked && "text-muted-foreground")}>
                    {c.unlocked ? c.initials : <Lock className="size-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground text-sm font-medium">{candidateDisplayName(c)}</span>
              </div>
            );
          },
        }),
        candidateColumnHelper.accessor((row) => row.profile.yrs, {
          id: "experience",
          header: ({ column }) => <TanStackSortableHead label="Experience" column={column} />,
          cell: ({ row }) => (
            <span className="text-foreground text-sm font-medium tabular-nums">{row.original.profile.yrs} yrs</span>
          ),
          sortingFn: (rowA, rowB) => rowA.original.profile.yrs - rowB.original.profile.yrs,
        }),
        candidateColumnHelper.accessor((row) => row.rosterScore, {
          id: "roster",
          header: ({ column }) => (
            <div className="flex items-center gap-1">
              <TanStackSortableHead label="Roster & sessions" column={column} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                  >
                    <Info className="size-3.5" />
                    <span className="sr-only">What is Roster & sessions?</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                  arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                >
                  Roster score is the candidate's lifetime performance across all
                  practice sessions on HireStepX, not just this role. Sessions is how
                  many they've completed.
                </TooltipContent>
              </Tooltip>
            </div>
          ),
          cell: ({ row }) => (
            <>
              <span className={cn(COPPER_TEXT, "text-sm font-medium tabular-nums")}>{row.original.rosterScore}</span>
              <span className="text-muted-foreground text-sm"> roster · {row.original.sessionsCompleted} sessions</span>
            </>
          ),
          sortingFn: (rowA, rowB) => rowA.original.rosterScore - rowB.original.rosterScore,
        }),
        candidateColumnHelper.accessor((row) => row.noticePeriod, {
          id: "notice",
          header: ({ column }) => <TanStackSortableHead label="Notice period" column={column} />,
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="text-muted-foreground text-sm">{row.original.noticePeriod}</span>
              <span className="text-muted-foreground text-[10px]">Self-reported</span>
            </div>
          ),
          sortingFn: (rowA, rowB) =>
            NOTICE_PERIOD_POOL.indexOf(rowA.original.noticePeriod) - NOTICE_PERIOD_POOL.indexOf(rowB.original.noticePeriod),
        }),
        candidateColumnHelper.accessor((row) => row.currentCtc, {
          id: "ctc",
          header: ({ column }) => <TanStackSortableHead label="Current CTC" column={column} />,
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="text-foreground text-sm font-medium tabular-nums">{row.original.currentCtc} LPA</span>
              <span className="text-muted-foreground text-[10px]">Self-reported</span>
            </div>
          ),
          sortingFn: (rowA, rowB) => rowA.original.currentCtc - rowB.original.currentCtc,
        }),
        candidateColumnHelper.display({
          id: "skills",
          header: "Skills",
          enableSorting: false,
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
              {row.original.profile.tags.split(" · ").map((tag) => (
                <Badge key={tag} variant="outline" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          ),
        }),
        candidateColumnHelper.accessor((row) => row.score, {
          id: "score",
          header: ({ column }) => (
            <div className="flex items-center gap-1">
              <TanStackSortableHead label="Match %" column={column} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                  >
                    <Info className="size-3.5" />
                    <span className="sr-only">What do the evidence-signal tiers mean?</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                  arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                >
                  Strong signal is 90%+, Solid signal is 75–89%, Mixed signal is below 75% — based on
                  evidence from the candidate's practice sessions.
                </TooltipContent>
              </Tooltip>
            </div>
          ),
          cell: ({ row }) => (
            <div className="flex items-center gap-2">
              <Progress value={row.original.score} className="w-20" indicatorClassName={COPPER_BG} />
              <div className="flex flex-col">
                <span className={cn(COPPER_TEXT, "text-sm font-medium")}>{row.original.score}%</span>
                <span className="text-muted-foreground text-[10px]">{evidenceTier(row.original.score)}</span>
              </div>
            </div>
          ),
          sortingFn: (rowA, rowB) => rowA.original.score - rowB.original.score,
        }),
        candidateColumnHelper.display({
          id: "stage",
          header: "Stage",
          enableSorting: false,
          cell: ({ row }) => {
            const c = row.original;
            const RoundIcon = roundStatusIcon[c.roundStatus];
            return (
              <div className="flex flex-col gap-1">
                <Badge
                  variant={c.stage === "Hired" ? "default" : c.roundStatus === "Refused" ? "outline" : "secondary"}
                  className="gap-1.5"
                >
                  {RoundIcon && (
                    <RoundIcon
                      className={cn(
                        "size-3.5",
                        c.stage === "Hired" && "fill-primary-foreground stroke-primary",
                        c.stage === "Interviewing" && "text-primary",
                        c.stage === "Shortlisted" && "text-muted-foreground",
                        c.roundStatus === "Refused" && "text-destructive",
                        c.roundStatus === "Awaiting reply" && "text-amber-500",
                        (c.roundStatus === "Round 1" || c.roundStatus === "Round 2") && "text-muted-foreground",
                      )}
                    />
                  )}
                  {c.roundStatus}
                </Badge>
                {c.stage === "Interviewing" && (
                  <span className="text-muted-foreground text-[10px]">Final round · Video call</span>
                )}
              </div>
            );
          },
        }),
        candidateColumnHelper.display({
          id: "actions",
          enableHiding: false,
          enableSorting: false,
          header: "Actions",
          cell: ({ row }) => {
            const c = row.original;
            return (
              <CandidateActionsMenu
                candidate={c}
                postingActive={postingActive}
                onViewEvidence={() => setEvidenceTarget(c.initials)}
                onAdvanceStage={() =>
                  setPendingStageAction({ type: "advance", initials: c.initials, name: candidateDisplayName(c) })
                }
                onReject={() =>
                  setPendingStageAction({ type: "reject", initials: c.initials, name: candidateDisplayName(c) })
                }
                onUnlockSingle={() =>
                  setPendingSingleUnlock({ initials: c.initials, name: c.profile.name, originalIndex: c.originalIndex })
                }
              />
            );
          },
        }),
      ]),
    [stageFilter, postingActive],
  );

  const candidateTable = useTable({
    features: candidateTableFeatures,
    data: searchedCandidates,
    columns: candidateColumns,
    state: {
      sorting: candidateSorting,
      columnVisibility: candidateColumnVisibility,
      rowSelection: candidateRowSelection,
      pagination: candidatePagination,
    },
    getRowId: (row) => row.initials,
    enableRowSelection: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    onRowSelectionChange: (updater) => {
      setSelectedCandidates((prevSet) => {
        const prevRecord: RowSelectionState = Object.fromEntries([...prevSet].map((initials) => [initials, true]));
        const nextRecord = typeof updater === "function" ? updater(prevRecord) : updater;
        return new Set(Object.keys(nextRecord).filter((key) => nextRecord[key]));
      });
    },
    onSortingChange: setCandidateSorting,
    onColumnVisibilityChange: setCandidateColumnVisibility,
    onPaginationChange: setCandidatePagination,
  });

  /* Mirrors the old effect that reset the page whenever the stage filter,
     search term, or sort changed — now resetting TanStack's own pagination
     state instead of a local candidatePage variable. */
  React.useEffect(() => {
    setCandidatePagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, [stageFilter, candidateSearchTerm, candidateSorting]);
  const nextBatchIndex = React.useMemo(() => {
    const totalBatches = Math.ceil(baseCandidates.length / BUNDLE_SIZE);
    for (let batch = 0; batch < totalBatches; batch++) {
      if (!purchasedBatches.has(batch)) return batch;
    }
    return null;
  }, [baseCandidates.length, purchasedBatches]);
  const nextBatchRange =
    nextBatchIndex !== null
      ? {
          start: nextBatchIndex * BUNDLE_SIZE + 1,
          end: Math.min((nextBatchIndex + 1) * BUNDLE_SIZE, baseCandidates.length),
        }
      : null;
  const purchaseBatches = (batchIndices: number[]) => {
    if (batchIndices.length === 0) return;
    setPurchasedBatches((prev) => {
      const next = new Set(prev);
      batchIndices.forEach((index) => next.add(index));
      return next;
    });
    setPurchaseHistory((prev) => [
      ...prev,
      { batches: batchIndices, at: Date.now(), seq: purchaseHistorySeq.current++ },
    ]);
    setUnlockConfirmation(
      batchIndices.length === 1
        ? `Batch unlocked — ${BATCH_PRICE} charged.`
        : `${batchIndices.length} batches unlocked — ₹${batchIndices.length * BATCH_PRICE_INR} charged.`,
    );
  };
  const confirmPendingPurchase = () => {
    if (pendingPurchase) purchaseBatches(pendingPurchase);
    setPendingPurchase(null);
  };
  const purchaseSingle = (originalIndex: number, name: string) => {
    setPurchasedSingles((prev) => new Set(prev).add(originalIndex));
    setPurchaseHistory((prev) => [...prev, { single: name, at: Date.now(), seq: purchaseHistorySeq.current++ }]);
    setUnlockConfirmation(`${name} unlocked — ${SINGLE_UNLOCK_PRICE} charged.`);
  };
  const confirmPendingSingleUnlock = () => {
    if (pendingSingleUnlock) purchaseSingle(pendingSingleUnlock.originalIndex, pendingSingleUnlock.name);
    setPendingSingleUnlock(null);
  };
  const confirmStageAction = () => {
    if (!pendingStageAction) return;
    const candidate = candidates.find((c) => c.initials === pendingStageAction.initials);
    if (candidate) {
      if (pendingStageAction.type === "advance") {
        advanceCandidateStage(candidate.initials, candidate.stage, pendingStageAction.name);
      } else {
        rejectCandidate(candidate.initials, pendingStageAction.name);
      }
    }
    setPendingStageAction(null);
  };
  const undoLastStageAction = () => {
    if (!lastStageAction) return;
    setStageOverrides((prev) => {
      const next = { ...prev };
      if (lastStageAction.previousOverride) next[lastStageAction.initials] = lastStageAction.previousOverride;
      else delete next[lastStageAction.initials];
      return next;
    });
    setLastStageAction(null);
  };
  /* Real (not fabricated) repeat-purchase signal for this posting only —
     "is this employer coming back to unlock more of the same shortlist,"
     the retention behavior the YC-partner audit flagged as the metric
     that actually matters here, not the raw shortlist size this screen
     already shows. */
  const isRepeatUnlock = purchaseHistory.length > 1;
  /* Storyboard-seeded confirmations (initialUnlockConfirmation) skip the
     auto-dismiss timer on their first render — they exist to demonstrate
     the banner, not to simulate a fresh purchase mid-session — so a
     screenshot taken any time after the storyboard loads still shows it.
     Any later real purchaseBatches() call still auto-dismisses normally. */
  const skipNextAutoDismiss = React.useRef(initialUnlockConfirmation != null);
  const [unlockBannerPaused, setUnlockBannerPaused] = React.useState(false);
  React.useEffect(() => {
    if (!unlockConfirmation || unlockBannerPaused) return;
    if (skipNextAutoDismiss.current) {
      skipNextAutoDismiss.current = false;
      return;
    }
    const timer = setTimeout(() => setUnlockConfirmation(null), 4000);
    return () => clearTimeout(timer);
  }, [unlockConfirmation, unlockBannerPaused]);
  const evidenceCandidate = candidates.find((c) => c.initials === evidenceTarget) ?? null;
  const profileCandidate = candidates.find((c) => c.initials === profileTarget) ?? null;
  React.useEffect(() => {
    onProfileCandidateChange?.(profileCandidate ? candidateDisplayName(profileCandidate) : null);
  }, [profileCandidate, onProfileCandidateChange]);
  React.useEffect(() => {
    if (closeProfileRef) closeProfileRef.current = () => setProfileTarget(null);
  }, [closeProfileRef]);
  const selectedCandidateList = candidates.filter((c) => selectedCandidates.has(c.initials));
  const selectedOnShortlist = selectedCandidateList.length;
  React.useEffect(() => {
    if (initialCompareOpen) setCompareList(selectedCandidateList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectedLockedBatches = React.useMemo(() => {
    const batches = new Set<number>();
    candidates.forEach((c) => {
      if (selectedCandidates.has(c.initials) && !c.unlocked) batches.add(Math.floor(c.originalIndex / BUNDLE_SIZE));
    });
    return batches;
  }, [candidates, selectedCandidates]);
  /* selectedOnDisplayCount/selectAllCandidatesState (the old manual
     select-all tri-state) are gone — the header checkbox now delegates
     directly to candidateTable.getIsAllPageRowsSelected() /
     getIsSomePageRowsSelected() / toggleAllPageRowsSelected(), matching the
     reference data-table.tsx's own header-checkbox pattern. */

  /* "Shortlisted" is the total shortlist size, not a stage subset, so
     clicking it clears the filter rather than filtering to it. */
  const pipelineStages: Array<{ label: string; value: number; filterValue: string | null }> = [
    { label: "Shortlisted", value: candidates.length, filterValue: null },
    {
      label: "Interviewing",
      value: candidates.filter((c) => c.stage === "Interviewing").length,
      filterValue: "Interviewing",
    },
    { label: "Hired", value: candidates.filter((c) => c.stage === "Hired").length, filterValue: "Hired" },
  ];
  const handlePipelineStageClick = (filterValue: string | null) => {
    setStageFilter((prev) => (prev === filterValue ? null : filterValue));
    shortlistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* Full-page candidate profile — an early return rather than folding into
     the main JSX below, since it replaces the entire shortlist view instead
     of overlaying it (unlike the Evidence dialog). The single-unlock and
     stage-action confirmation AlertDialogs are duplicated here (not shared
     with the main return) so "Unlock candidate" / "Advance" / "Reject" keep
     working from this page without threading extra plumbing through the
     stage below. */
  if (profileCandidate) {
    return (
      <main className="bg-muted/40 flex flex-1 flex-col gap-6 overflow-y-auto p-6 md:p-8">
        <CandidateProfileView
          candidate={profileCandidate}
          opportunity={opportunity}
          postingActive={postingActive}
          onUnlockSingle={() =>
            setPendingSingleUnlock({
              initials: profileCandidate.initials,
              name: profileCandidate.profile.name,
              originalIndex: profileCandidate.originalIndex,
            })
          }
          onAdvanceStage={() =>
            setPendingStageAction({
              type: "advance",
              initials: profileCandidate.initials,
              name: candidateDisplayName(profileCandidate),
            })
          }
          onReject={() =>
            setPendingStageAction({
              type: "reject",
              initials: profileCandidate.initials,
              name: candidateDisplayName(profileCandidate),
            })
          }
        />

        <AlertDialog
          open={pendingSingleUnlock !== null}
          onOpenChange={(open) => !open && setPendingSingleUnlock(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlock this candidate for {SINGLE_UNLOCK_PRICE}?</AlertDialogTitle>
              <AlertDialogDescription>
                This charges your account immediately and reveals this one candidate's name and contact details.
                This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPendingSingleUnlock}>Confirm & unlock</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={pendingStageAction !== null}
          onOpenChange={(open) => !open && setPendingStageAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingStageAction?.type === "reject"
                  ? `Reject ${pendingStageAction.name}?`
                  : `Advance ${pendingStageAction?.name} to the next stage?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingStageAction?.type === "reject"
                  ? "This marks the candidate as not selected. You can undo this right after confirming."
                  : "This moves the candidate forward in the pipeline. You can undo this right after confirming."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn(pendingStageAction?.type === "reject" && buttonVariants({ variant: "destructive" }))}
                onClick={confirmStageAction}
              >
                {pendingStageAction?.type === "reject" ? "Reject candidate" : "Advance candidate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    );
  }

  return (
    <main className="bg-muted/40 flex flex-1 flex-col gap-5 overflow-y-auto p-6">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
      <div className="bg-card flex flex-1 flex-col gap-5 rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <Briefcase className="size-6" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground text-[28px] leading-tight font-bold tracking-tight">
                  {opportunity.title}
                </h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="gap-1">
                      {StageIcon && <StageIcon className={stageIconClass[opportunity.stage]} />}
                      {stageLabel[opportunity.stage]}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent
                    className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                    arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                  >
                    {opportunity.stage === "Review"
                      ? "The AI has finished screening and surfaced a shortlist below for you to review."
                      : opportunity.stage === "Matching"
                        ? "The AI is still screening the practicing pool for this posting."
                        : opportunity.stage === "Interviewing"
                          ? "You've moved one or more shortlisted candidates into interviews."
                          : "At least one candidate from the shortlist has been hired for this posting."}
                  </TooltipContent>
                </Tooltip>
                {opportunity.postingStatus !== "Active" && (
                  <Badge variant={postingStatusBadgeVariant[opportunity.postingStatus]}>
                    {opportunity.postingStatus}
                  </Badge>
                )}
              </div>
              <div className="text-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <IndianRupee className="text-muted-foreground size-3.5" />
                  {opportunity.pay}
                </span>
                <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="text-muted-foreground size-3.5" />
                  {opportunity.location}
                </span>
                <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="text-muted-foreground size-3.5" />
                  {opportunity.experience}
                </span>
                <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="text-muted-foreground size-3.5" />
                  {opportunity.type} · {opportunity.duration} · {opportunity.hours}
                </span>
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    opportunity.dueDate === "Overdue" && "text-destructive font-medium",
                  )}
                >
                  <Calendar className="size-3.5" />
                  Due {opportunity.dueDate}
                </span>
                <span aria-hidden="true">·</span>
                <span>Posted {opportunity.createdDaysAgo === 0 ? "today" : `${opportunity.createdDaysAgo}d ago`}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  Updated {opportunity.updated}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMatching && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                    <LoaderCircle className="size-3.5 animate-spin" />
                    AI still evaluating
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                  arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                >
                  Usually takes 1–2 days to screen the full practicing pool. We'll email you the moment your
                  shortlist is ready — no need to keep this tab open.
                </TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-11"
                  aria-label={`Actions for ${opportunity.title}`}
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
                  onSelect={onArchive}
                >
                  <ArchiveIcon className="size-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t pt-4">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm">
            <span className="text-foreground font-semibold tabular-nums">
              {isMatching ? "—" : opportunity.evaluated}
            </span>
            evaluated
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                >
                  <Info className="size-3.5" />
                  <span className="sr-only">What does "evaluated" mean?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
              >
                Candidates the AI screened against this posting from HireStepX's practicing pool, based on their
                practice-session history — not resumes submitted to you directly.
              </TooltipContent>
            </Tooltip>
            {pipelineStages.map((stage) => (
              <React.Fragment key={stage.label}>
                <ChevronRight className="text-muted-foreground/40 size-3.5" aria-hidden="true" />
                {isMatching ? (
                  <>
                    <span className="text-foreground font-semibold tabular-nums">–</span>
                    {stage.label.toLowerCase()}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePipelineStageClick(stage.filterValue)}
                    aria-pressed={stage.filterValue !== null && stageFilter === stage.filterValue}
                    className={cn(
                      "focus-visible:ring-ring/50 -m-0.5 inline-flex items-center gap-1 rounded p-0.5 outline-none hover:underline focus-visible:ring-[3px]",
                      stage.filterValue !== null && stageFilter === stage.filterValue && "text-primary underline",
                    )}
                  >
                    <span className="text-foreground font-semibold tabular-nums">{stage.value}</span>
                    {stage.label.toLowerCase()}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <span>
              <span className={cn(COPPER_TEXT, "font-semibold tabular-nums")}>
                {isMatching ? "—" : `${opportunity.avgScore}%`}
              </span>{" "}
              avg evidence score{!isMatching ? ` (${evidenceTier(opportunity.avgScore)})` : ""}, spanning{" "}
              <span className="text-foreground font-medium tabular-nums">
                {isMatching ? "—" : `${opportunity.scoreLow}–${opportunity.scoreHigh}%`}
              </span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                >
                  <Info className="size-3.5" />
                  <span className="sr-only">What is the evidence score?</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
              >
                The average, across shortlisted candidates, of how well their practice-session evidence backs up
                their claimed skills. Strong signal is 90%+, Solid signal is 75–89%, Mixed signal is below 75%.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      </div>

      <div className="bg-card flex flex-col gap-3.5 rounded-xl border p-5 lg:w-96 lg:shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-foreground text-sm font-semibold">Talent preferences</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground -mr-2 gap-1.5" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {[
            { icon: Building2, label: "Industry", value: opportunity.talentPreferences.preferredIndustry },
            { icon: LayoutGrid, label: "Domain", value: opportunity.talentPreferences.preferredDomain },
            { icon: Calendar, label: "Availability", value: opportunity.talentPreferences.availability },
            { icon: GraduationCap, label: "Experience", value: opportunity.talentPreferences.relevantExperience },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-3.5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-muted-foreground text-[11px] leading-tight">{label}</span>
                <span className="text-foreground text-sm leading-snug font-medium">{value}</span>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
              <Folder className="size-3.5" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-[11px] leading-tight">Portfolio</span>
              <Badge
                variant={opportunity.talentPreferences.portfolioRequired ? "default" : "outline"}
                className="w-fit font-normal"
              >
                {opportunity.talentPreferences.portfolioRequired ? "Required" : "Optional"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="bg-card grid grid-cols-1 gap-6 rounded-xl border p-6 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-base font-semibold">Description</h2>
              <p className="text-muted-foreground max-w-[70ch] text-[15px] leading-relaxed">
                {opportunity.description}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-base font-semibold">Responsibilities</h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {opportunity.responsibilities.map((item) => (
                  <li key={item} className="text-muted-foreground flex items-start gap-2.5 text-sm">
                    <span className="bg-primary/50 mt-2 size-1 shrink-0 rounded-full" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-5 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-base font-semibold">Required skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.requiredSkills.map((skill) => (
                  <Badge key={skill} className="border-primary/20 bg-primary/10 text-primary font-normal">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-sm font-medium">Nice to have</h2>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.niceToHaveSkills.map((skill) => (
                  <Badge key={skill} variant="outline" className="font-normal">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div ref={shortlistRef} className="flex flex-col gap-3">
          {!isMatching && (
            <span className="sr-only" role="status" aria-live="polite">
              {stageFilter ? `Showing ${searchedCandidates.length} candidates in ${stageFilter}` : `Showing ${searchedCandidates.length} candidates`}
              {candidateSorting[0] ? `, sorted by ${candidateSorting[0].id} ${candidateSorting[0].desc ? "descending" : "ascending"}` : ""}
            </span>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Shortlist{!isMatching && candidates.length > 0 ? ` · ${candidates.length}` : ""}
              </h2>
              {stageFilter && (
                <Badge variant="secondary" className="gap-1 font-normal normal-case">
                  {stageFilter}
                  <button
                    type="button"
                    onClick={() => setStageFilter(null)}
                    aria-label={`Clear ${stageFilter} filter`}
                    className="hover:text-foreground -mr-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>
            {!isMatching && candidates.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                  <Input
                    aria-label="Search candidates"
                    placeholder="Search by name or skill"
                    className="w-64 pl-8"
                    value={candidateSearchQuery}
                    onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Columns3 className="size-3.5" />
                      Columns
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {candidateTable
                      .getAllColumns()
                      .filter((column) => column.getCanHide())
                      .map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          checked={column.getIsVisible()}
                          onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                        >
                          {candidateColumnLabels[column.id] ?? column.id}
                        </DropdownMenuCheckboxItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {unlockConfirmation && (
            <div
              role="status"
              aria-live="polite"
              onMouseEnter={() => setUnlockBannerPaused(true)}
              onMouseLeave={() => setUnlockBannerPaused(false)}
              onFocus={() => setUnlockBannerPaused(true)}
              onBlur={() => setUnlockBannerPaused(false)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle2 className="size-4" />
              {unlockConfirmation}
              {isRepeatUnlock && (
                <span className="text-emerald-700/70 dark:text-emerald-400/70 font-normal">
                  · unlock #{purchaseHistory.length} on this posting
                </span>
              )}
            </div>
          )}

          {lastStageAction && (
            <div
              role="status"
              aria-live="polite"
              className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm"
            >
              <span className="text-foreground font-medium">
                {lastStageAction.name} {lastStageAction.label}.
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={undoLastStageAction}>
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Dismiss"
                  onClick={() => setLastStageAction(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {purchaseHistory.length > 0 && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <span className="font-medium">Unlock history:</span>
              {purchaseHistory.map((entry, index) => (
                <React.Fragment key={entry.seq}>
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <span>
                    {"batches" in entry
                      ? `Batch${entry.batches.length > 1 ? "es" : ""} ${entry.batches.map((b) => b + 1).join(", ")}`
                      : entry.single}{" "}
                    ({new Date(entry.at).toLocaleDateString()})
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}

          {!isMatching && nextBatchRange && displayCandidates.length > 0 && (
            <div className="bg-primary/5 border-primary/20 flex items-center justify-between rounded-xl border px-4 py-3">
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  Unlock candidates {nextBatchRange.start}–{nextBatchRange.end} for {BATCH_PRICE}
                </span>
                <span className="text-muted-foreground text-xs">
                  {postingActive
                    ? `Names and contact details unlock in batches of ${BUNDLE_SIZE} — ${BATCH_PRICE} per batch.`
                    : `This posting is ${opportunity.postingStatus.toLowerCase()} — unlock again once it's active.`}
                </span>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!postingActive}
                onClick={() => setPendingPurchase([nextBatchIndex!])}
              >
                <Lock className="size-3.5" />
                Unlock batch — {BATCH_PRICE}
              </Button>
            </div>
          )}

          {selectedOnShortlist > 0 && (
            <div className="bg-muted flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5">
              <span className="text-foreground shrink truncate text-sm font-medium">
                {selectedOnShortlist} candidate{selectedOnShortlist > 1 ? "s" : ""} selected
                {selectedOnShortlist - selectedCandidateList.filter((c) => !c.unlocked).length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {selectedOnShortlist - selectedCandidateList.filter((c) => !c.unlocked).length} already unlocked
                  </span>
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                {selectedOnShortlist > 1 && (
                  <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-disabled={selectedOnShortlist > 3}
                      aria-describedby={selectedOnShortlist > 3 ? "compare-selected-limit-hint" : undefined}
                      onClick={() => {
                        if (selectedOnShortlist > 3) return;
                        setCompareList(selectedCandidateList);
                      }}
                    >
                      Compare selected
                    </Button>
                    {selectedOnShortlist > 3 && (
                      <span id="compare-selected-limit-hint" className="text-muted-foreground text-xs whitespace-nowrap">
                        Select up to 3 candidates to compare
                      </span>
                    )}
                  </div>
                )}
                {selectedLockedBatches.size > 0 && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!postingActive}
                    onClick={() => setPendingPurchase([...selectedLockedBatches])}
                  >
                    <Lock className="size-3.5" />
                    Unlock {selectedLockedBatches.size} batch{selectedLockedBatches.size > 1 ? "es" : ""} — ₹
                    {selectedLockedBatches.size * BATCH_PRICE_INR}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedCandidates(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card overflow-hidden rounded-xl border">
            {isMatching ? (
              <div className="text-muted-foreground flex flex-col items-center gap-1.5 py-16 text-center text-sm">
                <LoaderCircle className="size-5 animate-spin" />
                <span>Finding candidates — the AI is still evaluating the practicing pool.</span>
                <span className="text-xs">
                  Usually takes 1–2 days. We'll email you the moment your shortlist is ready.
                </span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-1 py-16 text-sm">
                <span className="font-medium">No candidates yet</span>
                <span>Strong matches will appear here once AI screening completes.</span>
              </div>
            ) : searchedCandidates.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-sm">
                <span className="font-medium">
                  {candidateSearchTerm
                    ? `No candidates match "${candidateSearchQuery.trim()}"`
                    : `No candidates in ${stageFilter}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (candidateSearchTerm) setCandidateSearchQuery("");
                    else setStageFilter(null);
                  }}
                >
                  {candidateSearchTerm ? "Clear search" : "Clear filter"}
                </Button>
              </div>
            ) : (
              <>
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  {candidateTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={cn(
                            header.column.id === "select" && "w-8 p-3.5",
                            header.column.id === "actions" && "text-right",
                          )}
                        >
                          {header.isPlaceholder ? null : <FlexRender header={header} />}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {candidateTable.getRowModel().rows.map((row) => {
                    const c = row.original;
                    return (
                      <TableRow key={row.id} onClick={() => setProfileTarget(c.initials)} className="cursor-pointer">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              cell.column.id === "select" && "p-3.5",
                              cell.column.id === "actions" && "text-right",
                            )}
                            onClick={
                              cell.column.id === "select" || cell.column.id === "actions"
                                ? (event) => event.stopPropagation()
                                : undefined
                            }
                          >
                            <FlexRender cell={cell} />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {candidateTable.getPageCount() > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-muted-foreground text-sm">
                    {searchedCandidates.length} candidate{searchedCandidates.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-6">
                    <p className="text-muted-foreground text-sm">
                      Page {candidateTable.state.pagination.pageIndex + 1} of {candidateTable.getPageCount()}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={!candidateTable.getCanPreviousPage()}
                        onClick={() => candidateTable.setPageIndex(0)}
                        aria-label="Go to first page"
                      >
                        <ChevronsLeft />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={!candidateTable.getCanPreviousPage()}
                        onClick={() => candidateTable.previousPage()}
                        aria-label="Go to previous page"
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={!candidateTable.getCanNextPage()}
                        onClick={() => candidateTable.nextPage()}
                        aria-label="Go to next page"
                      >
                        <ChevronRight />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        disabled={!candidateTable.getCanNextPage()}
                        onClick={() => candidateTable.setPageIndex(candidateTable.getPageCount() - 1)}
                        aria-label="Go to last page"
                      >
                        <ChevronsRight />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={compareList !== null} onOpenChange={(open) => !open && setCompareList(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compare candidates</DialogTitle>
            <DialogDescription>Evidence score and STAR breakdown side by side.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-5 border-t pt-4 sm:grid-cols-3">
            {(compareList ?? []).map((c) => (
              <div key={c.initials} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className={cn(!c.unlocked && "bg-muted")}>
                    <AvatarFallback className={cn(!c.unlocked && "text-muted-foreground")}>
                      {c.unlocked ? c.initials : <Lock className="size-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-medium">
                      {candidateDisplayName(c)}
                    </span>
                    <span className={cn(COPPER_TEXT, "text-xs font-medium")}>
                      {c.score}% · {evidenceTier(c.score)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  {synthesizeStarBreakdown(c.profile, c.score).map((star) => (
                    <div key={star.label} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{star.label}</span>
                        <span className="text-foreground font-medium">{star.score}%</span>
                      </div>
                      <Progress value={star.score} indicatorClassName={COPPER_BG} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingPurchase !== null} onOpenChange={(open) => !open && setPendingPurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPurchase && pendingPurchase.length === 1
                ? `Unlock this batch for ${BATCH_PRICE}?`
                : `Unlock ${pendingPurchase?.length ?? 0} batches for ₹${(pendingPurchase?.length ?? 0) * BATCH_PRICE_INR}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This charges your account immediately and reveals names and contact details for{" "}
              {(pendingPurchase?.length ?? 0) * BUNDLE_SIZE} candidates. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingPurchase}>Confirm & unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingSingleUnlock !== null}
        onOpenChange={(open) => !open && setPendingSingleUnlock(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this candidate for {SINGLE_UNLOCK_PRICE}?</AlertDialogTitle>
            <AlertDialogDescription>
              This charges your account immediately and reveals this one candidate's name and contact details.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingSingleUnlock}>Confirm & unlock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingStageAction !== null}
        onOpenChange={(open) => !open && setPendingStageAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStageAction?.type === "reject"
                ? `Reject ${pendingStageAction.name}?`
                : `Advance ${pendingStageAction?.name} to the next stage?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStageAction?.type === "reject"
                ? "This marks the candidate as not selected. You can undo this right after confirming."
                : "This moves the candidate forward in the pipeline. You can undo this right after confirming."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(pendingStageAction?.type === "reject" && buttonVariants({ variant: "destructive" }))}
              onClick={confirmStageAction}
            >
              {pendingStageAction?.type === "reject" ? "Reject candidate" : "Advance candidate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={evidenceTarget !== null} onOpenChange={(open) => !open && setEvidenceTarget(null)}>
        <DialogContent>
          {evidenceCandidate && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {evidenceCandidate.unlocked
                    ? evidenceCandidate.profile.name
                    : `Candidate ${evidenceCandidate.originalIndex + 1}`}
                </DialogTitle>
                <DialogDescription>
                  {evidenceCandidate.score}% avg evidence score · STAR breakdown from practice history
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 border-t pt-4">
                {synthesizeStarBreakdown(evidenceCandidate.profile, evidenceCandidate.score).map((star) => (
                  <div key={star.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-sm font-medium">{star.label}</span>
                      <span className={cn(COPPER_TEXT, "text-sm font-medium")}>{star.score}%</span>
                    </div>
                    <Progress value={star.score} indicatorClassName={COPPER_BG} />
                    <p className="text-muted-foreground text-sm">{star.note}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Create Opportunity form — local shadcn-idiomatic form primitives.
   Mirrors app/(employer)/employer/requirements/new/page.tsx's 2-step
   wizard (Basic information / Preferences & perks), rebuilt with this
   canvas's own Dialog/Input/Badge/Label/Textarea/Select primitives
   instead of the production app's inline-style _atoms.tsx components.
   ───────────────────────────────────────────────────────────────────── */

type WorkMode = "remote" | "onsite" | "hybrid";

const WORK_MODE_OPTIONS: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
];

const NOTICE_PERIOD_OPTIONS = ["Any", "Immediate", "Immediate–30 days", "30 days", "60 days"];

const JOB_DESCRIPTION_MIN_LENGTH = 20;

interface JobPostingFormState {
  title: string;
  locations: string[];
  workMode: WorkMode;
  openPositions: string;
  budgetMin: string;
  budgetMax: string;
  experienceMin: string;
  experienceMax: string;
  skills: string[];
  description: string;
  responsibilities: string;
  niceToHave: string;
  preferredIndustry: string;
  preferredColleges: string[];
  targetCompanies: string[];
  perksAndBenefits: string[];
  noticePeriodPref: string;
  dueDate: string;
}

const emptyJobPostingForm: JobPostingFormState = {
  title: "",
  locations: [],
  workMode: "remote",
  openPositions: "",
  budgetMin: "",
  budgetMax: "",
  experienceMin: "",
  experienceMax: "",
  skills: [],
  description: "",
  responsibilities: "",
  niceToHave: "",
  preferredIndustry: "",
  preferredColleges: [],
  targetCompanies: [],
  perksAndBenefits: [],
  noticePeriodPref: "Any",
  dueDate: "",
};

/** Multi-value tag field, built from this canvas's own Badge + Input —
 *  a shadcn-skinned re-implementation of src/employer/_atoms.tsx's
 *  TagInput (same interaction: type + Enter/comma commits a tag,
 *  Backspace on an empty draft removes the last tag, each chip has an
 *  "×" remove button). No external dependency. */
function FormTagInput({
  id,
  values,
  onChange,
  placeholder,
}: {
  id?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const cleaned = draft.trim();
    if (cleaned.length === 0) return;
    if (!values.includes(cleaned)) onChange([...values, cleaned]);
    setDraft("");
  };

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="h-6 gap-1 rounded-md pr-1">
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            className="ml-0.5 flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft.length === 0 && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        className="min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/** Two-segment step indicator for the Create Opportunity dialog — plain
 *  divs on token classes, not a new primitive. */
function FormStepProgress({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex gap-1.5">
      {([1, 2] as const).map((n) => (
        <div key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );
}

/** Small-caps section heading + Separator, mirroring the production
 *  wizard's FormSection grouping (Role / Compensation & experience / …). */
function FormSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</span>
      <Separator />
    </div>
  );
}

export default function EmployersDashboard({
  initialDetailsId = null,
  initialPurchasedBatches,
  initialStageFilter,
  initialSelectedCandidates,
  initialCompareOpen,
  initialEvidenceTarget,
  initialPurchaseHistory,
  initialUnlockConfirmation,
  initialProfileTarget,
}: {
  initialDetailsId?: string | null;
  /* Storyboard-only seeding forwarded straight to OpportunityDetailsView —
     see its own prop docs. Absent for every real caller. */
  initialPurchasedBatches?: number[];
  initialStageFilter?: string | null;
  initialSelectedCandidates?: string[];
  initialCompareOpen?: boolean;
  initialEvidenceTarget?: string | null;
  initialPurchaseHistory?: Array<{ batches: number[]; at: number }>;
  initialUnlockConfirmation?: string | null;
  initialProfileTarget?: string | null;
} = {}) {
  const [rows, setRows] = React.useState<Opportunity[]>(initialOpportunities);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = React.useState<{ kind: "bulk" } | { kind: "row"; id: string } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stageFilter, setStageFilter] = React.useState<Set<string>>(new Set(ALL_STAGES));
  const [statusFilter, setStatusFilter] = React.useState<Set<string>>(new Set(ALL_POSTING_STATUSES));
  const [attentionOnly, setAttentionOnly] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  /* Per-property color transitions across hundreds of table/row nodes forced
     a full style recalc on every toggle and still looked like a discrete
     jump-cut on the harder color swaps. The View Transitions API instead
     crossfades a single before/after snapshot of the page — cheap and
     genuinely smooth — with a plain toggle as the fallback where it's
     unsupported (Safari/Firefox at time of writing). */
  const toggleTheme = () => {
    const flip = () => setIsDarkMode((d) => !d);
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(flip);
    } else {
      flip();
    }
  };
  const [hasUnreadNotifications, setHasUnreadNotifications] = React.useState(true);
  const [composer, setComposer] = React.useState<{ mode: "create" | "edit"; id: string | null } | null>(null);
  const [composerStep, setComposerStep] = React.useState<1 | 2>(1);
  const [composerForm, setComposerForm] = React.useState<JobPostingFormState>(emptyJobPostingForm);
  const updateComposerForm = <K extends keyof JobPostingFormState>(key: K, value: JobPostingFormState[K]) =>
    setComposerForm((prev) => ({ ...prev, [key]: value }));
  const composerStep1Valid =
    composerForm.title.trim().length > 1 &&
    composerForm.locations.length > 0 &&
    composerForm.description.trim().length >= JOB_DESCRIPTION_MIN_LENGTH;
  const [composerSubmitting, setComposerSubmitting] = React.useState(false);
  const openComposer = (next: { mode: "create" | "edit"; id: string | null }, form: JobPostingFormState) => {
    setComposer(next);
    setComposerStep(1);
    setComposerForm(form);
  };
  const closeComposer = () => {
    setComposer(null);
    setComposerStep(1);
    setComposerForm(emptyJobPostingForm);
  };
  const [detailsTarget, setDetailsTarget] = React.useState<string | null>(initialDetailsId);
  const [profileCandidateName, setProfileCandidateName] = React.useState<string | null>(null);
  const closeProfileRef = React.useRef<(() => void) | null>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (!stageFilter.has(r.stage)) return false;
      if (!statusFilter.has(r.postingStatus)) return false;
      if (attentionOnly && !rowNeedsAttention(r)) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !r.type.toLowerCase().includes(q) &&
        !r.location.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, searchQuery, stageFilter, statusFilter, attentionOnly]);

  const sortedRows = React.useMemo(() => {
    if (!sortColumn) return filteredRows;
    if (sortColumn === "talent") {
      /* avgScore is a placeholder 0 while a posting is still Matching (no
         shortlist scored yet) — sorting on the raw number would treat "not
         evaluated" as "the lowest score," burying it at one end in asc and
         surfacing it at the other in desc. Unscored rows always sink to the
         bottom, in either direction; only scored rows sort by direction. */
      return [...filteredRows].sort((a, b) => {
        const aScored = a.topMatches > 0;
        const bScored = b.topMatches > 0;
        if (aScored !== bScored) return aScored ? -1 : 1;
        if (!aScored) return 0;
        return sortDirection === "asc" ? a.avgScore - b.avgScore : b.avgScore - a.avgScore;
      });
    }
    const accessor = sortAccessor[sortColumn];
    return [...filteredRows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const displayedRows = sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const dragEnabled = sortColumn === null;

  /* FLIP reorder animation: measure each row's position before the DOM
     updates, then invert the delta into a transform that eases back to
     zero — so drag/keyboard reorders (and sort/filter reshuffles) read as
     rows sliding into place instead of snapping. Transform-only, so it's
     cheap and never touches layout properties. */
  const rowRefs = React.useRef<Map<string, HTMLTableRowElement>>(new Map());
  const rowRectsRef = React.useRef<Map<string, DOMRect>>(new Map());
  React.useLayoutEffect(() => {
    const prevRects = rowRectsRef.current;
    const nextRects = new Map<string, DOMRect>();
    rowRefs.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

    nextRects.forEach((nextRect, id) => {
      const prevRect = prevRects.get(id);
      const el = rowRefs.current.get(id);
      if (!prevRect || !el) return;
      const deltaY = prevRect.top - nextRect.top;
      if (deltaY === 0) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 220ms cubic-bezier(0.25, 1, 0.5, 1)";
        el.style.transform = "";
        el.addEventListener("transitionend", () => (el.style.transition = ""), { once: true });
      });
    });

    rowRectsRef.current = nextRects;
  }, [displayedRows]);

  const activeFilterCount =
    (ALL_STAGES.length - stageFilter.size) +
    (ALL_POSTING_STATUSES.length - statusFilter.size) +
    (attentionOnly ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery("");
    setStageFilter(new Set(ALL_STAGES));
    setStatusFilter(new Set(ALL_POSTING_STATUSES));
    setAttentionOnly(false);
  };

  const handleDrop = (targetId: string) => {
    if (!dragEnabled || dragId === null || dragId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  };

  /* Keyboard-operable equivalent of the mouse-only drag reorder above —
     native HTML5 drag-and-drop has no keyboard path, so row order would
     otherwise be unreachable without a pointer. */
  const moveRow = (id: string, direction: "up" | "down") => {
    if (!dragEnabled) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === id);
      const to = direction === "up" ? from - 1 : from + 1;
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const confirmArchive = () => {
    if (!archiveTarget) return;
    if (archiveTarget.kind === "bulk") {
      setRows((prev) => prev.filter((r) => !selectedRows.has(r.id)));
      setSelectedRows(new Set());
    } else {
      const { id } = archiveTarget;
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDetailsTarget((prev) => (prev === id ? null : prev));
    }
    setArchiveTarget(null);
  };

  const handleComposerSubmit = () => {
    if (!composer || !composerStep1Valid || composerSubmitting) return;
    const title = composerForm.title.trim();
    setComposerSubmitting(true);
    /* Design-scope: no backend wiring, so a short artificial delay stands
       in for the real "Posting job…" network round trip and keeps the
       button's pending state visible/testable in the storyboard. */
    window.setTimeout(() => {
      if (composer.mode === "create") {
        const workModeLabel = WORK_MODE_OPTIONS.find((o) => o.value === composerForm.workMode)?.label ?? "Remote";
        const location = composerForm.locations.length
          ? `${composerForm.locations[0]}${composerForm.locations.length > 1 ? ` +${composerForm.locations.length - 1}` : ""} · ${workModeLabel}`
          : workModeLabel;
        const experience =
          composerForm.experienceMin.trim() || composerForm.experienceMax.trim()
            ? `${composerForm.experienceMin.trim() || "0"}-${composerForm.experienceMax.trim() || composerForm.experienceMin.trim() || "0"}yrs`
            : "—";
        const pay =
          composerForm.budgetMin.trim() || composerForm.budgetMax.trim()
            ? `₹${composerForm.budgetMin.trim() || "0"}-${composerForm.budgetMax.trim() || composerForm.budgetMin.trim() || "0"} LPA`
            : "—";
        const newRow: Opportunity = {
          id: `new-${Date.now()}`,
          title,
          type: "Project",
          duration: "—",
          hours: "—",
          pay,
          location,
          experience,
          dueDate: composerForm.dueDate ? composerForm.dueDate : "—",
          strongMatches: 0,
          strongMatchInitials: [],
          stage: "Matching",
          postingStatus: "Active",
          evaluated: 0,
          topMatches: 0,
          avgScore: 0,
          scoreLow: 0,
          scoreHigh: 0,
          nextStep: "",
          updated: "Just now",
          updatedMinutes: 0,
          createdDaysAgo: 0,
          description: composerForm.description.trim(),
          responsibilities: composerForm.responsibilities.trim() ? [composerForm.responsibilities.trim()] : [],
          requiredSkills: composerForm.skills,
          niceToHaveSkills: composerForm.niceToHave.trim() ? [composerForm.niceToHave.trim()] : [],
          talentPreferences: {
            experienceLevel: experience === "—" ? "2-4 years" : experience,
            availability: "Within 2 weeks",
            preferredIndustry: composerForm.preferredIndustry.trim() || "Software/IT",
            preferredDomain: "—",
            workSchedule: workModeLabel,
            portfolioRequired: false,
            relevantExperience: "—",
          },
        };
        setRows((prev) => [newRow, ...prev]);
      } else if (composer.id) {
        const { id } = composer;
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  title,
                  description: composerForm.description.trim() || r.description,
                  requiredSkills: composerForm.skills.length ? composerForm.skills : r.requiredSkills,
                }
              : r
          )
        );
      }
      setComposerSubmitting(false);
      closeComposer();
    }, 400);
  };

  const handleExport = () => {
    const selected = rows.filter((r) => selectedRows.has(r.id));
    const header = [
      "Title",
      "Type",
      "Pay",
      "Location",
      "Stage",
      "Status",
      "Evaluated",
      "Top Matches",
      "Avg Score",
      "Last Updated",
    ];
    const csvRows = selected.map((r) => [
      r.title,
      r.type,
      r.pay,
      r.location,
      r.stage,
      r.postingStatus,
      r.evaluated,
      r.topMatches,
      r.avgScore,
      r.updated,
    ]);
    const csv = [header, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "opportunities-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedOnPage = displayedRows.filter((r) => selectedRows.has(r.id)).length;
  const selectAllState: boolean | "indeterminate" =
    selectedOnPage === 0 ? false : selectedOnPage === displayedRows.length ? true : "indeterminate";

  const activeTheme = isDarkMode ? shadcnDarkTheme : shadcnDefaultTheme;

  return (
    <ThemeContext.Provider value={activeTheme}>
    <style>{`
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 220ms;
        animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
      }
      @supports not (view-transition-name: none) {
        .employers-dashboard-root,
        .employers-dashboard-portal {
          transition-property: background-color, color;
          transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
          transition-duration: 180ms;
        }
      }
    `}</style>
    <div
      style={activeTheme}
      className={cn(
        "employers-dashboard-root bg-background text-foreground flex h-screen w-[1728px]",
        isDarkMode && "dark"
      )}
    >
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col gap-3 border-r p-3 transition-[width]",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("flex items-center px-2 py-3", sidebarCollapsed && "justify-center px-0")}>
          {sidebarCollapsed ? (
            <HireStepXMark className="size-6" />
          ) : (
            <img src="/wordmark.png" alt="HireStepX" className="h-7 w-auto" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              data-active={active}
              aria-label={label}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none transition-colors",
                sidebarCollapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary/10 font-medium text-sidebar-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
        </div>

        <div className="border-sidebar-border flex flex-col border-t pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-14 w-full items-center gap-2.5 rounded-md p-2.5 text-left text-sm outline-none transition-colors",
                  sidebarCollapsed && "justify-center p-0"
                )}
              >
                <Avatar className="rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    <HireStepXMark className="size-full" />
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">Flexio Company</span>
                    </div>
                    <ChevronsUpDown className="text-sidebar-foreground/50 ml-auto size-4" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start" side="top" sideOffset={4}>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      <HireStepXMark className="size-full" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Flexio Company</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="size-4" />
                  Help &amp; Support
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2 h-max">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-1 size-7"
              aria-label="Toggle sidebar"
              onClick={() => setSidebarCollapsed((c) => !c)}
            >
              <PanelLeft />
            </Button>
            <Separator orientation="vertical" className="mr-2 h-4" />
            <h1 className="sr-only">Employer Opportunities Dashboard</h1>
            <Breadcrumb>
              <BreadcrumbList>
                {detailsTarget ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <button type="button" onClick={() => setDetailsTarget(null)}>
                          Opportunities
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {profileCandidateName ? (
                      <>
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <button type="button" onClick={() => closeProfileRef.current?.()}>
                              {rows.find((r) => r.id === detailsTarget)?.title ?? "Opportunity Details"}
                            </button>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>{profileCandidateName}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    ) : (
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {rows.find((r) => r.id === detailsTarget)?.title ?? "Opportunity Details"}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage>Opportunities</BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleTheme}
          >
            {isDarkMode ? <Sun /> : <Moon />}
          </Button>
          <DropdownMenu onOpenChange={(open) => open && setHasUnreadNotifications(false)}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={hasUnreadNotifications ? "Notifications (unread)" : "Notifications"}
                className="relative"
              >
                <Bell />
                {hasUnreadNotifications && (
                  <span
                    className="bg-destructive ring-background absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2"
                    aria-hidden="true"
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex-col items-start gap-0.5 whitespace-normal">
                <span className="font-medium">Brand Identity System needs attention</span>
                <span className="text-muted-foreground text-sm">No activity in 2 days — 8 candidates waiting.</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex-col items-start gap-0.5 whitespace-normal">
                <span className="font-medium">Analytics Support needs attention</span>
                <span className="text-muted-foreground text-sm">No activity in 2 days — 5 candidates waiting.</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {detailsTarget ? (
          (() => {
            const detailsRow = rows.find((r) => r.id === detailsTarget);
            if (!detailsRow) return null;
            return (
              <OpportunityDetailsView
                key={detailsRow.id}
                opportunity={detailsRow}
                onEdit={() =>
                  openComposer(
                    { mode: "edit", id: detailsRow.id },
                    {
                      ...emptyJobPostingForm,
                      title: detailsRow.title,
                      locations: detailsRow.location ? [detailsRow.location] : [],
                      description: detailsRow.description,
                      skills: detailsRow.requiredSkills,
                    }
                  )
                }
                onArchive={() => setArchiveTarget({ kind: "row", id: detailsRow.id })}
                onProfileCandidateChange={setProfileCandidateName}
                closeProfileRef={closeProfileRef}
                initialPurchasedBatches={initialPurchasedBatches}
                initialStageFilter={initialStageFilter}
                initialSelectedCandidates={initialSelectedCandidates}
                initialCompareOpen={initialCompareOpen}
                initialEvidenceTarget={initialEvidenceTarget}
                initialPurchaseHistory={initialPurchaseHistory}
                initialUnlockConfirmation={initialUnlockConfirmation}
                initialProfileTarget={initialProfileTarget}
              />
            );
          })()
        ) : (
        <main className="bg-muted/40 flex flex-1 flex-col gap-4 overflow-hidden p-4">
          <div aria-live="polite" className="sr-only">
            {filteredRows.length} {filteredRows.length === 1 ? "opportunity" : "opportunities"} match
            {searchQuery || activeFilterCount > 0 ? " your search and filters" : ""}.
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                aria-label="Search opportunities"
                placeholder="Search opportunities"
                className="w-64 pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={
                      activeFilterCount > 0
                        ? `Filter opportunities (${activeFilterCount} active)`
                        : "Filter opportunities"
                    }
                    className="relative"
                  >
                    <SlidersHorizontal />
                    {activeFilterCount > 0 && (
                      <span
                        className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-sm font-medium"
                        aria-hidden="true"
                      >
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Stage</DropdownMenuLabel>
                  {ALL_STAGES.map((stage) => (
                    <DropdownMenuCheckboxItem
                      key={stage}
                      checked={stageFilter.has(stage)}
                      onCheckedChange={(checked) =>
                        setStageFilter((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(stage);
                          else next.delete(stage);
                          return next;
                        })
                      }
                    >
                      {stageLabel[stage]}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Posting status</DropdownMenuLabel>
                  {ALL_POSTING_STATUSES.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilter.has(status)}
                      onCheckedChange={(checked) =>
                        setStatusFilter((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(status);
                          else next.delete(status);
                          return next;
                        })
                      }
                    >
                      {status}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={attentionOnly}
                    onCheckedChange={(checked) => setAttentionOnly(checked === true)}
                  >
                    Needs attention only
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => openComposer({ mode: "create", id: null }, emptyJobPostingForm)}>
                <Plus />
                Create
              </Button>
            </div>
          </div>

          {selectedRows.size > 0 && (
            <div className="bg-primary/5 border-primary/20 flex shrink-0 items-center justify-between rounded-lg border px-3 py-2">
              <p className="text-foreground text-sm font-medium">
                {selectedRows.size} selected
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setArchiveTarget({ kind: "bulk" })}
                >
                  Archive
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <div className="bg-card flex flex-1 flex-col overflow-hidden rounded-xl border">
            <div className="flex-1 overflow-auto">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <Briefcase className="text-muted-foreground/50 size-8" />
                <div className="space-y-1">
                  <p className="text-foreground font-medium">No postings yet</p>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    Create your first posting and HireStepX's AI will match, audit,
                    and score the top 5-10 candidates for it.
                  </p>
                </div>
                <Button className="mt-1" onClick={() => openComposer({ mode: "create", id: null }, emptyJobPostingForm)}>
                  <Plus />
                  Create your first posting
                </Button>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <Search className="text-muted-foreground/50 size-8" />
                <div className="space-y-1">
                  <p className="text-foreground font-medium">No opportunities match</p>
                  <p className="text-muted-foreground max-w-sm text-sm">
                    Try a different search term or clear your stage and attention filters.
                  </p>
                </div>
                <Button variant="outline" className="mt-1" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
            <Table aria-label="Opportunities">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="w-8">
                    <Checkbox
                      checked={selectAllState}
                      onCheckedChange={(checked) =>
                        setSelectedRows((prev) => {
                          const next = new Set(prev);
                          displayedRows.forEach((r) => (checked === true ? next.add(r.id) : next.delete(r.id)));
                          return next;
                        })
                      }
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                  <TableHead aria-sort={sortColumn === "title" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                    <SortableHead
                      label="Opportunity"
                      column="title"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead aria-sort={sortColumn === "stage" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                    <div className="flex items-center gap-1">
                      <SortableHead
                        label="Stage"
                        column="stage"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                          >
                            <Info className="size-3.5" />
                            <span className="sr-only">What is Stage?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                          arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                        >
                          Where this posting is in your hiring pipeline: AI Matching → Ready for
                          Review → Interviewing → Hired.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      AI Screening
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                          >
                            <Info className="size-3.5" />
                            <span className="sr-only">What is AI Screening?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                          arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                        >
                          How many candidates the AI evaluated for this posting, and the evidence
                          score range across them — the shortlist below is drawn from this same range.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead aria-sort={sortColumn === "talent" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                    <div className="flex items-center gap-1">
                      <SortableHead
                        label="Top Matches"
                        column="talent"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                          >
                            <Info className="size-3.5" />
                            <span className="sr-only">What is Top Matches?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                          arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                        >
                          The curated shortlist HireStepX's AI selected for this posting, with their average
                          evidence score.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Strong Match
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                          >
                            <Info className="size-3.5" />
                            <span className="sr-only">What is Strong Match?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                          arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                        >
                          The best of the shortlist — candidates the AI flagged as an especially strong fit.
                          Hover a row's avatars to see who.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.map((o) => {
                  const StageIcon = stageIcon[o.stage];
                  const isMatching = o.stage === "Matching";
                  return (
                    <TableRow
                      key={o.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(o.id, el);
                        else rowRefs.current.delete(o.id);
                      }}
                      data-state={selectedRows.has(o.id) ? "selected" : undefined}
                      draggable={dragEnabled}
                      onDragStart={() => setDragId(o.id)}
                      onDragOver={(e) => dragEnabled && e.preventDefault()}
                      onDrop={() => handleDrop(o.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(dragEnabled && "cursor-grab")}
                    >
                      <TableCell>
                        <span
                          aria-hidden="true"
                          className={cn(
                            "text-muted-foreground inline-flex size-7 items-center justify-center",
                            dragEnabled ? "cursor-grab" : "cursor-not-allowed opacity-40"
                          )}
                        >
                          <GripVertical className="size-4" />
                        </span>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(o.id)}
                          onCheckedChange={(checked) =>
                            setSelectedRows((prev) => {
                              const next = new Set(prev);
                              if (checked === true) next.add(o.id);
                              else next.delete(o.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${o.title}`}
                        />
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isMatching}
                            onClick={() => setDetailsTarget(o.id)}
                            className="text-foreground hover:text-primary focus-visible:ring-ring/50 disabled:hover:text-foreground -mx-0.5 rounded px-0.5 text-left font-semibold outline-none hover:underline focus-visible:ring-[3px] disabled:cursor-default disabled:hover:no-underline"
                          >
                            {o.title}
                          </button>
                        </div>
                        <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-sm">
                          <span>{o.pay}</span>
                          <span>·</span>
                          <span>{o.type}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground/70 hover:text-foreground inline-flex">
                                <Info className="size-3.5" />
                                <span className="sr-only">Duration and hours details</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              className="rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                              arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                            >
                              {o.duration} · {o.hours}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="text-muted-foreground gap-1 px-1.5">
                          <StageIcon className={stageIconClass[o.stage]} />
                          {stageLabel[o.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        {isMatching ? (
                          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            Finding candidates
                          </div>
                        ) : (
                          <>
                            <span className="bg-muted text-foreground inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium">
                              <Eye className="size-3.5" />
                              {o.evaluated} evaluated
                            </span>
                            {o.topMatches > 0 && (
                              <div className="text-muted-foreground mt-1.5 text-sm">
                                Score range {o.scoreLow}–{o.scoreHigh}%
                              </div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        {!isMatching && o.topMatches > 0 ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <span className="bg-primary/10 text-primary inline-flex w-fit items-center rounded-full px-2 py-0.5 text-sm font-medium">
                              Top {o.topMatches}
                            </span>
                            <div className="text-[var(--copper)] flex items-center gap-1 text-sm font-medium">
                              <BadgeCheck className="size-3.5" />
                              {o.avgScore}% avg evidence score
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-[var(--copper)]/70 hover:text-[var(--copper)] focus-visible:ring-ring/50 -m-1.5 inline-flex rounded p-1.5 outline-none focus-visible:ring-[3px]"
                                  >
                                    <Info className="size-3.5" />
                                    <span className="sr-only">What is evidence score?</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  className="max-w-64 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-1.5 text-[var(--tooltip-fg)]"
                                  arrowClassName="bg-[var(--tooltip-bg)] fill-[var(--tooltip-bg)]"
                                >
                                  AI-scored from each candidate's practice history, not self-reported. Averaged
                                  across the top matches for this posting.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                            <LoaderCircle className="size-3.5 animate-spin" />
                            {isMatching ? "Matching in progress" : "AI screening in progress"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        {isMatching ? (
                          <span className="text-muted-foreground text-sm">Pending</span>
                        ) : (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${o.strongMatches} strong match${o.strongMatches === 1 ? "" : "es"} — view candidates`}
                              className="focus-visible:ring-ring/50 flex w-fit items-center rounded-full outline-none focus-visible:ring-[3px]"
                            >
                              {o.strongMatchInitials.slice(0, 2).map((initials, i) => (
                                <Avatar
                                  key={initials}
                                  className={cn("border-background size-7 border-2", i > 0 && "-ml-2")}
                                >
                                  <AvatarFallback
                                    className={cn(
                                      "text-[10px] font-medium",
                                      AVATAR_COLORS[
                                        (initials.charCodeAt(0) + initials.charCodeAt(1)) % AVATAR_COLORS.length
                                      ]
                                    )}
                                  >
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {o.strongMatches > 2 && (
                                <Avatar className="border-background bg-muted -ml-2 size-7 border-2">
                                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                                    +{o.strongMatches - 2}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="bottom"
                            align="start"
                            className="w-72 rounded-xl border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] p-3.5 text-left text-[var(--tooltip-fg)] shadow-xl"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold tracking-wide text-[var(--tooltip-fg)]/60 uppercase">
                                Strong Matches
                              </span>
                              <span className="bg-[var(--tooltip-fg)] text-[var(--tooltip-bg)] flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                                {o.strongMatches}
                              </span>
                            </div>
                            <div className="divide-[var(--tooltip-border)] border-[var(--tooltip-border)] mt-2.5 flex flex-col divide-y border-t">
                              {o.strongMatchInitials.map((initials) => {
                                const profile = STRONG_MATCH_PROFILES[initials];
                                if (!profile) return null;
                                return (
                                  <button
                                    key={initials}
                                    type="button"
                                    onClick={() => {
                                      // Candidate details screen not built yet — this is the
                                      // intended navigation hook (e.g. router push to
                                      // /candidates/:id) once that screen exists.
                                    }}
                                    className="group hover:bg-[var(--tooltip-border)] focus-visible:bg-[var(--tooltip-border)] -mx-1.5 flex items-center justify-between gap-3 rounded-md px-1.5 py-2.5 text-left transition-colors focus-visible:outline-none"
                                  >
                                    <div className="flex min-w-0 flex-col gap-1">
                                      <span className="truncate text-sm leading-snug font-semibold text-[var(--tooltip-fg)]">
                                        {profile.name}
                                      </span>
                                      <span className="truncate text-xs leading-snug text-[var(--tooltip-fg)]/55">
                                        {profile.yrs} yrs · {profile.tags}
                                      </span>
                                    </div>
                                    <ChevronRight className="text-[var(--tooltip-fg)]/25 group-hover:text-[var(--tooltip-fg)]/70 size-3.5 shrink-0 transition-colors group-hover:translate-x-0.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                        )}
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        <span className="bg-[var(--experience-badge-bg)] text-[var(--experience-badge-fg)] inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium">
                          {o.experience}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        <div className="text-foreground text-sm font-medium">{o.location}</div>
                      </TableCell>
                      <TableCell className="align-middle whitespace-normal">
                        <div
                          className={cn(
                            "text-sm font-medium tabular-nums",
                            o.dueDate === "Overdue" ? "text-destructive" : "text-foreground"
                          )}
                        >
                          {o.dueDate}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground size-7"
                              aria-label={`Actions for ${o.title}`}
                            >
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              disabled={isMatching}
                              onSelect={() => setDetailsTarget(o.id)}
                            >
                              <Users className="size-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!dragEnabled || rows.findIndex((r) => r.id === o.id) === 0}
                              onSelect={() => moveRow(o.id, "up")}
                            >
                              <ChevronUp className="size-4" />
                              Move up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!dragEnabled || rows.findIndex((r) => r.id === o.id) === rows.length - 1}
                              onSelect={() => moveRow(o.id, "down")}
                            >
                              <ChevronDown className="size-4" />
                              Move down
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() =>
                                openComposer(
                                  { mode: "edit", id: o.id },
                                  {
                                    ...emptyJobPostingForm,
                                    title: o.title,
                                    locations: o.location ? [o.location] : [],
                                    description: o.description,
                                    skills: o.requiredSkills,
                                  }
                                )
                              }
                            >
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
                              onSelect={() => setArchiveTarget({ kind: "row", id: o.id })}
                            >
                              <ArchiveIcon className="size-4" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
              <div className="flex flex-1 items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  {selectedRows.size} of {filteredRows.length} row(s) selected.
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <p className="text-muted-foreground text-sm">Rows per page</p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-16 justify-between"
                        aria-label={`Rows per page: ${rowsPerPage}`}
                      >
                        {rowsPerPage}
                        <ChevronDown className="text-muted-foreground" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-16">
                      {[5, 10, 20, 30, 50].map((n) => (
                        <DropdownMenuItem
                          key={n}
                          onSelect={() => {
                            setRowsPerPage(n);
                            setCurrentPage(1);
                          }}
                        >
                          {n}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-muted-foreground text-sm">
                  Page {safePage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(1)}
                    aria-label="Go to first page"
                  >
                    <ChevronsLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Go to next page"
                  >
                    <ChevronRight />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    aria-label="Go to last page"
                  >
                    <ChevronsRight />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        )}
      </div>

      <AlertDialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.kind === "bulk" ? `Archive ${selectedRows.size} opportunities?` : "Archive this opportunity?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Archived opportunities are removed from this list. This can't be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={confirmArchive}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={composer !== null} onOpenChange={(open) => !open && closeComposer()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <span className="text-xs font-medium tracking-wide text-primary uppercase">
              {composer?.mode === "edit" ? "Edit posting" : "New requirement"} · step {composerStep} of 2
            </span>
            <FormStepProgress step={composerStep} />
            <DialogTitle className="font-heading text-lg">
              {composerStep === 1 ? "Basic information" : "Preferences & perks"}
            </DialogTitle>
            <DialogDescription>
              {composerStep === 1
                ? "Tell candidates what the role is and what you're looking for."
                : "Optional targeting and logistics — helps us narrow the shortlist."}
            </DialogDescription>
          </DialogHeader>

          {composerStep === 1 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <FormSectionHeading>Role</FormSectionHeading>

                <div className="grid gap-2">
                  <Label htmlFor="composer-title">
                    Job title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="composer-title"
                    autoFocus
                    placeholder="Senior Frontend Engineer"
                    value={composerForm.title}
                    onChange={(e) => updateComposerForm("title", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-locations">
                    Locations <span className="text-destructive">*</span>
                  </Label>
                  <FormTagInput
                    id="composer-locations"
                    values={composerForm.locations}
                    onChange={(next) => updateComposerForm("locations", next)}
                    placeholder="Mumbai, Bengaluru, Remote…"
                  />
                  <p className="text-sm text-muted-foreground">
                    Add each city or "Remote" as its own tag, then press Enter.
                  </p>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div className="grid gap-2">
                    <Label>Work mode</Label>
                    <div className="flex gap-1.5">
                      {WORK_MODE_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          size="sm"
                          variant={composerForm.workMode === opt.value ? "default" : "outline"}
                          aria-pressed={composerForm.workMode === opt.value}
                          onClick={() => updateComposerForm("workMode", opt.value)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid w-36 gap-2">
                    <Label htmlFor="composer-open-positions">Open positions</Label>
                    <Input
                      id="composer-open-positions"
                      type="number"
                      min={1}
                      max={500}
                      placeholder="1"
                      value={composerForm.openPositions}
                      onChange={(e) => updateComposerForm("openPositions", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <FormSectionHeading>Compensation & experience</FormSectionHeading>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="composer-budget-min">Budget — min (LPA)</Label>
                    <Input
                      id="composer-budget-min"
                      type="number"
                      min={0}
                      max={1000}
                      placeholder="12"
                      value={composerForm.budgetMin}
                      onChange={(e) => updateComposerForm("budgetMin", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="composer-budget-max">Budget — max (LPA)</Label>
                    <Input
                      id="composer-budget-max"
                      type="number"
                      min={0}
                      max={1000}
                      placeholder="18"
                      value={composerForm.budgetMax}
                      onChange={(e) => updateComposerForm("budgetMax", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="composer-experience-min">Experience — min (years)</Label>
                    <Input
                      id="composer-experience-min"
                      type="number"
                      min={0}
                      max={40}
                      placeholder="2"
                      value={composerForm.experienceMin}
                      onChange={(e) => updateComposerForm("experienceMin", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="composer-experience-max">Experience — max (years)</Label>
                    <Input
                      id="composer-experience-max"
                      type="number"
                      min={0}
                      max={40}
                      placeholder="5"
                      value={composerForm.experienceMax}
                      onChange={(e) => updateComposerForm("experienceMax", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <FormSectionHeading>Skills & description</FormSectionHeading>

                <div className="grid gap-2">
                  <Label htmlFor="composer-skills">Skills</Label>
                  <FormTagInput
                    id="composer-skills"
                    values={composerForm.skills}
                    onChange={(next) => updateComposerForm("skills", next)}
                    placeholder="React, TypeScript, System design…"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-description">
                    Role description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="composer-description"
                    rows={4}
                    maxLength={500}
                    placeholder="Paste the JD or a few lines about what you're looking for…"
                    value={composerForm.description}
                    onChange={(e) => updateComposerForm("description", e.target.value.slice(0, 500))}
                  />
                  <p
                    className={cn(
                      "text-sm",
                      composerForm.description.trim().length > 0 &&
                        composerForm.description.trim().length < JOB_DESCRIPTION_MIN_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    We diff this against each candidate's resume to generate their JD-match report — at least{" "}
                    {JOB_DESCRIPTION_MIN_LENGTH} characters. {composerForm.description.length}/500
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-responsibilities">Responsibilities (optional)</Label>
                  <Textarea
                    id="composer-responsibilities"
                    rows={4}
                    maxLength={500}
                    placeholder="What will this person own day to day?"
                    value={composerForm.responsibilities}
                    onChange={(e) => updateComposerForm("responsibilities", e.target.value.slice(0, 500))}
                  />
                  <p className="text-sm text-muted-foreground">{composerForm.responsibilities.length}/500</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-nice-to-have">Nice to have (optional)</Label>
                  <Textarea
                    id="composer-nice-to-have"
                    rows={3}
                    maxLength={500}
                    placeholder="Bonus skills or experience"
                    value={composerForm.niceToHave}
                    onChange={(e) => updateComposerForm("niceToHave", e.target.value.slice(0, 500))}
                  />
                  <p className="text-sm text-muted-foreground">{composerForm.niceToHave.length}/500</p>
                </div>
              </div>
            </div>
          )}

          {composerStep === 2 && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <FormSectionHeading>Candidate targeting</FormSectionHeading>

                <div className="grid gap-2">
                  <Label htmlFor="composer-preferred-industry">Preferred industry (optional)</Label>
                  <Input
                    id="composer-preferred-industry"
                    placeholder="Fintech, SaaS, Ecommerce…"
                    value={composerForm.preferredIndustry}
                    onChange={(e) => updateComposerForm("preferredIndustry", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-colleges">Preferred colleges (optional)</Label>
                  <FormTagInput
                    id="composer-colleges"
                    values={composerForm.preferredColleges}
                    onChange={(next) => updateComposerForm("preferredColleges", next)}
                    placeholder="IIT, NIT, BITS…"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-target-companies">Target companies (optional)</Label>
                  <FormTagInput
                    id="composer-target-companies"
                    values={composerForm.targetCompanies}
                    onChange={(next) => updateComposerForm("targetCompanies", next)}
                    placeholder="Companies you'd like candidates to come from"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <FormSectionHeading>Perks & logistics</FormSectionHeading>

                <div className="grid gap-2">
                  <Label htmlFor="composer-perks">Perks and benefits (optional)</Label>
                  <FormTagInput
                    id="composer-perks"
                    values={composerForm.perksAndBenefits}
                    onChange={(next) => updateComposerForm("perksAndBenefits", next)}
                    placeholder="Full healthcare, Unlimited vacation…"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-notice-period">Notice period preference</Label>
                  <Select
                    value={composerForm.noticePeriodPref}
                    onValueChange={(next) => updateComposerForm("noticePeriodPref", next)}
                  >
                    <SelectTrigger id="composer-notice-period" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTICE_PERIOD_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="composer-due-date">Due date (optional)</Label>
                  <Input
                    id="composer-due-date"
                    type="date"
                    value={composerForm.dueDate}
                    onChange={(e) => updateComposerForm("dueDate", e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Shown on the Jobs table as a countdown so you know when to follow up.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {composerStep === 1 ? (
              <Button disabled={!composerStep1Valid} onClick={() => setComposerStep(2)}>
                Continue
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setComposerStep(1)}>
                  Back
                </Button>
                <Button disabled={composerSubmitting} onClick={handleComposerSubmit}>
                  {composerSubmitting
                    ? "Posting job…"
                    : composer?.mode === "edit"
                      ? "Save"
                      : "Post Job"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ThemeContext.Provider>
  );
}

export function EmployersDashboardOpportunityDetails() {
  return <EmployersDashboard initialDetailsId="5" />;
}

/* ─────────────────────────────────────────────────────────────────────────
   Opportunity Details — scenario storyboards

   Thin entry points onto the same OpportunityDetailsView, each seeded to a
   different real state the screen needs to render correctly: every pipeline
   stage, every lock/unlock combination the pay-per-batch model can produce
   (all-locked, single-batch-unlocked, multi-batch partial and fully
   unlocked), a paused posting, and the stage-filter-to-zero-results empty
   state. All from the same mock Opportunity rows already in
   initialOpportunities — the only addition is id "8" (Senior Backend
   Engineer), the one seed opportunity with a shortlist longer than one
   batch (24 candidates), since every other seed posting tops out at 8.
   ───────────────────────────────────────────────────────────────────── */

/* AI still screening — topMatches is 0, so the shortlist table never
   renders; the screen shows only the "AI Matching" stat row. */
export function EmployersDashboardOpportunityDetailsMatching() {
  return <EmployersDashboard initialDetailsId="1" />;
}

/* Review stage, single batch (6 candidates), nothing purchased yet — every
   row locked, identity hidden behind "Candidate #XX0". Default state. */
export function EmployersDashboardOpportunityDetailsAllLocked() {
  return <EmployersDashboard initialDetailsId="2" />;
}

/* Same posting, batch 0 already purchased — since 6 < BUNDLE_SIZE the whole
   shortlist is unlocked in one purchase, showing real names/actions
   end-to-end with no locked rows left. */
export function EmployersDashboardOpportunityDetailsAllUnlocked() {
  return <EmployersDashboard initialDetailsId="2" initialPurchasedBatches={[0]} />;
}

/* 24-candidate shortlist spanning 3 batches, only batch 1 purchased —
   candidates 1-10 show names/actions, 11-24 stay locked with their own
   "Unlock next batch" banner still showing. The core multi-batch case. */
export function EmployersDashboardOpportunityDetailsMultiBatchPartial() {
  return <EmployersDashboard initialDetailsId="8" initialPurchasedBatches={[0]} />;
}

/* Same 24-candidate shortlist, all 3 batches purchased — the unlock banner
   disappears entirely since nextBatchIndex has nothing left to offer. */
export function EmployersDashboardOpportunityDetailsMultiBatchFullyUnlocked() {
  return <EmployersDashboard initialDetailsId="8" initialPurchasedBatches={[0, 1, 2]} />;
}

/* Interviewing stage — some rows already show "Interviewing"/"Round 1"
   round status instead of the default "Shortlisted". Batch 0 purchased so
   these rows are actually unlocked — a still-locked row is clamped to
   "Shortlisted" regardless of its seeded stage (see the candidates
   useMemo), so leaving everyone locked here would silently fall back to
   the "All Locked" storyboard instead of demonstrating this stage. */
export function EmployersDashboardOpportunityDetailsInterviewing() {
  return <EmployersDashboard initialDetailsId="3" initialPurchasedBatches={[0]} />;
}

/* Posting-lifecycle edge case: postingStatus "Paused" while pipeline stage
   is still mid-Review — the two axes are independent, so this checks they
   render correctly together instead of only ever seeing Active postings. */
export function EmployersDashboardOpportunityDetailsPaused() {
  return <EmployersDashboard initialDetailsId="4" />;
}

/* Funnel-stage filter applied to a posting with zero Hired candidates —
   the dedicated "no candidates in Hired" empty state (distinct from the
   "AI still matching" and "no shortlist at all" empty states), with its
   clear-filter action. */
export function EmployersDashboardOpportunityDetailsFilteredEmpty() {
  return <EmployersDashboard initialDetailsId="2" initialStageFilter="Hired" />;
}

/* The unlock-confirmation moment itself: batch 2 was just purchased on top
   of an already-purchased batch 1, so both the green confirmation banner
   AND the "· unlock #2 on this posting" repeat-unlock badge render together
   — the one feature this session built with zero prior static coverage.
   Note the banner auto-dismisses 4s after mount (real behavior, unchanged
   here), so a screenshot must be taken promptly after the storyboard loads. */
export function EmployersDashboardOpportunityDetailsRepeatUnlock() {
  return (
    <EmployersDashboard
      initialDetailsId="8"
      initialPurchasedBatches={[0, 1]}
      initialPurchaseHistory={[
        { batches: [0], at: Date.now() - 86_400_000 },
        { batches: [1], at: Date.now() },
      ]}
      initialUnlockConfirmation="Batch unlocked — ₹299 charged."
    />
  );
}

/* Bulk-selection toolbar: 2 already-unlocked candidates (AK at index 0, MP
   at index 2 — both in purchased batch 0) plus 2 still-locked candidates
   from batch 1 (NV2 at index 11, SJ2 at index 12 — batch 1 is untouched),
   selected together, so the toolbar shows "Compare selected" alongside
   "Unlock 1 batch — ₹299" — the mixed-lock-state bulk action path the
   per-batch banner alone never exercises. */
export function EmployersDashboardOpportunityDetailsBulkSelection() {
  return (
    <EmployersDashboard
      initialDetailsId="8"
      initialPurchasedBatches={[0]}
      initialSelectedCandidates={["AK", "MP", "NV2", "SJ2"]}
    />
  );
}

/* Compare dialog open on load, seeded from a checkbox selection (the only
   way to reach it — there is no default/top-N compare entry point) — the
   side-by-side evidence comparison overlay for 3 candidates a user picked
   themselves via the row checkboxes. */
export function EmployersDashboardOpportunityDetailsCompareDialog() {
  return (
    <EmployersDashboard
      initialDetailsId="8"
      initialPurchasedBatches={[0]}
      initialSelectedCandidates={["AK", "MP", "NV"]}
      initialCompareOpen
    />
  );
}

/* Per-candidate evidence detail dialog open on load, for a still-locked
   candidate — confirms the evidence breakdown (score, roster score,
   sessions, notice period, CTC) is visible even before identity unlocks,
   consistent with the "evidence always visible, only identity gated"
   model. */
export function EmployersDashboardOpportunityDetailsEvidenceDialog() {
  return <EmployersDashboard initialDetailsId="8" initialEvidenceTarget="AK2" />;
}

/* Full-page Candidate Profile — the deep, evidence-dense destination behind
   a shortlist row click. Locked variant: candidate is still behind the
   unlock gate, so every evidence section (STAR breakdown, practice
   sessions, portfolio, skill match) renders in full while identity/resume/
   LinkedIn/portfolio-view stay gated, proving the "evidence always visible,
   only identity gated" rule holds on this screen too. */
export function EmployersDashboardOpportunityDetailsCandidateProfileLocked() {
  return <EmployersDashboard initialDetailsId="8" initialProfileTarget="AK2" />;
}

/* Same profile, batch 0 purchased so this specific candidate (AK, index 0)
   is unlocked — identity, resume download, LinkedIn, and portfolio "View"
   links all become available, and the pipeline actions (advance/reject)
   appear since the candidate is a real, identified person now. */
export function EmployersDashboardOpportunityDetailsCandidateProfileUnlocked() {
  return <EmployersDashboard initialDetailsId="8" initialPurchasedBatches={[0]} initialProfileTarget="AK" />;
}

/* ═════════════════════════════════════════════════════════════════════════
   FULL-PAGE SCREEN SHELLS — shared chrome so every storyboard below renders
   as a complete 1728-wide browser screen (background + real nav/header),
   never a card floating alone in an oversized frame.

   - PublicAuthShell: the pre-auth chrome (logo header, full-height centered
     stage) for Sign up/Log in, Onboarding, Pending, and Rejected — screens
     that render before a user is inside the authenticated employer app.
   - EmployerAppShell: the SAME sidebar+header structure the default
     EmployersDashboard export builds (see its `return` above) — reused
     here (not rebuilt) for OutcomeFeedback and Settings, both reached from
     inside the authenticated employer app post-approval.
   - AdminAppShell: the admin-console counterpart — same shadcn primitives,
     an admin-flavored left nav (adminNavItems, mirroring
     src/AdminDashboard.tsx's TABS) — for AdminApprovals /
     AdminApprovalsEmpty, which are authenticated ADMIN screens, not
     employer ones.
   ───────────────────────────────────────────────────────────────────── */

function PublicAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <></>
  );
}

function EmployerAppShell({
  activeLabel,
  breadcrumbLabel,
  children,
}: {
  activeLabel?: string;
  breadcrumbLabel: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  return (
    <></>
  );
}

function AdminAppShell({
  activeLabel,
  breadcrumbLabel,
  children,
}: {
  activeLabel?: string;
  breadcrumbLabel: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  return (
    <></>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   PRE-APPROVAL EMPLOYER JOURNEY — everything that happens before a company
   ever reaches the Dashboard storyboard above: sign up/log in, the company
   intake form, and the two outcomes of admin review (pending / rejected).

   Ground truth:
     - Auth screen        → src/auth/Login.tsx (isEmployerFlow branch — the
       shared candidate/employer auth screen, employer copy at its
       headline/subhead/CTA branches).
     - Onboarding         → app/(employer)/employer/page.tsx CompanyOnboarding
       + server-handlers/employer-profile.ts (POST body/validation).
     - Pending / Rejected → the same file's CompanyPending / CompanyRejected.

   Same self-contained shadcn primitives as the rest of this canvas, now
   wrapped in PublicAuthShell (logo header + full-height stage — no sidebar
   nav, since these screens render before a user is ever inside the
   authenticated employer app) so each renders as a complete 1728-wide
   screen rather than a bare centered card. Local useState only, no
   backend wiring — this is design scope, matching this canvas's convention
   throughout.

   Deliberate gap-fill: the real CompanyOnboarding form only collects
   companyName + website, but employer-profile.ts's POST body and the
   `employers` table both already accept `gstin` (an earlier audit flagged
   this as a missing field, not a hallucinated one — the backend has
   supported it all along). This redesign adds a "GSTIN (optional)" field
   to close that gap; treat it as a proposed addition to the real form, not
   as depicting existing production UI.
   ───────────────────────────────────────────────────────────────────── */

function GoogleGIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.47 3.77 1.27 5.39z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

/* Small canvas-local narration tile — describes the row rather than being
   part of the product (per this canvas's "canvas narration" exemption). */
/* Meta/annotation frame, not a production screen — this is narration for
   the row below it, not an end-to-end screen grounded in a real route. Per
   the redesign brief it still gets the 1728-wide frame every storyboard on
   this canvas uses, but the content stays compact and left-aligned inside
   it rather than being stretched to fill the width unnaturally. */
export function EmployersDashboardEmployerJourneyIntro() {
  return (
    <div style={shadcnDefaultTheme} className="bg-background text-foreground flex h-[320px] w-[1728px] items-start justify-start p-10">
      <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-border p-8">
        <Badge variant="secondary" className="w-fit gap-1">
          <Sparkles className="size-3" /> Design exploration
        </Badge>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Employer onboarding — before a company reaches its Dashboard
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sign up / Log in <ArrowRight className="mx-1 inline size-3.5 align-[-1px]" />
          Company details <ArrowRight className="mx-1 inline size-3.5 align-[-1px]" />
          Pending review <span className="text-muted-foreground/60">(admin reviews)</span>{" "}
          <ArrowRight className="mx-1 inline size-3.5 align-[-1px]" /> Approved
          <span className="text-muted-foreground/60"> or Rejected → resubmit</span>{" "}
          <ArrowRight className="mx-1 inline size-3.5 align-[-1px]" /> Dashboard.
        </p>
      </div>
    </div>
  );
}

/* Sign up / Log in — grounded in src/auth/Login.tsx's isEmployerFlow branch.
   Shared candidate/employer screen in production; this redesign is the
   employer-only entry point, carrying over its exact employer copy
   ("Hire faster with proof", the roster subhead, "Continue to your
   roster") in this canvas's shadcn visual language rather than the real
   cream/serif auth page. */
export function EmployersDashboardEmployerAuth() {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  return (
    <PublicAuthShell>
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Hire <span className="text-copper">faster</span> with proof
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to review your shortlist of candidates who've already been scored on real interview practice."
              : "Create an employer account to post roles and get an AI-matched, evidence-backed shortlist."}
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-1">
            <Button variant="outline" className="h-9 w-full gap-2">
              <GoogleGIcon className="size-4" /> Continue with Google
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="employer-auth-email">Email address</Label>
                <Input
                  id="employer-auth-email"
                  type="email"
                  placeholder="rahul@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="employer-auth-password">Password</Label>
                  {mode === "login" && (
                    <a href="#" className="text-xs font-medium text-primary hover:underline" onClick={(e) => e.preventDefault()}>
                      Forgot password
                    </a>
                  )}
                </div>
                <Input
                  id="employer-auth-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="mt-1 h-9 w-full gap-1.5">
                {mode === "login" ? "Continue to your roster" : "Create your employer account"}
                <ArrowRight className="size-3.5" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </PublicAuthShell>
  );
}

/* Company intake form — grounded in app/(employer)/employer/page.tsx's
   CompanyOnboarding (name/website/logo, copy, the 3-step "what happens
   next" strip) plus server-handlers/employer-profile.ts's POST schema.
   Adds a "GSTIN (optional)" field the backend already accepts but the
   real form doesn't yet collect — the one deliberate gap-fill in this
   batch, called out again in the file-level comment above. */
export function EmployersDashboardEmployerOnboarding() {
  const [companyName, setCompanyName] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [logoName, setLogoName] = React.useState<string | null>(null);

  const canSubmit = companyName.trim().length > 1 && website.trim().length > 3;

  return (
    <PublicAuthShell>
      <div className="flex w-full flex-col items-center gap-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Tell us about your company</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We review every employer before they can browse the roster. Most companies hear back within one
            business day.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employer-onb-name">
                Company name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="employer-onb-name"
                placeholder="Acme Technologies Pvt Ltd"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employer-onb-website">
                Company website <span className="text-destructive">*</span>
              </Label>
              <Input
                id="employer-onb-website"
                placeholder="https://acme.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">We'll use this to verify your company is real.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employer-onb-gstin">GSTIN (optional)</Label>
              <Input
                id="employer-onb-gstin"
                placeholder="22AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                Your GST identification number — used for invoicing once you're approved.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company logo (optional)</Label>
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-muted-foreground">
                  {logoName ? <ShieldCheck className="size-5" /> : <Building2 className="size-5" />}
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="employer-onb-logo" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>{logoName ? "Change logo" : "Upload logo"}</span>
                    </Button>
                  </Label>
                  <input
                    id="employer-onb-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP · up to 2 MB.</p>
                </div>
              </div>
            </div>
            <Button disabled={!canSubmit} className="mt-1 h-9 w-full">
              Submit for approval
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-3 gap-6">
        {[
          { icon: CheckCircle2, title: "You submit", body: "Company name, website, and GSTIN. A logo speeds up review." },
          { icon: Clock, title: "We review", body: "A human checks every employer — most hear back in one business day." },
          { icon: ArrowRight, title: "You post roles", body: "Get an AI-matched shortlist, scored on real interview performance." },
        ].map((step) => (
          <div key={step.title} className="text-center">
            <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon className="size-4" />
            </div>
            <div className="text-sm font-semibold">{step.title}</div>
            <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.body}</div>
          </div>
        ))}
      </div>
      </div>
    </PublicAuthShell>
  );
}

/* Waiting state — grounded in app/(employer)/employer/page.tsx's
   CompanyPending (polls every 4s for approval in production; this
   storyboard is a static snapshot of that moment). */
export function EmployersDashboardEmployerPending() {
  return (
    <PublicAuthShell>
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clock className="size-5" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Your profile is under review</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          We typically approve genuine employers within one business day. You'll be able to post a requirement
          as soon as you're approved — this page will update automatically.
        </p>
        <div className="mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Once approved <ArrowRight className="size-3" /> your Dashboard
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Made a mistake in your details, or been waiting longer than a day?{" "}
          <span className="font-medium text-primary">support@hirestepx.com</span>
        </p>
      </div>
    </PublicAuthShell>
  );
}

/* Rejected state — grounded in app/(employer)/employer/page.tsx's
   CompanyRejected. "Resubmit" is a real state transition in this
   storyboard (not a no-op): it swaps in the onboarding form locally,
   the same way the real app's resetCompanyProfile() drops the user back
   to CompanyOnboarding — no router involved, this is still a static
   canvas. Destructive tone matches this canvas's existing convention
   (bg-destructive/10 + text-destructive) rather than an alarming full-red
   treatment. */
export function EmployersDashboardEmployerRejected() {
  const [resubmitting, setResubmitting] = React.useState(false);

  if (resubmitting) return <EmployersDashboardEmployerOnboarding />;

  return (
    <PublicAuthShell>
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <XCircle className="size-5" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">We couldn't approve this profile</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          We couldn't verify this as a genuine hiring company from the details provided. You're welcome to
          resubmit with more information.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => setResubmitting(true)}>
          Resubmit company profile
        </Button>
      </div>
    </PublicAuthShell>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   ADMIN — EMPLOYER APPROVALS, COMPARE (dedicated page), OUTCOME FEEDBACK,
   and SETTINGS — four more screens extending the employer-side redesign.

   Ground truth:
     - Admin approvals → src/AdminDashboard.tsx renderEmployers() + the
       EmployersData interface (stat cards, pending/decided tables,
       approve/reject busy-state buttons, CSV export, empty state).
       Per the user's blanket redesign decision, this is redesigned in
       this canvas's shadcn language rather than porting the real
       dark-console JSX verbatim — the real component mixes in many
       unrelated admin tabs that don't belong in this file.
     - Compare  → app/(employer)/employer/requirements/[id]/compare/page.tsx.
       The canvas already has a "Compare Dialog" storyboard (a modal
       inside OpportunityDetailsView); the real feature is its own routed
       page, not a dialog — flagged by a prior audit as a design-debt
       inconsistency. This adds the "real route" treatment as a full-page
       storyboard alongside the existing dialog rather than replacing it;
       a future cleanup pass should pick one pattern and retire the other.
     - Outcome feedback → app/(employer)/employer/requirements/[id]/outcome/page.tsx.
       Real code comment: this feedback "isn't persisted anywhere yet" —
       kept honest here too (local state only, no backend-persistence
       claim in the confirmation copy).
     - Settings → app/(employer)/employer/settings/page.tsx. Saving resets
       the company's approval status to pending for re-review — a real,
       load-bearing behavior surfaced via the new Alert primitive above.
   ───────────────────────────────────────────────────────────────────── */

type AdminEmployerRow = {
  id: string;
  companyName: string;
  website: string;
  gstin: string | null;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedAt: string | null;
  contactName: string;
  contactEmail: string;
};

const ADMIN_EMPLOYER_ROWS: AdminEmployerRow[] = [
  { id: "e1", companyName: "Zeta Logistics Pvt Ltd", website: "https://zetalogistics.in", gstin: "27AAAZL1234C1Z8", status: "pending", submittedAt: "2026-09-14T10:20:00Z", approvedAt: null, contactName: "Priya Nair", contactEmail: "priya@zetalogistics.in" },
  { id: "e2", companyName: "Kavan Fintech", website: "https://kavanfintech.com", gstin: null, status: "pending", submittedAt: "2026-09-15T06:05:00Z", approvedAt: null, contactName: "Arjun Mehta", contactEmail: "arjun@kavanfintech.com" },
  { id: "e3", companyName: "Solstice Cloud Labs", website: "https://solsticecloud.io", gstin: "29AASCL5678D1Z2", status: "pending", submittedAt: "2026-09-15T13:40:00Z", approvedAt: null, contactName: "Neha Kulkarni", contactEmail: "neha@solsticecloud.io" },
  { id: "e4", companyName: "Bharat Manufacturing Co", website: "https://bharatmfg.in", gstin: "24AABMC9012E1Z6", status: "approved", submittedAt: "2026-09-01T09:00:00Z", approvedAt: "2026-09-02T11:15:00Z", contactName: "Ramesh Iyer", contactEmail: "ramesh@bharatmfg.in" },
  { id: "e5", companyName: "Nimbus Data Systems", website: "https://nimbusdata.co", gstin: "07AANDS3456F1Z9", status: "approved", submittedAt: "2026-08-27T15:22:00Z", approvedAt: "2026-08-28T08:40:00Z", contactName: "Divya Rao", contactEmail: "divya@nimbusdata.co" },
  { id: "e6", companyName: "QuickShift Staffing", website: "https://quickshiftstaffing.com", gstin: null, status: "rejected", submittedAt: "2026-08-30T12:10:00Z", approvedAt: "2026-08-31T09:55:00Z", contactName: "Sanjay Bhatt", contactEmail: "sanjay@quickshiftstaffing.com" },
];

function adminFormatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function AdminStatusBadge({ status }: { status: AdminEmployerRow["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
        <Clock className="size-3" /> Pending
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Approved
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="size-3" /> Rejected
    </Badge>
  );
}

/* Admin — Employer Approvals. Redesigned from renderEmployers(): 4 stat
   cards (pending in amber/warning tone, rejected in destructive tone,
   mirroring the real component's c.gilt/c.sage/c.ember token usage),
   a pending-review table with inline Approve/Reject actions disabled
   while that row is mid-decision (a local busyId state standing in for
   the real employerActionBusyId), and a read-only decided-rows table
   with a CSV export action. Local mock state only — approve/reject
   actually moves rows between the two tables so the interaction reads
   true, but nothing is wired to a backend. */
export function EmployersDashboardAdminApprovals() {
  const [rows, setRows] = React.useState<AdminEmployerRow[]>(ADMIN_EMPLOYER_ROWS);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const total = rows.length;
  const pendingRows = rows.filter((r) => r.status === "pending");
  const decidedRows = rows.filter((r) => r.status !== "pending");
  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const rejectedCount = rows.filter((r) => r.status === "rejected").length;

  const decide = (id: string, next: "approved" | "rejected") => {
    setBusyId(id);
    window.setTimeout(() => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: next, approvedAt: new Date().toISOString() } : r))
      );
      setBusyId(null);
    }, 600);
  };

  return (
    <AdminAppShell activeLabel="Employers" breadcrumbLabel="Employer approvals">
      <div className="overflow-auto p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <Badge variant="secondary" className="mb-2 w-fit gap-1">
            <ShieldCheck className="size-3" /> Admin console
          </Badge>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Employer approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review company signups before they can browse the candidate roster.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total signups</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pending review</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {pendingRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {approvedCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-destructive text-2xl font-semibold tabular-nums">{rejectedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-sm">Pending review ({pendingRows.length})</CardTitle>
          </CardHeader>
          {pendingRows.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-1 py-12 text-sm">
              <span className="font-medium">Nothing waiting on review</span>
              <span>New signups will show up here for approval.</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium whitespace-normal">{row.companyName}</TableCell>
                    <TableCell className="whitespace-normal">
                      <a
                        href={row.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.preventDefault()}
                      >
                        {row.website.replace(/^https?:\/\//, "")}
                      </a>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.gstin ?? "—"}</TableCell>
                    <TableCell className="whitespace-normal">
                      <div>{row.contactName}</div>
                      <div className="text-muted-foreground text-xs">{row.contactEmail}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{adminFormatDateTime(row.submittedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === row.id}
                          className="bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-60"
                          onClick={() => decide(row.id, "approved")}
                        >
                          {busyId === row.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === row.id}
                          onClick={() => decide(row.id, "rejected")}
                        >
                          {busyId === row.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {decidedRows.length > 0 && (
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex-row items-center justify-between border-b py-4">
              <CardTitle className="text-sm">Reviewed</CardTitle>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {}}>
                <FileDown className="size-3.5" /> Export CSV
              </Button>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Decided</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decidedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium whitespace-normal">{row.companyName}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-normal text-xs">{row.contactEmail}</TableCell>
                    <TableCell>
                      <AdminStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{adminFormatDateTime(row.submittedAt)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.approvedAt ? adminFormatDateTime(row.approvedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
      </div>
    </AdminAppShell>
  );
}

/* Zero-state variant — mirrors renderEmployers()'s
   `if (!employers) return <EmptyState title="No employer signups yet" />`. */
export function EmployersDashboardAdminApprovalsEmpty() {
  return (
    <AdminAppShell activeLabel="Employers" breadcrumbLabel="Employer approvals">
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </div>
          <p className="text-sm font-medium">No employer signups yet</p>
          <p className="text-muted-foreground max-w-xs text-sm">
            Companies that sign up for an employer account will appear here for review.
          </p>
        </div>
      </div>
    </AdminAppShell>
  );
}

/* ── Compare (dedicated full-page route) ──────────────────────────────── */

type CompareCandidate = {
  id: string;
  name: string;
  unlocked: boolean;
  targetRole: string;
  city: string;
  matchScore: number;
  matchBreakdown: { roleMatch: number; skillMatch: number; locationMatch: number };
  rosterScore: number;
  sessionsCompleted: number;
  lastActiveDaysAgo: number;
  skills: string[];
};

const COMPARE_CANDIDATES: [CompareCandidate, CompareCandidate] = [
  {
    id: "c-ak",
    name: "Aditya Kulkarni",
    unlocked: true,
    targetRole: "Senior Frontend Engineer",
    city: "Bengaluru",
    matchScore: 91,
    matchBreakdown: { roleMatch: 94, skillMatch: 90, locationMatch: 88 },
    rosterScore: 95,
    sessionsCompleted: 14,
    lastActiveDaysAgo: 2,
    skills: ["React", "TypeScript", "System Design", "Performance"],
  },
  {
    id: "c-mp",
    name: "Meera Pillai",
    unlocked: true,
    targetRole: "Senior Frontend Engineer",
    city: "Pune",
    matchScore: 86,
    matchBreakdown: { roleMatch: 88, skillMatch: 85, locationMatch: 80 },
    rosterScore: 89,
    sessionsCompleted: 9,
    lastActiveDaysAgo: 6,
    skills: ["React", "Redux", "Accessibility", "Testing"],
  },
];

function CompareColumnCard({ candidate }: { candidate: CompareCandidate }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="text-sm font-semibold">{initialsFor(candidate.name)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-base">
              {candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`}
            </CardTitle>
            <CardDescription>{candidate.targetRole} · {candidate.city}</CardDescription>
          </div>
          <CardAction>
            <Badge variant="outline" className={cn(COPPER_TEXT, "gap-1")}>
              <ShieldCheck className="size-3" /> {candidate.matchScore}% match
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Role match</span>
            <span className="font-medium tabular-nums">{candidate.matchBreakdown.roleMatch}%</span>
          </div>
          <Progress value={candidate.matchBreakdown.roleMatch} indicatorClassName={COPPER_BG} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Skill match</span>
            <span className="font-medium tabular-nums">{candidate.matchBreakdown.skillMatch}%</span>
          </div>
          <Progress value={candidate.matchBreakdown.skillMatch} indicatorClassName={COPPER_BG} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Location match</span>
            <span className="font-medium tabular-nums">{candidate.matchBreakdown.locationMatch}%</span>
          </div>
          <Progress value={candidate.matchBreakdown.locationMatch} indicatorClassName={COPPER_BG} />
        </div>
        <Separator />
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Roster score</div>
            <div className="font-semibold tabular-nums">{candidate.rosterScore}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Sessions</div>
            <div className="font-semibold tabular-nums">{candidate.sessionsCompleted}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Last active</div>
            <div className="font-semibold tabular-nums">{candidate.lastActiveDaysAgo}d ago</div>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-2 text-xs">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <Badge key={s} variant="secondary">{s}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* Compare — dedicated full-page route treatment, grounded in
   app/(employer)/employer/requirements/[id]/compare/page.tsx (side-by-side
   2-candidate comparison: match score + breakdown, roster score, sessions,
   last active, skills). The canvas's existing "Compare Dialog" storyboard
   (inside OpportunityDetailsView) models this as a modal; the real feature
   is its own routed page. Both now exist side by side — a future cleanup
   pass should pick one pattern and retire the other. */
export function EmployersDashboardCompare() {
  const [a, b] = COMPARE_CANDIDATES;
  return (
    <EmployerAppShell activeLabel="Opportunities" breadcrumbLabel="Compare candidates">
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div>
            <Badge variant="secondary" className="mb-2 w-fit gap-1">
              <Sparkles className="size-3" /> Comparing candidates
            </Badge>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Senior Frontend Engineer</h1>
            <p className="text-muted-foreground mt-1 text-sm">Side-by-side comparison for this shortlist.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <CompareColumnCard candidate={a} />
            <CompareColumnCard candidate={b} />
          </div>
        </div>
      </div>
    </EmployerAppShell>
  );
}

/* ── Outcome feedback ─────────────────────────────────────────────────── */

const OUTCOME_OPTIONS: Array<{ value: string; label: string; icon: typeof UserCheck }> = [
  { value: "Hired", label: "Hired", icon: UserCheck },
  { value: "Interviewing", label: "Interviewing", icon: ThumbsUp },
  { value: "Not a fit", label: "Not a fit", icon: ThumbsDown },
  { value: "No response yet", label: "No response yet", icon: MinusCircle },
];

/* Outcome feedback — grounded in
   app/(employer)/employer/requirements/[id]/outcome/page.tsx ("How did it
   go?" per candidate: 4 mutually-exclusive options + free-text notes).
   Toggle-button group follows this canvas's established "small closed set"
   convention from the Create Opportunity wizard's work-mode picker, rather
   than introducing a new RadioGroup primitive. The real page's code comment
   notes this feedback isn't persisted anywhere yet — the confirmation copy
   below stays honest to that (no backend-persistence claim). */
export function EmployersDashboardOutcomeFeedback() {
  const [outcome, setOutcome] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [sent, setSent] = React.useState(false);

  if (sent) {
    return (
      <EmployerAppShell activeLabel="Opportunities" breadcrumbLabel="Outcome feedback">
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight">Thanks for the feedback</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              It's noted against Aditya Kulkarni for Senior Frontend Engineer.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>
              Back to shortlist
            </Button>
          </div>
        </div>
      </EmployerAppShell>
    );
  }

  return (
    <EmployerAppShell activeLabel="Opportunities" breadcrumbLabel="Outcome feedback">
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="w-full max-w-md">
          <Badge variant="secondary" className="mb-2 w-fit gap-1">
            <Sparkles className="size-3" /> Outcome feedback
          </Badge>
          <h1 className="font-heading text-xl font-semibold tracking-tight">How did it go with Aditya Kulkarni?</h1>
          <p className="text-muted-foreground mt-1 mb-5 text-sm">Senior Frontend Engineer</p>
          <Card>
            <CardContent className="flex flex-col gap-5 pt-1">
              <div className="flex flex-col gap-2">
                <Label>
                  Outcome <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={outcome === opt.value ? "default" : "outline"}
                      aria-pressed={outcome === opt.value}
                      className="gap-1.5"
                      onClick={() => setOutcome(opt.value)}
                    >
                      <opt.icon className="size-3.5" /> {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="outcome-notes">Notes (optional)</Label>
                <Textarea
                  id="outcome-notes"
                  rows={4}
                  placeholder="Anything that would help us improve future shortlists?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button disabled={!outcome} onClick={() => setSent(true)}>
                Submit feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </EmployerAppShell>
  );
}

/* ── Settings (company profile) ───────────────────────────────────────── */

/* Settings — grounded in app/(employer)/employer/settings/page.tsx: same
   field set as the sibling EmployersDashboardEmployerOnboarding storyboard
   (name/website/GSTIN/logo, for consistency with that already-added form),
   plus the real page's load-bearing behavior — saving re-runs the profile
   through review and resets status to pending — surfaced via the new
   Alert primitive rather than a plain paragraph, since an already-approved
   employer losing console access is a real, easy-to-miss consequence. */
export function EmployersDashboardSettings() {
  const [companyName, setCompanyName] = React.useState("Acme Technologies Pvt Ltd");
  const [website, setWebsite] = React.useState("https://acme.com");
  const [gstin, setGstin] = React.useState("27AAAAA0000A1Z5");
  const [logoName, setLogoName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const canSave = companyName.trim().length > 1 && website.trim().length > 3 && !saving;

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    window.setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 700);
  };

  return (
    <EmployerAppShell breadcrumbLabel="Settings">
      <div className="flex flex-1 flex-col items-center gap-6 overflow-auto p-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">Update your company profile.</p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-name">
                Company name <span className="text-destructive">*</span>
              </Label>
              <Input id="settings-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-website">
                Company website <span className="text-destructive">*</span>
              </Label>
              <Input id="settings-website" placeholder="https://acme.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-gstin">GSTIN (optional)</Label>
              <Input
                id="settings-gstin"
                placeholder="22AAAAA0000A1Z5"
                maxLength={20}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Company logo (optional)</Label>
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-muted-foreground">
                  {logoName ? <ShieldCheck className="size-5" /> : <Building2 className="size-5" />}
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="settings-logo" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>{logoName ? "Change logo" : "Upload logo"}</span>
                    </Button>
                  </Label>
                  <input
                    id="settings-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => setLogoName(e.target.files?.[0]?.name ?? null)}
                  />
                  <p className="text-muted-foreground text-xs">PNG, JPG, or WEBP · up to 2 MB.</p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="text-amber-600 dark:text-amber-400" />
              <AlertTitle>Saving sends your profile back for review</AlertTitle>
              <AlertDescription>
                Your company will show as pending until it's re-approved — the dashboard stays inaccessible for
                other teammates until then.
              </AlertDescription>
            </Alert>

            {saved && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved. Your profile is back under review.</p>
            )}

            <Button disabled={!canSave} onClick={handleSave}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </EmployerAppShell>
  );
}
