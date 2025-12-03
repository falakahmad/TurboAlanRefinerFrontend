/**
 * MongoDB Users API Route
 * Handles user CRUD operations via MongoDB
 */
import { NextRequest, NextResponse } from "next/server"

// MongoDB connection (server-side only)
let mongodb: any = null

async function getMongoClient() {
  if (mongodb) return mongodb
  
  try {
    const { MongoClient } = require('mongodb')
    const uri = process.env.MONGODB_URL || process.env.MONGO_URL || process.env.MONGO_URI
    
    if (!uri) {
      console.warn("MongoDB URL not configured")
      return null
    }
    
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    
    await client.connect()
    const db = client.db(process.env.MONGODB_DB_NAME || 'alan_refiner')
    mongodb = { client, db }
    
    return mongodb
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error)
    return null
  }
}

// GET /api/mongodb/users?email=...
export async function GET(request: NextRequest) {
  try {
    const mongo = await getMongoClient()
    if (!mongo) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }
    
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userId = searchParams.get('userId')
    
    if (email) {
      const user = await mongo.db.collection('users').findOne({ email: email.toLowerCase() })
      if (user) {
        // Convert ObjectId to string
        user._id = user._id.toString()
        return NextResponse.json({ user })
      }
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    if (userId) {
      const user = await mongo.db.collection('users').findOne({ id: userId })
      if (user) {
        user._id = user._id.toString()
        return NextResponse.json({ user })
      }
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    return NextResponse.json({ error: "email or userId required" }, { status: 400 })
  } catch (error) {
    console.error("MongoDB users GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/mongodb/users
export async function POST(request: NextRequest) {
  try {
    const mongo = await getMongoClient()
    if (!mongo) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }
    
    const body = await request.json()
    const { email, password_hash, first_name, last_name, settings, role, is_active, google_id, avatar_url } = body
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    
    // Check if user already exists
    const existing = await mongo.db.collection('users').findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 })
    }
    
    // Create new user
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()
    
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      password_hash: password_hash || '',
      first_name: first_name || '',
      last_name: last_name || '',
      settings: settings || {
        openai_api_key: '',
        openai_model: 'gpt-4',
        target_scanner_risk: 15,
        min_word_ratio: 0.8
      },
      role: role || 'user',
      is_active: is_active !== undefined ? is_active : true,
      google_id: google_id || null,
      avatar_url: avatar_url || null,
      created_at: now,
      last_login_at: null
    }
    
    await mongo.db.collection('users').insertOne(newUser)
    
    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = newUser
    
    return NextResponse.json({ user: userResponse }, { status: 201 })
  } catch (error) {
    console.error("MongoDB users POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


