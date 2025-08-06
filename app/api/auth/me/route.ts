import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({ 
      user: { id: user.userId, username: user.username } 
    })
  } catch (error) {
    console.error('Auth verification failed:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }
}
