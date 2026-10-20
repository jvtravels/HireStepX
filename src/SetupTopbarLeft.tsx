"use client";
import Image from "next/image";
import Link from "next/link";

const LOGO_STYLE = { justifySelf: "start", textDecoration: "none", display: "inline-flex", flexShrink: 0 } as const;
const LOGO_IMG_STYLE = { height: 32, width: "auto" } as const;

export default function SetupTopbarLeft() {
  return (
    <Link href="/dashboard" aria-label="HireStepX, go to dashboard" style={LOGO_STYLE}>
      <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} priority style={LOGO_IMG_STYLE} />
    </Link>
  );
}
