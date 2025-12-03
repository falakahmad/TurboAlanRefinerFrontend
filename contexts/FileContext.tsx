"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'

export interface FileItem {
  id: string
  name: string
  type: "local" | "drive"
  source?: string
  driveId?: string
  size?: number
  uploadedAt?: Date
  uploaded?: boolean
  uploadError?: string
  status?: "uploading" | "uploaded" | "processing" | "completed" | "error"
}

interface FileContextType {
  files: FileItem[]
  addFile: (file: FileItem) => void
  removeFile: (id: string) => void
  updateFile: (id: string, updates: Partial<FileItem>) => void
  getUploadedFiles: () => FileItem[]
  clearFiles: () => void
}

const FileContext = createContext<FileContextType | undefined>(undefined)

export function FileProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([])

  // Load files from localStorage on mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('refiner-uploaded-files')
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles)
        setFiles(parsedFiles)
      } catch (error) {
        console.error('Failed to load uploaded files:', error)
      }
    }
  }, [])

  // Save files to localStorage whenever files change
  useEffect(() => {
    localStorage.setItem('refiner-uploaded-files', JSON.stringify(files))
  }, [files])

  const addFile = (file: FileItem) => {
    setFiles(prev => [...prev, file])
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id))
  }

  const updateFile = (id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(file => 
      file.id === id ? { ...file, ...updates } : file
    ))
  }

  const getUploadedFiles = () => {
    return files.filter(file => file.status === "uploaded" || file.status === "completed")
  }

  const clearFiles = () => {
    setFiles([])
  }

  return (
    <FileContext.Provider value={{
      files,
      addFile,
      removeFile,
      updateFile,
      getUploadedFiles,
      clearFiles
    }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFiles() {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider')
  }
  return context
}