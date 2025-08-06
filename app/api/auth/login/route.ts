import { NextRequest, NextResponse } from 'next/server'
import { verifyUser } from '@/lib/database'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-here')

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    console.log('[LOGIN] Login attempt for username:', username)

    if (!username || !password) {
      console.log('[LOGIN] Missing username or password')
      return NextResponse.json(
        { error: 'Kullanıcı adı ve şifre gereklidir' },
        { status: 400 }
      )
    }

    const user = await verifyUser(username, password)
    if (!user) {
      console.log('[LOGIN] Invalid credentials for username:', username)
      return NextResponse.json(
        { error: 'Geçersiz kullanıcı adı veya şifre' },
        { status: 401 }
      )
    }

    console.log('[LOGIN] User authenticated successfully:', user.username)

    // Create JWT token
    const token = await new SignJWT({ userId: user.id, username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    const response = NextResponse.json({ 
      success: true, 
      user: { id: user.id, username: user.username } 
    })

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/'
    })

    console.log('[LOGIN] Token set in cookie for user:', user.username)
    return response
  } catch (error) {
    console.error('[LOGIN] Login error:', error)
    return NextResponse.json(
      { error: 'Giriş başarısız' },
      { status: 500 }
    )
  }
}
