import { NextRequest, NextResponse } from 'next/server'
import { createBackupConfig, getBackupConfigsByUser } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configs = await getBackupConfigsByUser(user.userId)
    return NextResponse.json({ configs })
  } catch (error) {
    console.error('Get configs error:', error)
    return NextResponse.json({ error: 'Failed to get configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, sourcePaths, oneDrivePath, googleDrivePath, retentionDays } = await request.json()

    if (!sourcePaths || sourcePaths.length === 0) {
      return NextResponse.json({ error: 'En az bir kaynak klasör belirtmelisiniz' }, { status: 400 })
    }

    const config = await createBackupConfig({
      user_id: user.userId,
      name,
      onedrive_path: oneDrivePath,
      googledrive_path: googleDrivePath,
      retention_days: retentionDays || 7
    }, sourcePaths)

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Create config error:', error)
    return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
  }
}
