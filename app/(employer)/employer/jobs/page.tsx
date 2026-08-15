"use client";

import Link from "next/link";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Eyebrow, PrimaryCta, StatusChip, EmployerIcon } from "@/employer/_atoms";

/* /employer/jobs — the requirements console. Owns the full list that used
   to live on the root dashboard; the dashboard now only links here. */
export default function EmployerJobsPage() {
  const { requirements, requirementsLoading } = useEmployerData();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
        <section>
          <Eyebrow tone="ink">Employer console</Eyebrow>
          <h1 style={{ fontFamily: f.serif, fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: "8px 0 6px" }}>
            Jobs
          </h1>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, maxWidth: 480 }}>
            Every requirement you've posted, and its match status.
          </p>
        </section>
        <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
          <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
        </Link>
      </div>

      {requirementsLoading ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
        </Card>
      ) : requirements.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
            You haven't posted a requirement yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {requirements.map((req) => (
            <Link key={req.id} href={`/employer/requirements/${req.id}`} style={{ textDecoration: "none" }}>
              <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal }}>{req.title}</div>
                  <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 4 }}>
                    {req.location} · Posted {req.createdAt}
                  </div>
                </div>
                <StatusChip status={req.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
