export interface RefineRequest {
  files: Array<{
    id: string
    name: string
    type: "local" | "drive"
    source?: string
    driveId?: string
    textContent?: string // Added for resume capability
  }>
  output: {
    type: "local" | "drive"
    dir?: string
    folderId?: string
  }
  passes: number
  startPass?: number // Added for resume capability
  earlyStop: boolean
  aggressiveness: string
  scannerRisk?: number
  keywords: string[]
  schemaLevels: Record<string, number>
  // Optional overrides understood by backend
  heuristics?: any
  // Extended properties for MVP
  strategy_mode?: "model" | "rules"
  entropy?: {
    risk_preference: number
    repeat_penalty: number
    phrase_penalty: number
  }
  formatting_safeguards?: {
    enabled: boolean
    mode: "smart" | "strict"
  }
  history_analysis?: {
    enabled: boolean
  }
  refiner_dry_run?: boolean
  annotation_mode?: {
    enabled: boolean
    mode: "inline" | "sidecar"
    verbosity: "low" | "medium" | "high"
  }
}

export interface PassMetrics {
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
  // Backend extended fields
  scannerRisk?: number
  processingTime?: number
  localPath?: string
  success?: boolean
  docId?: string
  originalLength?: number
  finalLength?: number
}

export interface ProcessingEvent {
  type: "job" | "pass_start" | "stage_update" | "pass_complete" | "early_stop" | "complete" | "error" | "stream_end"
  jobId?: string
  fileId?: string
  fileName?: string
  pass?: number
  totalPasses?: number
  stage?: string
  status?: string
  duration?: number
  metrics?: PassMetrics
  outputPath?: string
  reason?: string
  message?: string
  error?: string
  details?: string
}

