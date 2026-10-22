"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { captureClientEvent } from "../src/posthogClient";
import {
  OPEN_SETTINGS_EVENT,
  getCookieConsent,
  getStoredConsent,
  setCookieConsent,
  type ConsentCategories,
} from "../src/consent";

// Re-exported so existing importers keep working; the store lives in src/consent.ts.
export { getCookieConsent };

const SWITCH_CLASS =
  "mt-0.5 data-checked:bg-[var(--btn-primary)] data-unchecked:bg-[var(--muted-foreground)]";
const BUTTON_CLASS = "h-10 px-4 text-[13px] pointer-coarse:h-11";

function formatSavedDate(timestamp: string): string | null {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  useEffect(() => {
    // First visit, or the banner version changed (parseStoredConsent returns
    // null for a stale version) -> ask. Delay slightly so first paint isn't
    // blocked by the banner. No analytics event here: nothing may be sent
    // before the visitor opts in.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!getCookieConsent()) t = setTimeout(() => setVisible(true), 400);
    // Footer / account-menu "Cookie settings" link: reopen on the full
    // controls so a previous choice can be changed as easily as it was given.
    const reopen = () => {
      const stored = getStoredConsent();
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setAnalytics(stored?.analytics ?? false);
      setAdvertising(stored?.advertising ?? false);
      setSavedAt(stored ? formatSavedDate(stored.timestamp) : null);
      setReopened(true);
      setExpanded(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, reopen);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener(OPEN_SETTINGS_EVENT, reopen);
    };
  }, []);

  // Keyboard users who opened the controls (or moved to the Customize layer)
  // land on the dialog heading; a first-visit banner never steals focus.
  useEffect(() => {
    if (visible && (reopened || expanded)) titleRef.current?.focus();
  }, [visible, reopened, expanded]);

  // The banner is fixed to the bottom edge, so on a short screen it sat on top of the page's own
  // buttons (the login button on first visit). Reserve its height as body padding so the page can
  // scroll clear of it.
  useEffect(() => {
    const el = bannerRef.current;
    if (!visible || !el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--hsx-cookie-h", `${Math.ceil(el.getBoundingClientRect().height) + 16}px`);
    sync();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(sync);
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty("--hsx-cookie-h"); };
  }, [visible, expanded]);

  const dismiss = () => {
    setVisible(false);
    setExpanded(false);
    setReopened(false);
    openerRef.current?.focus();
    openerRef.current = null;
  };

  // Escape closes the panel only when the visitor opened it themselves; a
  // first-visit banner stays until they choose.
  useEffect(() => {
    if (!visible || !reopened) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, reopened]);

  const choose = (input: "accepted" | "rejected" | ConsentCategories) => {
    setCookieConsent(input);
    // Only a consented visitor's PostHog is running; for a rejection (or a
    // withdrawal) this is dropped by the client, so nothing is sent.
    if (input === "accepted" || (typeof input === "object" && input.analytics)) captureClientEvent("cookie_consent_accepted");
    dismiss();
  };

  if (!visible) return null;

  // Ads only run on the public marketing host; the signed-in app host has none.
  const showAds = !window.location.hostname.startsWith("app.");

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={expanded ? "hsx-cookie" : "hsx-cookie hsx-cookie--compact"}
    >
      <div className="hsx-cookie__scroll">
        <div className="hsx-cookie__head">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="hsx-cookie__title">Cookies on HireStepX</h2>
          {reopened && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-2 pointer-coarse:size-11"
              aria-label="Close cookie settings"
              onClick={dismiss}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>

        <p id={descId} className="hsx-cookie__text">
          {expanded
            ? "Choose which optional cookies to allow. Nothing optional loads until you decide."
            : <>
                <span className="hsx-cookie__long">Essential cookies keep you signed in and secure. We&rsquo;d also like to use analytics{showAds ? " and advertising" : ""} cookies to improve HireStepX. Nothing optional loads until you choose.</span>
                <span className="hsx-cookie__short">Essential cookies keep you signed in. Optional analytics{showAds ? " and ad" : ""} cookies load only if you accept.</span>
              </>}
        </p>

        {expanded && (
          <ul className="hsx-cookie__rows">
            <li className="hsx-cookie__row">
              <span className="hsx-cookie__row-body">
                <span className="hsx-cookie__row-title">Essential</span>
                <span className="hsx-cookie__row-desc">Sign-in, security, and remembering this choice. HireStepX can&rsquo;t work without these.</span>
              </span>
              <span className="hsx-cookie__badge">Always on</span>
            </li>
            <li>
              <label className="hsx-cookie__row hsx-cookie__row--toggle" htmlFor={`${uid}-analytics`}>
                <span className="hsx-cookie__row-body">
                  <span id={`${uid}-analytics-t`} className="hsx-cookie__row-title">Analytics</span>
                  <span id={`${uid}-analytics-d`} className="hsx-cookie__row-desc">
                    Shows us which pages and features are used so we can fix problems and improve. Google Analytics 4,
                    PostHog (tied to your account ID, never your email; no session recording), and Vercel Analytics and
                    Speed Insights.
                  </span>
                </span>
                <Switch
                  id={`${uid}-analytics`}
                  className={SWITCH_CLASS}
                  checked={analytics}
                  onCheckedChange={setAnalytics}
                  aria-labelledby={`${uid}-analytics-t`}
                  aria-describedby={`${uid}-analytics-d`}
                />
              </label>
            </li>
            {showAds && (
              <li>
                <label className="hsx-cookie__row hsx-cookie__row--toggle" htmlFor={`${uid}-advertising`}>
                  <span className="hsx-cookie__row-body">
                    <span id={`${uid}-advertising-t`} className="hsx-cookie__row-title">Advertising</span>
                    <span id={`${uid}-advertising-d`} className="hsx-cookie__row-desc">
                      Lets Google AdSense show ads on our public blog, interview-question and salary pages, and may set
                      advertising cookies. Never used on signed-in pages.
                    </span>
                  </span>
                  <Switch
                    id={`${uid}-advertising`}
                    className={SWITCH_CLASS}
                    checked={advertising}
                    onCheckedChange={setAdvertising}
                    aria-labelledby={`${uid}-advertising-t`}
                    aria-describedby={`${uid}-advertising-d`}
                  />
                </label>
              </li>
            )}
          </ul>
        )}

        <p className="hsx-cookie__text hsx-cookie__text--small">
          {expanded && <>Change or withdraw this any time from &ldquo;Cookie settings&rdquo; in the footer or account menu.{savedAt ? ` Last saved ${savedAt}.` : ""}{" "}</>}
          <a href="/privacy" className="hsx-cookie__link">Privacy policy</a>
        </p>
      </div>

      {/* Equal prominence: Reject all and Accept all share one variant, size and weight. */}
      <div className="hsx-cookie__actions">
        {expanded ? (
          <>
            <Button type="button" variant="outline" className={BUTTON_CLASS} onClick={() => choose("rejected")}>Reject all</Button>
            <Button type="button" variant="outline" className={BUTTON_CLASS} onClick={() => choose("accepted")}>Accept all</Button>
            <Button
              type="button"
              className={`${BUTTON_CLASS} hsx-cookie__save`}
              onClick={() => choose({ analytics, advertising: showAds ? advertising : analytics })}
            >
              Save choices
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" className={`${BUTTON_CLASS} hsx-cookie__customize`} onClick={() => setExpanded(true)}>Customize</Button>
            <Button type="button" className={BUTTON_CLASS} onClick={() => choose("rejected")}>Reject all</Button>
            <Button type="button" className={BUTTON_CLASS} onClick={() => choose("accepted")}>Accept all</Button>
          </>
        )}
      </div>
    </div>
  );
}
