/* HireStepX — Design System / Data Display
   Table, Chart, Carousel. Static/tabular content and token-driven data-viz
   (the mist chart ramp — indigo plays no role). There is no real "Data
   Table" or "Line/Bar chart demo" primitive in src/components/ui — those
   are compositions built here from the real Table and ChartContainer +
   recharts primitives, with local sort/state logic, not a new library
   abstraction. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowUpDown } from "lucide-react";

const sessions = [
  { date: "Sep 12", role: "PM", score: 82 },
  { date: "Sep 15", role: "SWE", score: 74 },
  { date: "Sep 18", role: "PM", score: 88 },
];

const trend = [
  { week: "W1", score: 62 },
  { week: "W2", score: 68 },
  { week: "W3", score: 74 },
  { week: "W4", score: 82 },
];

const byRound = [
  { round: "Behavioral", score: 82 },
  { round: "Technical", score: 74 },
  { round: "Negotiation", score: 88 },
];

const trendConfig = { score: { label: "Score", color: "var(--chart-2)" } } satisfies ChartConfig;
const roundConfig = { score: { label: "Score", color: "var(--chart-3)" } } satisfies ChartConfig;

type SortKey = "date" | "role" | "score";

/* No real "DataTable" primitive exists — this is a Table composition with
   local sort state, built only from already-declared real components. */
function SortableSessionsTable() {
  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [asc, setAsc] = React.useState(true);

  const sorted = React.useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    return copy;
  }, [sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((a) => !a);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {(["date", "role"] as SortKey[]).map((key) => (
            <TableHead key={key}>
              <button
                type="button"
                className="flex items-center gap-1 capitalize"
                onClick={() => toggleSort(key)}
              >
                {key}
                <ArrowUpDown className="size-3" />
              </button>
            </TableHead>
          ))}
          <TableHead>Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((s) => (
          <TableRow key={s.date}>
            <TableCell>{s.date}</TableCell>
            <TableCell>{s.role}</TableCell>
            <TableCell><Badge variant="outline">{s.score}/100</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function DesignSystemData() {
  return (
    <PageShell>
      <PageHeader
        title="Data display."
        description="Table, Chart, Carousel — tabular and token-driven visual data, built on the neutral mist chart ramp, never indigo."
      />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="Table" desc="Plain semantic table — the base every richer data view composes." />
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Role</TableHead><TableHead>Score</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.date}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.role}</TableCell>
                  <TableCell><Badge variant="outline">{s.score}/100</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="02" title="Data Table" desc="Table + a small client-side sort demo — a composition, not a new data-grid primitive (no real DataTable component exists)." />
          <SortableSessionsTable />
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="03" title="Chart" desc="Real ChartContainer wrapping raw recharts elements, driven by --chart-1..5 tokens — readiness trend and per-round score comparison." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <p className="text-sm font-medium mb-2">Readiness trend</p>
              <ChartContainer config={trendConfig} className="w-full">
                <LineChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Score by round</p>
              <ChartContainer config={roundConfig} className="w-full">
                <BarChart data={byRound}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="round" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="score" fill="var(--color-score)" radius={4} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </section>

        <section>
          <SectionHead num="04" title="Carousel" desc="Embla-based — for a company-logo or testimonial strip on marketing pages." />
          <div className="relative w-96">
            <Carousel>
              <CarouselContent>
                {["Google", "Flipkart", "Zomato"].map((c) => (
                  <CarouselItem key={c}>
                    <div className="flex h-24 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium">{c}</div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          </div>
        </section>
      </div>
      <Footer section="Data Display" tagline="Sort the table, drag the carousel." />
    </PageShell>
  );
}
