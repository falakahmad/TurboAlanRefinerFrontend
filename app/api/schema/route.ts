import { NextResponse } from "next/server"

export async function GET() {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ commands: {}, descriptions: {}, categories: {} })
  try {
    const url = `${backendUrl.replace(/\/$/, "")}/schema`
    const upstream = await fetch(url, { cache: "no-store", headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" } })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ commands: {}, descriptions: {}, categories: {} }, { status: 200 })
  }
}











