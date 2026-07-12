/* Per-post Suspense fallback — shows an article skeleton while the blog post
   client component hydrates. Avoids the generic marketing spinner on direct
   post-page loads and client-side navigations. */
export default function BlogPostLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F0", colorScheme: "light" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .bpost-skel {
          background: linear-gradient(90deg, #EBE5D2 25%, #F4EFE4 50%, #EBE5D2 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
          border-radius: 6px;
        }
        @media (prefers-reduced-motion: reduce) {
          .bpost-skel { animation: none; background: #EBE5D2; }
        }
      `}</style>

      {/* Nav skeleton */}
      <div style={{ height: 60, borderBottom: "1px solid #EBE5D2", display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between" }}>
        <div className="bpost-skel" style={{ width: 140, height: 28 }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div className="bpost-skel" style={{ width: 60, height: 20 }} />
          <div className="bpost-skel" style={{ width: 60, height: 20 }} />
          <div className="bpost-skel" style={{ width: 80, height: 32, borderRadius: 20 }} />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
        {/* Breadcrumb */}
        <div className="bpost-skel" style={{ width: 180, height: 16, marginBottom: 32 }} />

        {/* Hero image */}
        <div className="bpost-skel" style={{ width: "100%", height: 320, borderRadius: 12, marginBottom: 32 }} />

        {/* Title */}
        <div className="bpost-skel" style={{ width: "85%", height: 40, marginBottom: 12 }} />
        <div className="bpost-skel" style={{ width: "60%", height: 40, marginBottom: 24 }} />

        {/* Meta (date, read time) */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          <div className="bpost-skel" style={{ width: 100, height: 16 }} />
          <div className="bpost-skel" style={{ width: 80, height: 16 }} />
        </div>

        {/* Body paragraphs */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="bpost-skel" style={{ height: 16, width: "100%" }} />
            <div className="bpost-skel" style={{ height: 16, width: "95%" }} />
            <div className="bpost-skel" style={{ height: 16, width: "80%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
