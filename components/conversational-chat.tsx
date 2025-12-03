"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface ChatMessage {
  id: string
  type: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  metadata?: {
    command?: string
    schemaUpdates?: Record<string, number>
  }
}

interface ConversationalChatProps {
  onSchemaUpdate?: (schemaLevels: Record<string, number>) => void
  currentSchemaLevels: Record<string, number>
}

export default function ConversationalChat({ onSchemaUpdate, currentSchemaLevels }: ConversationalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      type: "system",
      content:
        "Welcome to the Conversational Refiner! I can help you adjust schema settings, explain refinement processes, and provide guidance. Try commands like /schema, /show settings, or ask me anything about text refinement.",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date(),
    }

    const messageToProcess = inputValue // Store the message before clearing input
    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsProcessing(true)

    // Process the message
    await processMessage(messageToProcess)
    setIsProcessing(false)
  }

  const processMessage = async (message: string) => {
    let response: ChatMessage

    // Handle commands locally
    if (message.startsWith("/")) {
      response = handleCommand(message)
      setMessages((prev) => [...prev, response])
      return
    }

    // Forward to backend chat via proxy
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, schemaLevels: currentSchemaLevels }),
      })
      const data = await res.json()
      if (!res.ok) {
        response = {
          id: Date.now().toString(),
          type: "assistant",
          content: data?.error || "Chat error.",
          timestamp: new Date(),
        }
      } else {
        response = {
          id: Date.now().toString(),
          type: "assistant",
          content: data?.reply || "",
          timestamp: new Date(),
        }
      }
    } catch (e) {
      response = {
        id: Date.now().toString(),
        type: "assistant",
        content: "Network error while contacting chat backend.",
        timestamp: new Date(),
      }
    }

    setMessages((prev) => [...prev, response])
  }

  const handleCommand = (command: string): ChatMessage => {
    const parts = command.split(" ")
    const cmd = parts[0].toLowerCase()

    switch (cmd) {
      case "/schema":
        return {
          id: Date.now().toString(),
          type: "assistant",
          content: `Current schema levels:\n${Object.entries(currentSchemaLevels)
            .map(([key, value]) => `• ${key.replace(/_/g, " ")}: ${value}`)
            .join("\n")}`,
          timestamp: new Date(),
          metadata: { command: "schema" },
        }

      case "/show":
        if (parts[1] === "settings") {
          return {
            id: Date.now().toString(),
            type: "assistant",
            content: `Current settings:\n• Schema levels: ${Object.keys(currentSchemaLevels).length} parameters\n• Active refinement mode: Multi-pass\n• Early stop: Enabled\n• Target risk: 15%`,
            timestamp: new Date(),
            metadata: { command: "show_settings" },
          }
        }
        break

      case "/set":
        // Parse /set schema:id level=X
        const match = command.match(/\/set\s+schema:(\w+)\s+level=(\d+)/)
        if (match) {
          const [, schemaId, level] = match
          const newLevel = Number.parseInt(level)
          if (newLevel >= 0 && newLevel <= 3) {
            const updatedSchema = { ...currentSchemaLevels, [schemaId]: newLevel }
            onSchemaUpdate?.(updatedSchema)
            return {
              id: Date.now().toString(),
              type: "assistant",
              content: `Updated ${schemaId.replace(/_/g, " ")} to level ${newLevel}`,
              timestamp: new Date(),
              metadata: { command: "set_schema", schemaUpdates: { [schemaId]: newLevel } },
            }
          }
        }
        break
    }

    return {
      id: Date.now().toString(),
      type: "assistant",
      content: `Unknown command: ${command}\n\nAvailable commands:\n• /schema - Show current schema levels\n• /show settings - Display current settings\n• /set schema:id level=X - Update schema level (0-3)`,
      timestamp: new Date(),
    }
  }

  // Removed local mock logic; backend powers general queries via /api/chat

  const getMessageColor = (type: ChatMessage["type"]) => {
    switch (type) {
      case "user":
        return "bg-blue-50 text-blue-900 ml-8 border border-blue-200"
      case "assistant":
        return "bg-muted text-foreground mr-8 border border-border"
      case "system":
        return "bg-yellow-50 text-yellow-900 mx-4 border border-yellow-200"
      default:
        return "bg-muted text-foreground border border-border"
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <Card className="bg-card border-border h-[40rem] md:h-[44rem] flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-card-foreground text-lg">Conversational Refiner</CardTitle>
            <CardDescription className="text-muted-foreground">AI assistant for refinement guidance</CardDescription>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200">Online</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-auto">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 break-words overscroll-contain">
          {messages.map((message) => (
            <div key={message.id} className={`p-3 rounded-lg ${getMessageColor(message.type)}`}>
              <div className="flex items-center justify-between mb-1">
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  {message.type}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              {message.metadata?.command && (
                <div className="mt-2 text-xs text-muted-foreground">Command: {message.metadata.command}</div>
              )}
            </div>
          ))}
          {isProcessing && (
            <div className="bg-muted p-3 rounded-lg mr-8 border border-border">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground" />
                <span className="text-muted-foreground text-sm">Assistant is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex space-x-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about refinement, use /commands, or chat naturally..."
              className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              disabled={isProcessing}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Try: /schema, /show settings, /set schema:anti_scanner_techniques level=3
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
