import { NextRequest, NextResponse } from "next/server"
import path from "path"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    let filePath = searchParams.get("path")

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      )
    }

    // Extract filename from path (handle both relative and absolute paths)
    // Examples: "./output/tmp1f1dhgnh_pass1.pdf", "output/tmp1f1dhgnh_pass1.pdf", "/tmp/output/tmp1f1dhgnh_pass1.pdf"
    const fileName = path.basename(filePath)
    
    // Security: Only allow alphanumeric, dots, hyphens, underscores in filename
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName) || fileName.startsWith('.')) {
      return NextResponse.json(
        { error: "Invalid filename" },
        { status: 400 }
      )
    }

    // Get backend URL from environment
    const backendUrl = process.env.REFINER_BACKEND_URL || process.env.NEXT_PUBLIC_REFINER_BACKEND_URL
    
    if (!backendUrl) {
      console.error("REFINER_BACKEND_URL not configured")
      return NextResponse.json(
        { error: "Backend not configured" },
        { status: 500 }
      )
    }

    // Proxy request to backend
    const backendDownloadUrl = `${backendUrl}/files/serve?filename=${encodeURIComponent(fileName)}`
    
    try {
      const backendResponse = await fetch(backendDownloadUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
      })

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text()
        console.error(`Backend download failed: ${backendResponse.status} - ${errorText}`)
        return NextResponse.json(
          { error: `Download failed: ${errorText || backendResponse.statusText}` },
          { status: backendResponse.status }
        )
      }

      // Get the file content as a blob
      const fileBuffer = await backendResponse.arrayBuffer()
      
      // Get content type from backend response, or infer from filename
      const contentType = backendResponse.headers.get('content-type') || 
        (fileName.endsWith('.pdf') ? 'application/pdf' :
         fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
         fileName.endsWith('.txt') ? 'text/plain; charset=utf-8' :
         fileName.endsWith('.md') ? 'text/markdown; charset=utf-8' :
         fileName.endsWith('.json') ? 'application/json; charset=utf-8' :
         'application/octet-stream')

      // Get content disposition from backend or create one
      const contentDisposition = backendResponse.headers.get('content-disposition') || 
        `attachment; filename="${fileName.replace(/"/g, '\\"')}"`

      // Return the file as a download with proper headers
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
          "Content-Length": fileBuffer.byteLength.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "X-Content-Type-Options": "nosniff",
        },
      })
    } catch (fetchError) {
      console.error("Failed to fetch from backend:", fetchError)
      return NextResponse.json(
        { error: `Failed to download file: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("File download error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download file" },
      { status: 500 }
    )
  }
}

