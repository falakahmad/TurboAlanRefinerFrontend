import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) {
    console.error("[API] /api/drive/upload: REFINER_BACKEND_URL not configured")
    return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  }
  
  try {
    // Handle both FormData (file uploads) and JSON (drive operations)
    const contentType = request.headers.get("content-type") || ""
    
    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get("file") as File
      const fileId = formData.get("file_id") as string
      
      if (!file) {
        console.error("[API] /api/drive/upload: No file provided in FormData")
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      
      console.log(`[API] /api/drive/upload: Uploading file "${file.name}" (${file.size} bytes)`)
      
      // Create a new FormData for backend
      const backendFormData = new FormData()
      backendFormData.append("file", file)
      if (fileId) backendFormData.append("file_id", fileId)
      
      const url = `${backendUrl.replace(/\/$/, "")}/files/upload`
      
      let upstream: Response
      try {
        upstream = await fetch(url, {
          method: "POST",
          headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
          body: backendFormData,
        })
      } catch (fetchError) {
        console.error("[API] /api/drive/upload: Fetch to backend failed:", fetchError)
        return NextResponse.json({ 
          error: "Failed to connect to backend", 
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }, { status: 502 })
      }
      
      // Try to parse response as JSON
      let data: any
      const responseText = await upstream.text()
      try {
        data = JSON.parse(responseText)
      } catch (jsonError) {
        console.error("[API] /api/drive/upload: Failed to parse backend response:", responseText)
        return NextResponse.json({ 
          error: "Invalid response from backend", 
          details: responseText.slice(0, 200) // Truncate for safety
        }, { status: 502 })
      }
      
      if (!upstream.ok) {
        console.error(`[API] /api/drive/upload: Backend returned error ${upstream.status}:`, data)
      } else {
        console.log(`[API] /api/drive/upload: Upload successful, file_id: ${data.file_id}`)
      }
      
      return NextResponse.json(data, { status: upstream.status })
    } else {
      // Handle JSON requests (drive operations)
      const body = await request.json()
      const url = `${backendUrl.replace(/\/$/, "")}/drive/upload`
      
      let upstream: Response
      try {
        upstream = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
          body: JSON.stringify(body),
        })
      } catch (fetchError) {
        console.error("[API] /api/drive/upload: Fetch to backend failed:", fetchError)
        return NextResponse.json({ 
          error: "Failed to connect to backend", 
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }, { status: 502 })
      }
      
      // Try to parse response as JSON
      let data: any
      const responseText = await upstream.text()
      try {
        data = JSON.parse(responseText)
      } catch (jsonError) {
        console.error("[API] /api/drive/upload: Failed to parse backend response:", responseText)
        return NextResponse.json({ 
          error: "Invalid response from backend", 
          details: responseText.slice(0, 200)
        }, { status: 502 })
      }
      
      return NextResponse.json(data, { status: upstream.status })
    }
  } catch (e) {
    console.error("[API] /api/drive/upload: Unexpected error:", e)
    return NextResponse.json({ 
      error: "upload_request_failed", 
      details: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}






