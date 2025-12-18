"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { refinerClient, type ProcessingEvent } from "@/lib/refiner-client"
import { useFiles } from "@/contexts/FileContext"
import { useProcessing } from "@/contexts/ProcessingContext"
import { useSchema } from "@/contexts/SchemaContext"
import FileBrowser from "./file-browser"
import DownloadModal from "./download-modal"
import ResumeModal from "./resume-modal"
import { Download } from "lucide-react"
import { formatFilePath } from "@/lib/path-utils"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ProcessingControls() {
  const { toast } = useToast()
  const { getUploadedFiles } = useFiles()
  const { processingEvents, addProcessingEvent, isProcessing, setIsProcessing, clearProcessingEvents } = useProcessing()
  const { schemaLevels, applyPreset } = useSchema()
  const [selectedInputPath, setSelectedInputPath] = useState("")
  const [passProgress, setPassProgress] = useState<Map<number, {pass: number; status: "pending" | "running" | "completed"; inputChars?: number; outputChars?: number; currentStage?: string}>>(new Map())
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [completedFiles, setCompletedFiles] = useState<Array<{fileId: string; fileName: string; fileExtension?: string; passes: {passNumber: number; path: string; size?: number; cost?: any; textContent?: string}[]}>>([])
  const [totalJobCost, setTotalJobCost] = useState(0)
  const [currentPassCost, setCurrentPassCost] = useState(0)
  const [tokenEstimate, setTokenEstimate] = useState<{tokens: number, cost: number} | null>(null)
  const [largeJobModalOpen, setLargeJobModalOpen] = useState(false)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const stuckCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(isProcessing)
  const processingEventsRef = useRef(processingEvents)
  const aggressivenessInitializedRef = useRef(false)
  const lastAppliedAggressivenessRef = useRef<string | null>(null)
  const currentJobIdRef = useRef<string | null>(null) // Track current job to prevent mixing events
  const [settings, setSettings] = useState({
    passes: 3,
    aggressiveness: "auto",
    scannerRisk: 15,
    keywords: "",
    earlyStop: true,
    strategyMode: "model" as "model" | "rules",
    entropy: {
      riskPreference: 0.5,
      repeatPenalty: 0.0,
      phrasePenalty: 0.0,
    },
    formattingMode: "smart" as "smart" | "strict",
    historyEnabled: false,
    refinerStrength: 2,
    dryRun: false,
    annotation: { enabled: false, mode: "inline" as "inline" | "sidecar", verbosity: "low" as "low" | "medium" | "high" },
    preset: null as string | null, // Preset profile (fast_cheap, balanced, max_quality, academic, creative)
  })
  
  // Preset profiles for quick selection
  const PRESETS = {
    fast_cheap: { name: "Fast & Cheap", description: "Quick refinement, lowest cost", passes: 1, icon: "⚡" },
    balanced: { name: "Balanced", description: "Good quality/cost balance", passes: 2, icon: "⚖️" },
    max_quality: { name: "Max Quality", description: "Best results, higher cost", passes: 3, icon: "✨" },
    academic: { name: "Academic", description: "For research/papers", passes: 2, icon: "📚" },
    creative: { name: "Creative", description: "Maintains voice", passes: 2, icon: "🎨" },
  }
  
  // Apply preset settings
  const applyPresetSettings = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS]
    if (!preset) return
    
    setSettings(prev => ({
      ...prev,
      preset: presetKey,
      passes: preset.passes,
    }))
  }

  // Load settings and file selection from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('refiner-processing-settings')
    const savedFileSelection = localStorage.getItem('refiner-selected-file')
    
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings)
        // FIX #4: Validate passes with stricter checks to prevent invalid values
        const validatedSettings = {
          ...parsedSettings,
          passes: typeof parsedSettings.passes === 'number' && 
                  !isNaN(parsedSettings.passes) && 
                  parsedSettings.passes > 0 && 
                  parsedSettings.passes <= 10 
            ? parsedSettings.passes 
            : 3, // Default to 3 if invalid
          scannerRisk: typeof parsedSettings.scannerRisk === 'number' && !isNaN(parsedSettings.scannerRisk) ? parsedSettings.scannerRisk : 15,
          refinerStrength: typeof parsedSettings.refinerStrength === 'number' && !isNaN(parsedSettings.refinerStrength) ? parsedSettings.refinerStrength : 2,
          entropy: {
            riskPreference: typeof parsedSettings.entropy?.riskPreference === 'number' && !isNaN(parsedSettings.entropy.riskPreference) ? parsedSettings.entropy.riskPreference : 0.5,
            repeatPenalty: typeof parsedSettings.entropy?.repeatPenalty === 'number' && !isNaN(parsedSettings.entropy.repeatPenalty) ? parsedSettings.entropy.repeatPenalty : 0.0,
            phrasePenalty: typeof parsedSettings.entropy?.phrasePenalty === 'number' && !isNaN(parsedSettings.entropy.phrasePenalty) ? parsedSettings.entropy.phrasePenalty : 0.0,
          }
        }
        setSettings(prev => ({ ...prev, ...validatedSettings }))
      } catch (error) {
        console.error('Failed to load processing settings:', error)
        // Reset to defaults on error
        setSettings(prev => ({ ...prev, passes: 3 }))
      }
    }
    
    // Load selected file path
    if (savedFileSelection) {
      try {
        const parsedFileSelection = JSON.parse(savedFileSelection)
        if (parsedFileSelection.path) {
          setSelectedInputPath(parsedFileSelection.path)
        }
      } catch (error) {
        console.error('Failed to load file selection:', error)
      }
    }
  }, [])


  // FIX #5: Persist settings whenever they change (with error handling)
  useEffect(() => {
    try {
      localStorage.setItem('refiner-processing-settings', JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save processing settings:', error)
    }
  }, [settings])

  // Sync aggressiveness with schema controls
  useEffect(() => {
    // Define aggressiveness presets
    const aggressivenessPresets: Record<string, Record<string, number>> = {
      "low": {
        microstructure_control: 1,
        macrostructure_analysis: 0,
        anti_scanner_techniques: 1,
        entropy_management: 1,
        semantic_tone_tuning: 0,
        formatting_safeguards: 3,
        refiner_control: 1,
        history_analysis: 1,
        annotation_mode: 0,
        humanize_academic: 1,
      },
      "medium": {
        microstructure_control: 2,
        macrostructure_analysis: 1,
        anti_scanner_techniques: 2,
        entropy_management: 2,
        semantic_tone_tuning: 1,
        formatting_safeguards: 3,
        refiner_control: 2,
        history_analysis: 1,
        annotation_mode: 0,
        humanize_academic: 2,
      },
      "high": {
        microstructure_control: 3,
        macrostructure_analysis: 2,
        anti_scanner_techniques: 3,
        entropy_management: 3,
        semantic_tone_tuning: 2,
        formatting_safeguards: 2,
        refiner_control: 3,
        history_analysis: 2,
        annotation_mode: 1,
        humanize_academic: 3,
      },
      "very-high": {
        microstructure_control: 3,
        macrostructure_analysis: 3,
        anti_scanner_techniques: 3,
        entropy_management: 3,
        semantic_tone_tuning: 3,
        formatting_safeguards: 2,
        refiner_control: 3,
        history_analysis: 3,
        annotation_mode: 2,
        humanize_academic: 3,
      },
      "auto": {
        // Auto mode uses balanced defaults (medium preset)
        microstructure_control: 2,
        macrostructure_analysis: 1,
        anti_scanner_techniques: 2,
        entropy_management: 2,
        semantic_tone_tuning: 1,
        formatting_safeguards: 3,
        refiner_control: 2,
        history_analysis: 1,
        annotation_mode: 0,
        humanize_academic: 2,
      },
    }

    // Skip on initial mount to avoid overriding user settings
    if (!aggressivenessInitializedRef.current) {
      aggressivenessInitializedRef.current = true
      lastAppliedAggressivenessRef.current = settings.aggressiveness
      return
    }

    // Only apply preset if aggressiveness actually changed
    if (lastAppliedAggressivenessRef.current === settings.aggressiveness) {
      return
    }

    // Apply preset when aggressiveness changes
    const preset = aggressivenessPresets[settings.aggressiveness]
    if (preset) {
      lastAppliedAggressivenessRef.current = settings.aggressiveness
      applyPreset(preset)
      localStorage.setItem('refiner-last-aggressiveness', settings.aggressiveness)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.aggressiveness])

  // Save file selection to localStorage whenever it changes
  useEffect(() => {
    if (selectedInputPath) {
      localStorage.setItem('refiner-selected-file', JSON.stringify({ path: selectedInputPath }))
    }
  }, [selectedInputPath])

  // Debug isProcessing state changes (disabled)
  useEffect(() => {
    
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  // Update processingEvents ref
  useEffect(() => {
    processingEventsRef.current = processingEvents
  }, [processingEvents])

  // Rebuild completedFiles from processingEvents as a reliable fallback
  useEffect(() => {
    try {
      // FIX #2: Only process events from the current job to prevent pollution from previous jobs
      // Use the tracked currentJobId if available, otherwise get from most recent event
      const currentJobId = currentJobIdRef.current || 
        (processingEvents.length > 0 ? processingEvents[processingEvents.length - 1]?.jobId : null)
      
      if (!currentJobId) {
        setCompletedFiles([])
        return
      }
      
      // Filter events to only current job
      const currentJobEvents = processingEvents.filter(ev => ev.jobId === currentJobId)
      
      const byFile: Record<string, { fileId: string; fileName: string; fileExtension?: string; passes: { passNumber: number; path: string; size?: number; cost?: any; textContent?: string }[] }> = {}
      for (const ev of currentJobEvents) {
        const anyEv: any = ev as any
        if (anyEv.type === 'pass_complete' && (anyEv.outputPath || anyEv.metrics?.localPath || anyEv.textContent) && anyEv.pass) {
          const fid = anyEv.fileId || 'unknown'
          const fname = anyEv.fileName || `File ${fid}`
          const path = anyEv.outputPath || anyEv.metrics?.localPath
          const textContent = anyEv.textContent // CRITICAL: Store textContent for reliable downloads on Vercel
          
          // CRITICAL FIX: Extract file extension for proper download format
          const getFileExtension = () => {
            if (path) {
              const pathExt = path.split('.').pop()?.toLowerCase()
              if (pathExt && ['docx', 'doc', 'pdf', 'txt', 'md'].includes(pathExt)) {
                return `.${pathExt}`
              }
            }
            const fnameExt = fname?.split('.').pop()?.toLowerCase()
            if (fnameExt && ['docx', 'doc', 'pdf', 'txt', 'md'].includes(fnameExt)) {
              return `.${fnameExt}`
            }
            return undefined // Will default to .txt in download modal
          }
          
          const currentExt = getFileExtension()
          
          // Initialize file entry if not exists
          if (!byFile[fid]) {
            byFile[fid] = { fileId: fid, fileName: fname, fileExtension: currentExt, passes: [] }
          } else {
            // CRITICAL FIX: Update fileExtension if we now have a valid one and didn't before
            if (currentExt && !byFile[fid].fileExtension) {
              byFile[fid].fileExtension = currentExt
            }
          }
          if (!byFile[fid].passes.find(p => p.passNumber === anyEv.pass)) {
            byFile[fid].passes.push({ 
              passNumber: anyEv.pass, 
              path: path || '', 
              size: anyEv.outputChars, 
              cost: anyEv.cost,
              textContent: textContent // Store textContent for client-side download
            })
          }
        }
      }
      const options = Object.values(byFile).map(opt => ({
        ...opt,
        passes: opt.passes.sort((a, b) => a.passNumber - b.passNumber)
      }))
      setCompletedFiles(options)
    } catch {}
  }, [processingEvents])

  // Token Estimator Logic
  useEffect(() => {
    if (!selectedInputPath && getUploadedFiles().length === 0) {
      setTokenEstimate(null)
      return
    }

    const calculateEstimate = async () => {
      // Simple approximation: 1 token ~= 4 chars (English)
      // For code/technical text, it can be different, but this is a standard heuristic.
      let totalChars = 0
      
      // Check uploaded files
      const uploaded = getUploadedFiles()
      for (const file of uploaded) {
        // File size is in bytes, but we need to estimate text content
        // For PDFs and binary files, actual text content is much smaller than file size
        // Use a conservative estimate: assume 10% of file size is actual text for PDFs/binary
        // For text files, use file size directly
        if (file.size) {
          const fileName = file.name?.toLowerCase() || ''
          // Check if it's a text-based file
          const isTextFile = fileName.endsWith('.txt') || 
                           fileName.endsWith('.md') || 
                           fileName.endsWith('.json') ||
                           fileName.endsWith('.csv')
          
          if (isTextFile) {
            // For text files, use size directly (assuming UTF-8, 1 byte per char for ASCII)
            totalChars += file.size
          } else {
            // For PDFs, DOCX, etc., estimate text content as 10% of file size
            // This is conservative - actual text extraction might be even less
            totalChars += Math.floor(file.size * 0.1)
          }
        } else {
          // Fallback: assume small file if size unknown
          totalChars += 5000 // Conservative estimate for unknown files
        }
      }

      // If selected local path (Desktop mode)
      // We can't easily read the file content here without an API call.
      // Let's rely on what we have. If we can't estimate, we show nothing or a warning.
      
      if (totalChars === 0) {
        setTokenEstimate(null)
        return
      }

      const inputTokens = Math.ceil(totalChars / 4)
      const totalPasses = settings.passes
      
      // Rough multiplier for expansion/overhead + input + output per pass
      // Input is sent every pass. Output is generated every pass.
      // Cost = (Input + Output) * Passes
      // Assuming Output ~= Input (refinement)
      const estimatedTotalTokens = inputTokens * 2 * totalPasses
      
      // Cost estimation (using GPT-4 Turbo pricing as a baseline or generic)
      // Input: $10/1M, Output: $30/1M -> Avg $20/1M
      const costPer1k = 0.02 // $0.02 per 1k tokens (approx blended)
      const estimatedCost = (estimatedTotalTokens / 1000) * costPer1k

      setTokenEstimate({
        tokens: estimatedTotalTokens,
        cost: estimatedCost
      })
    }

    calculateEstimate()
  }, [selectedInputPath, getUploadedFiles, settings.passes])

  // Debug button re-rendering (disabled)
  useEffect(() => {
    
  }, [isProcessing])

  const [resumeState, setResumeState] = useState<{
    open: boolean
    fileId: string
    fileName: string
    lastPass: number
    textContent: string
  }>({
    open: false,
    fileId: "",
    fileName: "",
    lastPass: 0,
    textContent: "",
  })

  const handleResume = async () => {
    if (!resumeState.fileId || !resumeState.textContent) return

    setIsProcessing(true)
    
    // Construct files array for resume - using text content from last pass
    const files = [{
      id: resumeState.fileId,
      name: resumeState.fileName,
      type: "local" as const,
      textContent: resumeState.textContent // Pass the text content directly
    }]

    try {
      await refinerClient.startRefinement(
        {
          files,
          output: { type: 'local', dir: './output' },
          passes: settings.passes - resumeState.lastPass, // Remaining passes
          startPass: resumeState.lastPass + 1, // Start from next pass
          earlyStop: settings.earlyStop,
          aggressiveness: settings.aggressiveness,
          scannerRisk: settings.scannerRisk,
          keywords: settings.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          strategy_mode: settings.strategyMode,
          formatting_safeguards: { 
            enabled: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) > 0, 
            mode: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) >= 3 ? 'strict' : 'smart' 
          },
          history_analysis: { 
            enabled: (schemaLevels.find(s => s.id === 'history_analysis')?.value || 1) > 0
          },
          refiner_dry_run: settings.dryRun,
          annotation_mode: { 
            enabled: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) > 0, 
            mode: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 1 ? 'inline' : 'sidecar',
            verbosity: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 1 ? 'low' : 
                      (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 2 ? 'medium' : 'high'
          },
          heuristics: {
            microstructure_control: (schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2) > 0,
            macrostructure_analysis: (schemaLevels.find(s => s.id === 'macrostructure_analysis')?.value || 1) > 0,
            anti_scanner_techniques: (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) > 0,
            refiner_control: schemaLevels.find(s => s.id === 'refiner_control')?.value || 2,
            entropy_management: schemaLevels.find(s => s.id === 'entropy_management')?.value || 2,
            semantic_tone_tuning: schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1,
            history_analysis: (schemaLevels.find(s => s.id === 'history_analysis')?.value || 1) > 0,
            annotation_mode: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) > 0,
            humanize_academic: {
              enabled: (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) > 0,
              intensity: (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) === 1 ? 'light' : 
                        (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) === 2 ? 'medium' : 'strong',
            },
            formatting_safeguards: {
              enabled: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) > 0,
              mode: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) >= 3 ? 'strict' : 'smart',
            },
            keywords: settings.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            strategy_weights: {
              clarity: Math.min(1.0, 0.3 + ((schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1) * 0.2)),
              persuasion: Math.min(1.0, 0.2 + ((schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.15)),
              brevity: Math.min(1.0, 0.2 + ((schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2) * 0.1)),
              formality: Math.min(1.0, 0.4 + ((schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) * 0.1)),
            },
            entropy: {
              risk_preference: Math.min(1.0, 0.3 + ((schemaLevels.find(s => s.id === 'entropy_management')?.value || 2) * 0.2)),
              repeat_penalty: Math.min(1.0, (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.3),
              phrase_penalty: Math.min(1.0, (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.2),
            },
          },
          schemaLevels: {
            microstructure_control: schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2,
            macrostructure_analysis: schemaLevels.find(s => s.id === 'macrostructure_analysis')?.value || 1,
            anti_scanner_techniques: schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3,
            entropy_management: schemaLevels.find(s => s.id === 'entropy_management')?.value || 2,
            semantic_tone_tuning: schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1,
            formatting_safeguards: schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3,
            refiner_control: schemaLevels.find(s => s.id === 'refiner_control')?.value || 2,
            history_analysis: schemaLevels.find(s => s.id === 'history_analysis')?.value || 1,
            annotation_mode: schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0,
            humanize_academic: schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2,
          },
        },
        (event: ProcessingEvent) => {
          // Re-use the same event handler logic
          const eventType = (event as any).type || event.type
          if (eventType === "complete" || eventType === "stream_end" || eventType === "done") {
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current)
              processingTimeoutRef.current = null
            }
            if (stuckCheckTimeoutRef.current) {
              clearTimeout(stuckCheckTimeoutRef.current)
              stuckCheckTimeoutRef.current = null
            }
            try { addProcessingEvent(event) } catch {}
            setIsProcessing(false)
            setPassProgress(new Map())
            currentJobIdRef.current = null // Clear job tracking on completion
            window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: event }))
            toast({
              title: "Processing Complete",
              description: "All passes completed successfully!",
            })
            return
          }
          
          if (event.type === "error") {
            // On error during resume, show alert but don't loop resume modal infinitely unless useful
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current)
              processingTimeoutRef.current = null
            }
            if (stuckCheckTimeoutRef.current) {
              clearTimeout(stuckCheckTimeoutRef.current)
              stuckCheckTimeoutRef.current = null
            }
            try { addProcessingEvent(event) } catch {}
            toast({
              title: "Processing Failed",
              description: event.error || event.message || "Unknown error",
              variant: "destructive"
            })
            setIsProcessing(false)
            setPassProgress(new Map())
            return
          }
          
          if (!event.fileName && event.fileId) {
            event.fileName = resumeState.fileName
          }
          if (event.type === 'pass_complete') {
            if (!event.outputPath && (event as any).metrics?.localPath) {
              try { (event as any).outputPath = (event as any).metrics.localPath } catch {}
            }
          }
          addProcessingEvent(event)
          
          const ev = event as any
          if (ev.type === "pass_start") {
             setPassProgress(prev => {
              const newMap = new Map(prev)
              // Initialize passes if needed (merging with existing progress)
              newMap.set(ev.pass, { pass: ev.pass, status: "running", currentStage: "starting" })
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
          }
          
          if (ev.type === "stage_update" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "running" as const, currentStage: ev.stage } as any
              current.currentStage = ev.stage
              current.status = "running"
              // CRITICAL FIX: Capture inputChars from read stage_update event
              if (ev.inputChars !== undefined) {
                current.inputChars = ev.inputChars
              }
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
          }
          
          // Handle chunk progress events for real-time feedback during large document processing
          if (ev.type === "chunk_progress") {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              // Find the current active pass or use pass 1
              const activePass = Array.from(newMap.entries()).find(([_, v]) => v.status === "running")?.[0] || 1
              const current = newMap.get(activePass) || { pass: activePass, status: "running" as const, currentStage: "processing" } as any
              current.chunkProgress = ev.progress  // Store chunk progress percentage
              current.chunkMessage = ev.message     // Store chunk progress message
              current.currentStage = `processing (${ev.message})`
              newMap.set(activePass, current)
              window.dispatchEvent(new CustomEvent("refiner-chunk-progress", { 
                detail: { progress: ev.progress, message: ev.message, stage: ev.stage }
              }))
              return newMap
            })
          }
          
          if (ev.type === "pass_complete" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "completed" as const, currentStage: "completed" } as any
              current.status = "completed"
              current.inputChars = ev.inputChars
              current.outputChars = ev.outputChars
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
            
            // Update completed files tracking
            if (ev.fileId && ev.pass && (ev.outputPath || ev.metrics?.localPath)) {
              const filePath = ev.outputPath || ev.metrics?.localPath
              setCompletedFiles(prev => {
                const existingIndex = prev.findIndex(f => f.fileId === ev.fileId)
                if (existingIndex >= 0) {
                  const existing = prev[existingIndex]
                  if (!existing.passes.find(p => p.passNumber === ev.pass)) {
                    // CRITICAL FIX: Create new object to ensure React detects the change
                    const updated = {
                      ...existing,
                      passes: [...existing.passes, {
                        passNumber: ev.pass,
                        path: filePath,
                        size: ev.outputChars,
                        cost: ev.cost,
                        textContent: ev.textContent // Include textContent for download
                      }].sort((a, b) => a.passNumber - b.passNumber)
                    }
                    return [...prev.slice(0, existingIndex), updated, ...prev.slice(existingIndex + 1)]
                  }
                  return prev // No change needed
                } else {
                  return [...prev, {
                    fileId: ev.fileId,
                    fileName: ev.fileName || `File ${ev.fileId}`,
                    passes: [{
                      passNumber: ev.pass,
                      path: filePath,
                      size: ev.outputChars,
                      cost: ev.cost,
                      textContent: ev.textContent // Include textContent for download
                    }]
                  }]
                }
              })
            }
          }
          
          if (ev.type === "progress" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "running" as const, currentStage: "processing" } as any
              if (ev.inputSize) current.inputChars = ev.inputSize
              if (ev.outputSize) current.outputChars = ev.outputSize
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
          }
        }
      )
    } catch (error) {
      console.error("Resume failed:", error)
      toast({
        title: "Resume Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      })
      setIsProcessing(false)
    }
  }

  // Helper function to extract Drive file ID from URL
  const extractDriveFileId = (url: string): string | null => {
    if (!url) return null
    if (url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
      return match ? match[1] : null
    }
    if (url.includes('/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
      return match ? match[1] : null
    }
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      return null // Will be extracted by backend
    }
    return null
  }

  const handleStartProcessing = async () => {
    // Check if we have a selected input path or uploaded files
    if (!selectedInputPath && getUploadedFiles().length === 0) {
      alert("Please select an input file or upload files before starting processing.")
      return
    }

    // Check for large file/high cost
    // Only show alert for truly large jobs: > 500k tokens or > $10 cost
    // This prevents false positives for normal-sized files
    if (tokenEstimate && (tokenEstimate.tokens > 500000 || tokenEstimate.cost > 10)) {
      setLargeJobModalOpen(true)
      return // Wait for user confirmation in modal
    }
    
    // Continue with processing (called after modal confirmation)
    await startProcessingInternal()
  }

  const startProcessingInternal = async () => {
    // FIX #1: Clear all state from previous jobs to prevent overlap
    setPassProgress(new Map())
    setCompletedFiles([])
    clearProcessingEvents() // Clear events from previous jobs
    currentJobIdRef.current = null // Reset current job tracking
    setIsProcessing(true)
    setTotalJobCost(0)
    setCurrentPassCost(0)
    
    // Set a timeout fallback to prevent infinite processing state
    // CRITICAL FIX: Increased from 10 to 60 minutes to match backend's 20 min per pass × 3 passes max
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false)
      setPassProgress(new Map())
      window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: { type: "timeout" } }))
    }, 60 * 60 * 1000) // 60 minutes timeout (allows for multiple passes on large files)
    
    // Also set a shorter timeout to check for stuck processing
    stuckCheckTimeoutRef.current = setTimeout(() => {
      // Check current state using ref
      if (isProcessingRef.current) {
        // Try to get job status to see if it's actually complete
        if (processingEventsRef.current.length > 0) {
          const lastEvent = processingEventsRef.current[processingEventsRef.current.length - 1]
          
          if (lastEvent && (lastEvent.type === "stream_end" || lastEvent.type === "complete")) {
            setIsProcessing(false)
            setPassProgress(new Map())
            currentJobIdRef.current = null // Clear job tracking on completion
            window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: lastEvent }))
          } else {
            // FIX #3: Check if all files have completed all passes (multi-file support)
            // FIX #7: Only check events from current job
            const currentJobId = currentJobIdRef.current
            const passCompleteEvents = currentJobId
              ? processingEventsRef.current.filter(e => e.type === "pass_complete" && e.jobId === currentJobId)
              : processingEventsRef.current.filter(e => e.type === "pass_complete")
            
            if (passCompleteEvents.length > 0) {
              // Group by fileId and check if each file has completed all passes
              const filePassMap = new Map<string, Set<number>>()
              passCompleteEvents.forEach(ev => {
                const fileId = ev.fileId || 'default'
                if (!filePassMap.has(fileId)) {
                  filePassMap.set(fileId, new Set())
                }
                if (ev.pass) {
                  filePassMap.get(fileId)!.add(ev.pass)
                }
              })
              
              // Check if all files have completed all required passes
              const allFilesComplete = Array.from(filePassMap.entries()).every(([fileId, completedPasses]) => {
                const maxPass = completedPasses.size > 0 ? Math.max(...Array.from(completedPasses)) : 0
                return completedPasses.size >= settings.passes && maxPass >= settings.passes
              })
              
              if (allFilesComplete && filePassMap.size > 0) {
                setIsProcessing(false)
                setPassProgress(new Map())
                currentJobIdRef.current = null // Clear job tracking
                window.dispatchEvent(new CustomEvent("refiner-processing-complete", { 
                  detail: { type: "assumed_complete", files: Array.from(filePassMap.keys()) } 
                }))
                toast({
                  title: "Processing Complete",
                  description: `All ${settings.passes} passes completed for ${filePassMap.size} file${filePassMap.size > 1 ? 's' : ''}!`,
                })
              }
            }
          }
        }
      }
    }, 2 * 60 * 1000) // 2 minutes check

    try {
      // Use selected input path if available, otherwise fall back to uploaded files
      let files
      if (selectedInputPath) {
        // Check if selectedInputPath is a Google Drive URL
        const driveId = extractDriveFileId(selectedInputPath)
        const isDriveUrl = selectedInputPath.includes('drive.google.com') || selectedInputPath.includes('docs.google.com')
        
        // Find the file in uploadedFiles to get its name and type
        // Try multiple matching strategies to find the uploaded file
        const uploadedFile = getUploadedFiles().find(f => {
          // Match by source path
          if (f.source === selectedInputPath) return true
          // Match by driveId
          if (driveId && (f as any).driveId === driveId) return true
          // Match by name
          if (f.name === selectedInputPath) return true
          // Match by backendFileId if source contains it
          if ((f as any).backendFileId && selectedInputPath.includes((f as any).backendFileId)) return true
          return false
        })
        
        // CRITICAL FIX: Use backend's file_id (stored in driveId/backendFileId) for local uploads
        // For Google Drive files, the driveId from URL is the correct ID
        // If we can't find the uploaded file, we MUST have a valid backend file_id or fail gracefully
        const backendFileId = (uploadedFile as any)?.driveId || (uploadedFile as any)?.backendFileId
        const effectiveId = isDriveUrl 
          ? (driveId || backendFileId || "selected_file")
          : (backendFileId || (uploadedFile as any)?.driveId || uploadedFile?.id || driveId || "selected_file")
        
        // If we don't have a valid backend file_id and it's not a drive URL, warn the user
        if (!isDriveUrl && !backendFileId && !uploadedFile) {
          console.warn(`[ProcessingControls] Selected file path "${selectedInputPath}" not found in uploaded files. This may cause the request to fail.`)
        }
        
        files = [{
          id: effectiveId,
          name: uploadedFile?.name || "Selected File",
          type: (isDriveUrl || driveId || uploadedFile?.type === 'drive') ? 'drive' as const : 'local' as const,
          source: selectedInputPath,
          driveId: driveId || (uploadedFile as any)?.driveId || undefined,
          backendFileId: backendFileId || (uploadedFile as any)?.backendFileId || undefined
        }]
      } else {
        // CRITICAL FIX: Use the backend's file_id (stored in driveId) for local file uploads
        // The backend generates its own file_id (like "file_12345_6789") during upload
        // and stores file info under that key, NOT the frontend's random id
        files = getUploadedFiles().map(file => ({
          // Use backend's file_id if available (stored in driveId after upload), fallback to frontend id
          id: (file as any).driveId || (file as any).backendFileId || file.id,
          name: file.name,
          // Narrow to allowed union for API contract
          type: (file.type === 'drive' ? 'drive' : 'local') as 'local' | 'drive',
          source: file.source,
          driveId: (file as any).driveId,  // Include for reference
          backendFileId: (file as any).driveId || (file as any).backendFileId  // Explicit backend file_id
        }))
      }
      
      await refinerClient.startRefinement(
        {
          files,
          // Ensure backend-compatible local output target (mapped by API route)
          output: { type: 'local', dir: './output' },
          passes: settings.passes,
          earlyStop: settings.earlyStop,
          aggressiveness: settings.aggressiveness,
          scannerRisk: settings.scannerRisk,
          keywords: settings.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          // Pass through strategy mode to backend via schema flag for simplicity
          // Backend reads heuristics.strategy_mode or env; route can map this as needed
          // Here we add a meta field understood by the API route
          strategy_mode: settings.strategyMode,
          // Use schema-derived formatting safeguards
          formatting_safeguards: { 
            enabled: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) > 0, 
            mode: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) >= 3 ? 'strict' : 'smart' 
          },
          // Use schema-derived analysis settings
          history_analysis: { 
            enabled: (schemaLevels.find(s => s.id === 'history_analysis')?.value || 1) > 0
          },
          refiner_dry_run: settings.dryRun,
          // Use schema-derived annotation settings
          annotation_mode: { 
            enabled: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) > 0, 
            mode: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 1 ? 'inline' : 'sidecar',
            verbosity: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 1 ? 'low' : 
                      (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) === 2 ? 'medium' : 'high'
          },
          // Preset profile for quick configuration
          preset: settings.preset || undefined,
          // Map schema levels to heuristics for backend processing
          heuristics: {
            // Core processing flags
            microstructure_control: (schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2) > 0,
            macrostructure_analysis: (schemaLevels.find(s => s.id === 'macrostructure_analysis')?.value || 1) > 0,
            anti_scanner_techniques: (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) > 0,
            
            // Control levels
            refiner_control: schemaLevels.find(s => s.id === 'refiner_control')?.value || 2,
            entropy_management: schemaLevels.find(s => s.id === 'entropy_management')?.value || 2,
            semantic_tone_tuning: schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1,
            
            // Feature toggles
            history_analysis: (schemaLevels.find(s => s.id === 'history_analysis')?.value || 1) > 0,
            annotation_mode: (schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0) > 0,
            
            // Humanizer settings
            humanize_academic: {
              enabled: (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) > 0,
              intensity: (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) === 1 ? 'light' : 
                        (schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) === 2 ? 'medium' : 'strong',
            },
            
            // Formatting safeguards
            formatting_safeguards: {
              enabled: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) > 0,
              mode: (schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3) >= 3 ? 'strict' : 'smart',
            },
            
            // Keywords from settings
            keywords: settings.keywords.split(",").map((k) => k.trim()).filter(Boolean),
            
            // Strategy weights (derived from schema levels)
            strategy_weights: {
              clarity: Math.min(1.0, 0.3 + ((schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1) * 0.2)),
              persuasion: Math.min(1.0, 0.2 + ((schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.15)),
              brevity: Math.min(1.0, 0.2 + ((schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2) * 0.1)),
              formality: Math.min(1.0, 0.4 + ((schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2) * 0.1)),
            },
            
            // Entropy settings (derived from schema levels)
            entropy: {
              risk_preference: Math.min(1.0, 0.3 + ((schemaLevels.find(s => s.id === 'entropy_management')?.value || 2) * 0.2)),
              repeat_penalty: Math.min(1.0, (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.3),
              phrase_penalty: Math.min(1.0, (schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3) * 0.2),
            },
          },
          // Pass schema levels for tracking
          schemaLevels: {
            microstructure_control: schemaLevels.find(s => s.id === 'microstructure_control')?.value || 2,
            macrostructure_analysis: schemaLevels.find(s => s.id === 'macrostructure_analysis')?.value || 1,
            anti_scanner_techniques: schemaLevels.find(s => s.id === 'anti_scanner_techniques')?.value || 3,
            entropy_management: schemaLevels.find(s => s.id === 'entropy_management')?.value || 2,
            semantic_tone_tuning: schemaLevels.find(s => s.id === 'semantic_tone_tuning')?.value || 1,
            formatting_safeguards: schemaLevels.find(s => s.id === 'formatting_safeguards')?.value || 3,
            refiner_control: schemaLevels.find(s => s.id === 'refiner_control')?.value || 2,
            history_analysis: schemaLevels.find(s => s.id === 'history_analysis')?.value || 1,
            annotation_mode: schemaLevels.find(s => s.id === 'annotation_mode')?.value || 0,
            humanize_academic: schemaLevels.find(s => s.id === 'humanize_academic')?.value || 2,
          },
        },
        (event: ProcessingEvent) => {
          
          
          // Check for completion events FIRST - before any other processing
          const eventType = (event as any).type || event.type
          if (eventType === "complete" || eventType === "stream_end" || eventType === "done") {
            
            
            // Clear the timeouts since we completed successfully
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current)
              processingTimeoutRef.current = null
            }
            if (stuckCheckTimeoutRef.current) {
              clearTimeout(stuckCheckTimeoutRef.current)
              stuckCheckTimeoutRef.current = null
            }
            
            // Record terminal event so other components can observe it in history
            try { addProcessingEvent(event) } catch {}

            // Force state update immediately - no need for setTimeout
            setIsProcessing(false)
            setPassProgress(new Map())
            
            
            // Trigger a refresh of results and analytics
            window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: event }))
            
            
            return // Exit early to avoid duplicate processing
          }
          
          // Check for error events SECOND
          if (event.type === "error") {
            
            // Clear the timeouts on error
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current)
              processingTimeoutRef.current = null
            }
            if (stuckCheckTimeoutRef.current) {
              clearTimeout(stuckCheckTimeoutRef.current)
              stuckCheckTimeoutRef.current = null
            }
            // Record error event in history so UI can react
            try { addProcessingEvent(event) } catch {}
            
            // Check if we can resume (if we have completed passes)
            const completedPasses = processingEventsRef.current
              .filter(e => e.type === 'pass_complete' && (e as any).textContent)
              .sort((a, b) => (b.pass || 0) - (a.pass || 0))
            
            if (completedPasses.length > 0) {
              const lastPass = completedPasses[0]
              setResumeState({
                open: true,
                fileId: lastPass.fileId || "",
                fileName: lastPass.fileName || "",
                lastPass: lastPass.pass || 0,
                textContent: (lastPass as any).textContent || ""
              })
            } else {
              toast({
                title: "Processing Failed",
                description: event.error || event.message || "Unknown error",
                variant: "destructive"
              })
            }
            
            setIsProcessing(false)
            setPassProgress(new Map()) // Clear progress on error
            return // Exit early to avoid duplicate processing
          }
          
          // Ensure fileName is present on events for downstream components (Results/Diff)
          if (!event.fileName && event.fileId) {
            const src = files.find(f => (f.id === event.fileId || (f as any).driveId === event.fileId))
            if (src) event.fileName = src.name
          }
          // Normalize output path for ResultsViewer from backend metrics
          if (event.type === 'pass_complete') {
            
            
            if (!event.outputPath && (event as any).metrics?.localPath) {
              try { (event as any).outputPath = (event as any).metrics.localPath } catch {}
            }
          }
          // FIX #7: Capture jobId from first event to track current job
          if (event.jobId && !currentJobIdRef.current) {
            currentJobIdRef.current = event.jobId
          }
          
          addProcessingEvent(event)
          
          // Track pass progression
          const ev = event as any
          if (ev.type === "pass_start") {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              // FIX #6: Only initialize passes if settings.passes is valid and we don't have stale data
              // This prevents overwriting passes from previous jobs or incorrect pass counts
              const validPasses = typeof settings.passes === 'number' && settings.passes > 0 && settings.passes <= 10
                ? settings.passes 
                : 3
              
              // Only initialize if we're starting fresh or if the current pass is within expected range
              if (newMap.size === 0 || (ev.pass && ev.pass <= validPasses)) {
                for (let i = 1; i <= validPasses; i++) {
                  if (!newMap.has(i)) {
                    newMap.set(i, { pass: i, status: "pending" })
                  }
                }
              }
              // Mark current pass as running
              if (ev.pass) {
                newMap.set(ev.pass, { pass: ev.pass, status: "running", currentStage: "starting" })
              }
              // Emit progress event
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: validPasses }
              }))
              return newMap
            })
            // Toast for pass start
            toast({
              title: `Pass ${ev.pass} of ${settings.passes}`,
              description: "Processing started...",
            })
          }
          
          if (ev.type === "stage_update" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "running" as const, inputChars: undefined, outputChars: undefined, currentStage: undefined }
              current.currentStage = ev.stage
              current.status = "running"
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
          }
          
          // Handle chunk progress events for real-time feedback during large document processing
          if (ev.type === "chunk_progress") {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              // Find the current active pass or use pass 1
              const activePass = Array.from(newMap.entries()).find(([_, v]) => v.status === "running")?.[0] || 1
              const current = newMap.get(activePass) || { pass: activePass, status: "running" as const, currentStage: "processing" } as any
              current.chunkProgress = ev.progress
              current.chunkMessage = ev.message
              current.currentStage = `processing (${ev.message})`
              newMap.set(activePass, current)
              window.dispatchEvent(new CustomEvent("refiner-chunk-progress", { 
                detail: { progress: ev.progress, message: ev.message, stage: ev.stage }
              }))
              return newMap
            })
          }
          
          if (ev.type === "pass_complete" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "completed" as const, inputChars: undefined, outputChars: undefined, currentStage: undefined }
              current.status = "completed"
              current.inputChars = ev.inputChars
              current.outputChars = ev.outputChars
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              // Emit diff meta so DiffViewer can load correct ids/passes
              try {
                const completedPasses = Array.from(newMap.values())
                  .filter(p => p.status === "completed")
                  .map(p => p.pass)
                  .sort((a, b) => a - b)
                if (ev.fileId) {
                  window.dispatchEvent(new CustomEvent("refiner-diff-meta", {
                    detail: { fileId: ev.fileId, fileName: ev.fileName, availablePasses: completedPasses }
                  }))
                }
              } catch {}
              return newMap
            })
            
            // Track completed files for download
            if (ev.fileId && ev.pass && (ev.outputPath || ev.metrics?.localPath)) {
              const filePath = ev.outputPath || ev.metrics?.localPath
              setCompletedFiles(prev => {
                const existingIndex = prev.findIndex(f => f.fileId === ev.fileId)
                if (existingIndex >= 0) {
                  const existing = prev[existingIndex]
                  // Add this pass if it doesn't exist
                  if (!existing.passes.find(p => p.passNumber === ev.pass)) {
                    // CRITICAL FIX: Create new object to ensure React detects the change
                    const updated = {
                      ...existing,
                      passes: [...existing.passes, {
                        passNumber: ev.pass,
                        path: filePath,
                        size: ev.outputChars,
                        cost: ev.cost,
                        textContent: ev.textContent // Include textContent for download
                      }].sort((a, b) => a.passNumber - b.passNumber)
                    }
                    return [...prev.slice(0, existingIndex), updated, ...prev.slice(existingIndex + 1)]
                  }
                  return prev // No change needed
                } else {
                  // Create new file entry
                  return [...prev, {
                    fileId: ev.fileId,
                    fileName: ev.fileName || `File ${ev.fileId}`,
                    passes: [{
                      passNumber: ev.pass,
                      path: filePath,
                      size: ev.outputChars,
                      cost: ev.cost,
                      textContent: ev.textContent // Include textContent for download
                    }]
                  }]
                }
              })
            }
            
            // Update cost tracking
            if (ev.cost) {
              setCurrentPassCost(ev.cost.totalCost || 0)
              setTotalJobCost(prev => prev + (ev.cost?.totalCost || 0))
            }
          }
          
          // Update input/output character counts from progress events
          if (ev.type === "progress" && ev.pass) {
            setPassProgress(prev => {
              const newMap = new Map(prev)
              const current = newMap.get(ev.pass) || { pass: ev.pass, status: "running" as const, inputChars: undefined, outputChars: undefined, currentStage: undefined }
              if (ev.inputSize) current.inputChars = ev.inputSize
              if (ev.outputSize) current.outputChars = ev.outputSize
              newMap.set(ev.pass, current)
              window.dispatchEvent(new CustomEvent("refiner-pass-progress", { 
                detail: { passProgress: Array.from(newMap.values()), totalPasses: settings.passes }
              }))
              return newMap
            })
          }
          
          // Bubble plan/strategy snapshot via CustomEvent for Dashboard -> PlanKnobs
          if ((event as any).type === "plan" || (event as any).type === "strategy") {
            window.dispatchEvent(new CustomEvent("refiner-plan", { detail: event }))
          }
        },
      )
    } catch (error) {
      console.error("Processing failed:", error)
      // Clear the timeouts on error
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
        processingTimeoutRef.current = null
      }
      if (stuckCheckTimeoutRef.current) {
        clearTimeout(stuckCheckTimeoutRef.current)
        stuckCheckTimeoutRef.current = null
      }
      
      // Check if we can resume (if we have completed passes)
      const completedPasses = processingEventsRef.current
        .filter(e => e.type === 'pass_complete' && (e as any).textContent)
        .sort((a, b) => (b.pass || 0) - (a.pass || 0))
      
      if (completedPasses.length > 0) {
        const lastPass = completedPasses[0]
        setResumeState({
          open: true,
          fileId: lastPass.fileId || "",
          fileName: lastPass.fileName || "",
          lastPass: lastPass.pass || 0,
          textContent: (lastPass as any).textContent || ""
        })
      } else {
        alert(`Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
      
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Large Job Confirmation Modal */}
      <AlertDialog open={largeJobModalOpen} onOpenChange={setLargeJobModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-orange-600">
              Large Job Alert
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Estimated Tokens:</span>
                  <span className="font-bold text-orange-700">
                    {tokenEstimate?.tokens.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Estimated Cost:</span>
                  <span className="font-bold text-orange-700">
                    ~${tokenEstimate?.cost.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
              <p className="text-gray-600 pt-2">
                This is a large job that will consume significant tokens and incur costs. 
                Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsProcessing(false)
              toast({
                title: "Processing Cancelled",
                description: "Large job cancelled by user",
              })
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setLargeJobModalOpen(false)
                toast({
                  title: "Large Job Warning",
                  description: `Processing ${tokenEstimate?.tokens.toLocaleString()} tokens (~$${tokenEstimate?.cost.toFixed(2)})`,
                  variant: "default"
                })
                await startProcessingInternal()
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Browser */}
      <FileBrowser
        onFileSelect={setSelectedInputPath}
        selectedInputPath={selectedInputPath}
      />

      <ResumeModal
        open={resumeState.open}
        onOpenChange={(open) => setResumeState(prev => ({ ...prev, open }))}
        onResume={handleResume}
        lastPass={resumeState.lastPass}
        fileName={resumeState.fileName}
      />

      {/* Processing Controls */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Processing Configuration</span>
            {tokenEstimate && (
              <div className="text-sm font-normal bg-secondary/50 px-3 py-1 rounded-full border border-border">
                <span className="text-muted-foreground mr-2">Est. Usage:</span>
                <span className="font-medium text-foreground">{tokenEstimate.tokens.toLocaleString()} tokens</span>
                <span className="mx-2 text-border">|</span>
                <span className="font-medium text-green-600">~${tokenEstimate.cost.toFixed(2)}</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        {/* Preset Profiles - Quick selection for common use cases */}
        <div className="space-y-2">
          <Label className="text-card-foreground flex items-center gap-2">
            Quick Presets
            <span className="text-xs text-muted-foreground font-normal">(click to apply)</span>
          </Label>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPresetSettings(key)}
                className={`
                  p-2 rounded-lg border text-center transition-all duration-200 text-sm
                  ${settings.preset === key 
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/50' 
                    : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-card-foreground'
                  }
                `}
              >
                <div className="text-lg mb-0.5">{preset.icon}</div>
                <div className="font-medium text-xs truncate">{preset.name}</div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-card-foreground">Passes</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={settings.passes}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value)
                if (!isNaN(value) && value >= 1 && value <= 10) {
                  setSettings({ ...settings, passes: value })
                }
              }}
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-card-foreground">Scanner Risk (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={settings.scannerRisk}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value)
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  setSettings({ ...settings, scannerRisk: value })
                }
              }}
              className="bg-input border-border text-foreground"
            />
          </div>
        </div>

        {/* Refiner Strength + Dry-Run */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-card-foreground">Strength</Label>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={settings.refinerStrength}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value)
                if (!isNaN(value) && value >= 0 && value <= 3) {
                  setSettings({ ...settings, refinerStrength: value })
                }
              }}
            />
            <div className="text-xs text-muted-foreground">Level {settings.refinerStrength}</div>
          </div>
          <div className="flex items-end">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="dryRun"
                checked={settings.dryRun}
                onChange={(e) => setSettings({ ...settings, dryRun: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="dryRun" className="text-card-foreground">Dry-run (plan only)</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-card-foreground">Aggressiveness</Label>
          <select
            value={settings.aggressiveness}
            onChange={(e) => setSettings({ ...settings, aggressiveness: e.target.value })}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground"
          >
            <option value="auto">Auto</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="very-high">Very High</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-card-foreground">Strategy Mode</Label>
          <select
            value={settings.strategyMode}
            onChange={(e) => setSettings({ ...settings, strategyMode: e.target.value as any })}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground"
          >
            <option value="model">Model (default)</option>
            <option value="rules">Rules (MVP)</option>
          </select>
        </div>

        {/* Entropy Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-card-foreground">Risk Preference</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.entropy.riskPreference}
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value)
                if (!isNaN(value) && value >= 0 && value <= 1) {
                  setSettings({
                    ...settings,
                    entropy: { ...settings.entropy, riskPreference: value },
                  })
                }
              }}
            />
            <div className="text-xs text-muted-foreground">{Math.round(settings.entropy.riskPreference * 100)}%</div>
          </div>
          <div className="space-y-2">
            <Label className="text-card-foreground">Repeat Penalty</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.entropy.repeatPenalty}
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value)
                if (!isNaN(value) && value >= 0 && value <= 1) {
                  setSettings({
                    ...settings,
                    entropy: { ...settings.entropy, repeatPenalty: value },
                  })
                }
              }}
            />
            <div className="text-xs text-muted-foreground">{Math.round(settings.entropy.repeatPenalty * 100)}%</div>
          </div>
          <div className="space-y-2">
            <Label className="text-card-foreground">Phrase Penalty</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.entropy.phrasePenalty}
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value)
                if (!isNaN(value) && value >= 0 && value <= 1) {
                  setSettings({
                    ...settings,
                    entropy: { ...settings.entropy, phrasePenalty: value },
                  })
                }
              }}
            />
            <div className="text-xs text-muted-foreground">{Math.round(settings.entropy.phrasePenalty * 100)}%</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-card-foreground">Formatting Safeguards</Label>
          <select
            value={settings.formattingMode}
            onChange={(e) => setSettings({ ...settings, formattingMode: e.target.value as any })}
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground"
          >
            <option value="smart">Smart (preserve code/tables)</option>
            <option value="strict">Strict (also lock lists/headings)</option>
          </select>
        </div>

        {/* History Analysis Toggle + Profile Preview */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="historyEnabled"
              checked={settings.historyEnabled}
              onChange={(e) => setSettings({ ...settings, historyEnabled: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="historyEnabled" className="text-card-foreground">
              Enable History Analysis
            </Label>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={async () => {
              try {
                const res = await fetch("/api/history/profile")
                const p = await res.json()
                alert(`History profile\nbrevity: ${Math.round(p.brevity_bias*100)}%\nformality: ${Math.round(p.formality_bias*100)}%\nstructure: ${Math.round(p.structure_bias*100)}%`)
              } catch (e) {
                alert("Failed to load history profile")
              }
            }}
          >
            View Derived Profile
          </button>
        </div>

        {/* Annotation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="annotationEnabled"
              checked={settings.annotation.enabled}
              onChange={(e) => setSettings({ ...settings, annotation: { ...settings.annotation, enabled: e.target.checked } })}
              className="rounded"
            />
            <Label htmlFor="annotationEnabled" className="text-card-foreground">Annotations</Label>
          </div>
          <div className="space-y-2">
            <Label className="text-card-foreground">Mode</Label>
            <select
              value={settings.annotation.mode}
              onChange={(e) => setSettings({ ...settings, annotation: { ...settings.annotation, mode: e.target.value as any } })}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground"
            >
              <option value="inline">Inline</option>
              <option value="sidecar">Sidecar</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-card-foreground">Verbosity</Label>
            <select
              value={settings.annotation.verbosity}
              onChange={(e) => setSettings({ ...settings, annotation: { ...settings.annotation, verbosity: e.target.value as any } })}
              className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-card-foreground">Keywords (comma-separated)</Label>
          <Input
            placeholder="keyword1, keyword2, keyword3"
            value={settings.keywords}
            onChange={(e) => setSettings({ ...settings, keywords: e.target.value })}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="earlyStop"
            checked={settings.earlyStop}
            onChange={(e) => setSettings({ ...settings, earlyStop: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="earlyStop" className="text-card-foreground">
            Early stop when target risk reached
          </Label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={handleStartProcessing}
            disabled={isProcessing || (!selectedInputPath && getUploadedFiles().length === 0)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            ) : 
             (!selectedInputPath && getUploadedFiles().length === 0) ? "Select file" :
             `Start (${selectedInputPath ? '1' : getUploadedFiles().length})`}
          </Button>
          
          {/* Reset button (Force Reset while processing, Reset otherwise) */}
          {isProcessing ? (
            <Button
              onClick={() => {
                
                setIsProcessing(false)
                setPassProgress(new Map())
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current)
                  processingTimeoutRef.current = null
                }
                if (stuckCheckTimeoutRef.current) {
                  clearTimeout(stuckCheckTimeoutRef.current)
                  stuckCheckTimeoutRef.current = null
                }
                window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: { type: "manual_force_reset" } }))
              }}
              variant="outline"
              className="text-xs"
            >
              Force Reset
            </Button>
          ) : (
            <Button
              onClick={() => {
                
                setIsProcessing(false)
                setPassProgress(new Map())
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current)
                  processingTimeoutRef.current = null
                }
                if (stuckCheckTimeoutRef.current) {
                  clearTimeout(stuckCheckTimeoutRef.current)
                  stuckCheckTimeoutRef.current = null
                }
                window.dispatchEvent(new CustomEvent("refiner-processing-complete", { detail: { type: "manual_reset" } }))
              }}
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              Reset
            </Button>
          )}
          
          <Button
            onClick={() => setDownloadModalOpen(true)}
            disabled={completedFiles.length === 0}
            variant="outline"
            className="border-primary text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Download {completedFiles.length > 0 && `(${completedFiles.length})`}
          </Button>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-800 font-medium">Processing in progress...</span>
            </div>
            <div className="text-blue-600 text-sm mt-1">
              Check the progress events below for real-time updates.
            </div>
            {/* Cost Tracking */}
            {(totalJobCost > 0 || currentPassCost > 0) && (
              <div className="mt-2 flex gap-4 text-sm">
                <div className="text-green-700">
                  <span className="font-medium">Total Cost:</span> ${totalJobCost.toFixed(4)}
                </div>
                {currentPassCost > 0 && (
                  <div className="text-blue-700">
                    <span className="font-medium">Current Pass:</span> ${currentPassCost.toFixed(4)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live Processing Events */}
        {processingEvents.length > 0 && (
          <div className="mt-6 space-y-2">
            <h4 className="text-card-foreground font-medium text-sm">Live Progress</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {processingEvents.slice(-10).map((event, index) => (
                <div key={index} className={`text-xs p-2 rounded border ${
                  event.type === 'error' ? 'bg-red-50 border-red-200' :
                  event.type === 'complete' ? 'bg-green-50 border-green-200' :
                  'bg-muted border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs ${
                      event.type === 'error' ? 'border-red-300 text-red-700' :
                      event.type === 'complete' ? 'border-green-300 text-green-700' :
                      'text-muted-foreground border-border'
                    }`}>
                      {event.type}
                    </Badge>
                    {event.duration && <span className="text-muted-foreground">{event.duration}ms</span>}
                  </div>
                  {event.fileName && <div className="text-muted-foreground mt-1">{event.fileName}</div>}
                  {event.stage && <div className="text-muted-foreground">Stage: {event.stage}</div>}
                  {event.message && <div className="text-muted-foreground">Message: {event.message}</div>}
                  {event.error && <div className="text-red-600">Error: {event.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    
    <DownloadModal 
      open={downloadModalOpen}
      onClose={() => setDownloadModalOpen(false)}
      downloadOptions={completedFiles}
    />
    </div>
  )
}
