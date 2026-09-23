import CanvasProviders from "../../../CanvasProviders";
import DesignSystemIndex from "./DesignSystemIndex";
import DesignSystemColor from "./DesignSystemColor";
import DesignSystemTypography from "./DesignSystemTypography";
import DesignSystemFoundations from "./DesignSystemFoundations";
import DesignSystemMotion from "./DesignSystemMotion";
import DesignSystemComponents from "./DesignSystemComponents";
import DesignSystemPatterns from "./DesignSystemPatterns";
import DesignSystemVoice from "./DesignSystemVoice";
import DesignSystemAccessibility from "./DesignSystemAccessibility";
import DesignSystemBrandStory from "./DesignSystemBrandStory";
import DesignSystemEmail from "./DesignSystemEmail";
import DesignSystemPhotography from "./DesignSystemPhotography";
import DesignSystemPersonas from "./DesignSystemPersonas";
import DesignSystemSound from "./DesignSystemSound";
import DesignSystemDataViz from "./DesignSystemDataViz";
import DesignSystemComponentsAdvanced from "./DesignSystemComponentsAdvanced";
import DesignSystemThemes from "./DesignSystemThemes";
import DesignSystemOverlays from "./DesignSystemOverlays";
import DesignSystemFormsExtra from "./DesignSystemFormsExtra";
import DesignSystemFeedback from "./DesignSystemFeedback";
import DesignSystemLayoutNav from "./DesignSystemLayoutNav";
import DesignSystemData from "./DesignSystemData";
import DesignSystemChat from "./DesignSystemChat";
import DesignSystemBlocks from "./DesignSystemBlocks";
import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Accordion } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog } from "@/components/ui/dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Popover } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { HoverCard } from "@/components/ui/hover-card";
import { ContextMenu } from "@/components/ui/context-menu";
import { Menubar } from "@/components/ui/menubar";
import { Sheet } from "@/components/ui/sheet";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { NativeSelect } from "@/components/ui/native-select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Command } from "@/components/ui/command";
import { Combobox } from "@/components/ui/combobox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { InputGroup } from "@/components/ui/input-group";
import { Field } from "@/components/ui/field";
import { Item } from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { Calendar } from "@/components/ui/calendar";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { Collapsible } from "@/components/ui/collapsible";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NavigationMenu } from "@/components/ui/navigation-menu";
import { Pagination } from "@/components/ui/pagination";
import { ResizablePanelGroup } from "@/components/ui/resizable";
import { Sidebar } from "@/components/ui/sidebar";
import { Table } from "@/components/ui/table";
import { ChartContainer } from "@/components/ui/chart";
import { Carousel } from "@/components/ui/carousel";
import { Bubble } from "@/components/ui/bubble";
import { Message } from "@/components/ui/message";
import { MessageScroller } from "@/components/ui/message-scroller";
import { Attachment } from "@/components/ui/attachment";
import { Questionnaire } from "@/components/ui/questionnaire";
import { Marker } from "@/components/ui/marker";

const Index = () => (
    <CanvasProviders>
      <DesignSystemIndex />
    </CanvasProviders>
  );

const Color = () => (
    <CanvasProviders>
      <DesignSystemColor />
    </CanvasProviders>
  );

const Typography = () => (
    <CanvasProviders>
      <DesignSystemTypography />
    </CanvasProviders>
  );

const Foundations = () => (
    <CanvasProviders>
      <DesignSystemFoundations />
    </CanvasProviders>
  );

const Motion = () => (
    <CanvasProviders>
      <DesignSystemMotion />
    </CanvasProviders>
  );

const Components = () => (
    <CanvasProviders>
      <DesignSystemComponents />
    </CanvasProviders>
  );

const Patterns = () => (
    <CanvasProviders>
      <DesignSystemPatterns />
    </CanvasProviders>
  );

const Voice = () => (
    <CanvasProviders>
      <DesignSystemVoice />
    </CanvasProviders>
  );

const Accessibility = () => (
    <CanvasProviders>
      <DesignSystemAccessibility />
    </CanvasProviders>
  );

