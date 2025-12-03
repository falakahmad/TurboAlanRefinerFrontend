export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">About</h1>
      <p className="text-muted-foreground">Learn about the project history and the team behind Turbo Alan Refiner.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Origin</div>
          <div className="text-muted-foreground text-sm mt-1">Built from real needs to refine long technical documents reliably.</div>
        </div>
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Today</div>
          <div className="text-muted-foreground text-sm mt-1">Full-stack pipeline with streaming UX and pass-by-pass diffs.</div>
        </div>
      </div>
    </div>
  )
}


