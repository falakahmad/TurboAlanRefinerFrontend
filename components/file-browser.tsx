"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FolderOpen, FileText, Upload, Download } from "lucide-react"
import { formatFilePath } from "@/lib/path-utils"
import { useFiles } from "@/contexts/FileContext"

interface FileBrowserProps {
  onFileSelect: (filePath: string) => void
  selectedInputPath?: string
}

interface BrowsedFile {
  id: string
  name: string
  path: string
  source: "browsed" | "uploaded"
}

export default function FileBrowser({ 
  onFileSelect, 
  selectedInputPath
}: FileBrowserProps) {
  const { files: uploadedFiles } = useFiles()
  const [inputPath, setInputPath] = useState(selectedInputPath || "")
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [browsedFiles, setBrowsedFiles] = useState<BrowsedFile[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Sync with selectedInputPath prop changes
  useEffect(() => {
    if (selectedInputPath && selectedInputPath !== inputPath) {
      setInputPath(selectedInputPath)
    }
  }, [selectedInputPath, inputPath])

  // Load available files from backend
  const loadAvailableFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/files')
      if (response.ok) {
        const data = await response.json()
        const backendFiles = data.files?.map((f: any) => f.filename) || []
        
        // Also include uploaded files from FileContext
        const contextFiles = uploadedFiles
          .filter(file => file.uploaded && (file.status === "uploaded" || file.status === "completed"))
          .map(file => file.source || file.name)
          .filter((path): path is string => !!path)
        
        // Combine and deduplicate
        const allFiles = Array.from(new Set([...backendFiles, ...contextFiles]))
        setAvailableFiles(allFiles)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAvailableFiles()
  }, [])

  // Refresh file list when uploaded files change
  useEffect(() => {
    loadAvailableFiles()
    // Debug: Log uploaded files whenever they change
    console.log('Uploaded files changed:', uploadedFiles)
    const uploaded = uploadedFiles.filter(file => 
      file.uploaded === true || 
      file.status === "uploaded" || 
      file.status === "completed" ||
      !!file.source
    )
    console.log('Files that should appear:', uploaded)
  }, [uploadedFiles])

  const handleInputPathChange = (path: string) => {
    setInputPath(path)
    onFileSelect(path)
  }


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('file_id', `upload_${Date.now()}`)

      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        const filePath = result.temp_path || result.file_path || result.filename
        
        // Check if this file already exists in uploaded files
        const existsInUploaded = uploadedFiles.some(
          uf => (uf.source === filePath || uf.name === filePath) && uf.uploaded
        )
        
        // Only add to browsed files if it's not already in uploaded files
        if (!existsInUploaded) {
          const browsedFile: BrowsedFile = {
            id: `browsed_${Date.now()}`,
            name: file.name, // Use original filename
            path: filePath,
            source: "browsed"
          }
          
          // Check if this file is already in the browsed list
          const existsInBrowsed = browsedFiles.some(bf => bf.path === filePath)
          if (!existsInBrowsed) {
            setBrowsedFiles(prev => [...prev, browsedFile])
          }
        }
        
        // Auto-select the newly browsed file
        setInputPath(filePath)
        onFileSelect(filePath)
        await loadAvailableFiles() // Refresh file list
      } else {
        alert('File upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed')
    } finally {
      setIsLoading(false)
    }
  }

  const browseInputFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.docx,.doc,.pdf,.md'
    input.style.display = 'none'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Upload the file and use the temp path
        handleFileUpload({ target: { files: [file] } } as any)
      }
    }
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
  }


  const downloadProcessedFile = async () => {
    if (!inputPath) {
      alert('Please select a file first')
      return
    }

    try {
      // Trigger download of the processed file (use files/download route)
      const response = await fetch(`/api/files/download?path=${encodeURIComponent(inputPath)}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `processed_${inputPath.split('/').pop() || 'file'}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Download failed')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Download failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Input File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Input File
          </CardTitle>
          <CardDescription>Select the file to process</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* All Available Files - Uploaded + Browsed */}
          {(() => {
            // Filter uploaded files - be lenient to catch all uploaded files
            const uploadedFileList = uploadedFiles
              .filter(file => {
                // Include file if:
                // 1. uploaded flag is explicitly true, OR
                // 2. status is "uploaded" or "completed", OR
                // 3. file has a source path (indicating it was uploaded)
                const hasUploadedFlag = file.uploaded === true
                const hasUploadedStatus = file.status === "uploaded" || file.status === "completed"
                const hasSource = !!file.source
                
                return hasUploadedFlag || hasUploadedStatus || hasSource
              })
              .map(file => ({
                id: file.id,
                name: file.name, // Original filename (e.g., "testing")
                path: file.source || file.name,
                source: "uploaded" as const,
                type: file.type || "local"
              }))
            
            const allFiles = [...uploadedFileList, ...browsedFiles]
            
            if (allFiles.length === 0) return null
            
            return (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select File ({allFiles.length})</Label>
                <p className="text-xs text-gray-500">Choose one file to process</p>
                <div className="space-y-2">
                  {allFiles.map((file) => {
                    const isSelected = inputPath === file.path
                    
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'bg-green-50 border-green-400 shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                              {file.name}
                            </p>
                            {file.source === "uploaded" && (file as any).type === "drive" && (
                              <p className="text-xs text-gray-500">Google Drive</p>
                            )}
                            {file.source === "uploaded" && (file as any).type === "local" && (
                              <p className="text-xs text-gray-500">Uploaded from Files tab</p>
                            )}
                            {file.source === "browsed" && (
                              <p className="text-xs text-gray-500">Browsed from Process tab</p>
                            )}
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-xs flex-shrink-0 ${
                              file.source === "uploaded" 
                                ? 'text-green-700 border-green-300' 
                                : 'text-blue-700 border-blue-300'
                            }`}
                          >
                            {file.source === "uploaded" ? "✓ Uploaded" : "📁 Browsed"}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleInputPathChange(file.path)}
                          className="ml-2 flex-shrink-0"
                        >
                          {isSelected ? (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Selected
                            </>
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Divider */}
          {(() => {
            const hasUploadedFiles = uploadedFiles.filter(file => file.uploaded && (file.status === "uploaded" || file.status === "completed")).length > 0
            const hasBrowsedFiles = browsedFiles.length > 0
            if (hasUploadedFiles || hasBrowsedFiles) {
              return (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* File Path Input - For manual entry or browsing new files */}
          <div className="space-y-2">
            <Label>Add New File</Label>
            <div className="flex gap-2">
              <Input
                value={inputPath}
                onChange={(e) => handleInputPathChange(e.target.value)}
                placeholder="Enter file path or browse for a new file"
                className="flex-1"
              />
              <Button onClick={browseInputFile} variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
            </div>
            <p className="text-xs text-gray-500">Browse a new file to add it to the selection list above</p>
          </div>

          {/* Available Files from Backend */}
          {availableFiles.filter(filename => {
            // Exclude files that are already shown in Uploaded Files section
            return !uploadedFiles.some(
              file => (file.source === filename || file.name === filename) && file.uploaded
            )
          }).length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Other Available Files</Label>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {availableFiles
                  .filter(filename => {
                    // Exclude files that are already shown in Uploaded Files section
                    return !uploadedFiles.some(
                      file => (file.source === filename || file.name === filename) && file.uploaded
                    )
                  })
                  .map((filename, index) => {
                    const isSelected = inputPath === filename
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded border transition-colors ${
                          isSelected ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm truncate" title={filename}>
                            {formatFilePath(filename, filename)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => handleInputPathChange(filename)}
                          className="ml-2 flex-shrink-0"
                        >
                          {isSelected ? "Selected" : "Select"}
                        </Button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {inputPath && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Selected
                </Badge>
                <span className="text-sm font-medium text-green-700" title={inputPath}>
                  {(() => {
                    // Try to find the file in uploadedFiles or browsedFiles to show the original name
                    const uploadedFile = uploadedFiles.find(
                      file => (file.source === inputPath || file.name === inputPath) && file.uploaded
                    )
                    const browsedFile = browsedFiles.find(bf => bf.path === inputPath)
                    
                    if (uploadedFile) return uploadedFile.name
                    if (browsedFile) return browsedFile.name
                    return formatFilePath(inputPath, "Selected file")
                  })()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Download Section */}
      {inputPath && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Ready to Download</h3>
                <p className="text-sm text-gray-600">Download your processed file</p>
              </div>
              <Button onClick={downloadProcessedFile} className="bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
