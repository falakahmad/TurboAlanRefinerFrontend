"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FileUploadSection from "@/components/file-upload-section"
import ProcessingQueue from "@/components/processing-queue"
import SchemaControls from "@/components/schema-controls"
import ProcessingControls from "@/components/processing-controls"
import ResultsViewer from "@/components/results-viewer"
import LogViewer from "@/components/log-viewer"
import DiffViewer from "@/components/diff-viewer"
import ConversationalChat from "@/components/conversational-chat"
import PlanKnobs from "@/components/plan-knobs"
import AdminAnalytics from "@/components/admin-analytics"
import UsageSummary from "@/components/usage-summary"
import { useEffect } from "react"
import { useProcessing } from "@/contexts/ProcessingContext"
import { FileProvider } from "@/contexts/FileContext"
import { ProcessingProvider } from "@/contexts/ProcessingContext"
// import { ErrorBoundary } from "@/components/error-boundary"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("files")
  const { processingEvents } = useProcessing()

  // Load activeTab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('refiner-active-tab')
    if (savedTab) {
      setActiveTab(savedTab)
    }
  }, [])

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('refiner-active-tab', activeTab)
  }, [activeTab])
  const [schemaLevels, setSchemaLevels] = useState({
    microstructure_control: 2,
    macrostructure_analysis: 1,
    anti_scanner_techniques: 3,
    entropy_management: 2,
    semantic_tone_tuning: 1,
    formatting_safeguards: 3,
    refiner_control: 2,
    history_analysis: 1,
    annotation_mode: 0,
    humanize_academic: 2,
  })
  const [plan, setPlan] = useState<{ weights?: any; entropy?: any; formatting?: "smart"|"strict" }>({})
  const [passProgress, setPassProgress] = useState<Array<{pass: number; status: "pending" | "running" | "completed"; inputChars?: number; outputChars?: number; currentStage?: string}>>([])
  const [totalPasses, setTotalPasses] = useState<number>(0)

  useEffect(() => {
    const handler = (e: any) => {
      const ev = e.detail
      console.log("Dashboard received plan event:", ev)
      const mappedWeights = ev?.weights || ev?.plan?.weights || undefined
      const mappedEntropy = ev?.entropy || ev?.plan?.entropy || undefined
      const mappedFormatting = ev?.formatting || ev?.plan?.formatting || undefined
      setPlan({ weights: mappedWeights, entropy: mappedEntropy, formatting: mappedFormatting })
    }
    window.addEventListener("refiner-plan", handler)
    return () => window.removeEventListener("refiner-plan", handler)
  }, [])

  // Fallback: derive plan and pass progression from processingEvents when no window events captured
  useEffect(() => {
    try {
      // Strategy/plan fallback
      const lastStrategy = [...processingEvents].reverse().find(e => (e as any).type === 'strategy' || (e as any).type === 'plan') as any
      if (lastStrategy) {
        setPlan({
          weights: lastStrategy.weights || lastStrategy.plan?.weights,
          entropy: lastStrategy.entropy || lastStrategy.plan?.entropy,
          formatting: lastStrategy.formatting || lastStrategy.plan?.formatting,
        })
      }
      // Pass progression fallback
      const passMap = new Map<number, { pass: number; status: "pending" | "running" | "completed"; inputChars?: number; outputChars?: number; currentStage?: string }>()
      let total = 0
      for (const ev of processingEvents as any[]) {
        if (ev.type === 'pass_start' && ev.pass) {
          total = Math.max(total, ev.totalPasses || ev.pass)
          passMap.set(ev.pass, { pass: ev.pass, status: 'running', currentStage: 'starting' })
        }
        if (ev.type === 'stage_update' && ev.pass) {
          const curr = passMap.get(ev.pass) || { pass: ev.pass, status: 'running' as const, inputChars: undefined as number | undefined, outputChars: undefined as number | undefined, currentStage: undefined as string | undefined }
          curr.currentStage = ev.stage
          curr.status = 'running'
          passMap.set(ev.pass, curr)
        }
        if (ev.type === 'progress' && ev.pass) {
          const curr = passMap.get(ev.pass) || { pass: ev.pass, status: 'running' as const, inputChars: undefined as number | undefined, outputChars: undefined as number | undefined, currentStage: undefined as string | undefined }
          if (ev.inputSize !== undefined) curr.inputChars = ev.inputSize
          if (ev.outputSize !== undefined) curr.outputChars = ev.outputSize
          passMap.set(ev.pass, curr)
        }
        if (ev.type === 'pass_complete' && ev.pass) {
          total = Math.max(total, ev.totalPasses || ev.pass)
          const curr = passMap.get(ev.pass) || { pass: ev.pass, status: 'completed' as const, inputChars: undefined as number | undefined, outputChars: undefined as number | undefined, currentStage: undefined as string | undefined }
          curr.status = 'completed'
          curr.inputChars = ev.inputChars ?? curr.inputChars
          curr.outputChars = ev.outputChars ?? curr.outputChars
          passMap.set(ev.pass, curr)
        }
      }
      if (passMap.size > 0) {
        setPassProgress(Array.from(passMap.values()).sort((a, b) => a.pass - b.pass))
        setTotalPasses(total)
      }
    } catch {}
  }, [processingEvents])

  // Persist plan/passProgress/totalPasses to localStorage to preserve across navigations/reloads
  useEffect(() => {
    try {
      const saved = localStorage.getItem('refiner-dashboard-state')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.plan) setPlan(parsed.plan)
        if (Array.isArray(parsed.passProgress)) setPassProgress(parsed.passProgress)
        if (typeof parsed.totalPasses === 'number') setTotalPasses(parsed.totalPasses)
      }
    } catch (e) {
      console.warn('Failed to load dashboard state', e)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('refiner-dashboard-state', JSON.stringify({ plan, passProgress, totalPasses }))
    } catch {}
  }, [plan, passProgress, totalPasses])

  useEffect(() => {
    const handler = (e: any) => {
      const ev = e.detail
      
      // Defer state updates to avoid render-phase updates from sibling component dispatches
      requestAnimationFrame(() => {
        setPassProgress(ev.passProgress || [])
        setTotalPasses(ev.totalPasses || 0)
      })
    }
    window.addEventListener("refiner-pass-progress", handler)
    return () => window.removeEventListener("refiner-pass-progress", handler)
  }, [])

  return (
        <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-light text-foreground mb-2">Turbo Alan Refiner</h1>
            <p className="text-muted-foreground text-sm">Multi-pass text refinement with AI detection reduction</p>
          </div>
          {/* Temporarily commented out until fixed */}
          {/* <div className="mb-6">
            <UsageSummary />
          </div> */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-muted">
            <TabsTrigger
              value="files"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Files
            </TabsTrigger>
            <TabsTrigger
              value="process"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Process
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Results
            </TabsTrigger>
            <TabsTrigger
              value="diff"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Diff
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FileUploadSection />
              <ProcessingQueue />
            </div>
          </TabsContent>

          <TabsContent value="process" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProcessingControls />
                <PlanKnobs 
                  weights={plan.weights} 
                  entropy={plan.entropy} 
                  formattingMode={plan.formatting || "smart"} 
                  passProgress={passProgress}
                  totalPasses={totalPasses}
                />
              </div>
              <SchemaControls />
            </div>
          </TabsContent>
          <TabsContent value="results" className="mt-6">
            <ResultsViewer />
          </TabsContent>

          <TabsContent value="diff" className="mt-6">
            <DiffViewer />
          </TabsContent>

          <TabsContent value="chat" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversationalChat onSchemaUpdate={(levels: Record<string, number>) => setSchemaLevels(prev => ({ ...prev, ...levels }))} currentSchemaLevels={schemaLevels} />
              <div className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Quick Commands</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Common chat commands and shortcuts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary text-sm">/schema</code>
                      <p className="text-muted-foreground text-xs mt-1">Show current schema levels</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary text-sm">/show settings</code>
                      <p className="text-muted-foreground text-xs mt-1">Display current configuration</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <code className="text-primary text-sm">/set schema:anti_scanner_techniques level=3</code>
                      <p className="text-muted-foreground text-xs mt-1">Update specific schema level</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">Current Schema</CardTitle>
                    <CardDescription className="text-muted-foreground">Live schema level display</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(schemaLevels).map(([key, value]) => (
                        <div key={key} className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                          <span className="text-foreground font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Application Settings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Manage your API keys and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-card-foreground">OpenAI API Key</Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-card-foreground">Default Model</Label>
                    <select className="w-full px-3 py-2 rounded-md bg-input border border-border text-foreground">
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                  </div>

                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Settings</Button>
                </CardContent>
              </Card>

              <LogViewer />
              <AdminAnalytics />
            </div>
          </TabsContent>
        </Tabs>
        </div>
        </div>
  )
}
