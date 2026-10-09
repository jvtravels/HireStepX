/* Route-level loading fallbacks for the `dynamic(() => import(...), { loading })`
   wrapper each app/(app)/(dashboard)/*\/page.tsx uses around its heavy client
   component. Each skeleton here is shaped like its destination screen's real
   layout (cards, table rows, two-pane chat, month grid, …) rather than a
   generic placeholder, using the same `.skeleton` shimmer treatment as every
   other loading state in the app.

   Deliberately dependency-free (no imports from the screens themselves): the
   whole point of `dynamic()` on those pages is keeping the heavy component's
   module out of the route's critical-path bundle, so this file must not pull
   any of those modules back in via a shared import. */

export function DashboardRouteSkeleton() {
  return (
    <div style={{ padding: "24px 28px" }}>
      <div className="skeleton skeleton-heading" style={{ width: 220 }} />
      <div className="skeleton skeleton-text" style={{ width: 320, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 28, width: "40%", marginTop: 8, marginBottom: 8 }} />
            <div className="skeleton skeleton-text-sm" style={{ width: "60%" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 16 }}>
        <div className="skeleton-card" style={{ minHeight: 200 }}>
          <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          <div className="skeleton" style={{ height: 140, width: "100%", marginTop: 12 }} />
        </div>
        <div className="skeleton-card" style={{ minHeight: 200 }}>
          <div className="skeleton skeleton-text" style={{ width: "55%" }} />
          <div className="skeleton skeleton-text" style={{ width: "85%" }} />
          <div className="skeleton skeleton-text" style={{ width: "70%" }} />
        </div>
      </div>
      <div className="skeleton-card" style={{ minHeight: 160 }}>
        <div className="skeleton skeleton-text" style={{ width: "30%" }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div className="skeleton skeleton-circle" style={{ width: 28, height: 28, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 12, flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SessionsRouteSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <div className="skeleton skeleton-heading" style={{ width: 180, marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div className="skeleton" style={{ height: 36, width: 220 }} />
        <div className="skeleton" style={{ height: 36, width: 90 }} />
        <div className="skeleton" style={{ height: 36, width: 90 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skeleton skeleton-circle" style={{ width: 36, height: 36, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="skeleton" style={{ height: 12, width: "40%" }} />
              <div className="skeleton" style={{ height: 10, width: "25%" }} />
            </div>
            <div className="skeleton" style={{ height: 12, width: 60 }} />
            <div className="skeleton" style={{ height: 12, width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResumeRouteSkeleton() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", padding: "16px 20px" }}>
      <div style={{ flex: "1 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skeleton-card">
          <div className="skeleton skeleton-heading" style={{ width: 220 }} />
          <div className="skeleton skeleton-text" style={{ width: "90%" }} />
          <div className="skeleton skeleton-text" style={{ width: "70%" }} />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-text" style={{ width: 140 }} />
          <div className="skeleton skeleton-text" style={{ width: "80%" }} />
          <div className="skeleton skeleton-text" style={{ width: "60%" }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" style={{ flex: "1 1 160px", minWidth: 160 }}>
              <div className="skeleton skeleton-text-sm" style={{ width: 100 }} />
              <div className="skeleton" style={{ height: 28, width: 60, marginTop: 8 }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: "1 1 420px", maxWidth: 550, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skeleton-card">
          <div className="skeleton skeleton-text" style={{ width: 140 }} />
          <div className="skeleton skeleton-text" style={{ width: "80%" }} />
        </div>
        <div className="skeleton-card">
          <div className="skeleton skeleton-text" style={{ width: 160 }} />
          <div className="skeleton skeleton-text" style={{ width: "90%" }} />
        </div>
      </div>
    </div>
  );
}

export function JobDetailRouteSkeleton() {
  const panel = { background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: 24, minWidth: 0 } as const;
  return (
    <div role="status" aria-busy="true" style={{ width: "100%" }}>
      <span className="sr-only">Loading job details</span>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ ...panel, flex: "3 1 min(560px, 100%)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-heading" style={{ width: 260, maxWidth: "80%", marginBottom: 10 }} />
              <div className="skeleton skeleton-text-sm" style={{ width: 320, maxWidth: "90%" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 14, width: `${95 - i * 8}%` }} />)}
          </div>
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 260, maxWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton" style={{ height: 170, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 150, borderRadius: 16 }} />
        </div>
      </div>
    </div>
  );
}

export function JobsRouteSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <div className="skeleton skeleton-heading" style={{ width: 120, marginBottom: 20 }} />
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 36, width: 220 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 36, width: 90 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, padding: "0 4px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        {["16%", "22%", "10%", "9%", "9%", "12%", "16%", "6%"].map((w, i) => (
          <div key={i} className="skeleton skeleton-text-sm" style={{ width: w }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="skeleton skeleton-circle" style={{ width: 32, height: 32, flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 12, width: "20%" }} />
            <div className="skeleton" style={{ height: 12, width: "14%" }} />
            <div className="skeleton" style={{ height: 12, width: "10%" }} />
            <div className="skeleton" style={{ height: 12, width: "10%" }} />
            <div className="skeleton" style={{ height: 12, width: "12%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessagesRouteSkeleton() {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 400 }}>
      <div style={{ width: 280, borderRight: "1px solid rgba(0,0,0,0.06)", flexShrink: 0, padding: "14px 16px" }}>
        {[0, 1].map((g) => (
          <div key={g} style={{ marginBottom: 18 }}>
            <div className="skeleton skeleton-text-sm" style={{ width: 80, marginBottom: 10 }} />
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 10, width: "45%" }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 16px" }}>
        <div className="skeleton" style={{ height: 14, width: 180, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 11, width: 140, marginBottom: 20 }} />
        {(
          [
            { w: "55%", align: "flex-start" },
            { w: "40%", align: "flex-end" },
            { w: "65%", align: "flex-start" },
            { w: "35%", align: "flex-end" },
          ] as const
        ).map((b, i) => (
          <div key={i} style={{ display: "flex", justifyContent: b.align, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 32, width: b.w, borderRadius: 14 }} />
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ height: 40, width: "100%" }} />
      </div>
    </div>
  );
}

export function MessageThreadRouteSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 16px", gap: 10 }}>
      <div className="skeleton" style={{ height: 32, width: "50%", borderRadius: 14, alignSelf: "flex-start" }} />
      <div className="skeleton" style={{ height: 32, width: "35%", borderRadius: 14, alignSelf: "flex-end" }} />
      <div className="skeleton" style={{ height: 32, width: "60%", borderRadius: 14, alignSelf: "flex-start" }} />
    </div>
  );
}

export function AnalyticsRouteSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="skeleton-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          <div className="skeleton skeleton-circle" style={{ width: 90, height: 90 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="skeleton-card" style={{ minHeight: 70 }}>
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 20, width: "35%", marginTop: 8 }} />
          </div>
          <div className="skeleton-card" style={{ minHeight: 70 }}>
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 20, width: "35%", marginTop: 8 }} />
          </div>
        </div>
        <div className="skeleton-card" style={{ minHeight: 160 }}>
          <div className="skeleton skeleton-text" style={{ width: "60%" }} />
          <div className="skeleton skeleton-text" style={{ width: "80%" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton skeleton-text-sm" style={{ width: "50%" }} />
            <div className="skeleton" style={{ height: 24, width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="skeleton-card" style={{ minHeight: 220 }}>
          <div className="skeleton skeleton-text" style={{ width: "30%" }} />
          <div className="skeleton" style={{ height: 170, width: "100%", marginTop: 12 }} />
        </div>
        <div className="skeleton-card" style={{ minHeight: 220 }}>
          <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          <div className="skeleton" style={{ height: 170, width: "100%", marginTop: 12 }} />
        </div>
      </div>
    </div>
  );
}

export function CalendarRouteSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="skeleton skeleton-heading" style={{ width: 160 }} />
        <div className="skeleton" style={{ height: 36, width: 130 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 30, width: 120, borderRadius: 999 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="skeleton-card" style={{ minHeight: 160 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="skeleton skeleton-circle" style={{ width: 44, height: 44 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 14, width: "50%", marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 11, width: "35%" }} />
              </div>
            </div>
            <div className="skeleton" style={{ height: 36, width: "100%", marginTop: 16 }} />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-card" style={{ minHeight: 60 }}>
              <div className="skeleton" style={{ height: 12, width: "60%" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="skeleton-card">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: "1", borderRadius: 6 }} />
              ))}
            </div>
          </div>
          <div className="skeleton-card" style={{ minHeight: 50 }} />
          <div className="skeleton-card" style={{ minHeight: 50 }} />
        </div>
      </div>
    </div>
  );
}

export function SettingsRouteSkeleton() {
  const ActionRow = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 6 }} />
        <div className="skeleton" style={{ height: 10, width: "60%" }} />
      </div>
      <div className="skeleton" style={{ height: 30, width: 80 }} />
    </div>
  );
  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 28 }}>
      <div className="skeleton skeleton-heading" style={{ width: 160 }} />
      <div>
        <div className="skeleton skeleton-text" style={{ width: 140, marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 10, width: "100%", marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div className="skeleton" style={{ height: 32, width: 100 }} />
          <div className="skeleton" style={{ height: 32, width: 100 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", gap: 16 }}>
              <div className="skeleton" style={{ height: 12, width: "30%" }} />
              <div className="skeleton" style={{ height: 12, width: "20%" }} />
              <div className="skeleton" style={{ height: 12, width: "15%" }} />
              <div className="skeleton" style={{ height: 12, width: "15%" }} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="skeleton skeleton-text" style={{ width: 100, marginBottom: 10 }} />
        <ActionRow />
        <ActionRow />
      </div>
      <div>
        <div className="skeleton skeleton-text" style={{ width: 120, marginBottom: 10 }} />
        <ActionRow />
        <ActionRow />
      </div>
    </div>
  );
}

/* ── Path → skeleton lookup ──
   For loaders that sit above the per-page `dynamic()` fallbacks and so can't
   know the destination statically: the RequireAuth gate (shown while the
   session restores on every hard load) and the shared (dashboard)/loading.tsx
   boundary. Without this, every hard load flashed a generic blob before the
   page's shaped skeleton took over. Returns null for paths with no shaped
   skeleton so callers fall back to the generic LoadingScreen. */
const ROUTE_SKELETONS: ReadonlyArray<[prefix: string, render: () => React.ReactNode]> = [
  ["/dashboard", () => <DashboardRouteSkeleton />],
  ["/sessions", () => <SessionsRouteSkeleton />],
  ["/resume", () => <ResumeRouteSkeleton />],
  ["/jobs", () => <JobsRouteSkeleton />],
  ["/messages", () => <MessagesRouteSkeleton />],
  ["/analytics", () => <AnalyticsRouteSkeleton />],
  ["/calendar", () => <CalendarRouteSkeleton />],
  ["/settings", () => <SettingsRouteSkeleton />],
];

export function routeSkeletonFor(pathname: string | null | undefined): React.ReactNode | null {
  if (!pathname) return null;
  if (pathname.startsWith("/jobs/")) return <JobDetailRouteSkeleton />;
  const match = ROUTE_SKELETONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1]() : null;
}
