import { NextResponse } from "next/server"

export async function GET() {
  try {
    const backendUrl = process.env.REFINER_BACKEND_URL
    if (!backendUrl) {
      return NextResponse.json({ 
        status: "degraded", 
        message: "Backend not configured",
        frontend: "ok"
      })
    }
    
    // Try to reach backend
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/health`, {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ 
        ...data, 
        frontend: "ok",
        backend: "connected"
      })
    } else {
      return NextResponse.json({ 
        status: "degraded", 
        message: "Backend returned error",
        frontend: "ok",
        backend: "error",
        backendStatus: response.status
      })
    }
  } catch (error) {
    return NextResponse.json({ 
      status: "degraded", 
      message: "Backend unreachable",
      frontend: "ok",
      backend: "unreachable",
      error: error instanceof Error ? error.message : "Unknown error"
    })
  }
}
