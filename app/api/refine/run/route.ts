import { type NextRequest, NextResponse } from "next/server"

// Force Node.js runtime for streaming SSE (edge runtime has streaming limitations)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Increase max duration for large files (Vercel allows up to 300s on Hobby, 900s on Pro)
export const maxDuration = 300 // 5 minutes for initial connection

interface RefineRequest {
  files: Array<{
    id: string
    name: string
    type: "local" | "drive"
    source?: string
    driveId?: string
    backendFileId?: string  // Backend's file_id from upload response
  }>
  output: {
    type: "local" | "drive"
    dir?: string
    folderId?: string
  }
  passes: number
  earlyStop: boolean
  aggressiveness: string
  scannerRisk?: number
  keywords: string[]
  schemaLevels: Record<string, number>
  // MVP extension: optional strategy mode passthrough
  strategy_mode?: "model" | "rules"
  // Optional knobs forwarded to backend
  entropy?: {
    risk_preference: number
    repeat_penalty: number
    phrase_penalty: number
  }
  formatting_safeguards?: {
    enabled?: boolean
    mode: "smart" | "strict"
  }
  // Preset profile for quick configuration
  preset?: string
}

interface PassState {
  passNumber: number
  stage: "read" | "prep" | "refine" | "post" | "write" | "upload"
  status: "pending" | "running" | "completed" | "error"
  startTime?: number
  endTime?: number
  metrics?: PassMetrics
}

interface PassMetrics {
  changePercent: number
  tensionPercent: number
  normalizedLatency: number
  previousPassRisk: number
  punctuationPer100Words: number
  sentences: number
  transitions: number
  rhythmCV: number
  keywords: number
  synonymRate: number
  grammarIssues: number
  editsPer100Words: number
}

interface StageState {
  name: string
  status: "pending" | "running" | "completed" | "error"
  duration?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: RefineRequest = await request.json()

    // Normalize request for backend compatibility
    const normalizedBody: any = {
      ...body,
      // Backend expects output_settings; map from our output
      output_settings: body.output
        ? {
            type: body.output.type,
            path: body.output.dir,
            folder_id: body.output.folderId,
          }
        : { type: "local", path: "./output" },
    }

    const backendUrl = process.env.REFINER_BACKEND_URL
    console.log("[API] /api/refine/run START", { 
      hasBackendUrl: !!backendUrl, 
      backendUrl: backendUrl || 'NOT SET',
      mode: backendUrl ? 'proxy' : 'mock'
    })
    if (backendUrl) {
      // Attempt to resolve authenticated user for attribution
      let usageUserId: string | null = null
      try {
        // Prefer Authorization bearer, fallback to cookie 'refiner_auth'
        const authHeader = request.headers.get('authorization')
        const cookieHeader = request.headers.get('cookie') || ''
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (cookieHeader.split(';').map(s=>s.trim()).find(s=>s.startsWith('refiner_auth='))||'').split('=')[1]
        if (token) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const jwt = require('jsonwebtoken')
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production') as any
          usageUserId = decoded?.userId || null
          // If only email is present, try to resolve to users.id
          if (!usageUserId && decoded?.email) {
            try {
              const response = await fetch(`${process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/api/mongodb/users?email=${encodeURIComponent(decoded.email)}`)
              if (response.ok) {
                const data = await response.json()
                if (data?.user?.id) usageUserId = data.user.id
              }
            } catch {}
          }
        }
      } catch {}
      console.log("[API] /api/refine/run → proxy mode", { hasBackend: true })
      // Proxy to backend SSE endpoint if configured
      const url = `${backendUrl.replace(/\/$/, "")}/refine/run`
      // Increase timeout significantly for large files (10 minutes for initial connection)
      // The SSE stream itself can run longer, but we need time for the initial connection
      const abortController = new AbortController()
      const connectionTimeout = setTimeout(() => {
        console.warn("[API] /api/refine/run connection timeout after 10 minutes")
        abortController.abort()
      }, 600000) // 10 minutes for initial connection
      
