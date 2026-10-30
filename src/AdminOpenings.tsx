"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { c, radius } from "./tokens";
import type { listPublicOpeningRequests } from "../server-handlers/_admin-openings";

interface Props {
  getToken: () => string | null;
  setToken: (token: string) => void;
}

type Listing = Awaited<ReturnType<typeof listPublicOpeningRequests>>;
type Row = Listing["rows"][number];
type Draft = { title: string; summary: string };

const card: CSSProperties = { background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: "20px 24px", marginBottom: 24 };
const heading: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: c.stone, margin: "0 0 12px" };
const note: CSSProperties = { margin: "4px 0 0", fontSize: 12, color: c.stone };
const rowBox: CSSProperties = { background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: 14, marginBottom: 12, display: "grid", gap: 8 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 13, color: c.ivory, background: c.carbon, border: `1px solid ${c.border}`, borderRadius: radius.lg, fontFamily: "inherit" };
const btn: CSSProperties = { padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: radius.lg, border: `1px solid ${c.border}`, background: c.carbon, color: c.ivory, cursor: "pointer" };
const btnPrimary: CSSProperties = { ...btn, background: c.gilt, color: "#fff", border: "none" };

const SUMMARY_MAX = 280;

export default function AdminOpenings({ getToken, setToken }: Props) {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const post = useCallback(async (body: Record<string, unknown>) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["x-admin-token"] = token;
    const res = await fetch("/api/admin-data", { method: "POST", headers, credentials: "include", body: JSON.stringify(body) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown> & { _token?: string; error?: string };
    if (d._token) setToken(d._token);
    if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : `HTTP ${res.status}`);
    return d;
  }, [getToken, setToken]);

  const load = useCallback(async () => {
    try {
      const d = (await post({ section: "public-openings" })) as unknown as Listing;
      setData(d);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const r of d.rows) next[r.requirementId] ??= { title: r.preview?.title ?? r.title, summary: r.preview?.summary ?? "" };
        return next;
      });
    } catch {
      setError("Could not load roles.");
    }
  }, [post]);

  useEffect(() => { void load(); }, [load]);

  const act = async (r: Row, decision: "approve" | "unpublish") => {
    const d = drafts[r.requirementId];
    setBusy(r.requirementId);
    setMessage("");
    try {
      const out = await post({ section: "set-public-opening", requirementId: r.requirementId, decision, publicTitle: d?.title, publicSummary: d?.summary });
      if (out.ok === false) setMessage(String(out.error ?? "Failed"));
      else setMessage(decision === "approve" ? "Listed. It can take up to 5 minutes to appear on the site." : "Unlisted.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  };

  if (error) return <div style={card}><p style={note}>{error}</p></div>;
  if (!data) return <div style={card}><p style={note}>Loading public roles…</p></div>;

  const set = (id: string, patch: Partial<Draft>) => setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  return (
    <div style={card}>
      <p style={heading}>Public open roles</p>
      <p style={note}>Candidates see only the title and summary below, never the company. Roles hide {data.maxAgeDays} days after listing. Do not put the company name, phone or email in the text.</p>
      {message && <p style={{ ...note, color: c.ivory, margin: "8px 0" }}>{message}</p>}
      <div style={{ marginTop: 12 }}>
        {data.rows.length === 0 && <p style={note}>No open roles yet.</p>}
        {data.rows.map((r) => {
          const d = drafts[r.requirementId] ?? { title: "", summary: "" };
          const on = r.listing === "approved";
          return (
            <div key={r.requirementId} style={rowBox}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: c.ivory, fontWeight: 600 }}>{r.title} <span style={{ color: c.stone, fontWeight: 400 }}>({r.companyName || "unknown company"}, private)</span></span>
                <span style={{ fontSize: 12, color: on ? c.sage : c.stone }}>{on ? (r.live ? "Live" : "Expired, re-list to show") : "Not listed"}</span>
              </div>
              <input style={input} aria-label="Public title" value={d.title} maxLength={120} onChange={(e) => set(r.requirementId, { title: e.target.value })} />
              <textarea style={{ ...input, minHeight: 64, resize: "vertical" }} aria-label="Public summary" value={d.summary} maxLength={SUMMARY_MAX} placeholder="One or two sentences about the role. No company name." onChange={(e) => set(r.requirementId, { summary: e.target.value })} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" style={btnPrimary} disabled={busy === r.requirementId || !d.summary.trim()} onClick={() => void act(r, "approve")}>{on ? "Update and re-list" : "List this role"}</button>
                {on && <button type="button" style={btn} disabled={busy === r.requirementId} onClick={() => void act(r, "unpublish")}>Unlist</button>}
                <span style={note}>{d.summary.length}/{SUMMARY_MAX}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
