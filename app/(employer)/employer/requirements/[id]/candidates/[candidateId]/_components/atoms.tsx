import React from "react";
import Link from "next/link";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { Card } from "@/employer/_atoms";

/* Presentational atoms private to the candidate detail page. */

export function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: t.neutralInk, margin: "0 0 12px" }}>
      {children}
    </h2>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: f.sans, fontSize: 13, color: t.neutralInk, lineHeight: 1.6, margin: 0 }}>{children}</p>;
}

const iconProps = { "aria-hidden": true, focusable: false } as const;

export const PhoneIcon = () => (
  <svg {...iconProps} width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.8 21 3 13.2 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1.1L6.6 10.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const MailIcon = () => (
  <svg {...iconProps} width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3.5 6.5L12 13l8.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LinkIcon = () => (
  <svg {...iconProps} width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M10 14a4 4 0 005.7.3l2.6-2.6a4 4 0 00-5.6-5.6L11 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10a4 4 0 00-5.7-.3L5.7 12.3a4 4 0 005.6 5.6L13 16.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ContactBox({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 10,
        border: `1px solid ${t.line}`,
        fontFamily: f.sans,
        fontSize: 13,
        color: t.coal,
        flex: "1 1 180px",
        minWidth: 0,
        overflowWrap: "anywhere",
      }}
    >
      <span style={{ color: t.neutralInk, display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </div>
  );
}

export type KpiTone = "success" | "indigo" | "neutral";

export function KpiCard({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub?: string; tone?: KpiTone }) {
  const toneColor = tone === "success" ? t.successInk : tone === "indigo" ? t.indigoDeep : t.coal;
  return (
    <Card style={{ boxShadow: "none", minWidth: 0 }} pad={16}>
      <dl style={{ margin: 0 }}>
        <dt style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: t.neutralInk }}>{label}</dt>
        <dd style={{ fontFamily: f.sans, fontSize: 24, fontWeight: 700, color: toneColor, margin: "6px 0 0", overflowWrap: "anywhere" }}>{value}</dd>
        {sub && <dd style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk, margin: "4px 0 0" }}>{sub}</dd>}
      </dl>
    </Card>
  );
}

export function SnapshotCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, marginTop: 3, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

/** The percentage is always printed, so the bar is decorative. */
export function BarRow({ label, pct, tone = "neutral" }: { label: string; pct: number; tone?: KpiTone }) {
  const color = tone === "success" ? t.success : tone === "indigo" ? t.indigo : t.inkFaint;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: f.sans, fontSize: 12.5, color: t.coal, marginBottom: 4 }}>
        <span>{label}</span>
        <strong>{clamped}%</strong>
      </div>
      <div aria-hidden="true" style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}>
        <div style={{ width: `${clamped}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

/** Link styled as the shared primary button, for navigating to the shortlist
 *  where the unlock purchase actually happens. */
export function UnlockLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild size="lg" className="pointer-coarse:h-11 px-4" style={{ fontFamily: f.sans }}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
