/** Resolves at once while the tab is visible, otherwise when it next becomes visible, so background polling
    does not spend rate limit on a tab nobody is looking at. */
export function waitUntilVisible(): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState === "hidden") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}
