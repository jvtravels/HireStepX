import { tokens as t } from "../../../src/auth/_tokens";

export default function BlogLoading() {
  return (
    <div style={{ minHeight: "100vh", background: t.cream, colorScheme: "light" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .blog-skel {
          background: linear-gradient(90deg, ${t.line} 25%, ${t.creamSoft} 50%, ${t.line} 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .blog-skel { animation: none; background: ${t.line}; }
        }
      `}</style>

      {/* Nav skeleton */}
      <div style={{ height: 60, borderBottom: `1px solid ${t.line}`, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between" }}>
        <div className="blog-skel" style={{ width: 140, height: 28 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div className="blog-skel" style={{ width: 60, height: 20 }} />
          <div className="blog-skel" style={{ width: 60, height: 20 }} />
          <div className="blog-skel" style={{ width: 80, height: 32, borderRadius: 20 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Page title */}
        <div className="blog-skel" style={{ width: 360, height: 52, marginBottom: 14, borderRadius: 8 }} />
        <div className="blog-skel" style={{ width: 280, height: 22, marginBottom: 36 }} />

        {/* Category filter chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
          {[72, 90, 80, 96, 68, 88].map((w, i) => (
            <div key={i} className="blog-skel" style={{ width: w, height: 36, borderRadius: 20 }} />
          ))}
        </div>

        {/* Featured card */}
        <div className="blog-skel" style={{ width: "100%", height: 280, borderRadius: 16, marginBottom: 20 }} />

        {/* Article grid — 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="blog-skel" style={{ height: 160, borderRadius: 12 }} />
              <div className="blog-skel" style={{ height: 14, width: "45%", borderRadius: 4 }} />
              <div className="blog-skel" style={{ height: 20, width: "90%", borderRadius: 4 }} />
              <div className="blog-skel" style={{ height: 20, width: "75%", borderRadius: 4 }} />
              <div className="blog-skel" style={{ height: 14, width: "55%", borderRadius: 4 }} />
            </div>
          ))}
        </div>

        {/* Editorial strip skeleton */}
        <div className="blog-skel" style={{ width: "100%", height: 300, borderRadius: 16, marginBottom: 20 }} />

        {/* Another 3-col row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="blog-skel" style={{ height: 160, borderRadius: 12 }} />
              <div className="blog-skel" style={{ height: 14, width: "45%", borderRadius: 4 }} />
              <div className="blog-skel" style={{ height: 20, width: "88%", borderRadius: 4 }} />
              <div className="blog-skel" style={{ height: 14, width: "60%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
