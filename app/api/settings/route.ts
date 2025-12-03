import { type NextRequest, NextResponse } from "next/server"

interface Settings {
  openaiApiKey: string
  openaiModel: string
  targetScannerRisk: number
  minWordRatio: number
  googleDriveConnected: boolean
  defaultOutputLocation: string
  schemaDefaults: Record<string, number>
  strategyMode?: "model" | "rules"
}

export async function GET() {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (backendUrl) {
    try {
      const url = `${backendUrl.replace(/\/$/, "")}/settings`
      const upstream = await fetch(url, { cache: "no-store", headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" } })
      if (upstream.ok) {
        const data = await upstream.json()
        return NextResponse.json(data)
      }
    } catch (e) {
      // fall through to mock
    }
  }
  // Fallback mock
  const mockSettings: Settings = {
    openaiApiKey: "sk-***",
    openaiModel: "gpt-4",
    targetScannerRisk: 15,
    minWordRatio: 0.8,
    googleDriveConnected: true,
    defaultOutputLocation: "local",
    schemaDefaults: {
      microstructure_control: 2,
      macrostructure_analysis: 1,
      anti_scanner_techniques: 3,
      entropy_management: 2,
      semantic_tone_tuning: 1,
      formatting_safeguards: 3,
      refiner_control: 2,
      history_analysis: 1,
      annotation_mode: 0,
      humanize_academic: 2,
    },
    strategyMode: "model",
  }

  return NextResponse.json(mockSettings)
}

export async function POST(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  try {
    const settings: Partial<Settings> = await request.json()

    if (backendUrl) {
      // Proxy to backend settings save
      const url = `${backendUrl.replace(/\/$/, "")}/settings`
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
        body: JSON.stringify(settings),
      })
      if (upstream.ok) {
        const data = await upstream.json().catch(() => ({ success: true }))
        return NextResponse.json(data)
      }
      return NextResponse.json({ error: "Backend settings save failed" }, { status: upstream.status || 502 })
    }

    // Fallback: accept and pretend-succeed in mock mode
    console.log("Saving settings (mock):", settings)
    return NextResponse.json({ success: true, message: "Settings saved successfully" })
  } catch (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
