"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export default function SuccessPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get("session_id")
    if (sid) setSessionId(sid)
  }, [])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-semibold mb-2">Payment successful</h1>
        <p className="text-muted-foreground mb-6">Thank you! Your payment has been processed.</p>
        {sessionId && (
          <p className="text-xs text-muted-foreground mb-6">Session: {sessionId}</p>
        )}
        <Link href="/" className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}





