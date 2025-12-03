"use client"

import { useEffect, useMemo, useState } from "react"

export default function CheckoutPage() {
  const [plan, setPlan] = useState<string>("Pro")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    if (p) setPlan(p)
  }, [])

  const valid = useMemo(() => name && email, [name, email])

  const startCheckout = async () => {
    if (!valid) return alert('Please fill required details.')
    try {
      setLoading(true)
      // Map plan to price ID (backend could also accept plan and resolve server-side)
      const priceMap: Record<string, string> = {
        Starter: "price_STARTER",
        Pro: "price_PROFESSIONAL",
        Enterprise: "price_ENTERPRISE",
      }
      const priceId = priceMap[plan] || priceMap['Pro']
      // Try to attach known user info from localStorage
      let userId: string | undefined
      try {
        const raw = localStorage.getItem('turbo-alan-user')
        if (raw) {
          const u = JSON.parse(raw)
          userId = u?.id
        }
      } catch {}

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, customer_email: email, metadata: { name, company, plan, userId, email } })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout session failed')
      window.location.assign(data.url)
    } catch (e: any) {
      alert(e?.message || 'Failed to start checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="text-3xl font-semibold mb-2">Checkout</h1>
      <p className="text-muted-foreground mb-8">Add your details and continue to secure payment.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Plan</label>
          <select className="w-full border rounded px-3 py-2" value={plan} onChange={(e)=>setPlan(e.target.value)}>
            <option>Starter</option>
            <option>Pro</option>
            <option>Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Full name</label>
          <input className="w-full border rounded px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Ada Lovelace" />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input className="w-full border rounded px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="ada@example.com" />
        </div>
        <div>
          <label className="block text-sm mb-1">Company (optional)</label>
          <input className="w-full border rounded px-3 py-2" value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Analytical Engines, Inc." />
        </div>
        <div className="pt-2">
          <button disabled={!valid || loading} onClick={startCheckout} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-medium hover:bg-yellow-500 disabled:opacity-50">
            {loading ? 'Redirecting…' : 'Continue to Payment'}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">You will be redirected to a secure Stripe checkout to enter card details.</div>
      </div>
    </div>
  )
}


