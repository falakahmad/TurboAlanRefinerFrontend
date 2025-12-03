export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Contact</h1>
      <p className="text-muted-foreground mb-6">Have questions? Reach out to the team.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Support</div>
          <div className="text-muted-foreground text-sm mt-1">support@example.com</div>
        </div>
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Sales</div>
          <div className="text-muted-foreground text-sm mt-1">sales@example.com</div>
        </div>
      </div>
    </div>
  )
}


