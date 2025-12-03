"use client"

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
import { Button } from "@/components/ui/button"
import { RefreshCw, Wifi } from "lucide-react"
import { useState } from "react"

interface ResumeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResume: () => void
  lastPass: number
  fileName: string
}

export default function ResumeModal({
  open,
  onOpenChange,
  onResume,
  lastPass,
  fileName,
}: ResumeModalProps) {
  const [checking, setChecking] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const handleResumeClick = async () => {
    setChecking(true)
    // Simple connectivity check
    try {
      await fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
      setIsOnline(true)
      onResume()
      onOpenChange(false)
    } catch (e) {
      setIsOnline(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
            <Wifi className="h-5 w-5" />
            Connection Interrupted
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              It seems the network connection was lost during the refinement of <strong>{fileName}</strong>.
            </p>
            <p>
              We successfully completed <strong>Pass {lastPass}</strong>. Would you like to resume processing from there?
            </p>
            {!isOnline && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                Still offline. Please check your internet connection and try again.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel Job</AlertDialogCancel>
          <Button 
            onClick={handleResumeClick} 
            disabled={checking}
            className="bg-yellow-400 text-black hover:bg-yellow-500"
          >
            {checking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking Connection...
              </>
            ) : (
              "Resume Processing"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
