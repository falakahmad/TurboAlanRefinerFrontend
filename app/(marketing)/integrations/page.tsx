export default function IntegrationsPage() {
  const items = [
    { name: 'Google Drive', desc: 'Import/export files from Drive.', img: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png' },
    { name: 'Stripe (optional)', desc: 'Billing integration (guarded).', img: 'https://upload.wikimedia.org/wikipedia/commons/4/41/Stripe_Logo%2C_revised_2016.svg' },
    { name: 'Custom Webhooks', desc: 'Receive completion notifications.', img: 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop' },
  ]
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Integrations</h1>
      <p className="text-muted-foreground mb-8">Connect the refiner with your tools and platforms.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((i) => (
          <div key={i.name} className="rounded-lg border bg-white p-5">
            <img src={i.img} alt={i.name} className="h-10 object-contain" />
            <div className="font-medium mt-3">{i.name}</div>
            <div className="text-muted-foreground text-sm mt-1">{i.desc}</div>
            <a href="/docs" className="inline-block mt-4 text-sm underline">Read guide</a>
          </div>
        ))}
      </div>
      <div className="mt-12 p-6 rounded-lg border bg-white">
        <div className="font-medium">Custom Webhooks</div>
        <div className="text-muted-foreground text-sm mt-1">Configure a URL to receive job completion events.</div>
        <pre className="mt-4 bg-gray-50 p-3 rounded text-xs overflow-auto">{`POST https://yourapp.com/webhooks/refiner\n{\n  "type": "complete",\n  "jobId": "...",\n  "stats": {"passes": 3}\n}`}</pre>
      </div>
    </div>
  )
}


