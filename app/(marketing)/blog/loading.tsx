/* Blog-specific Suspense fallback — overrides the generic marketing spinner.
   Shows the blog header skeleton so the page looks alive immediately rather
   than showing an empty spinner where the article grid should be. */
export default function BlogLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F0", colorScheme: "light" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .blog-skel {
          background: linear-gradient(90deg, #EBE5D2 25%, #F4EFE4 50%, #EBE5D2 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .blog-skel { animation: none; background: #EBE5D2; }
        }
      `}</style>

      {/* Nav skeleton */}
      <div style={{ height: 60, borderBottom: "1px solid #EBE5D2", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between" }}>
        <div className="blog-skel" style={{ width: 140, height: 28 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div className="blog-skel" style={{ width: 60, height: 20 }} />
          <div className="blog-skel" style={{ width: 60, height: 20 }} />
          <div className="blog-skel" style={{ width: 80, height: 32, borderRadius: 20 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        {/* Page title */}
        <div className="blog-skel" style={{ width: 320, height: 36, marginBottom: 10 }} />
        <div className="blog-skel" style={{ width: 240, height: 20, marginBottom: 32 }} />

        {/* Category filter chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
          {[72, 90, 80, 96, 68].map((w, i) => (
            <div key={i} className="blog-skel" style={{ width: w, height: 32, borderRadius: 20 }} />
          ))}
        </div>

        {/* Featured card */}
        <div className="blog-skel" style={{ width: "100%", height: 240, borderRadius: 12, marginBottom: 32 }} />

        {/* Article grid — 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="blog-skel" style={{ height: 160, borderRadius: 10 }} />
              <div className="blog-skel" style={{ height: 18, width: "90%" }} />
              <div className="blog-skel" style={{ height: 14, width: "70%" }} />
              <div className="blog-skel" style={{ height: 14, width: "50%" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
