export const metadata = {
  title: 'Product – Turbo Alan Refiner',
  description: 'Refine writing that ships. Multi-pass strategy, diffs, analytics, and real-time streaming.',
}

export default function ProductPage() {
  return (
    <div className="relative">
      {/* Animated gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-yellow-50 via-white to-white" />

      <div className="max-w-6xl mx-auto py-16 px-6">
        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white/70 backdrop-blur text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" /> Live multi-pass refinement
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold mt-4">Refine writing that ships.</h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
              Turbo Alan Refiner turns rough drafts into publication-ready content. Run structured passes, visualize diffs, measure change, and
              reduce AI detector risk — all with real-time feedback.
            </p>
            <div className="mt-6 flex gap-3">
              <a href="/" className="px-4 py-2 rounded-md bg-yellow-400 text-black font-medium hover:bg-yellow-500">Start Refining</a>
              <a href="/features" className="px-4 py-2 rounded-md border bg-white hover:bg-gray-50">See Features</a>
            </div>
            <div className="mt-6 text-xs text-muted-foreground">No credit card required. Local file output supported.</div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-yellow-200/40 blur-xl" />
            <img
              src="https://images.unsplash.com/photo-1516542076529-1ea3854896e1?q=80&w=1200&auto=format&fit=crop"
              alt="Refiner product screenshot"
              className="relative rounded-xl border shadow-lg"
            />
          </div>
        </div>

        {/* Value Props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {[
            { title: 'Multi-Pass Strategy', desc: 'Break work into targeted passes with clear progression and controls.' },
            { title: 'Real-Time Diffing', desc: 'Compare any two passes to see exactly what changed and why.' },
            { title: 'Risk & Quality Metrics', desc: 'Track tension, change %, detector risk, and processing time.' },
          ].map((c) => (
            <div key={c.title} className="p-6 rounded-lg border bg-white">
              <div className="text-lg font-medium">{c.title}</div>
              <div className="text-muted-foreground mt-2">{c.desc}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-2xl font-semibold mb-4">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '1',
                title: 'Upload & Plan',
                desc: 'Choose files or a local path. Set passes, aggressiveness, and safeguards. A plan snapshot is emitted in real-time.',
                img: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=1200&auto=format&fit=crop',
              },
              {
                step: '2',
                title: 'Refine in Passes',
                desc: 'Each pass focuses on a theme — micro/macro structure, tone, formatting. Watch stage updates via SSE.',
                img: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=1200&auto=format&fit=crop',
              },
              {
                step: '3',
                title: 'Review & Ship',
                desc: 'Compare diffs, download outputs, and review metrics. Re-run selectively to dial in quality.',
                img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1200&auto=format&fit=crop',
              },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border overflow-hidden bg-white">
                <img src={s.img} alt={s.title} className="h-40 w-full object-cover" />
                <div className="p-5">
                  <div className="text-xs text-muted-foreground">Step {s.step}</div>
                  <div className="text-lg font-medium mt-1">{s.title}</div>
                  <div className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 p-6 rounded-xl border bg-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-lg font-medium">Refine your next draft today</div>
            <div className="text-muted-foreground">Batch processing, diffs, analytics, and local outputs included.</div>
          </div>
          <a href="/pricing" className="px-4 py-2 rounded-md bg-yellow-400 text-black font-medium hover:bg-yellow-500">View Pricing</a>
        </div>
      </div>
    </div>
  )
}


