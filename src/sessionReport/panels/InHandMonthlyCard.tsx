import { EyebrowLabel, StatTile, t, radius } from "./_primitives";

export interface InHandMonthlyMeta {
  closingTotalLpa?: number | null;
  monthlyTakeHomeNewRegimeInr?: number | null;
  monthlyTakeHomeOldRegimeInr?: number | null;
  annualTaxNewRegimeLpa?: number | null;
  annualTaxOldRegimeLpa?: number | null;
}

/* Phase 1.1 — in-hand monthly under both tax regimes for the closing
 * offer. Regime selection is the single largest ₹/month delta most
 * Indian candidates miss. */
export function InHandMonthlyCard({
  salaryMeta,
}: {
  salaryMeta: InHandMonthlyMeta;
}) {
  const fmtInr = (v: number | null | undefined) =>
    typeof v === "number" && v > 0
      ? `₹${Math.round(v).toLocaleString("en-IN")}`
      : "—";
  const fmtTaxLpa = (v: number | null | undefined) =>
    typeof v === "number" && v >= 0 ? `₹${v.toFixed(1)} LPA tax/yr` : "";
  return (
    <div
      style={{
        margin: "8px 0 4px",
        padding: "14px 16px",
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: radius.bar,
      }}
    >
      <EyebrowLabel marginBottom={8}>
        Take-home on closing offer · ₹{salaryMeta.closingTotalLpa?.toFixed(1)} LPA
      </EyebrowLabel>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <StatTile
          variant="monthly"
          label="New regime (FY 2025-26)"
          value={fmtInr(salaryMeta.monthlyTakeHomeNewRegimeInr)}
          suffix="/mo"
          footnote={fmtTaxLpa(salaryMeta.annualTaxNewRegimeLpa)}
        />
        <StatTile
          variant="monthly"
          label="Old regime"
          value={fmtInr(salaryMeta.monthlyTakeHomeOldRegimeInr)}
          suffix="/mo"
          footnote={fmtTaxLpa(salaryMeta.annualTaxOldRegimeLpa)}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: t.inkSoft,
          marginTop: 10,
          lineHeight: 1.5,
        }}
      >
        Heuristic. Assumes 12% variable, 18% employer benefits loading, 12% employee EPF on 50% basic. HRA / 80C deductions NOT netted (depend on rent / investments). Most candidates &lt; ₹15L taxable do better under new regime; HRA-heavy + 80C-active candidates &gt; ₹20L often beat new regime under old.
      </div>
    </div>
  );
}