const BrandStory = () => (
    <CanvasProviders>
      <DesignSystemBrandStory />
    </CanvasProviders>
  );

const Email = () => (
    <CanvasProviders>
      <DesignSystemEmail />
    </CanvasProviders>
  );

const Photography = () => (
    <CanvasProviders>
      <DesignSystemPhotography />
    </CanvasProviders>
  );

const Personas = () => (
    <CanvasProviders>
      <DesignSystemPersonas />
    </CanvasProviders>
  );

const Sound = () => (
    <CanvasProviders>
      <DesignSystemSound />
    </CanvasProviders>
  );

const DataViz = () => (
    <CanvasProviders>
      <DesignSystemDataViz />
    </CanvasProviders>
  );

const ComponentsAdvanced = () => (
    <CanvasProviders>
      <DesignSystemComponentsAdvanced />
    </CanvasProviders>
  );

const Themes = () => (
    <CanvasProviders>
      <DesignSystemThemes />
    </CanvasProviders>
  );

const Overlays = () => (
    <CanvasProviders>
      <DesignSystemOverlays />
    </CanvasProviders>
  );

const FormsExtra = () => (
    <CanvasProviders>
      <DesignSystemFormsExtra />
    </CanvasProviders>
  );

const Feedback = () => (
    <CanvasProviders>
      <DesignSystemFeedback />
    </CanvasProviders>
  );

const LayoutNav = () => (
    <CanvasProviders>
      <DesignSystemLayoutNav />
    </CanvasProviders>
  );

const Data = () => (
    <CanvasProviders>
      <DesignSystemData />
    </CanvasProviders>
  );

const Chat = () => (
    <CanvasProviders>
      <DesignSystemChat />
    </CanvasProviders>
  );

const Blocks = () => (
    <CanvasProviders>
      <DesignSystemBlocks />
    </CanvasProviders>
  );

