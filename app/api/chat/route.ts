import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json({ 
      error: "Backend not configured", 
      message: "REFINER_BACKEND_URL environment variable is not set",
      reply: "I can answer questions about refinement, schema, and risk reduction."
    }, { status: 503 })
  }
  
  try {
    const body = await request.json()
    const url = `${backendUrl.replace(/\/$/, "")}/chat`
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
      body: JSON.stringify(body),
    })
    
    if (!upstream.ok) {
      const errorText = await upstream.text()
      return NextResponse.json({ 
        error: "Backend request failed", 
        message: `Backend returned ${upstream.status}: ${errorText}`,
        reply: "I can answer questions about refinement, schema, and risk reduction."
      }, { status: upstream.status })
    }
    
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({ 
      error: "Failed to process chat request", 
      message: error instanceof Error ? error.message : "Unknown error occurred",
      reply: "I can answer questions about refinement, schema, and risk reduction."
    }, { status: 500 })
  }
}


