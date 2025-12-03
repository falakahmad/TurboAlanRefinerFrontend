export default function CompanyPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Company</h1>
      <p className="text-muted-foreground">Our mission is to make refined writing fast, consistent, and measurable.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {[{h:'Mission',d:'Quality at speed with transparent diffs and metrics.'},{h:'Vision',d:'Human-AI collaboration powered by trustworthy tooling.'},{h:'Values',d:'Clarity, accountability, and craft.'}].map((x)=>(
          <div key={x.h} className="p-5 rounded-lg border bg-white">
            <div className="font-medium">{x.h}</div>
            <div className="text-muted-foreground text-sm mt-1">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


