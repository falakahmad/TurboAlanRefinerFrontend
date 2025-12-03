"use client"

import Link from "next/link"

export default function CancelPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-semibold mb-2">Payment canceled</h1>
        <p className="text-muted-foreground mb-6">Your checkout was canceled. You can try again anytime.</p>
        <Link href="/" className="inline-block px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90">
          Back to pricing
        </Link>
      </div>
    </div>
  )
}