      let upstream: Response
      try {
        console.log("[API] /api/refine/run connecting to backend...")
        upstream = await fetch(url, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "X-API-Key": process.env.BACKEND_API_KEY || "",
            "Connection": "keep-alive"
          },
          body: JSON.stringify(normalizedBody),
          signal: abortController.signal,
          // Don't timeout the fetch itself - let the abort controller handle it
        })
        clearTimeout(connectionTimeout)
        console.log("[API] /api/refine/run connected, status:", upstream.status)
      } catch (fetchError: any) {
        clearTimeout(connectionTimeout)
        console.error("[API] /api/refine/run fetch error or timeout", fetchError)
        const isTimeout = fetchError?.name === 'AbortError' || fetchError?.message?.includes('timeout')
        return NextResponse.json({ 
          error: isTimeout ? "Backend connection timeout - file may be too large or backend is slow to respond" : "Backend connection failed",
          details: fetchError?.message || "Check backend logs"
        }, { status: isTimeout ? 504 : 502 })
      }
      console.log("[API] /api/refine/run upstream status", { status: upstream.status, ok: upstream.ok })
      if (!upstream.ok || !upstream.body) {
        // Try to get error details from response
        let errorDetails: any = { error: "Backend refine failed" }
        try {
          const errorText = await upstream.text()
          if (errorText) {
            try {
              errorDetails = JSON.parse(errorText)
            } catch {
              errorDetails = { error: errorText.slice(0, 200) } // Truncate for safety
            }
          }
        } catch (e) {
          // If we can't read the error, use default
        }
        
        console.error(`[API] /api/refine/run backend error ${upstream.status}:`, errorDetails)
        return NextResponse.json(errorDetails, { status: upstream.status || 502 })
      }
      // Optional: write a system log that a refine run started
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/api/mongodb/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: usageUserId, action: 'refine_start', details: `files=${(body.files||[]).length}, passes=${body.passes}` })
        })
      } catch {}

      // Accumulators for usage stats
      let totalTokensInUsed = 0
      let totalCost = 0
      let totalRequests = 0

      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstream.body!.getReader()
          let chunkCount = 0
          let sawTerminal = false
          const decoder = new TextDecoder()
          let buffer = ""
          let lastChunkTime = Date.now()
          const STREAM_TIMEOUT = 30 * 60 * 1000 // 30 minutes for stream processing
          
          // Set up a watchdog to detect if stream stalls
          const streamWatchdog = setInterval(() => {
            const timeSinceLastChunk = Date.now() - lastChunkTime
            if (timeSinceLastChunk > STREAM_TIMEOUT) {
              console.warn("[API] /api/refine/run stream stalled, closing")
              clearInterval(streamWatchdog)
              reader.cancel()
              controller.close()
            }
          }, 60000) // Check every minute
          
          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              if (value) {
                lastChunkTime = Date.now() // Update last chunk time
                controller.enqueue(value)
                // Accumulate usage stats by parsing SSE lines
                try {
                  buffer += decoder.decode(value, { stream: true })
                  const parts = buffer.split('\n')
                  buffer = parts.pop() || ""
                  for (const raw of parts) {
                    const line = raw.trim()
                    if (!line) continue
                    const clean = line.startsWith('data: ') ? line.slice(6) : line
                    if (!clean || clean.startsWith(':')) continue
                    try {
                      const ev = JSON.parse(clean)
                      if (ev && ev.type === 'pass_complete') {
                        const met = ev.metrics || {}
                        const cost = ev.cost || {}
                        const usedIn = Number(met.inputTokensUsed || 0)
                        const passCost = Number(cost.totalCost || 0)
                        const reqs = Number(cost.requestCount || 0)
                        totalTokensInUsed += isNaN(usedIn) ? 0 : usedIn
                        totalCost += isNaN(passCost) ? 0 : passCost
                        totalRequests += isNaN(reqs) ? 0 : reqs
                      }
                    } catch {}
                  }
                } catch {}
                chunkCount++
                if (chunkCount % 10 === 0) {
                  console.log(`[API] /api/refine/run forwarded ${chunkCount} chunks`)
                }
              }
            }
            // Append terminal marker to help client detect completion when proxying
            const enc = new TextEncoder()
            controller.enqueue(enc.encode(": proxy-complete\n\n"))
            console.log(`[API] /api/refine/run proxy complete appended (total chunks: ${chunkCount})`)
            sawTerminal = true
            clearInterval(streamWatchdog)
          } catch (e) {
            // emit error event frame to client
            const enc = new TextEncoder()
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", error: "proxy_stream_error", details: e instanceof Error ? e.message : String(e) })}\n\n`))
            console.warn("[API] /api/refine/run proxy stream error", e)
            clearInterval(streamWatchdog)
          } finally {
            clearInterval(streamWatchdog)
            controller.close()
            // Log completion event
            try {
              await fetch(`${process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/api/mongodb/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: usageUserId, action: sawTerminal ? 'refine_complete' : 'refine_stream_error', details: `chunks=${chunkCount}` })
              })
              // Note: Usage stats are handled by the backend MongoDB service
            } catch {}
          }
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable nginx buffering
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    // Fallback: local mock simulator (no backend configured)
    console.log("[API] /api/refine/run → mock mode (no backend URL configured)")
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        processFiles(body, controller, encoder)
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[API] /api/refine/run error", error)
    return NextResponse.json({ 
      error: "Failed to process request", 
      message: error instanceof Error ? error.message : "Unknown error occurred",
      details: "Check server logs for more information"
    }, { status: 500 })
  }
}

async function processFiles(request: RefineRequest, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  try {
    for (const file of request.files) {
      await processFile(file, request, controller, encoder)
    }

    // Send completion event
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "complete",
          message: "All files processed successfully",
        })}\n\n`,
      ),
    )

    controller.close()
  } catch (error) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "error",
          error: "Processing failed",
          details: error instanceof Error ? error.message : "Unknown error",
        })}\n\n`,
      ),
    )
    controller.close()
  }
}

async function processFile(
  file: any,
  request: RefineRequest,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const stages: StageState[] = [
    { name: "read", status: "pending" },
    { name: "prep", status: "pending" },
    { name: "refine", status: "pending" },
    { name: "post", status: "pending" },
    { name: "write", status: "pending" },
    { name: "upload", status: "pending" },
  ]

  // Map strategy_mode to a simple heuristics hint in logs (in a real app, forward to backend service)
  if (request.strategy_mode) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({ type: "info", message: `strategy_mode=${request.strategy_mode}` })}\n\n`,
      ),
    )
  }

  for (let pass = 1; pass <= request.passes; pass++) {
    // Send pass start event
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "pass_start",
          fileId: file.id,
          fileName: file.name,
          pass: pass,
          totalPasses: request.passes,
        })}\n\n`,
      ),
    )

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      const startTime = Date.now()

      // Update stage to running
      stage.status = "running"
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "stage_update",
            fileId: file.id,
            pass: pass,
            stage: stage.name,
            status: "running",
          })}\n\n`,
        ),
      )

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000 + 500))

      const endTime = Date.now()
      stage.duration = endTime - startTime
      stage.status = "completed"

      // Send stage completion
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "stage_update",
            fileId: file.id,
            pass: pass,
            stage: stage.name,
            status: "completed",
            duration: stage.duration,
          })}\n\n`,
        ),
      )
    }

    // Emit a mock plan/knobs snapshot once per file at the end of prep
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "plan",
          weights: { clarity: 0.6, persuasion: 0.25, brevity: 0.25, formality: 0.6 },
          entropy: request.entropy || { risk_preference: 0.5, repeat_penalty: 0.0, phrase_penalty: 0.0 },
          formatting: request.formatting_safeguards?.mode || "smart",
        })}\n\n`,
      ),
    )

    // Generate mock metrics for this pass
    const metrics: PassMetrics = {
      changePercent: Math.random() * 30 + 10,
      tensionPercent: Math.random() * 20 + 5,
      normalizedLatency: Math.random() * 100 + 50,
      previousPassRisk: Math.max(0, (request.scannerRisk || 15) - pass * 5),
      punctuationPer100Words: Math.random() * 10 + 15,
      sentences: Math.floor(Math.random() * 50 + 20),
      transitions: Math.floor(Math.random() * 15 + 5),
      rhythmCV: Math.random() * 0.3 + 0.1,
      keywords: request.keywords.length,
      synonymRate: Math.random() * 0.4 + 0.2,
      grammarIssues: Math.floor(Math.random() * 5),
      editsPer100Words: Math.random() * 20 + 10,
    }

    // Send pass completion with metrics
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "pass_complete",
          fileId: file.id,
          pass: pass,
          metrics: metrics,
          outputPath: `refined_${file.name}_pass${pass}.docx`,
        })}\n\n`,
      ),
    )

    // Check early stop condition
    if (request.earlyStop && metrics.previousPassRisk <= (request.scannerRisk || 15)) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "early_stop",
            fileId: file.id,
            pass: pass,
            reason: "Target scanner risk achieved",
          })}\n\n`,
        ),
      )
      break
    }
  }
}
