"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "../apiClient";
import { CATEGORY_LABELS, DEFAULT_PREFS, categoriesForAudience, type Audience, type Category, type NotificationPrefs } from "./registry";

export default function NotificationPreferences({ audience }: { audience: Audience }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let live = true;
    apiFetch<{ prefs: NotificationPrefs }>("/api/notifications/preferences", {}).then((res) => {
      if (live) setPrefs(res.ok && res.data ? res.data.prefs : DEFAULT_PREFS);
    });
    return () => { live = false; };
  }, []);

  async function toggle(category: Category, on: boolean) {
    if (!prefs) return;
    const previous = prefs;
    const next: NotificationPrefs = { inApp: { ...prefs.inApp, [category]: on } };
    setPrefs(next);
    setStatus("saving");
    const res = await apiFetch("/api/notifications/preferences", { prefs: next });
    if (res.ok) setStatus("saved");
    else {
      setPrefs(previous);
      setStatus("error");
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-1 p-4">
      <h2 className="m-0 text-base font-semibold text-foreground">In-app notifications</h2>
      <p className="m-0 mb-3 text-[13px] text-muted-foreground">
        Choose what appears in your inbox. Payment problems and other critical alerts always come through.
      </p>
      {prefs === null ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <ul role="list" className="m-0 list-none divide-y divide-border rounded-lg border border-border p-0">
          {categoriesForAudience(audience).map((c) => {
            const id = `pref-${c}`;
            return (
              <li key={c} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <label htmlFor={id} className="block text-sm font-medium text-foreground">{CATEGORY_LABELS[c].label}</label>
                  <p className="m-0 text-[13px] text-muted-foreground">{CATEGORY_LABELS[c].description}</p>
                </div>
                <Switch id={id} checked={prefs.inApp[c] !== false} onCheckedChange={(on) => toggle(c, on)} />
              </li>
            );
          })}
        </ul>
      )}
      <p role="status" className="m-0 mt-2 h-4 text-xs text-muted-foreground">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Couldn't save. Try again." : ""}
      </p>
    </div>
  );
}
