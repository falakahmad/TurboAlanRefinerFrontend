export default function PrivacyPage() {
  return (
    <div className="max-w-6xl mx-auto py-16 px-6">
      <h1 className="text-3xl md:text-4xl font-semibold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground">We minimize data collection and avoid logging sensitive content.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Data Handling</div>
          <div className="text-muted-foreground text-sm mt-1">Local outputs by default. No 3rd-party storage unless configured.</div>
        </div>
        <div className="p-5 rounded-lg border bg-white">
          <div className="font-medium">Security</div>
          <div className="text-muted-foreground text-sm mt-1">Optional API key enforcement. Validate and sanitize input paths.</div>
        </div>
      </div>
    </div>
  )
}


