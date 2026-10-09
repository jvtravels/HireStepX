"use client";

import { useState, useEffect, useRef } from "react";
import { c, font, radius } from "./tokens";
import { tokens as T } from "./auth/_tokens";

interface RequirementRow {
  requirementId: string; employerId: string; companyName: string;
  title: string; location: string; status: string; createdAt: string;
}
interface MatchRow {
  matchId: string; name: string; email: string; matchScore: number;
  unlocked: boolean; unlockedAt: string | null;
}
interface MatchesData {
  requirement: { id: string; title: string; location: string; status: string };
  employer: { id: string; companyName: string };
  matches: MatchRow[];
}
interface UnlockResult { ok: boolean; unlocked?: number; alreadyUnlocked?: number; failed?: number; error?: string }

interface Props {
  getToken: () => string | null;
  setToken: (token: string) => void;
}

const card = { background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: "20px 24px" } as const;
const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: c.stone, margin: "0 0 6px" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 13 } as const;
const thStyle = { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: c.stone, borderBottom: `1px solid ${c.border}` } as const;
const tdStyle = { padding: "10px 12px", color: c.chalk, borderBottom: `1px solid ${c.borderSubtle}` } as const;
const inputStyle = {
  fontFamily: font.ui, fontSize: 13, color: c.ivory, background: c.obsidian,
  border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 12px", outline: "none",
} as const;
const primaryBtn = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: "#fff", background: T.indigo,
  border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer",
} as const;
const ghostBtn = {
  fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: T.indigo, background: "transparent",
  border: "1px solid rgba(180,83,9,0.3)", borderRadius: 8, padding: "6px 12px", cursor: "pointer",
} as const;

