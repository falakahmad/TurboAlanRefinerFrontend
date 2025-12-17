"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFiles } from "@/contexts/FileContext"
import { refinerClient } from "@/lib/refiner-client"
import { formatFilePath } from "@/lib/path-utils"

export default function FileUploadSection() {
  const { files, addFile, removeFile, updateFile } = useFiles()
  const [driveUrl, setDriveUrl] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
  const [showDriveBrowser, setShowDriveBrowser] = useState(false)
  const [driveFiles, setDriveFiles] = useState<any[]>([])
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false)
  const [driveError, setDriveError] = useState<string | null>(null)

  const handleFileUpload = useCallback(async (uploadedFiles: FileList) => {
    const fileArray = Array.from(uploadedFiles)
    
    // Supported file extensions and MIME types
    const SUPPORTED_EXTENSIONS = ['.txt', '.docx', '.doc', '.pdf', '.md']
    const SUPPORTED_MIME_TYPES = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown'
    ]
    
    for (const file of fileArray) {
      // Validate file type before processing
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      const isValidExt = SUPPORTED_EXTENSIONS.includes(fileExt)
      const isValidMime = SUPPORTED_MIME_TYPES.includes(file.type) || file.type === '' // Some browsers don't set MIME type
      
      if (!isValidExt && !isValidMime) {
        alert(`Unsupported file type: ${file.name}. Supported formats: TXT, DOCX, DOC, PDF, MD`)
        continue
      }
      
      const fileId = Math.random().toString(36).substr(2, 9)
      const newFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: "local" as const,
        source: file.name,
        uploaded: false,
      }
      
      // Add file to context immediately
      addFile(newFile)
      setUploadingFiles(prev => new Set(prev).add(fileId))
      
      try {
        // Create FormData for file upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('file_id', fileId)
        
        // Upload file to backend
        const response = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (response.ok) {
          const result = await response.json()
          // Store actual path for backend, but display will be sanitized
          const actualPath = result.temp_path || result.file_path || file.name
          // CRITICAL FIX: Store the backend's file_id properly
          // The backend generates its own file_id (like "file_12345_6789") and stores 
          // file info under that key - we MUST use this ID when starting refinement
          updateFile(fileId, { 
            uploaded: true,
            status: "uploaded",
            // Backend's file_id - this is what we need to use for refinement
            driveId: result.file_id,
            backendFileId: result.file_id,  // Explicit field for backend file_id
            // Backend returns temp_path; use that as source path
            source: actualPath,
            // Store file type for extension preservation
            fileType: result.file_type,
            // Store display name separately
            displayName: formatFilePath(actualPath, file.name)
          })
        } else {
          updateFile(fileId, { 
            uploadError: 'Upload failed',
            uploaded: false 
          })
        }
      } catch (error) {
        updateFile(fileId, { 
          uploadError: `Upload error: ${error}`,
          uploaded: false 
        })
      } finally {
        setUploadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileId)
          return newSet
        })
      }
    }
  }, [addFile, updateFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFiles = e.dataTransfer.files
      if (droppedFiles.length > 0) {
        handleFileUpload(droppedFiles)
      }
    },
    [handleFileUpload],
  )

  const handleDriveAdd = async () => {
    if (driveUrl.trim()) {
      // Check if it's a folder URL (not supported)
      if (driveUrl.includes('/folders/') && !driveUrl.includes('/file/')) {
        alert('Folder URLs are not supported. Please use a direct file link or file ID.')
        return
      }
      
      const fileId = extractDriveFileId(driveUrl)
      if (!fileId || fileId === "unknown") {
        alert('Could not extract file ID from the Google Drive URL. Please check the URL and try again.')
        return
      }
      
      const newFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Drive Document ${fileId}`,
        size: 0,
        type: "drive" as const,
        source: driveUrl,
        driveId: fileId,
        uploaded: false,
      }
      
      addFile(newFile)
      setUploadingFiles(prev => new Set(prev).add(newFile.id))
      
      try {
        // Verify drive file access
        const fileInfo = await refinerClient.getDriveFileInfo(fileId)
        updateFile(newFile.id, { 
          uploaded: true,
          status: "uploaded",
          name: fileInfo.name || `Drive Document ${fileId}`,
          size: fileInfo.size || 0
        })
      } catch (error) {
        updateFile(newFile.id, { 
          uploadError: `Drive access failed: ${error}`,
          uploaded: false 
        })
      } finally {
        setUploadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(newFile.id)
          return newSet
        })
        setDriveUrl("")
      }
    }
  }

  const extractDriveFileId = (url: string): string => {
    if (!url) return "unknown"
    
    // Handle folder URLs - these should not be used for files
    if (url.includes('/folders/')) {
      const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/)
      return match ? match[1] : "unknown"
    }
    
    // Handle file view URLs: https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
    if (url.includes('/file/d/')) {
      const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)
      if (match) return match[1]
    }
    
    // Handle document URLs: https://docs.google.com/document/d/FILE_ID/edit
    if (url.includes('/document/d/') || url.includes('/spreadsheets/d/') || url.includes('/presentation/d/')) {
      const match = url.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9-_]+)/)
      if (match) return match[2]
    }
    
    // Handle standard share URLs: https://drive.google.com/drive/u/0/folders/FILE_ID or /d/FILE_ID
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) return match[1]
    
    // Handle query parameter: ?id=FILE_ID
    const urlObj = new URL(url)
    if (urlObj.searchParams.has('id')) {
      return urlObj.searchParams.get('id') || "unknown"
    }
    
    // If it's already just an ID (no slashes or special chars), return it
    if (!url.includes('/') && !url.includes('?')) {
      return url
    }
    
    // Last resort: try to get the last segment
    return url.split("/").pop()?.split("?")[0] || "unknown"
  }

  const [serviceAccountEmail, setServiceAccountEmail] = useState<string | null>(null)

  const handleBrowseDrive = async () => {
    setShowDriveBrowser(true)
    setLoadingDriveFiles(true)
    setDriveError(null)
    
    try {
      const result = await refinerClient.listDriveFiles("root", 50)
      setDriveFiles(result.files || [])
      setServiceAccountEmail(result.service_account_email || null)
    } catch (error) {
      console.error('Failed to load Drive files:', error)
      setDriveError(`Failed to load Google Drive files: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoadingDriveFiles(false)
    }
  }

  const handleSelectDriveFile = async (file: any) => {
    const fileId = file.id
    const newFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name || `Drive Document ${fileId}`,
      size: file.size || 0,
      type: "drive" as const,
      source: `https://docs.google.com/document/d/${fileId}`,
      driveId: fileId,
      uploaded: false,
    }
    
    addFile(newFile)
    setUploadingFiles(prev => new Set(prev).add(newFile.id))
    setShowDriveBrowser(false)
    
    try {
      // Verify drive file access
      const fileInfo = await refinerClient.getDriveFileInfo(fileId)
      updateFile(newFile.id, { 
        uploaded: true,
        name: fileInfo.name || file.name || `Drive Document ${fileId}`,
        size: fileInfo.size || file.size || 0
      })
    } catch (error) {
      updateFile(newFile.id, { 
        uploadError: `Drive access failed: ${error}`,
        uploaded: false 
      })
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(newFile.id)
        return newSet
      })
    }
  }

  const handleRemoveFile = (id: string) => {
    removeFile(id)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "Unknown size"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  return (
    <Card className="bg-white border-gray-200 shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-gray-900 flex items-center gap-2">
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          File Sources
        </CardTitle>
        <CardDescription className="text-gray-600">
          Upload local files or connect Google Drive documents
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1">
            <TabsTrigger
              value="local"
              className="text-gray-700 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Local Upload
            </TabsTrigger>
            <TabsTrigger
              value="drive"
              className="text-gray-700 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-sm"
            >
              Google Drive
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local" className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                isDragging
                  ? "border-yellow-400 bg-yellow-50 scale-[1.02]"
                  : "border-gray-300 hover:border-yellow-400 hover:bg-yellow-50/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-yellow-600" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="text-gray-900">
                  <p className="text-base font-medium">Drag and drop files here, or</p>
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer text-yellow-600 hover:text-yellow-700 underline font-medium"
                  >
                    browse files
                  </Label>
                </div>
                <p className="text-sm text-gray-500">Supports .txt, .docx, .doc, .pdf, .md files up to 10MB</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                multiple
                accept=".txt,.docx,.doc,.pdf,.md,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
            </div>
          </TabsContent>

          <TabsContent value="drive" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-gray-900 font-medium">Google Drive URL or File ID</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/document/d/... or file ID"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                />
                <Button onClick={handleDriveAdd} className="bg-yellow-400 text-black hover:bg-yellow-500 shadow-sm">
                  Add
                </Button>
              </div>
            </div>

            <Button 
              onClick={handleBrowseDrive}
              className="w-full bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-yellow-400 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Browse Google Drive
            </Button>
          </TabsContent>
        </Tabs>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              Selected Files ({files.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      {file.type === "local" ? (
                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 text-sm font-medium">{file.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500 text-xs">
                          {file.type === "local" ? formatFileSize(file.size || 0) : "Google Drive"}
                        </p>
                        {uploadingFiles.has(file.id) && (
                          <span className="text-blue-600 text-xs">Uploading...</span>
                        )}
                        {file.uploaded && !uploadingFiles.has(file.id) && (
                          <span className="text-green-600 text-xs">✓ Uploaded</span>
                        )}
                        {file.uploadError && (
                          <span className="text-red-600 text-xs">✗ {file.uploadError}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(file.id)}
                    className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                    disabled={uploadingFiles.has(file.id)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Google Drive Browser Modal */}
      {showDriveBrowser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDriveBrowser(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Browse Google Drive Files
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDriveBrowser(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingDriveFiles ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-gray-600">Loading Google Drive files...</p>
                </div>
              ) : driveError ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium mb-2">Error loading files</p>
                  <p className="text-gray-600 text-sm">{driveError}</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">No files found</p>
                  <p className="text-gray-600 text-sm mb-4">
                    No accessible files found in Google Drive. Service accounts can only access files that are explicitly shared with them.
                  </p>
                  <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-gray-700 font-medium mb-2">To access your files:</p>
                    <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside mb-3">
                      <li>Share the files/folders with the service account email</li>
                      {serviceAccountEmail && (
                        <li className="ml-4 mt-1">
                          <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-blue-200">
                            {serviceAccountEmail}
                          </span>
                        </li>
                      )}
                      <li>Or use the "Google Drive URL or File ID" input above to add files directly</li>
                    </ol>
                    {serviceAccountEmail && (
                      <p className="text-xs text-gray-500 mt-2">
                        Copy the email above and share your Google Drive files/folders with it to make them accessible here.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {driveFiles
                    .filter((file: any) => {
                      const mimeType = file.mimeType || file.mime_type || ''
                      return mimeType.includes('document') || 
                             mimeType.includes('text') || 
                             mimeType.includes('spreadsheet') ||
                             mimeType === 'application/vnd.google-apps.document' ||
                             mimeType === 'application/vnd.google-apps.spreadsheet'
                    })
                    .map((file: any) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                        onClick={() => handleSelectDriveFile(file)}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 font-medium text-sm truncate">{file.name}</p>
                            <p className="text-gray-500 text-xs">
                              {file.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Size unknown'}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-yellow-400 text-black hover:bg-yellow-500 flex-shrink-0 ml-2"
                        >
                          Select
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