export default function DesignSystemCanvas() {
  return (
    <Canvas name="Design System">
      <Storyboard
        id="Index"
        name="Index · Cover"
        component={Index}
        layout={{ x: -1391, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Color"
        name="Color"
        component={Color}
        layout={{ x: -51, y: 0, width: 1280, height: 6521 }}
      />
      <Storyboard
        id="Typography"
        name="Typography"
        component={Typography}
        layout={{ x: 1279, y: 0, width: 1280, height: 7919 }}
      />
      <Storyboard
        id="Foundations"
        name="Foundations"
        component={Foundations}
        layout={{ x: 2706, y: 0, width: 1280, height: 5500 }}
      />
      <Storyboard
        id="Motion"
        name="Motion"
        component={Motion}
        layout={{ x: 4036, y: 0, width: 1280, height: 5200 }}
      />
      <Storyboard
        id="Components"
        name="Components"
        component={Components}
        layout={{ x: 5366, y: 0, width: 1280, height: 7200 }}
      />
      <Storyboard
        id="Patterns"
        name="Patterns"
        component={Patterns}
        layout={{ x: 6696, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Voice"
        name={"Voice & Tone"}
        component={Voice}
        layout={{ x: 8026, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Accessibility"
        name="Accessibility"
        component={Accessibility}
        layout={{ x: 9356, y: 0, width: 1280, height: 5500 }}
      />
      <Storyboard
        id="BrandStory"
        name="Brand Story"
        component={BrandStory}
        layout={{ x: 10686, y: 0, width: 1280, height: 6800 }}
      />
      <Storyboard
        id="Email"
        name="Email Design"
        component={Email}
        layout={{ x: 12016, y: 0, width: 1280, height: 7800 }}
      />
      <Storyboard
        id="Photography"
        name="Photography"
        component={Photography}
        layout={{ x: 13346, y: 0, width: 1280, height: 5800 }}
      />
      <Storyboard
        id="Personas"
        name="Customer Personas"
        component={Personas}
        layout={{ x: 14676, y: 0, width: 1280, height: 4800 }}
      />
      <Storyboard
        id="Sound"
        name="Sound Identity"
        component={Sound}
        layout={{ x: 16006, y: 0, width: 1280, height: 5400 }}
      />
      <Storyboard
        id="DataViz"
        name="Data Visualization"
        component={DataViz}
        layout={{ x: 17336, y: 0, width: 1280, height: 6800 }}
      />
      <Storyboard
        id="ComponentsAdvanced"
        name="Components · Advanced"
        component={ComponentsAdvanced}
        layout={{ x: 18666, y: 0, width: 1280, height: 7200 }}
      />
      <Storyboard
        id="Themes"
        name="Themes · Light & Dark"
        component={Themes}
        layout={{ x: 19996, y: 0, width: 1280, height: 1300 }}
      />
      <Storyboard
        id="Overlays"
        name="Overlays & Menus"
        component={Overlays}
        layout={{ x: 21326, y: 0, width: 1280, height: 4600 }}
      />
      <Storyboard
        id="FormsExtra"
        name="Forms · Extended"
        component={FormsExtra}
        layout={{ x: 22656, y: 0, width: 1280, height: 5600 }}
      />
      <Storyboard
        id="Feedback"
        name="Feedback & Loading"
        component={Feedback}
        layout={{ x: 23986, y: 0, width: 1280, height: 4200 }}
      />
      <Storyboard
        id="LayoutNav"
        name="Layout & Navigation"
        component={LayoutNav}
        layout={{ x: 25316, y: 0, width: 1280, height: 4400 }}
      />
      <Storyboard
        id="Data"
        name="Data Display"
        component={Data}
        layout={{ x: 26646, y: 0, width: 1280, height: 4400 }}
      />
      <Storyboard
        id="Chat"
        name="Conversational"
        component={Chat}
        layout={{ x: 27976, y: 0, width: 1280, height: 3600 }}
      />
      <Storyboard
        id="Blocks"
        name="Blocks"
        component={Blocks}
        layout={{ x: 29306, y: 0, width: 1280, height: 5600 }}
      />
    </Canvas>
  );
}

defineAsset(Button, {
  libraries: ["shadcn"],
  usageInstructions:
    "Primary action button — variants default/destructive/outline/secondary/ghost/link, sizes sm/default/lg/icon. Use for form submits and CTAs, not navigation.",
  variants: {
    Default: { props: { children: "Continue" } },
    Destructive: { props: { children: "Delete account", variant: "destructive" } },
    Outline: { props: { children: "Cancel", variant: "outline" } },
  },
});

defineAsset(Badge, {
  libraries: ["shadcn"],
  usageInstructions:
    "Compact status/label pill — variants default/secondary/destructive/outline. Use for statuses and counts, not as a clickable button.",
  variants: {
    Default: { props: { children: "New" } },
    Secondary: { props: { children: "Draft", variant: "secondary" } },
  },
});

defineAsset(Card, {
  libraries: ["shadcn"],
  usageInstructions:
    "Bordered content container with optional header/content/footer sub-parts. Use to group related content, not for one-off padding.",
});

defineAsset(Input, {
  libraries: ["shadcn"],
  usageInstructions: "Single-line text field. Pair with Label for accessible forms.",
});

defineAsset(Textarea, {
  libraries: ["shadcn"],
  usageInstructions: "Multi-line text field for longer free-text input.",
});

defineAsset(Label, {
  libraries: ["shadcn"],
  usageInstructions: "Form field label, associated to an input via htmlFor.",
});

defineAsset(Separator, {
  libraries: ["shadcn"],
  usageInstructions: "Thin dividing line between sections, horizontal or vertical.",
});

defineAsset(Avatar, {
  libraries: ["shadcn"],
  usageInstructions: "User/entity image with fallback initials via AvatarFallback.",
});

defineAsset(Checkbox, {
  libraries: ["shadcn"],
  usageInstructions: "Boolean toggle for forms and lists — not for single on/off settings (use Switch).",
});

defineAsset(Alert, {
  libraries: ["shadcn"],
  usageInstructions:
    "Inline banner for important contextual info, paired with AlertTitle/AlertDescription. Not for transient feedback (use a toast).",
});

defineAsset(Progress, {
  libraries: ["shadcn"],
  usageInstructions: "Determinate progress bar — pass a value 0-100.",
});

defineAsset(Tabs, {
  libraries: ["shadcn"],
  usageInstructions:
    "Tabbed content switcher composed with TabsList/TabsTrigger/TabsContent. Use for switching between views in place, not for navigation between pages.",
});

defineAsset(Breadcrumb, {
  libraries: ["shadcn"],
  usageInstructions:
    "Hierarchical page-location trail — composed with BreadcrumbList/BreadcrumbItem/BreadcrumbLink/BreadcrumbPage/BreadcrumbSeparator, not a flat items array.",
  variants: {
    Default: {
      props: {
        children: (
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbPage>Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        ),
      },
    },
  },
});

defineAsset(Accordion, {
  libraries: ["shadcn"],
  usageInstructions:
    "Collapsible disclosure list composed with AccordionItem/AccordionTrigger/AccordionContent — real Radix Accordion primitive. Use for FAQ-shaped or progressive-disclosure content, not for page-level navigation (use Tabs).",
  variants: {
    Default: {
      props: {
        type: "single",
        collapsible: true,
      },
    },
  },
});

defineAsset(ButtonGroup, {
  libraries: ["shadcn"],
  usageInstructions:
    "Adjacent buttons sharing one border with joined corners — for a tightly-related set of actions (e.g. a round-type picker). Not a generic flex row of unrelated buttons; use plain flex + gap for those.",
});

defineAsset(Switch, {
  libraries: ["shadcn"],
  usageInstructions:
    "Single boolean on/off setting (visual-only port, copper when on) — for a standalone preference toggle. Use Checkbox instead inside forms/lists with multiple selectable items.",
});

/* ─── Overlays & menus (real Radix primitives, src/components/ui) ─── */
defineAsset(Dialog, {
  libraries: ["shadcn"],
  usageInstructions:
    "Centered modal (Radix Dialog) for a focused task with one primary action — compose with DialogTrigger/DialogContent/DialogHeader/DialogFooter. Use AlertDialog instead when the user must make an explicit confirm/cancel choice before anything else can happen.",
});

defineAsset(AlertDialog, {
  libraries: ["shadcn"],
  usageInstructions:
    "Blocking confirmation dialog (Radix AlertDialog) — for destructive or irreversible actions (delete session, cancel subscription) that require an explicit choice. Not for general content or forms — use Dialog for those.",
});

defineAsset(Popover, {
  libraries: ["shadcn"],
  usageInstructions:
    "Click-to-open floating panel anchored to a trigger — for filters, small inline forms, or supplementary controls. Not for a hover-only hint (use Tooltip) or a rich preview-on-hover card (use HoverCard).",
});

defineAsset(Tooltip, {
  libraries: ["shadcn"],
  usageInstructions:
    "Hover/focus-triggered one-line hint. Keep it to a short label — for richer hover content (a user's stats, a preview) use HoverCard instead, and never put interactive controls inside a Tooltip.",
});

defineAsset(DropdownMenu, {
  libraries: ["shadcn"],
  usageInstructions:
    "Click-triggered action/option menu (Radix DropdownMenu) — for a list of commands or a settings menu off a trigger button. Use ContextMenu instead for a right-click surface, and Select for choosing a single form value.",
});

defineAsset(HoverCard, {
  libraries: ["shadcn"],
  usageInstructions:
    "Hover-triggered rich preview card (e.g. a user's mini-profile on hover) — more content than a Tooltip should carry, but not something the user needs to click to open (use Popover for that).",
});

defineAsset(ContextMenu, {
  libraries: ["shadcn"],
  usageInstructions:
    "Right-click contextual menu — for actions scoped to a specific element (a transcript line, a question card). Use DropdownMenu for a normal click-triggered menu off a visible button.",
});

defineAsset(Menubar, {
  libraries: ["shadcn"],
  usageInstructions:
    "Horizontal application menu bar (File/Edit-style) for dense authenticated tooling. Not for the primary marketing site nav — use NavigationMenu for that.",
});

defineAsset(Sheet, {
  libraries: ["shadcn"],
  usageInstructions:
    "Dialog composed as a side-sliding panel (desktop settings/detail panels that shouldn't fully block the page like a centered Dialog). On small screens where a bottom-sheet feel fits better, use Drawer instead.",
});

defineAsset(Drawer, {
  libraries: ["shadcn"],
  usageInstructions:
    "Mobile-style bottom sheet (vaul-based, with background scale-down). Use for mobile quick-actions and compact pickers; use Sheet for desktop side panels and Dialog for centered focused tasks.",
});

/* ─── Forms, extended (real Radix/base-ui primitives, src/components/ui) ─── */
defineAsset(Select, {
  libraries: ["shadcn"],
  usageInstructions:
    "Portal-rendered listbox for choosing one value in a form (Radix Select) — the default choice for a dropdown field. Use NativeSelect only in portal-hostile contexts (print views, iframes), and Combobox when the list needs search/filter.",
});

defineAsset(NativeSelect, {
  libraries: ["shadcn"],
  usageInstructions:
    "Plain browser <select>, styled to match — for contexts where a portal-rendered listbox breaks (iframes, print views) or true native mobile picker behavior is wanted. Prefer Select for ordinary forms.",
});

defineAsset(RadioGroup, {
  libraries: ["shadcn"],
  usageInstructions:
    "Real interactive single-select control (Radix RadioGroup) — compose with RadioGroupItem for each option. The one to reach for in any form; there is no separate visual-only radio atom in this library.",
  variants: {
    Default: {
      props: {
        defaultValue: "a",
        children: <RadioGroupItem value="a" />,
      },
    },
  },
});

defineAsset(Toggle, {
  libraries: ["shadcn"],
  usageInstructions:
    "Single pressed/unpressed button (Radix Toggle) — for one standalone on/off action (e.g. mute mic). For a set of mutually-exclusive or multi-select options, use ToggleGroup.",
});

defineAsset(ToggleGroup, {
  libraries: ["shadcn"],
  usageInstructions:
    "Segmented set of toggle buttons, single- or multi-select — for compact inline filters or formatting controls. Use RadioGroup instead when the choice belongs in a labeled form field.",
  variants: {
    Default: { props: { type: "single" } },
  },
});

defineAsset(Slider, {
  libraries: ["shadcn"],
  usageInstructions:
    "Continuous numeric value picker (Radix Slider) — e.g. target answer length. Not for a small fixed set of discrete choices (use ToggleGroup or RadioGroup).",
});

defineAsset(Command, {
  libraries: ["shadcn"],
  usageInstructions:
    "Searchable command/option list primitive (cmdk) — the palette underneath Combobox. Use directly for a command-palette-style surface (⌘K); use Combobox when you need it as a single-select form field.",
  variants: {
    Default: { props: { children: null } },
  },
});

defineAsset(Combobox, {
  libraries: ["shadcn"],
  usageInstructions:
    "Searchable single-select field (base-ui Combobox) — for a long option list where typing to filter beats scrolling (e.g. target company). Compose with ComboboxInput/ComboboxContent/ComboboxList/ComboboxItem. Use plain Select when the list is short and doesn't need search.",
  variants: {
    Default: { props: { items: ["google", "amazon"] } },
  },
});

defineAsset(InputOTP, {
  libraries: ["shadcn"],
  usageInstructions: "Fixed-length one-time-code input (email/phone verification) — compose with InputOTPGroup/InputOTPSlot.",
  variants: {
    Default: {
      props: {
        maxLength: 6,
        children: (
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
        ),
      },
    },
  },
});

defineAsset(InputGroup, {
  libraries: ["shadcn"],
  usageInstructions:
    "Input with a leading/trailing adornment (currency symbol, icon) — compose with InputGroupText/InputGroupInput. Use plain Input when there's no adornment.",
  variants: {
    Default: { props: { children: null } },
  },
});

defineAsset(Field, {
  libraries: ["shadcn"],
  usageInstructions:
    "Label + control + description/error composition for one form row — compose with FieldLabel/FieldDescription/FieldError around any input control.",
});

defineAsset(Item, {
  libraries: ["shadcn"],
  usageInstructions:
    "Generic icon + title/description + trailing-action list row — for a question-bank entry or settings row. Use Card instead for a larger standalone content block.",
});

defineAsset(Kbd, {
  libraries: ["shadcn"],
  usageInstructions: "Small keyboard-shortcut chip (e.g. ⌘K) — inline next to the action it triggers, never as a clickable element itself.",
});

defineAsset(Calendar, {
  libraries: ["shadcn"],
  usageInstructions:
    "Full month-grid date picker (react-day-picker) — for an inline always-visible calendar. There is no separate DatePicker primitive in this library; a compact date field is a composition of Popover + Button + Calendar (see DesignSystemFormsExtra.tsx for the pattern).",
});

/* ─── Feedback & loading (real Radix/sonner primitives, src/components/ui) ─── */
defineAsset(Toaster, {
  libraries: ["shadcn"],
  usageInstructions:
    "Transient feedback toasts, built on sonner — mount <Toaster /> once near the app root, then call `toast()`/`toast.success()`/`toast.error()` from anywhere. Not for anything the user must explicitly acknowledge (use AlertDialog for that).",
});

defineAsset(Skeleton, {
  libraries: ["shadcn"],
  usageInstructions: "Layout-shaped loading placeholder — use when the eventual content's shape is known. Use Spinner for an indeterminate inline wait instead.",
});

defineAsset(Spinner, {
  libraries: ["shadcn"],
  usageInstructions: "Small inline indeterminate loading indicator (e.g. inside a submitting button). Use Skeleton for layout-shaped page/section loading.",
});

defineAsset(Empty, {
  libraries: ["shadcn"],
  usageInstructions:
    "No-data state block (icon + title + description + optional action) — for 'no interviews yet' style surfaces. Compose with EmptyHeader/EmptyMedia/EmptyTitle/EmptyDescription/EmptyContent.",
});

defineAsset(Collapsible, {
  libraries: ["shadcn"],
  usageInstructions:
    "Single expand/collapse section (Radix Collapsible) — for one optional block of content. Use Accordion instead for a list of several collapsible items.",
});

defineAsset(AspectRatio, {
  libraries: ["shadcn"],
  usageInstructions: "Locks a media box to a fixed width/height ratio (e.g. 16/9) — for logo tiles, video thumbnails, and other fixed-ratio media slots.",
});

defineAsset(ScrollArea, {
  libraries: ["shadcn"],
  usageInstructions: "Styled scrollbar over a fixed-height/width region (Radix ScrollArea) — the real scroll container for e.g. the interview transcript panel.",
});

/* ─── Layout & navigation (real Radix/react-resizable-panels primitives, src/components/ui) ─── */
defineAsset(NavigationMenu, {
  libraries: ["shadcn"],
  usageInstructions:
    "Marketing-site header nav with dropdown mega-menus (Radix NavigationMenu). Not for the authenticated dashboard's primary nav — use Sidebar for that.",
});

defineAsset(Pagination, {
  libraries: ["shadcn"],
  usageInstructions: "Page-by-page navigation control — for long lists like session history or a question bank. Compose with PaginationContent/PaginationItem/PaginationLink.",
});

defineAsset(ResizablePanelGroup, {
  libraries: ["shadcn"],
  usageInstructions:
    "Drag-to-resize split layout (react-resizable-panels) — e.g. the interview screen's video/transcript split. Compose with ResizablePanel/ResizableHandle.",
});

defineAsset(Sidebar, {
  libraries: ["shadcn"],
  usageInstructions:
    "Authenticated app-shell navigation rail — icon+label rows, grouped sections, active-state highlighting. Must be rendered inside a SidebarProvider ancestor (it reads collapse/mobile state via context) — wire that up in src/DashboardLayout.tsx if adopted there.",
});

/* Direction (RTL) context is intentionally NOT declared as a design-system
   asset — see the doc comment at the top of src/components/ui/direction.tsx.
   It's pure context plumbing with no visual output, and HireStepX ships
   English/Hindi-Latin only today. */

/* ─── Data display (real Table + recharts, src/components/ui) ─── */
defineAsset(Table, {
  libraries: ["shadcn"],
  usageInstructions: "Plain semantic table (Table/TableHeader/TableBody/TableRow/TableHead/TableCell) — the base every richer tabular view composes.",
});

/* No real "DataTable" primitive exists in src/components/ui — a sortable
   table is a composition of Table + local sort state (see
   SortableSessionsTable in DesignSystemData.tsx), not a new component to
   declare here. Reach for @tanstack/react-table directly if a true
   virtualized/filterable data grid is ever needed. */

defineAsset(ChartContainer, {
  libraries: ["shadcn"],
  usageInstructions:
    "Recharts wrapper mapping a token-driven color config onto --color-* CSS vars (the shadcn Chart pattern) — wrap raw recharts LineChart/BarChart/etc. children and reference colors as var(--color-<configKey>). Always source colors from --chart-1..5, never invent new hues for data-viz.",
  variants: {
    Default: {
      props: {
        config: { score: { label: "Score", color: "var(--chart-2)" } },
        children: <div />,
      },
    },
  },
});

defineAsset(Carousel, {
  libraries: ["shadcn"],
  usageInstructions:
    "Embla-based horizontal carousel — for a company-logo or testimonial strip on marketing pages. Compose with CarouselContent wrapping CarouselItem children, plus CarouselPrevious/CarouselNext. Not for step-by-step flows (use a wizard/stepper pattern instead).",
});

/* ─── Conversational / AI-chat (real Radix + @shadcn/react primitives, src/components/ui) ─── */
defineAsset(Bubble, {
  libraries: ["shadcn"],
  usageInstructions:
    "The speech-bubble surface inside a Message — variants default/secondary/muted/tinted/outline/ghost/destructive. Assistant turns use `default`, user turns use `tinted`. Compose with BubbleContent.",
  variants: {
    Default: {
      props: { children: <span>Tell me about a time you managed a conflict.</span> },
    },
  },
});

defineAsset(Message, {
  libraries: ["shadcn"],
  usageInstructions:
    "Align-aware chat turn wrapper (`align=\"start\"` for assistant, `align=\"end\"` for user) — wraps MessageContent > Bubble > BubbleContent, inside a MessageScroller.",
  variants: {
    Start: { props: { align: "start", children: null } },
    End: { props: { align: "end", children: null } },
  },
});

defineAsset(MessageScroller, {
  libraries: ["shadcn"],
  usageInstructions:
    "Auto-stick-to-bottom transcript container — the shell for the Interview screen's live conversation. Must be rendered inside a MessageScrollerProvider, and compose MessageScrollerViewport > MessageScrollerContent > MessageScrollerItem for each turn.",
});

defineAsset(Attachment, {
  libraries: ["shadcn"],
  usageInstructions:
    "Inline file chip shown in a conversational turn (e.g. an uploaded resume, a coached-answer export) — compose with AttachmentMedia/AttachmentContent/AttachmentTitle/AttachmentDescription/AttachmentActions. Pairs with AttachmentTrigger for the composer's attach button.",
  variants: {
    Default: {
      props: {
        children: <span>Resume.pdf</span>,
      },
    },
  },
});

defineAsset(Questionnaire, {
  libraries: ["shadcn"],
  usageInstructions:
    "A structured single-question, multiple-choice block rendered inline in a conversation (e.g. 'which round would you like to practice?') — compose with QuestionnaireItem (requires a `name`)/QuestionnaireTitle/QuestionnaireChoices/QuestionnaireChoice/QuestionnaireActions. Navigation state is `defaultItem`/`item`, not `value`/`defaultValue`. For a real multi-field form, use Field/Input instead.",
  variants: {
    Default: { props: { defaultItem: "round", children: null } },
  },
});

defineAsset(Marker, {
  libraries: ["shadcn"],
  usageInstructions:
    "Inline highlight/annotation mark for flagging a moment in text (e.g. coaching notes on a transcript — 'filler word', 'strong STAR structure') — compose with MarkerContent, or use `asChild` to apply the marker to a styled span. Not a status indicator for a whole item — use Badge for that.",
  variants: {
    Default: { props: { children: <span>Strong close</span> } },
  },
});
