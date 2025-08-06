import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  return NextResponse.json({
    environmentCheck: {
      tenantId: tenantId ? `Set (${tenantId.substring(0, 8)}...)` : 'Missing',
      clientId: clientId ? `Set (${clientId.substring(0, 8)}...)` : 'Missing',
      clientSecret: clientSecret ? `Set (${clientSecret.substring(0, 4)}...)` : 'Missing'
    },
    endpoints: {
      tokenEndpoint: tenantId ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token` : 'Tenant ID missing',
      graphEndpoint: 'https://graph.microsoft.com/v1.0/me/drive/root'
    },
    requiredScopes: [
      'https://graph.microsoft.com/.default'
    ],
    requiredPermissions: [
      'Files.Read.All',
      'Files.ReadWrite.All',
      'Sites.Read.All',
      'Sites.ReadWrite.All'
    ],
    grantType: 'client_credentials',
    authType: 'Application (not Delegated)'
  })
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.MICROSOFT_TENANT_ID
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        missing: {
          tenantId: !tenantId,
          clientId: !clientId,
          clientSecret: !clientSecret
        }
      }, { status: 400 })
    }

    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })

    console.log('[DEBUG] Token request URL:', tokenUrl)
    console.log('[DEBUG] Token request body:', body.toString())

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body
    })

    const tokenResponseText = await tokenResponse.text()
    console.log('[DEBUG] Token response status:', tokenResponse.status)
    console.log('[DEBUG] Token response body:', tokenResponseText)

    if (!tokenResponse.ok) {
      return NextResponse.json({
        success: false,
        step: 'token_request',
        error: 'Token request failed',
        status: tokenResponse.status,
        response: tokenResponseText,
        possibleCauses: [
          'Invalid client credentials',
          'Incorrect tenant ID',
          'App registration not found',
          'Client secret expired'
        ]
      }, { status: 400 })
    }

    const tokenData = JSON.parse(tokenResponseText)
    
    if (!tokenData.access_token) {
      return NextResponse.json({
        success: false,
        step: 'token_parsing',
        error: 'No access token in response',
        response: tokenData
      }, { status: 400 })
    }

    // Test Graph API call
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    })

    const graphResponseText = await graphResponse.text()
    console.log('[DEBUG] Graph API response status:', graphResponse.status)
    console.log('[DEBUG] Graph API response body:', graphResponseText)

    if (!graphResponse.ok) {
      return NextResponse.json({
        success: false,
        step: 'graph_api_call',
        error: 'Graph API call failed',
        status: graphResponse.status,
        response: graphResponseText,
        possibleCauses: [
          'Insufficient permissions',
          'Admin consent not granted',
          'Wrong permission type (should be Application, not Delegated)',
          'Token scope issues'
        ]
      }, { status: 400 })
    }

    const graphData = JSON.parse(graphResponseText)

    return NextResponse.json({
      success: true,
      message: 'Microsoft connection successful',
      tokenInfo: {
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope
      },
      driveInfo: {
        id: graphData.id,
        name: graphData.name,
        driveType: graphData.driveType,
        owner: graphData.owner
      }
    })

  } catch (error) {
    console.error('[DEBUG] Unexpected error:', error)
    return NextResponse.json({
      success: false,
      step: 'unexpected_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
