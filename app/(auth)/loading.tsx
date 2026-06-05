export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", background: "#FAF7F0", fontFamily: "var(--font-ui, system-ui, sans-serif)" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #EBE5D2", borderTopColor: "#B45309", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
