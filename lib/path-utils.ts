/**
 * Path utilities for sanitizing and displaying file paths
 * Handles both local system paths and server paths safely
 */

/**
 * Extract filename from a path, handling both Windows and Unix paths
 */
export function getFilename(path: string): string {
  if (!path) return ""
  
  // Handle Windows paths (C:\Users\...)
  if (path.includes("\\")) {
    return path.split("\\").pop() || path
  }
  
  // Handle Unix paths (/tmp/...)
  if (path.includes("/")) {
    return path.split("/").pop() || path
  }
  
  // Already a filename
  return path
}

/**
 * Sanitize path for display - only show filename, never full system paths
 */
export function sanitizePathForDisplay(path: string): string {
  if (!path) return ""
  
  // If it's already just a filename (no path separators), return as-is
  if (!path.includes("\\") && !path.includes("/")) {
    return path
  }
  
  // Extract filename only
  const filename = getFilename(path)
  
  // If it looks like a temp file, show a cleaner name
  if (filename.startsWith("tmp") || filename.includes("temp")) {
    // Try to extract original extension
    const ext = filename.split(".").pop()
    return `uploaded_file.${ext || "docx"}`
  }
  
  return filename
}

/**
 * Check if a path is a system path (Windows or Unix temp/system paths)
 */
export function isSystemPath(path: string): boolean {
  if (!path) return false
  
  // Windows system paths
  if (path.match(/^[A-Z]:\\/i)) return true
  if (path.includes("AppData\\Local\\Temp")) return true
  if (path.includes("\\Temp\\")) return true
  
  // Unix system paths
  if (path.startsWith("/tmp/")) return true
  if (path.startsWith("/var/tmp/")) return true
  
  return false
}

/**
 * Format file path for display - always safe for production
 */
export function formatFilePath(path: string, fallback: string = "file"): string {
  if (!path) return fallback
  
  // If it's a system path, sanitize it
  if (isSystemPath(path)) {
    return sanitizePathForDisplay(path)
  }
  
  // If it's a URL or Drive link, extract meaningful name
  if (path.startsWith("http")) {
    const url = new URL(path)
    const pathname = url.pathname
    const filename = pathname.split("/").pop() || "document"
    return decodeURIComponent(filename)
  }
  
  // If it's a Google Drive file ID format
  if (path.match(/^[A-Za-z0-9_-]{20,}$/)) {
    return `Google Drive Document`
  }
  
  // Otherwise, sanitize and return
  return sanitizePathForDisplay(path) || fallback
}


