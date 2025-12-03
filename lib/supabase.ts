import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create Supabase client if environment variables are available
let supabase: any = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log("Supabase client created successfully")
  } catch (error) {
    console.warn("Failed to create Supabase client:", error)
    supabase = null
  }
} else {
  console.warn("Supabase environment variables not configured, using fallback mode")
}

export { supabase }

// Database table types
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
  token_count: number
  cost: number
  date: string
  created_at: string
}

export interface SystemLog {
  id: string
  user_id?: string
  action: string
  details: string
  ip_address?: string
  user_agent?: string
  created_at: string
}