export class RefinerClient {
  private baseUrl: string

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl
  }

  async sendStrategyFeedback(feedback: {
    weights: { clarity: number; persuasion: number; brevity: number; formality: number }
    thumbs: "up" | "down"
    fileId?: string
    pass?: number
    rationale?: string
  }) {
    const response = await fetch(`${this.baseUrl}/strategy/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async startRefinement(request: RefineRequest, onEvent: (event: ProcessingEvent) => void): Promise<void> {
    // debug: request start (removed verbose logs in production)
    const response = await fetch(`${this.baseUrl}/refine/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      // debug: http error suppressed from console
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let jobId: string | undefined
    let ws: WebSocket | null = null
    let pollTimer: any = null
    let isTerminated = false

    const stopRealtime = () => {
      isTerminated = true
      // debug: stopRealtime
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        try { ws.close() } catch {}
      }
    }

    const startPolling = () => {
      if (!jobId || isTerminated) return
      // debug: startPolling
      const poll = async () => {
        if (isTerminated) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        try {
          const res = await fetch(`${this.baseUrl}/jobs/${jobId}/status`, { cache: "no-store" })
          if (res.ok) {
            const evt = (await res.json()) as ProcessingEvent
            if (evt && evt.type) {
              // debug: polling event
              onEvent(evt)
              // Only stop on true terminal events, not stream_end
              if (evt.type === "complete" || evt.type === "error") {
                // debug: polling terminal
                stopRealtime()
              }
            }
          }
        } catch (e) {
          // debug: polling error
        }
      }
      pollTimer = setInterval(poll, 2000)
    }

    let buffer = ""
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        
        buffer += chunk
        const lines = buffer.split("\n")
        
        
        
        // Keep the last line in buffer (might be incomplete)
        buffer = lines.pop() || ""
        
        

        for (const raw of lines) {
          let line = raw
          if (!line) continue
          // Normalize Windows newlines and trim once
          line = line.replace(/\r/g, "").trim()
          if (!line) continue
          // Ignore SSE comments/heartbeats
          if (line.startsWith(":")) continue
          
          // Strip accidental double data: prefix added by proxying layers (e.g., Next.js)
          let cleanLine = line
          if (line.startsWith("data: data: ")) {
            cleanLine = line.replace("data: data: ", "data: ")
            
          }
          // Recognize backend SSE terminal markers - but DON'T exit immediately
          if (cleanLine === 'event: done' || cleanLine === 'event: error' || cleanLine === ': stream-complete' || cleanLine === ': proxy-complete') {
            
            // Emit a corresponding event
            const mapped: any =
              cleanLine === 'event: error' ? { type: 'error', message: 'stream error' } :
              { type: cleanLine.includes('error') ? 'error' : (cleanLine.includes('done') ? 'complete' : 'stream_end') }
            try { onEvent(mapped) } catch {}
            // DON'T call stopRealtime() or return here! Let the stream process all buffered events first
            continue  // Skip to next line in this iteration
          }
          // Support both SSE-formatted ("data: {...}") and raw JSON lines
          // Collapse any leading 'data:' prefixes and extra spaces
          const payload = cleanLine.replace(/^data:\s*/i, "").trim()
          if (!payload) continue
          try {
            const anyEvent: any = JSON.parse(payload)
            // First event from backend is job id => open WS
            if (anyEvent.type === "job" && anyEvent.jobId && !jobId) {
                jobId = anyEvent.jobId
                
                // Try to open WS to backend directly (bypass Next.js)
                try {
                  const backend = process.env.NEXT_PUBLIC_REFINER_BACKEND_WS_URL || (this.baseUrl ? this.baseUrl : "")
                  if (backend) {
                    // Detect if page is HTTPS and force secure WebSocket
                    const isSecure = typeof window !== "undefined" && window.location.protocol === "https:"
                    
                    // Convert http:// to ws:// and https:// to wss://
                    // If page is HTTPS, always use wss:// regardless of backend URL protocol
                    let wsBase = backend.replace(/\/$/, "")
                    if (isSecure) {
                      // Force secure WebSocket for HTTPS pages
                      wsBase = wsBase.replace(/^https?:\/\//, "wss://")
                    } else {
                      // Use protocol from backend URL for HTTP pages
                      wsBase = wsBase
                        .replace(/^https:\/\//, "wss://")
                        .replace(/^http:\/\//, "ws://")
                    }
                    const wsUrl = `${wsBase}/ws/progress/${jobId}`
                    
                    // Small delay to ensure backend is ready
                    await new Promise(resolve => setTimeout(resolve, 100))
                    
                    ws = new WebSocket(wsUrl)
                    let wsConnected = false
                    
                    ws.onopen = () => {
                      wsConnected = true
                      console.log(`WebSocket connected for job ${jobId}`)
                    }
                    
                    ws.onmessage = (m) => {
                      try {
                        const e = JSON.parse(String(m.data))
                        if (e && e.type) {
                          // Ignore heartbeat messages to reduce noise
                          if (e.type !== "heartbeat") {
                          onEvent(e)
                          }
                          // Don't stop here - stream cleanup handles it
                        }
                      } catch (err) {
                        console.warn("Failed to parse WebSocket message:", err)
                      }
                    }
                    
                    ws.onerror = (error) => {
                      console.warn(`WebSocket error for job ${jobId}:`, error)
                      // Only fallback to polling if connection never established
                      if (!wsConnected && !isTerminated && !pollTimer) {
                        console.log("Falling back to polling due to WebSocket error")
                        startPolling()
                      }
                    }
                    
                    ws.onclose = (closeEvent) => {
                      console.log(`WebSocket closed for job ${jobId}, code: ${closeEvent.code}, reason: ${closeEvent.reason}`)
                      wsConnected = false
                      // Only poll on abnormal close (not normal closure) and not terminated
                      if (!isTerminated && !pollTimer && closeEvent.code !== 1000 && closeEvent.code !== 1001) {
                        console.log("Falling back to polling due to abnormal WebSocket close")
                        startPolling()
                      }
                    }
                  } else {
                    // No backend URL exposed for WS, fallback
                    console.log("No backend WebSocket URL configured, using polling")
                    if (!isTerminated && !pollTimer) startPolling()
                  }
                } catch {
                  
                  if (!isTerminated && !pollTimer) startPolling()
                }
            }
            onEvent(anyEvent as ProcessingEvent)
            // Don't stop here - let the stream finish naturally
          } catch (e) {
            // Ignore non-JSON keepalive/heartbeat lines
          }
        }
      }
      
      // Process any remaining buffer
      if (buffer.trim()) {
        
        const lines = buffer.split("\n")
        for (const raw of lines) {
          const line = raw.trim()
          const payload = line.startsWith("data: ") ? line.slice(6).trim() : line
          if (!payload) continue
          try {
            const event: any = JSON.parse(payload)
            onEvent(event as ProcessingEvent)
            // Don't stop here - cleanup happens in finally block
          } catch (e) {
            
          }
        }
      }
    } finally {
      
      stopRealtime()
      reader.releaseLock()
    }
  }

  async getDiff(fileId: string, fromPass: number, toPass: number, mode: "sentence" | "word" = "sentence") {
    const response = await fetch(
      `${this.baseUrl}/refine/diff?fileId=${fileId}&fromPass=${fromPass}&toPass=${toPass}&mode=${mode}`,
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getSettings() {
    const response = await fetch(`${this.baseUrl}/settings`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getJobs() {
    const response = await fetch(`${this.baseUrl}/jobs`, { cache: "no-store" })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async getJobStatus(jobId: string) {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}/status`, { cache: "no-store" })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async getSchema() {
    const response = await fetch(`${this.baseUrl}/schema`, { cache: "no-store" })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async memoryLogPass(payload: { user_id: string; original_text: string; refined_text: string; score?: number; notes?: string[] }) {
    const response = await fetch(`${this.baseUrl}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log_pass", ...payload }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async memoryGetHistory(user_id: string) {
    const response = await fetch(`${this.baseUrl}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_history", user_id }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async memoryClearHistory(user_id: string) {
    const response = await fetch(`${this.baseUrl}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_history", user_id }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async memoryRefineWithFeedback(payload: { user_id: string; original_text: string; heuristics?: any; flags?: Record<string, any> }) {
    const response = await fetch(`${this.baseUrl}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refine_with_feedback", ...payload }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async getMemoryStats(userId: string) {
    const response = await fetch(`${this.baseUrl}/memory/${userId}/stats`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async exportMemory(userId: string) {
    const response = await fetch(`${this.baseUrl}/memory/${userId}/export`, { method: "POST" })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async importMemory(userId: string, memoryData: any) {
    const response = await fetch(`${this.baseUrl}/memory/${userId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memoryData),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  // Google Drive Integration
  async listDriveFiles(folderId: string = "root", limit: number = 100) {
    const response = await fetch(`${this.baseUrl}/drive/files?folder_id=${folderId}&limit=${limit}`)
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        // If response is not JSON, use default message
      }
      throw new Error(errorMessage)
    }
    return response.json()
  }

  async getDriveFileInfo(fileId: string) {
    const response = await fetch(`${this.baseUrl}/drive/files/${fileId}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async downloadDriveFile(fileId: string, outputFormat: string = "docx") {
    const response = await fetch(`${this.baseUrl}/drive/files/${fileId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, output_format: outputFormat }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async uploadToDrive(fileId: string, folderId: string = "root", title?: string) {
    const response = await fetch(`${this.baseUrl}/drive/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, folder_id: folderId, title }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async listDriveFolders() {
    const response = await fetch(`${this.baseUrl}/drive/folders`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async checkDriveAuth() {
    const response = await fetch(`${this.baseUrl}/drive/auth`, { method: "POST" })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  // Advanced Pipeline Operations
  async analyzeText(text: string, analysisTypes: string[] = ["microstructure", "macrostructure", "keywords", "structure"]) {
    const response = await fetch(`${this.baseUrl}/pipeline/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, analysis_types: analysisTypes }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async applyTransform(text: string, transformType: string, parameters: Record<string, any> = {}) {
    const response = await fetch(`${this.baseUrl}/pipeline/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, transform_type: transformType, parameters }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async validateText(text: string, validateMarkdown: boolean = true, validateStructure: boolean = true) {
    const response = await fetch(`${this.baseUrl}/pipeline/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, validate_markdown: validateMarkdown, validate_structure: validateStructure }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async analyzeEntropy(text: string, currentEntropy: string = "medium", targetMetrics: Record<string, number> = {}) {
    const response = await fetch(`${this.baseUrl}/pipeline/entropy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, current_entropy: currentEntropy, target_metrics: targetMetrics }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  // Text Annotations & Processing
  async generateAnnotations(text: string, verbosity: string = "low") {
    const response = await fetch(`${this.baseUrl}/text/annotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, verbosity }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async injectAnnotations(text: string, annotations: any[], verbosity: string = "low") {
    const response = await fetch(`${this.baseUrl}/text/inject-annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, annotations, verbosity }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async analyzeStructure(text: string, analysisDepth: string = "medium") {
    const response = await fetch(`${this.baseUrl}/text/analyze-structure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, analysis_depth: analysisDepth }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async validateKeywords(text: string, keywords: string[] = [], maxRepeats: number = 2) {
    const response = await fetch(`${this.baseUrl}/text/validate-keywords`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, keywords, max_repeats: maxRepeats }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  // Style Management
  async extractStyleSkeleton(fileId: string, outputFormat: string = "json") {
    const response = await fetch(`${this.baseUrl}/style/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, output_format: outputFormat }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async applyStyleSkeleton(text: string, styleSkeleton: any, outputPath?: string) {
    const response = await fetch(`${this.baseUrl}/style/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, style_skeleton: styleSkeleton, output_path: outputPath }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async getStyleSequence(fileId: string) {
    const response = await fetch(`${this.baseUrl}/style/sequence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async listStyleTemplates() {
    const response = await fetch(`${this.baseUrl}/style/templates`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async queueJob(request: RefineRequest) {
    const response = await fetch(`${this.baseUrl}/jobs/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async cancelJob(jobId: string) {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}/cancel`, {
      method: "POST",
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async retryJob(jobId: string, request: RefineRequest) {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

  async saveSettings(settings: any) {
    const response = await fetch(`${this.baseUrl}/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getLogs(lines = 100) {
    const response = await fetch(`${this.baseUrl}/logs?lines=${lines}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getAnalytics(userId?: string) {
    let url = `${this.baseUrl}/analytics/summary`
    if (userId) {
      url += `?user_id=${encodeURIComponent(userId)}`
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
  }

}

// Export a default instance
// In the browser: ALWAYS go through Next proxy (/api) to avoid CORS and ensure headers
// On the server (SSR/build): use configured backend URL
export const refinerClient = new RefinerClient(
  typeof window !== "undefined" ? "/api" : (process.env.NEXT_PUBLIC_REFINER_BACKEND_URL || "")
)