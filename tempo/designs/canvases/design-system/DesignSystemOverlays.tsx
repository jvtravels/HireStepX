/* HireStepX — Design System / Overlays & Menus
   Real Radix-backed overlay primitives: Dialog, Alert Dialog, Popover,
   Tooltip, Dropdown Menu, Hover Card, Context Menu, Menubar, Sheet,
   Drawer. These are interactive — click through them, they actually
   open/close. Copper marks the one primary action per surface. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator } from "@/components/ui/menubar";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import {
  Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";

export default function DesignSystemOverlays() {
  return (
    <PageShell>
      <PageHeader
        title="Overlays & menus."
        description="Dialog, Alert Dialog, Popover, Tooltip, Dropdown Menu, Hover Card, Context Menu, Menubar, Sheet, Drawer — real Radix primitives, live and interactive."
      />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 56 }}>
          <SectionHead num="01" title="Dialog & Alert Dialog" desc="Centered modal for a task; alert dialog forces an explicit choice." />
          <div style={{ display: "flex", gap: 12 }}>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>End interview early?</DialogTitle>
                  <DialogDescription>You've answered 3 of 5 questions. We'll score what you've completed.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Keep going</Button>
                  </DialogClose>
                  <Button>End and score</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete session</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                  <AlertDialogDescription>Your transcript and score will be removed. This can't be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <SectionHead num="02" title="Popover, Tooltip, Hover Card" desc="Three levels of ambient detail: click-to-open, hover-hint, hover-preview." />
          <TooltipProvider>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Filter</Button>
                </PopoverTrigger>
                <PopoverContent>
                  <p className="text-sm font-medium mb-1">Filter by round</p>
                  <p className="text-sm text-muted-foreground">Behavioral, technical, salary negotiation.</p>
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>Readiness score updates after each session</TooltipContent>
              </Tooltip>

              <HoverCard>
                <HoverCardTrigger asChild>
                  <Button variant="link">@riddhi</Button>
                </HoverCardTrigger>
                <HoverCardContent>
                  <p className="text-sm font-medium">Riddhi Keralia</p>
                  <p className="text-sm text-muted-foreground mt-1">12 sessions · 7-day streak · Pro plan</p>
                </HoverCardContent>
              </HoverCard>
            </div>
          </TooltipProvider>
        </section>

        <section style={{ marginBottom: 56 }}>
          <SectionHead num="03" title="Dropdown Menu & Context Menu" desc="Click to open; right-click for context actions." />
          <div style={{ display: "flex", gap: 12 }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Session</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View report</DropdownMenuItem>
                <DropdownMenuItem>Share link</DropdownMenuItem>
                <DropdownMenuCheckboxItem checked>Pin to dashboard</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ContextMenu>
              <ContextMenuTrigger className="flex h-9 w-48 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                Right-click here
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel>Question</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem>Flag as unclear</ContextMenuItem>
                <ContextMenuItem>Skip</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </section>

        <section style={{ marginBottom: 56 }}>
          <SectionHead num="04" title="Menubar" desc="Horizontal menu bar — for dense authenticated tooling, not the primary marketing nav." />
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>Session</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>New interview</MenubarItem>
                <MenubarItem>Resume draft</MenubarItem>
                <MenubarSeparator />
                <MenubarItem>Export report</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger>View</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>Transcript</MenubarItem>
                <MenubarItem>Score breakdown</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </section>

        <section style={{ marginBottom: 56 }}>
          <SectionHead num="05" title="Sheet & Drawer" desc="Sheet slides from a screen edge (desktop settings panels); Drawer is the mobile-style bottom sheet." />
          <div style={{ display: "flex", gap: 12 }}>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Interview settings</SheetTitle>
                  <SheetDescription>Adjust difficulty and round length before you start.</SheetDescription>
                </SheetHeader>
                <SheetFooter>
                  <SheetClose asChild>
                    <Button variant="outline">Close</Button>
                  </SheetClose>
                  <Button>Save</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">Open drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Quick actions</DrawerTitle>
                  <DrawerDescription>Mobile-style bottom sheet, built on vaul.</DrawerDescription>
                </DrawerHeader>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">Close</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          </div>
        </section>
      </div>
      <Footer section="Overlays & Menus" tagline="Real Radix primitives — click through them." />
    </PageShell>
  );
}