export default function AdminUnlockPanel({ getToken, setToken }: Props) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<RequirementRow[] | null>(null);
  const [listError, setListError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchesData | null>(null);
  const [detailError, setDetailError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const listSeq = useRef(0);
  const detailSeq = useRef(0);

  async function post<T>(body: Record<string, unknown>): Promise<T | null> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["x-admin-token"] = token;
    const res = await fetch("/api/admin-data", { method: "POST", headers, credentials: "include", body: JSON.stringify(body) });
    if (!res.ok) return null;
    const data = await res.json() as T & { _token?: string };
    if (data._token) setToken(data._token);
    return data;
  }

  async function loadList(term: string) {
    const seq = ++listSeq.current;
    setLoadingList(true);
    setListError("");
    try {
      const data = await post<{ rows: RequirementRow[] }>({ section: "unlock-requirements", search: term });
      if (seq !== listSeq.current) return;
      if (!data) { setListError("Could not load job requirements."); return; }
      setRows(data.rows);
    } catch {
      if (seq === listSeq.current) setListError("Could not load job requirements.");
    } finally {
      if (seq === listSeq.current) setLoadingList(false);
    }
  }

  async function loadDetail(requirementId: string) {
    const seq = ++detailSeq.current;
    setLoadingDetail(true);
    setDetailError("");
    try {
      const data = await post<MatchesData>({ section: "unlock-matches", requirementId });
      if (seq !== detailSeq.current) return;
      if (!data) { setDetailError("Could not load candidates."); return; }
      setDetail(data);
    } catch {
      if (seq === detailSeq.current) setDetailError("Could not load candidates.");
    } finally {
      if (seq === detailSeq.current) setLoadingDetail(false);
    }
  }

  // Debounced search; also does the initial load (empty term = newest first).
  useEffect(() => {
    const t = setTimeout(() => { void loadList(search); }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openRequirement(id: string) {
    setSelectedReq(id);
    setDetail(null);
    setPicked(new Set());
    setNote("");
    setResult(null);
    void loadDetail(id);
  }

  function closeRequirement() {
    detailSeq.current++;
    setSelectedReq(null);
    setDetail(null);
    setPicked(new Set());
    setResult(null);
  }

  async function unlock(matchIds: string[] | null) {
    if (!detail || busy) return;
    const lockedCount = matchIds ? matchIds.length : detail.matches.filter((m) => !m.unlocked).length;
    if (lockedCount === 0) return;
    const ok = window.confirm(
      `Unlock ${lockedCount} candidate${lockedCount === 1 ? "" : "s"} for "${detail.requirement.title}" at ${detail.employer.companyName}?\n\n` +
      "This is complimentary (no payment). The employer will see the candidates' contact details.",
    );
    if (!ok) return;
    setBusy(true);
    setResult(null);
    try {
      const out = await post<UnlockResult>({
        action: "admin-unlock-candidates",
        requirementId: detail.requirement.id,
        ...(matchIds ? { matchIds } : {}),
        note: note.trim() || undefined,
      });
      if (!out) {
        setResult({ ok: false, message: "Request failed. Nothing may have been unlocked — refresh to check." });
      } else if (out.ok) {
        setResult({ ok: true, message: out.unlocked ? `Unlocked ${out.unlocked} candidate${out.unlocked === 1 ? "" : "s"}.` : "Nothing to unlock — already unlocked." });
      } else {
        setResult({ ok: false, message: out.error || "Unlock failed." });
      }
      setPicked(new Set());
      await loadDetail(detail.requirement.id);
    } catch {
      setResult({ ok: false, message: "Network error. Refresh to see what was unlocked." });
    } finally {
      setBusy(false);
    }
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (selectedReq) {
    const locked = detail ? detail.matches.filter((m) => !m.unlocked) : [];
    const allPicked = locked.length > 0 && locked.every((m) => picked.has(m.matchId));
    return (
      <div>
        <button type="button" style={{ ...ghostBtn, marginBottom: 16 }} onClick={closeRequirement}>← Back to job roles</button>
        {loadingDetail && !detail && <p style={{ color: c.stone, fontSize: 13 }}>Loading candidates…</p>}
        {detailError && <p role="alert" style={{ color: c.ember, fontSize: 13 }}>{detailError}</p>}
        {detail && (
          <div style={card}>
            <p style={labelStyle}>{detail.employer.companyName}</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: c.ivory, margin: "0 0 4px" }}>{detail.requirement.title}</h2>
            <p style={{ fontSize: 12, color: c.stone, margin: "0 0 16px" }}>
              {detail.requirement.location || "No location"} · {detail.matches.length} matched · {locked.length} locked
            </p>

            {detail.matches.length === 0 ? (
              <p style={{ color: c.stone, fontSize: 13 }}>No candidates are matched to this job yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 36 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all locked candidates"
                          checked={allPicked}
                          disabled={locked.length === 0 || busy}
                          onChange={() => setPicked(allPicked ? new Set() : new Set(locked.map((m) => m.matchId)))}
                        />
                      </th>
                      <th style={thStyle}>Candidate</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Match</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.matches.map((m) => (
                      <tr key={m.matchId}>
                        <td style={tdStyle}>
                          {!m.unlocked && (
                            <input
                              type="checkbox"
                              aria-label={`Select ${m.name}`}
                              checked={picked.has(m.matchId)}
                              disabled={busy}
                              onChange={() => togglePick(m.matchId)}
                            />
                          )}
                        </td>
                        <td style={tdStyle}>{m.name}</td>
                        <td style={tdStyle}>{m.email}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{Math.round(m.matchScore)}%</td>
                        <td style={{ ...tdStyle, color: m.unlocked ? c.sage : c.stone }}>
                          {m.unlocked ? `Unlocked${m.unlockedAt ? ` · ${new Date(m.unlockedAt).toLocaleDateString()}` : ""}` : "Locked"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {locked.length > 0 && (
              <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <input
                  type="text"
                  aria-label="Reason for complimentary unlock (optional)"
                  placeholder="Reason (optional) — e.g. pilot, goodwill"
                  value={note}
                  maxLength={200}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ ...inputStyle, flex: "1 1 240px" }}
                />
                <button
                  type="button"
                  style={{ ...primaryBtn, opacity: picked.size === 0 || busy ? 0.5 : 1 }}
                  disabled={picked.size === 0 || busy}
                  onClick={() => void unlock([...picked])}
                >
                  Unlock selected ({picked.size})
                </button>
                <button
                  type="button"
                  style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}
                  disabled={busy}
                  onClick={() => void unlock(null)}
                >
                  Unlock all locked ({locked.length})
                </button>
              </div>
            )}

            {result && (
              <p role={result.ok ? "status" : "alert"} style={{ marginTop: 14, fontSize: 13, color: result.ok ? c.sage : c.ember }}>
                {result.message}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: 20 }}>
        <p style={labelStyle}>Complimentary unlock</p>
        <p style={{ fontSize: 13, color: c.chalk, margin: "0 0 14px", lineHeight: 1.5 }}>
          Unlock matched candidates for any company&apos;s job role without payment. Search by company or job title, then pick the role.
        </p>
        <input
          type="search"
          aria-label="Search company or job role"
          placeholder="Search company or job role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: "100%", maxWidth: 420 }}
        />
      </div>

      {listError && <p role="alert" style={{ color: c.ember, fontSize: 13 }}>{listError}</p>}
      {loadingList && !rows && <p style={{ color: c.stone, fontSize: 13 }}>Loading…</p>}
      {rows && rows.length === 0 && !loadingList && (
        <p style={{ color: c.stone, fontSize: 13 }}>No job roles found{search ? ` for "${search}"` : ""}.</p>
      )}
      {rows && rows.length > 0 && (
        <div style={{ ...card, overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Job role</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Action</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.requirementId}>
                  <td style={tdStyle}>{r.companyName}</td>
                  <td style={tdStyle}>{r.title}</td>
                  <td style={tdStyle}>{r.location || "—"}</td>
                  <td style={tdStyle}>{r.status}</td>
                  <td style={tdStyle}>
                    <button type="button" style={ghostBtn} onClick={() => openRequirement(r.requirementId)}>
                      View candidates
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
