import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Microsoft Graph API authentication
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const tenantId = process.env.MICROSOFT_TENANT_ID
    
    if (!clientId || !clientSecret || !tenantId) {
      return NextResponse.json(
        { error: 'Microsoft credentials not configured' },
        { status: 500 }
      )
    }

    // OAuth2 flow for Microsoft Graph
    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/callback/microsoft')}&` +
      `scope=${encodeURIComponent('https://graph.microsoft.com/Files.ReadWrite.All offline_access')}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Microsoft auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
