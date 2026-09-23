/* HireStepX — Design System / Layout & Navigation
   Navigation Menu, Pagination, Resizable, Sidebar. The chrome that holds
   a whole screen together, distinct from the Breadcrumb/Tabs already in
   Components · Advanced. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import {
  NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, BarChart3, Settings, User } from "lucide-react";

export default function DesignSystemLayoutNav() {
  return (
    <PageShell>
      <PageHeader
        title="Layout & navigation."
        description="Navigation Menu, Pagination, Resizable, Sidebar — the structural chrome a whole screen hangs off of."
      />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="Navigation Menu" desc="Marketing-site header nav with a dropdown mega-menu — not the authenticated app's primary nav (that's Sidebar)." />
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Product</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid gap-1">
                    <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-muted">Mock interviews</NavigationMenuLink>
                    <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-muted">Salary negotiation</NavigationMenuLink>
                    <NavigationMenuLink className="block rounded-md p-2 text-sm hover:bg-muted">Readiness score</NavigationMenuLink>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">Pricing</NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="02" title="Pagination" desc="Page-by-page navigation for question banks / session history lists." />
          <Pagination>
            <PaginationContent>
              <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
              <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
              <PaginationItem><PaginationLink href="#">3</PaginationLink></PaginationItem>
              <PaginationItem><PaginationEllipsis /></PaginationItem>
              <PaginationItem><PaginationNext href="#" /></PaginationItem>
            </PaginationContent>
          </Pagination>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="03" title="Resizable" desc="Drag-to-resize split panels — e.g. the interview screen's transcript / video split." />
          <ResizablePanelGroup orientation="horizontal" className="h-40 rounded-lg border border-border">
            <ResizablePanel defaultSize={50} className="flex items-center justify-center text-sm text-muted-foreground">Video</ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} className="flex items-center justify-center text-sm text-muted-foreground">Transcript</ResizablePanel>
          </ResizablePanelGroup>
        </section>

        <section>
          <SectionHead num="04" title="Sidebar" desc="Authenticated app-shell nav — icon + label rows, grouped sections, active-state highlighting." />
          <div className="h-96 w-64 overflow-hidden rounded-lg border border-border">
            <SidebarProvider className="h-full w-full min-h-0">
              <Sidebar className="h-full w-full border-none" collapsible="none">
                <SidebarHeader><span className="text-sm font-semibold">HireStepX</span></SidebarHeader>
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupLabel>Practice</SidebarGroupLabel>
                    <SidebarMenu>
                      <SidebarMenuItem><SidebarMenuButton isActive><LayoutDashboard />Dashboard</SidebarMenuButton></SidebarMenuItem>
                      <SidebarMenuItem><SidebarMenuButton><Calendar />Calendar</SidebarMenuButton></SidebarMenuItem>
                      <SidebarMenuItem><SidebarMenuButton><BarChart3 />Analytics</SidebarMenuButton></SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                  <SidebarMenuButton><User />Riddhi Keralia</SidebarMenuButton>
                  <SidebarMenuButton><Settings />Settings</SidebarMenuButton>
                </SidebarFooter>
              </Sidebar>
            </SidebarProvider>
          </div>
        </section>
      </div>
      <Footer section="Layout & Navigation" tagline="Drag the resizable handle." />
    </PageShell>
  );
}
