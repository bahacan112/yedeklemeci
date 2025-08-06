import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-here')

export async function verifyToken(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    
    if (!token) {
      console.log('[AUTH] No token found in cookies')
      return null
    }

    console.log('[AUTH] Token found, verifying...')
    const { payload } = await jwtVerify(token, secret)
    console.log('[AUTH] Token verified successfully for user:', payload.username)
    
    return payload as { userId: number; username: string }
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error)
    return null
  }
}

export async function requireAuth(request: NextRequest) {
  const user = await verifyToken(request)
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}
