/**
 * MongoDB Users API Route - Dynamic User ID Route
 * Handles PATCH operations for specific users
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

// PATCH /api/mongodb/users/:userId
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const mongo = await getMongoClient()
    if (!mongo) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }
    
    const body = await request.json()
    const userId = params.userId
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }
    
    // Update user
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    }
    
    // Remove id from update data (don't allow changing the ID)
    delete updateData.id
    delete updateData._id
    delete updateData.userId
    
    console.log(`Updating user ${userId} with data:`, updateData)
    
    const result = await mongo.db.collection('users').findOneAndUpdate(
      { id: userId },
      { $set: updateData },
      { returnDocument: 'after' }
    )
    
    if (!result.value) {
      console.warn(`User ${userId} not found for update`)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    
    const user = result.value
    user._id = user._id.toString()
    
    console.log(`User ${userId} updated successfully:`, { 
      google_id: user.google_id, 
      avatar_url: user.avatar_url 
    })
    
    // Remove password_hash from response
    const { password_hash: _, ...userResponse } = user
    
    return NextResponse.json({ user: userResponse })
  } catch (error) {
    console.error("MongoDB users PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


