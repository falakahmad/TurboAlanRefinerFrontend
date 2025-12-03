import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  
  try {
    // Handle both FormData (file uploads) and JSON (drive operations)
    const contentType = request.headers.get("content-type") || ""
    
    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get("file") as File
      const fileId = formData.get("file_id") as string
      
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      
      // Create a new FormData for backend
      const backendFormData = new FormData()
      backendFormData.append("file", file)
      if (fileId) backendFormData.append("file_id", fileId)
      
      const url = `${backendUrl.replace(/\/$/, "")}/files/upload`
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
        body: backendFormData,
      })
      
      const data = await upstream.json()
      return NextResponse.json(data, { status: upstream.status })
    } else {
      // Handle JSON requests (drive operations)
      const body = await request.json()
      const url = `${backendUrl.replace(/\/$/, "")}/drive/upload`
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
        body: JSON.stringify(body),
      })
      const data = await upstream.json()
      return NextResponse.json(data, { status: upstream.status })
    }
  } catch (e) {
    return NextResponse.json({ error: "upload_request_failed" }, { status: 500 })
  }
}






