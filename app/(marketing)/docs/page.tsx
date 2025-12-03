export default function DocumentationPage() {
  const links = [
    { t: 'Quickstart', d: 'Install frontend & backend, run locally, first refinement.', href: 'https://github.com' },
    { t: 'Refinement Pipeline', d: 'Pass structure, metrics, and strategies.', href: 'https://github.com' },
    { t: 'Streaming & Events', d: 'SSE frames, terminal markers, and proxies.', href: 'https://github.com' },
    { t: 'Diffs & File Versions', d: 'How versions are stored and diffs are generated.', href: 'https://github.com' },
  ]
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Documentation</h1>
      <p className="text-muted-foreground mb-8">Everything you need to install, run, and integrate.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {links.map((l) => (
          <a key={l.t} href={l.href} className="p-6 rounded-lg border bg-white hover:bg-gray-50">
            <div className="font-medium">{l.t}</div>
            <div className="text-muted-foreground mt-1 text-sm">{l.d}</div>
          </a>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-lg border bg-white">
        <div className="font-medium">SSE Event Example</div>
        <pre className="mt-3 bg-gray-50 p-3 rounded text-xs overflow-auto">{`data: {"type":"pass_complete","jobId":"...","fileId":"...","pass":2,"metrics":{...}}\n\n`}</pre>
      </div>
    </div>
  )
}


