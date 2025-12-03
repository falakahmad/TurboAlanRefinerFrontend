export default function DevelopersApiPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl font-semibold mb-4">API</h1>
      <p className="text-muted-foreground mb-6">Programmatic access to refinement, jobs, diffs, and analytics.</p>
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-medium">POST /refine/run</div>
          <div className="text-muted-foreground">Starts a refinement job. Returns SSE stream of events.</div>
        </div>
        <div>
          <div className="font-medium">GET /jobs /jobs/{`{jobId}`}/status</div>
          <div className="text-muted-foreground">Query job lists and status.</div>
        </div>
        <div>
          <div className="font-medium">GET /refine/diff</div>
          <div className="text-muted-foreground">Get diff between two passes for a file.</div>
        </div>
      </div>
    </div>
  )
}


