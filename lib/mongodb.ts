/**
 * MongoDB Client for Frontend
 * Provides a client interface for MongoDB operations via API routes
 */

// Database table types (matching MongoDB schema)
export interface User {
  id: string
  email: string
  password_hash: string
  first_name: string
  last_name: string
  settings: {
    openai_api_key: string
    openai_model: string
    target_scanner_risk: number
    min_word_ratio: number
  }
  created_at: string
  last_login_at?: string
  is_active: boolean
  role: 'user' | 'admin'
  google_id?: string
  avatar_url?: string
}

export interface Admin {
  id: string
  user_id: string
  permissions: string[]
  created_at: string
  created_by?: string
}

export interface UsageStats {
  id: string
  user_id: string
  request_count: number
  tokens_in: number
  tokens_out: number
  cost: number
  model: string
  job_id?: string
  date: string
  created_at: string
  updated_at: string
}

export interface SystemLog {
  id: string
  user_id?: string
  action?: string
  details?: string
  level?: string
  logger_name?: string
  message?: string
  module?: string
  function_name?: string
  line_number?: number
  traceback?: string
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface Job {
  id: string
  user_id?: string
  file_name: string
  file_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_passes: number
  current_pass: number
  model: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface JobEvent {
  id: string
  job_id: string
  event_type: string
  message: string
  pass_number?: number
  details: Record<string, any>
  created_at: string
}

/**
 * MongoDB client helper functions
 * These functions call the Next.js API routes which handle MongoDB operations
 */
export const mongodb = {
  /**
   * Check if MongoDB is configured
   */
  isConfigured: (): boolean => {
    // MongoDB is configured if the backend API is available
    // The actual MongoDB connection is handled server-side
    return true
  },

  /**
   * Get user by email (via API route)
   */
  getUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/users?email=' + encodeURIComponent(email))
      if (!response.ok) return null
      const data = await response.json()
      return data.user || null
    } catch (error) {
      console.error('Failed to get user by email:', error)
      return null
    }
  },

  /**
   * Create user (via API route)
   */
  createUser: async (userData: Partial<User>): Promise<User | null> => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      if (!response.ok) return null
      const data = await response.json()
      return data.user || null
    } catch (error) {
      console.error('Failed to create user:', error)
      return null
    }
  },

  /**
   * Update user (via API route)
   */
  updateUser: async (userId: string, updates: Partial<User>): Promise<User | null> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      if (!response.ok) return null
      const data = await response.json()
      return data.user || null
    } catch (error) {
      console.error('Failed to update user:', error)
      return null
    }
  },

  /**
   * Insert system log (via API route)
   */
  insertSystemLog: async (logData: Partial<SystemLog>): Promise<boolean> => {
    try {
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      })
      return response.ok
    } catch (error) {
      console.error('Failed to insert system log:', error)
      return false
    }
  }
}

// Export for backward compatibility (if code expects supabase-like interface)
export { mongodb as supabase }

