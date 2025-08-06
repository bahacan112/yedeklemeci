import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''
    const recursive = searchParams.get('recursive') === 'true'
    const targetUserEmail = searchParams.get('userEmail') || process.env.TARGET_USER_EMAIL

    console.log('[BROWSE] Browsing OneDrive for user:', targetUserEmail, 'Path:', path, 'Recursive:', recursive)

    if (!targetUserEmail) {
      return NextResponse.json({ 
        error: 'Target user email not specified. Please set TARGET_USER_EMAIL in environment variables or provide userEmail parameter.' 
      }, { status: 400 })
    }

    // Get Microsoft access token
    const accessToken = await getMicrosoftAccessToken()

    // First, get the user ID from email
    const userId = await getUserIdFromEmail(accessToken, targetUserEmail)
    
    let graphUrl: string

    // Browse specific user's OneDrive
    if (path && path !== '/') {
      graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${path}:/children`
    } else {
      graphUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root/children`
    }
    // Fixed: Remove problematic $orderby with folder field, use client-side sorting instead
    graphUrl += '?$select=id,name,folder,file,size,lastModifiedDateTime,parentReference&$orderby=name asc'

    console.log('[BROWSE] Graph API URL:', graphUrl)

    const response = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[BROWSE] Graph API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Microsoft Graph API error: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Process drive items
    let items = data.value.map((item: { id: string, name: string, folder?: any, file?: any, size?: number, lastModifiedDateTime: string, parentReference: any }) => ({
      id: item.id,
      name: item.name,
      isFolder: !!item.folder,
      size: item.size || 0,
      lastModified: item.lastModifiedDateTime,
      path: path ? `${path}/${item.name}` : `/${item.name}`,
      itemCount: item.folder?.childCount || 0
    }))

    // If recursive is requested, get subfolders for each folder
    if (recursive) {
      const foldersWithSubfolders = []
      
      for (const item of items) {
        if (item.isFolder) {
          try {
            const subfolderUrl = `https://graph.microsoft.com/v1.0/users/${userId}/drive/root:${item.path}:/children?$select=id,name,folder&$filter=folder ne null&$orderby=name asc`
            
            const subfolderResponse = await fetch(subfolderUrl, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            })

            if (subfolderResponse.ok) {
              const subfolderData = await subfolderResponse.json()
              const subfolders = subfolderData.value.map((subfolder: { id: string, name: string, folder?: any }) => ({
                id: subfolder.id,
                name: `${item.name}/${subfolder.name}`,
                isFolder: true,
                size: 0,
                lastModified: item.lastModified,
                path: `${item.path}/${subfolder.name}`,
                itemCount: subfolder.folder?.childCount || 0,
                isSubfolder: true,
                parentPath: item.path
              }))
              
              foldersWithSubfolders.push(item, ...subfolders)
            } else {
              foldersWithSubfolders.push(item)
            }
          } catch (error) {
            console.warn('[BROWSE] Error getting subfolders for:', item.path)
            foldersWithSubfolders.push(item)
          }
        }
      }
      
      // Replace folders with expanded list
      items = [
        ...foldersWithSubfolders,
        ...items.filter(item => !item.isFolder)
      ]
    }

    // Client-side sorting: folders first, then files, both sorted by name
    items.sort((a: any, b: any) => {
      // First sort by type (folders first)
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      
      // Then sort by name
      return a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' })
    })

    // Separate folders and files
    const folders = items.filter((item: { isFolder: boolean }) => item.isFolder)
    const files = items.filter((item: { isFolder: boolean }) => !item.isFolder)

    return NextResponse.json({
      currentPath: path || '/',
      parentPath: getParentPath(path || '/'),
      folders,
      files,
      totalItems: items.length,
      targetUser: targetUserEmail,
      userId: userId
    })

  } catch (error) {
    console.error('[BROWSE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to browse OneDrive' },
      { status: 500 }
    )
  }
}

async function getUserIdFromEmail(accessToken: string, email: string): Promise<string> {
  console.log('[BROWSE] Getting user ID for email:', email)
  
  // Try to get user by email
  const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`
  
  const response = await fetch(userUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[BROWSE] Failed to get user:', response.status, errorText)
    throw new Error(`User not found: ${email}. Error: ${response.status} - ${errorText}`)
  }

  const userData = await response.json()
  console.log('[BROWSE] Found user:', userData.userPrincipalName, 'ID:', userData.id)
  
  return userData.id
}

async function getMicrosoftAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Microsoft token request failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

function getParentPath(currentPath: string): string | null {
  if (currentPath === '/' || currentPath === '') {
    return null
  }
  
  const parts = currentPath.split('/').filter(part => part !== '')
  if (parts.length <= 1) {
    return '/'
  }
  
  return '/' + parts.slice(0, -1).join('/')
}
