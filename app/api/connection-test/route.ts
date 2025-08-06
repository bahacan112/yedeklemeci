import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = {
      microsoft: { connected: false, error: null as string | null, details: null as any },
      google: { connected: false, error: null as string | null, details: null as any }
    }

    // Test Microsoft connection with user-specific approach
    try {
      console.log('[CONNECTION-TEST] Testing Microsoft OneDrive connection...')
      
      const targetUserEmail = process.env.TARGET_USER_EMAIL
      if (!targetUserEmail) {
        throw new Error('TARGET_USER_EMAIL environment variable not set')
      }

      const microsoftToken = await getMicrosoftAccessToken()
      console.log('[CONNECTION-TEST] Microsoft token obtained successfully')
      
      // Get user ID from email
      const userId = await getUserIdFromEmail(microsoftToken, targetUserEmail)
      console.log('[CONNECTION-TEST] User ID obtained:', userId)
      
      // Test access to user's OneDrive
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/drive`, {
        headers: {
          'Authorization': `Bearer ${microsoftToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('[CONNECTION-TEST] Microsoft drive response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        results.microsoft.connected = true
        results.microsoft.details = {
          driveType: data.driveType,
          owner: data.owner,
          quota: data.quota,
          userId: userId,
          targetUser: targetUserEmail,
          message: 'User OneDrive accessible'
        }
        console.log('[CONNECTION-TEST] Microsoft OneDrive connection successful')
      } else {
        const errorData = await response.text()
        results.microsoft.error = `Microsoft OneDrive access failed: ${response.status} - ${errorData}`
      }
    } catch (error) {
      console.error('[CONNECTION-TEST] Microsoft connection error:', error)
      results.microsoft.error = error instanceof Error ? error.message : 'Microsoft connection failed'
    }

    // Test Google connection
    try {
      console.log('[CONNECTION-TEST] Testing Google connection...')
      
      const googleToken = await getGoogleAccessToken()
      console.log('[CONNECTION-TEST] Google token obtained successfully')
      
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: {
          'Authorization': `Bearer ${googleToken}`
        }
      })

      console.log('[CONNECTION-TEST] Google API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        results.google.connected = true
        results.google.details = {
          user: data.user,
          storageQuota: data.storageQuota
        }
        console.log('[CONNECTION-TEST] Google connection successful')
      } else {
        const errorData = await response.text()
        results.google.error = `Google Drive API error: ${response.status} - ${errorData}`
      }
    } catch (error) {
      console.error('[CONNECTION-TEST] Google connection error:', error)
      results.google.error = error instanceof Error ? error.message : 'Google connection failed'
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[CONNECTION-TEST] General error:', error)
    return NextResponse.json(
      { error: 'Bağlantı testi başarısız' },
      { status: 500 }
    )
  }
}

async function getUserIdFromEmail(accessToken: string, email: string): Promise<string> {
  const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`
  
  const response = await fetch(userUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`User not found: ${email}. Error: ${response.status} - ${errorText}`)
  }

  const userData = await response.json()
  return userData.id
}

async function getMicrosoftAccessToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft credentials are missing in environment variables')
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Microsoft token request failed: ${response.status} - ${responseText}`)
  }

  const data = await response.json()
  
  if (!data.access_token) {
    throw new Error('No access token received from Microsoft')
  }

  return data.access_token
}

async function getGoogleAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google credentials are missing in environment variables')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(`Google token request failed: ${response.status} - ${responseText}`)
  }

  const data = await response.json()
  
  if (!data.access_token) {
    throw new Error('No access token received from Google')
  }

  return data.access_token
}
