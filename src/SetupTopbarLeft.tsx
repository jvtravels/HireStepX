"use client";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { fonts as F, tokens as T } from "./auth/_tokens";

const WRAP_STYLE = { justifySelf: "start", display: "flex", alignItems: "center", gap: 20, minWidth: 0 } as const;
const LOGO_STYLE = { textDecoration: "none", display: "inline-flex", flexShrink: 0 } as const;
const LOGO_IMG_STYLE = { height: 32, width: "auto" } as const;
const LIST_STYLE = { fontFamily: F.sans, fontSize: 13, flexWrap: "nowrap" } as const;
const LINK_STYLE = { color: T.inkSoft, display: "inline-flex", alignItems: "center" } as const;
const PAGE_STYLE = { fontSize: 13, fontWeight: 600, color: T.coal } as const;

export default function SetupTopbarLeft() {
  return (
    <div style={WRAP_STYLE}>
      <Link href="/dashboard" aria-label="HireStepX, go to dashboard" style={LOGO_STYLE}>
        <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} priority style={LOGO_IMG_STYLE} />
      </Link>
      <Breadcrumb className="max-[560px]:hidden">
        <BreadcrumbList className="whitespace-nowrap" style={LIST_STYLE}>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard" style={LINK_STYLE}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage style={PAGE_STYLE}>New session</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
