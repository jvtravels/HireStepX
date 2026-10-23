import { CITY_PAGES } from "../../data/city-pages";
import type { Item } from "./resourcesData";

export function seoHubItems(): Item[] {
  const report: Item = {
    k: "salary", t: "Indian Startup Engineer Salary Report 2026", h: "/salary-report-2026", tag: "Report",
    d: "Total-CTC bands by company, with sources.",
  };
  const cities: Item[] = CITY_PAGES.map((c) => ({
    k: "city", t: `Interview prep in ${c.displayName}`, h: `/interview-prep/${c.slug}`,
    d: `${c.companies.length} hiring companies, with role and company-specific practice.`,
  }));
  const hubs: Item[] = [
    { k: "topic", t: "Interview preparation guide for India", h: "/interview-prep", d: "The full prep framework, with every company guide linked." },
    { k: "topic", t: "All company interview guides", h: "/companies", d: "Browse every company we have question sets for." },
  ];
  return [report, ...cities, ...hubs];
}
