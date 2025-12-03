export default function StatusPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Status</h1>
      <p className="text-muted-foreground">All systems operational.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {[{k:'API',s:'Operational'},{k:'Streaming',s:'Operational'},{k:'Storage',s:'Operational'}].map((x)=>(
          <div key={x.k} className="p-5 rounded-lg border bg-white">
            <div className="font-medium">{x.k}</div>
            <div className="text-green-600 mt-1">{x.s}</div>
          </div>
        ))}
      </div>
    </div>
  )
}


