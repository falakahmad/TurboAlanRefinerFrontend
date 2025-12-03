import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")
    
    if (!filePath) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 })
    }

    // Security: Only allow downloads from specific directories
    const allowedPaths = [
      "/downloads/",
      "/output/",
      "/results/"
    ]
    
    const isAllowed = allowedPaths.some(allowedPath => filePath.startsWith(allowedPath))
    if (!isAllowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Read the file
    const fullPath = join(process.cwd(), "public", filePath)
    const fileBuffer = await readFile(fullPath)
    
    // Determine content type based on file extension
    const extension = filePath.split('.').pop()?.toLowerCase()
    let contentType = "application/octet-stream"
    
    switch (extension) {
      case "docx":
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        break
      case "pdf":
        contentType = "application/pdf"
        break
      case "txt":
        contentType = "text/plain"
        break
      case "json":
        contentType = "application/json"
        break
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filePath.split('/').pop()}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
