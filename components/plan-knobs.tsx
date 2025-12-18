"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2, Circle, ArrowRight } from "lucide-react"

interface PassProgress {
  pass: number
  status: "pending" | "running" | "completed"
  inputChars?: number
  outputChars?: number
  currentStage?: string
}

interface PlanKnobsProps {
  weights?: { clarity: number; persuasion: number; brevity: number; formality: number }
  entropy?: { risk_preference?: number; repeat_penalty?: number; phrase_penalty?: number }
  formattingMode?: "smart" | "strict"
  passProgress?: PassProgress[]
  totalPasses?: number
}

export default function PlanKnobs({ weights, entropy, formattingMode, passProgress, totalPasses }: PlanKnobsProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground">Plan & Knobs</CardTitle>
        <CardDescription className="text-muted-foreground">
          Live pass progression and strategy weights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pass Progress Section */}
        {passProgress && passProgress.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">Pass Progression</div>
            {passProgress.map((p) => (
              <div 
                key={p.pass} 
                className={`p-3 rounded-lg border ${
                  p.status === "running" 
                    ? "border-primary bg-primary/5" 
                    : p.status === "completed"
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {p.status === "running" && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}
                  {p.status === "completed" && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {p.status === "pending" && (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    Pass {p.pass} {totalPasses && `of ${totalPasses}`}
                  </span>
                  {p.status === "running" && p.currentStage && (
                    <span className="text-xs text-muted-foreground">({p.currentStage})</span>
                  )}
                </div>
                
                {p.status === "running" && (
                  <div className="text-xs text-foreground flex items-center gap-2">
                    {p.inputChars !== undefined && (
                      <span>Read {p.inputChars.toLocaleString()} characters</span>
                    )}
                    {totalPasses && p.pass < totalPasses && (
                      <>
                        <ArrowRight className="h-3 w-3 text-primary" />
                        <span className="text-primary font-medium">Converging to Pass {p.pass + 1}</span>
                      </>
                    )}
                  </div>
                )}
                
                {p.status === "completed" && (
                  <div className="text-xs text-foreground flex items-center gap-2">
                    {p.inputChars !== undefined && (
                      <span>Input: {p.inputChars.toLocaleString()} chars</span>
                    )}
                    {p.outputChars !== undefined && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span>Output: {p.outputChars.toLocaleString()} chars</span>
                      </>
                    )}
                    {totalPasses && p.pass < totalPasses && (
                      <>
                        <ArrowRight className="h-3 w-3 text-green-500" />
                        <span className="text-green-500 font-medium">Proceeding to Pass {p.pass + 1}</span>
                      </>
                    )}
                    {totalPasses && p.pass === totalPasses && (
                      <span className="ml-2 text-green-500 font-medium">✓ Final pass completed</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Strategy Weights Section */}
        {!passProgress?.length && !weights && !entropy && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Start processing to see live strategy
          </div>
        )}
        
        {weights && (
          <>
            <div className="text-xs font-medium text-muted-foreground mb-2 mt-4 border-t border-border pt-4">Strategy Weights</div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(weights).map(([k, v]) => (
                <div key={k} className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-xs text-muted-foreground capitalize mb-1">{k}</div>
                  <div className="text-lg font-semibold text-foreground">{Math.round((v || 0) * 100)}%</div>
                </div>
              ))}
            </div>
          </>
        )}
        
        {entropy && (
          <>
            <div className="text-xs font-medium text-muted-foreground mb-2 mt-4">Entropy Management</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground mb-1">Risk Pref.</div>
                <div className="text-lg font-semibold text-foreground">{Math.round((entropy.risk_preference || 0) * 100)}%</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground mb-1">Repeat Pen.</div>
                <div className="text-lg font-semibold text-foreground">{(entropy.repeat_penalty || 0).toFixed(2)}</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-xs text-muted-foreground mb-1">Phrase Pen.</div>
                <div className="text-lg font-semibold text-foreground">{(entropy.phrase_penalty || 0).toFixed(2)}</div>
              </div>
            </div>
          </>
        )}
        
        {formattingMode && (
          <div className="text-xs text-muted-foreground border-t border-border pt-3">
            Formatting Mode: <span className="text-foreground font-medium capitalize">{formattingMode}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}











