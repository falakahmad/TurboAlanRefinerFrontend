"use client"

import { useEffect, useMemo, useState } from "react"
import { getPriceIdAsync, initializePriceIds, isStripeAvailable, getStripeMessage } from "@/lib/stripe-config"

export default function CheckoutPage() {
  const [plan, setPlan] = useState<string>("Pro")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    if (p) setPlan(p)
    
    // Initialize price IDs on mount with timeout
    const initPromise = Promise.race([
      initializePriceIds(),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 5000)) // 5 second timeout
    ])
    
    initPromise.finally(() => {
      setInitializing(false)
    }).catch((error) => {
      console.error('Failed to initialize price IDs:', error)
      setInitializing(false)
    })
  }, [])

  const valid = useMemo(() => name && email, [name, email])

  const startCheckout = async () => {
    if (!valid) return alert('Please fill required details.')
    if (initializing) return alert('Please wait, initializing...')
    
    try {
      setLoading(true)
      
      // Check if Stripe is available
      if (!isStripeAvailable()) {
        const message = getStripeMessage() || 'Stripe payment processing is not currently available. Please install the stripe module and configure STRIPE_SECRET_KEY.'
        alert(message)
        setLoading(false)
        return
      }
      
      // Get price ID from backend (creates if doesn't exist)
      const priceId = await getPriceIdAsync(plan)
      
      if (!priceId) {
        throw new Error(`Price ID not found for plan: ${plan}. Please try again.`)
      }
      
      // Try to attach known user info from localStorage
      let userId: string | undefined
      try {
        const raw = localStorage.getItem('turbo-alan-user')
        if (raw) {
          const u = JSON.parse(raw)
          userId = u?.id
        }
      } catch {}

      // Use the frontend API route which proxies to backend
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          price_id: priceId, // Backend expects price_id
          user_id: userId || '', // Backend expects user_id (can be empty if not logged in)
          email: email,
          name: name,
          metadata: { 
            plan: plan, // Important: This is used to update user plan
            company: company || '',
            userId: userId || '',
            email: email 
          }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.detail || 'Checkout session failed')
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.assign(data.url)
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to start checkout')
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
          <button disabled={!valid || loading || initializing} onClick={startCheckout} className="px-4 py-2 rounded-md bg-yellow-400 text-black font-medium hover:bg-yellow-500 disabled:opacity-50">
            {initializing ? 'Initializing...' : loading ? 'Redirecting…' : 'Continue to Payment'}
          </button>
        </div>
        {initializing && (
          <div className="text-xs text-muted-foreground text-center">
            Setting up payment options...
          </div>
        )}
        <div className="text-xs text-muted-foreground">You will be redirected to a secure Stripe checkout to enter card details.</div>
      </div>
    </div>
  )
}


