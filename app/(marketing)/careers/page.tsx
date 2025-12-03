export default function CareersPage() {
  const openings = [
    { role: "Frontend Engineer", type: "Remote" },
    { role: "Backend Engineer", type: "Remote" },
  ]
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Careers</h1>
      <p className="text-muted-foreground mb-8">Join us in building the best refinement pipeline.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {openings.map((o) => (
          <div key={o.role} className="p-5 border rounded-md bg-white">
            <div className="font-medium">{o.role}</div>
            <div className="text-muted-foreground">{o.type}</div>
          </div>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-lg border bg-white">
        <div className="font-medium">Benefits</div>
        <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
          <li>Remote-first</li>
          <li>Flexible hours</li>
          <li>Learning budget</li>
        </ul>
      </div>
    </div>
  )
}


