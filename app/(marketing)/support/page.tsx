export default function SupportPage() {
  const faqs = [
    { q: 'Processing is stuck', a: 'Check the Network tab for SSE frames and ensure proxy buffering is disabled.' },
    { q: 'No pass_complete events', a: 'Verify frontend client parsing and backend keepalive yields.' },
    { q: 'Download disabled', a: 'Ensure events include outputPath or metrics.localPath.' },
  ]
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Support</h1>
      <p className="text-muted-foreground mb-8">We’re here to help. Explore FAQs or contact us.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {faqs.map((f) => (
          <div key={f.q} className="p-5 rounded-lg border bg-white">
            <div className="font-medium">{f.q}</div>
            <div className="text-muted-foreground mt-1 text-sm">{f.a}</div>
          </div>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-lg border bg-white flex items-center justify-between">
        <div>
          <div className="font-medium">Still need help?</div>
          <div className="text-muted-foreground text-sm">Our team typically responds within 24–48 hours.</div>
        </div>
        <a href="/contact" className="px-4 py-2 rounded-md bg-yellow-400 text-black font-medium hover:bg-yellow-500">Contact Support</a>
      </div>
    </div>
  )
}


