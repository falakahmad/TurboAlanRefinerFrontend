"use client"

import { useEffect, useMemo, useState } from "react"

type Tier = {
  name: string
  price: string
  period?: string
  tagline: string
  cta: string
  href: string
  popular?: boolean
  features: string[]
  limits: string[]
}

interface PricingClientProps {
  baseTiers: Tier[]
}

export default function PricingClient({ baseTiers }: PricingClientProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")

  // Persist billing preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('refiner-billing')
      if (saved === 'annual' || saved === 'monthly') setBilling(saved)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('refiner-billing', billing) } catch {}
  }, [billing])

  const tiers = useMemo(() => {
    if (billing === "monthly") return baseTiers
    // Annual: ~17% discount example; display per-month price and note
    return baseTiers.map(t => {
      if (t.price === "$0" || t.price === "Custom") return t
      const numeric = parseFloat(t.price.replace(/[^0-9.]/g, "")) || 0
      const discounted = Math.round(numeric * 0.83)
      return {
        ...t,
        price: `$${discounted}`,
        period: "/mo",
        tagline: `${t.tagline} — billed annually`,
      }
    })
  }, [baseTiers, billing])

  return (
    <div>
      {/* Decorative SVG */}
      <div className="relative">
        <svg className="absolute -top-24 -right-16 w-72 h-72 opacity-20 pointer-events-none blur-2xl" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <path fill="url(#grad)" d="M47.4,-68.8C62.7,-62,75.7,-51,81.1,-37.3C86.6,-23.7,84.5,-7.4,81.1,8.4C77.6,24.1,72.7,39.3,62.9,50.7C53.1,62.2,38.3,69.9,22.9,74.2C7.6,78.5,-8.4,79.4,-24.6,76.2C-40.8,73,-57.2,65.6,-67.1,53.1C-77,40.6,-80.3,22.8,-80.4,5C-80.6,-12.8,-77.5,-30.6,-68.7,-43.5C-60,-56.4,-45.7,-64.3,-31.2,-70.8C-16.7,-77.4,-8.4,-82.6,2.1,-85.9C12.7,-89.2,25.3,-90.7,37.1,-84.6C49,-78.6,60.1,-65.9,47.4,-68.8Z" transform="translate(100 100)" />
        </svg>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <button
          onClick={() => setBilling("monthly")}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${billing==='monthly' ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling("annual")}
          className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${billing==='annual' ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
        >
          Annual (save ~17%)
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`group p-6 rounded-xl border ${t.popular ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white'} transition-transform duration-300 hover:-translate-y-1 hover:shadow-md`}
          >
            <div className="flex items-center gap-2">
              {t.popular && <div className="text-xs inline-flex px-2 py-1 rounded-full bg-yellow-400 text-black">Most Popular</div>}
              {billing === 'annual' && t.popular && (
                <div className="text-[10px] inline-flex px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Save ~17% annually</div>
              )}
            </div>
            <h2 className="text-xl font-medium mt-2">{t.name}</h2>
            <div className="flex items-end gap-1 mt-2">
              <div className="text-3xl font-semibold">{t.price}</div>
              {t.period && <div className="text-muted-foreground">{t.period}</div>}
            </div>
            <div className="text-muted-foreground mt-1">{t.tagline}</div>
            <ul className="mt-4 text-sm text-muted-foreground space-y-2">
              {t.features.map((f) => (<li key={f}>• {f}</li>))}
            </ul>
            <ul className="mt-3 text-xs text-muted-foreground space-y-1">
              {t.limits.map((f) => (<li key={f}>– {f}</li>))}
            </ul>
            <a
              href={t.href}
              className={`inline-block mt-5 px-4 py-2 rounded-md ${t.popular ? 'bg-yellow-400 text-black hover:bg-yellow-500' : 'bg-gray-900 text-white hover:bg-black'} font-medium transition-colors`}
            >
              {t.cta}
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}


