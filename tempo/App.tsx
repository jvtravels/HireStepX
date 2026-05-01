/* Sidecar landing page — shown when the devserver is hit at "/".
   The real app is Next.js and can't run under Vite, so this is just a
   helpful placeholder pointing at the Tempo canvas viewer. */
export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        background: "#FAF7F0",
        color: "#0E0C08",
      }}
    >
      <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 28, margin: 0 }}>
        HireStepX · Tempo Sidecar
      </h1>
      <p style={{ color: "#3E3A6E", fontSize: 14, margin: 0 }}>
        Open canvases in the Tempo Local panel.
      </p>
    </div>
  );
}
