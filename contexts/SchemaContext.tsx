"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export interface SchemaLevel {
  id: string
  name: string
  description: string
  value: number
  category: "detection" | "structure" | "quality" | "formatting"
  usageCount?: number // Track how many times this schema has been used
  lastUsed?: string // Track when this schema was last used
}

export interface SchemaUsageStats {
  totalUsages: number
  mostUsedSchema: string | null
  leastUsedSchema: string | null
  averageUsage: number
  schemasByCategory: Record<string, number>
}

interface SchemaContextType {
  schemaLevels: SchemaLevel[]
  updateSchemaLevel: (id: string, value: number) => void
  applyPreset: (preset: Record<string, number>) => void
  resetToDefaults: () => void
  getSchemaUsageStats: () => SchemaUsageStats
  incrementSchemaUsage: (schemaId: string) => void
  loadSchemaLevels: () => void
  saveSchemaLevels: () => void
}

const defaultSchemaLevels: SchemaLevel[] = [
  {
    id: "microstructure_control",
    name: "Microstructure Control",
    description: "Fine-grained sentence and phrase adjustments",
    value: 2,
    category: "structure",
    usageCount: 0,
  },
  {
    id: "macrostructure_analysis",
    name: "Macrostructure Analysis",
    description: "Document-level organization and flow",
    value: 1,
    category: "structure",
    usageCount: 0,
  },
  {
    id: "anti_scanner_techniques",
    name: "Anti-Scanner Techniques",
    description: "Methods to reduce AI detection flags",
    value: 3,
    category: "detection",
    usageCount: 0,
  },
  {
    id: "entropy_management",
    name: "Entropy Management",
    description: "Randomness and unpredictability control",
    value: 2,
    category: "detection",
    usageCount: 0,
  },
  {
    id: "semantic_tone_tuning",
    name: "Semantic Tone Tuning",
    description: "Adjust writing style and voice",
    value: 1,
    category: "quality",
    usageCount: 0,
  },
  {
    id: "formatting_safeguards",
    name: "Formatting Safeguards",
    description: "Preserve document structure and formatting",
    value: 3,
    category: "formatting",
    usageCount: 0,
  },
  {
    id: "refiner_control",
    name: "Refiner Control",
    description: "Overall refinement intensity",
    value: 2,
    category: "quality",
    usageCount: 0,
  },
  {
    id: "history_analysis",
    name: "History Analysis",
    description: "Learn from previous refinement passes",
    value: 1,
    category: "quality",
    usageCount: 0,
  },
  {
    id: "annotation_mode",
    name: "Annotation Mode",
    description: "Add explanatory notes and comments",
    value: 0,
    category: "formatting",
    usageCount: 0,
  },
  {
    id: "humanize_academic",
    name: "Humanize Academic",
    description: "Make academic writing more natural",
    value: 2,
    category: "quality",
    usageCount: 0,
  },
]

const SchemaContext = createContext<SchemaContextType | undefined>(undefined)

export function SchemaProvider({ children }: { children: ReactNode }) {
  const [schemaLevels, setSchemaLevels] = useState<SchemaLevel[]>(defaultSchemaLevels)

  // Load schema levels from localStorage on mount
  const loadSchemaLevels = () => {
    try {
      const saved = localStorage.getItem('refiner-schema-levels')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSchemaLevels(prev => prev.map(schema => ({
          ...schema,
          value: parsed[schema.id] ?? schema.value,
          usageCount: parsed[`${schema.id}_usage`] ?? schema.usageCount ?? 0,
          lastUsed: parsed[`${schema.id}_lastUsed`] ?? schema.lastUsed,
        })))
      }
    } catch (error) {
      console.error('Failed to load schema levels:', error)
    }
  }

  // Save schema levels to localStorage
  const saveSchemaLevels = () => {
    try {
      const toSave = schemaLevels.reduce((acc, schema) => {
        acc[schema.id] = schema.value
        acc[`${schema.id}_usage`] = schema.usageCount ?? 0
        acc[`${schema.id}_lastUsed`] = schema.lastUsed
        return acc
      }, {} as Record<string, any>)
      
      localStorage.setItem('refiner-schema-levels', JSON.stringify(toSave))
    } catch (error) {
      console.error('Failed to save schema levels:', error)
    }
  }

  // Load on mount
  useEffect(() => {
    loadSchemaLevels()
  }, [])

  // Save whenever schema levels change
  useEffect(() => {
    saveSchemaLevels()
  }, [schemaLevels])

  const updateSchemaLevel = (id: string, value: number) => {
    setSchemaLevels(prev => 
      prev.map(schema => 
        schema.id === id 
          ? { ...schema, value, lastUsed: new Date().toISOString() }
          : schema
      )
    )
  }

  const applyPreset = (preset: Record<string, number>) => {
    setSchemaLevels(prev => 
      prev.map(schema => ({
        ...schema,
        value: preset[schema.id] ?? schema.value,
        lastUsed: preset[schema.id] !== undefined ? new Date().toISOString() : schema.lastUsed,
      }))
    )
  }

  const resetToDefaults = () => {
    setSchemaLevels(prev => 
      prev.map(schema => ({ 
        ...schema, 
        value: 2,
        lastUsed: new Date().toISOString(),
      }))
    )
  }

  const incrementSchemaUsage = (schemaId: string) => {
    setSchemaLevels(prev => 
      prev.map(schema => 
        schema.id === schemaId 
          ? { 
              ...schema, 
              usageCount: (schema.usageCount ?? 0) + 1,
              lastUsed: new Date().toISOString(),
            }
          : schema
      )
    )
  }

  const getSchemaUsageStats = (): SchemaUsageStats => {
    const activeSchemas = schemaLevels.filter(s => s.value > 0)
    const totalUsages = schemaLevels.reduce((sum, s) => sum + (s.usageCount ?? 0), 0)
    
    if (activeSchemas.length === 0) {
      return {
        totalUsages: 0,
        mostUsedSchema: null,
        leastUsedSchema: null,
        averageUsage: 0,
        schemasByCategory: {},
      }
    }

    const mostUsed = activeSchemas.reduce((max, current) => 
      (current.usageCount ?? 0) > (max.usageCount ?? 0) ? current : max
    )
    
    const leastUsed = activeSchemas.reduce((min, current) => 
      (current.usageCount ?? 0) < (min.usageCount ?? 0) ? current : min
    )

    const schemasByCategory = activeSchemas.reduce((acc, schema) => {
      acc[schema.category] = (acc[schema.category] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalUsages,
      mostUsedSchema: mostUsed.id,
      leastUsedSchema: leastUsed.id,
      averageUsage: totalUsages / activeSchemas.length,
      schemasByCategory,
    }
  }

  return (
    <SchemaContext.Provider value={{
      schemaLevels,
      updateSchemaLevel,
      applyPreset,
      resetToDefaults,
      getSchemaUsageStats,
      incrementSchemaUsage,
      loadSchemaLevels,
      saveSchemaLevels,
    }}>
      {children}
    </SchemaContext.Provider>
  )
}

export function useSchema() {
  const context = useContext(SchemaContext)
  if (context === undefined) {
    throw new Error('useSchema must be used within a SchemaProvider')
  }
  return context
}
