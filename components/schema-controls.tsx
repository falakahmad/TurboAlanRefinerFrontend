"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSchema } from "@/contexts/SchemaContext"

interface SchemaPreset {
  name: string
  description: string
  levels: Record<string, number>
}

export default function SchemaControls() {
  const { schemaLevels, updateSchemaLevel, applyPreset, resetToDefaults } = useSchema()

  const [presets] = useState<SchemaPreset[]>([
    {
      name: "Conservative",
      description: "Minimal changes, preserve original style",
      levels: {
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
    },
    {
      name: "Balanced",
      description: "Moderate refinement with good detection reduction",
      levels: {
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
    },
    {
      name: "Aggressive",
      description: "Maximum detection reduction, significant changes",
      levels: {
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
    },
    {
      name: "Academic Focus",
      description: "Optimized for academic writing and research papers",
      levels: {
        microstructure_control: 2,
        macrostructure_analysis: 2,
        anti_scanner_techniques: 2,
        entropy_management: 1,
        semantic_tone_tuning: 1,
        formatting_safeguards: 3,
        refiner_control: 2,
        history_analysis: 2,
        annotation_mode: 0,
        humanize_academic: 3,
      },
    },
  ])

  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [sessionName, setSessionName] = useState("")

  const getLevelLabel = (value: number) => {
    switch (value) {
      case 0:
        return "Off"
      case 1:
        return "Low"
      case 2:
        return "Medium"
      case 3:
        return "High"
      default:
        return "Medium"
    }
  }

  const getLevelColor = (value: number) => {
    switch (value) {
      case 0:
        return "text-muted-foreground"
      case 1:
        return "text-blue-600"
      case 2:
        return "text-green-600"
      case 3:
        return "text-orange-600"
      default:
        return "text-muted-foreground"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "detection":
        return "bg-red-100 text-red-700 border-red-200"
      case "structure":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "quality":
        return "bg-green-100 text-green-700 border-green-200"
      case "formatting":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const filteredSchemas =
    activeCategory === "all" ? schemaLevels : schemaLevels.filter((schema) => schema.category === activeCategory)

  const categories = ["all", "detection", "structure", "quality", "formatting"]

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground">Schema Controls</CardTitle>
            <CardDescription className="text-muted-foreground">Fine-tune refinement parameters</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-medium">Quick Presets</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presets.map((preset) => (
              <Button
                key={preset.name}
                variant="ghost"
                size="sm"
                onClick={() => applyPreset(preset.levels)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted text-xs p-3 h-auto flex-col items-start w-full justify-start text-left whitespace-normal break-words"
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs opacity-70 leading-snug">{preset.description}</div>
              </Button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label className="text-foreground text-sm font-medium">Category Filter</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={activeCategory === category ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveCategory(category)}
                className={
                  activeCategory === category
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 h-7 px-2 text-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted h-7 px-2 text-xs"
                }
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Schema Controls */}
        <div className="space-y-4">
          {filteredSchemas.map((schema) => (
            <div key={schema.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Label className="text-foreground text-sm font-medium">{schema.name}</Label>
                  <Badge className={getCategoryColor(schema.category)}>{schema.category}</Badge>
                </div>
                <span className={`text-xs font-medium ${getLevelColor(schema.value)}`}>
                  {getLevelLabel(schema.value)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{schema.description}</p>
              <Slider
                value={[schema.value]}
                onValueChange={(value) => updateSchemaLevel(schema.id, value[0])}
                max={3}
                min={0}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Off</span>
                <span>Low</span>
                <span>Med</span>
                <span>High</span>
              </div>
            </div>
          ))}
        </div>

        {/* Session Management */}
        <div className="pt-4 border-t border-border space-y-3">
          <Label className="text-foreground text-sm font-medium">Save Current Configuration</Label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Session name (optional)"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm"
            />
            <Button 
              onClick={() => {
                const sessionData = {
                  name: sessionName || `Session ${new Date().toISOString()}`,
                  timestamp: new Date().toISOString(),
                  schemaLevels: schemaLevels.reduce(
                    (acc, schema) => {
                      acc[schema.id] = schema.value
                      return acc
                    },
                    {} as Record<string, number>,
                  ),
                }

                // Save to localStorage (in real app would save to backend)
                const savedSessions = JSON.parse(localStorage.getItem("schema-sessions") || "[]")
                savedSessions.push(sessionData)
                localStorage.setItem("schema-sessions", JSON.stringify(savedSessions))

                console.log("Session saved:", sessionData)
                setSessionName("")
              }} 
              size="sm" 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save
            </Button>
          </div>
        </div>

        {/* Current Configuration Summary */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">Active Configuration:</p>
            <div className="grid grid-cols-2 gap-1">
              {schemaLevels
                .filter((s) => s.value > 0)
                .map((schema) => (
                  <span key={schema.id} className="text-foreground/80">
                    {schema.name.split(" ")[0]}: {getLevelLabel(schema.value)}
                  </span>
                ))}
            </div>
            <div className="mt-2 text-muted-foreground">
              {schemaLevels.filter((s) => s.value > 0).length} of {schemaLevels.length} schemas active
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}