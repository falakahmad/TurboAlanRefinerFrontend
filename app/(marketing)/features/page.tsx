export const metadata = {
  title: 'Features – Turbo Alan Refiner',
  description: 'Production-grade features: streaming SSE, pass-by-pass metrics, batch processing, and diffs.',
}

export default function FeaturesPage() {
  const features = [
    {
      title: 'Multi-pass Refinement',
      desc: 'Apply targeted transformations over several passes to increase clarity, coherence, and consistency.',
      img: 'https://images.unsplash.com/photo-1526378722484-bd91ca387e72?q=80&w=1200&auto=format&fit=crop',
    },
    {
      title: 'Server-Sent Events',
      desc: 'Low-latency streaming with keepalive flushing and terminal markers for robust UX.',
      img: 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop',
    },
    {
      title: 'Diff Viewer',
      desc: 'Visualize differences between any two passes with clean side-by-side views.',
      img: 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?q=80&w=1200&auto=format&fit=crop',
    },
    {
      title: 'Batch & Analytics',
      desc: 'Run batches and analyze job metrics, change percent, tension, and risk reduction.',
      img: 'https://images.unsplash.com/photo-1517148815978-75f6acaaf32c?q=80&w=1200&auto=format&fit=crop',
    },
  ]
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-3">Everything you need to refine</h1>
      <p className="text-muted-foreground mb-10">Production-grade features designed for real, long-form writing workflows.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-white overflow-hidden">
            <img src={f.img} alt={f.title} className="h-44 w-full object-cover" />
            <div className="p-6">
              <div className="text-lg font-medium">{f.title}</div>
              <div className="text-muted-foreground mt-2">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {[{h:'Real-time progress'}, {h:'Pass-by-pass metrics'}, {h:'Download & share'}].map((x) => (
          <div key={x.h} className="p-5 rounded-lg border bg-white">
            <div className="font-medium">{x.h}</div>
            <div className="text-muted-foreground mt-1 text-sm">Stay in control with granular visibility and outputs you can trust.</div>
          </div>
        ))}
      </div>
    </div>
  )
}


