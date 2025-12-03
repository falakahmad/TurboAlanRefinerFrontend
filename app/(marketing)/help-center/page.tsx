export default function HelpCenterPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Help Center</h1>
      <p className="text-muted-foreground">Find answers to common questions and guides.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {[{h:'Processing stuck?'},{h:'Compare passes'},{h:'Downloads'}].map((x) => (
          <a key={x.h} href="/support" className="p-5 rounded-lg border bg-white hover:bg-gray-50">
            <div className="font-medium">{x.h}</div>
            <div className="text-muted-foreground text-sm mt-1">Read troubleshooting and how-tos.</div>
          </a>
        ))}
      </div>
    </div>
  )
}


