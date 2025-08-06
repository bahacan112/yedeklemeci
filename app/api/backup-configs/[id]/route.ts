import { NextRequest, NextResponse } from 'next/server'
import { getBackupConfig, updateBackupConfig, deleteBackupConfig, removeBackupSource, addBackupSource } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configId = parseInt(params.id)
    const config = getBackupConfig(configId)
    
    if (!config || config.user_id !== user.userId) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Get config error:', error)
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configId = parseInt(params.id)
    const { name, sourcePaths, oneDrivePath, googleDrivePath, retentionDays } = await request.json()

    // Check if config exists and belongs to user
    const existingConfig = getBackupConfig(configId)
    if (!existingConfig || existingConfig.user_id !== user.userId) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // Update basic config info
    const updatedConfig = updateBackupConfig(configId, {
      name,
      onedrive_path: oneDrivePath,
      googledrive_path: googleDrivePath,
      retention_days: retentionDays || 7
    })

    if (!updatedConfig) {
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    // Update source paths if provided
    if (sourcePaths && Array.isArray(sourcePaths)) {
      // Remove all existing sources
      const existingSources = existingConfig.sources || []
      for (const source of existingSources) {
        removeBackupSource(source.id)
      }

      // Add new sources
      for (const sourcePath of sourcePaths) {
        addBackupSource(configId, sourcePath)
      }
    }

    // Get updated config with sources
    const finalConfig = getBackupConfig(configId)
    return NextResponse.json({ config: finalConfig })
  } catch (error) {
    console.error('Update config error:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configId = parseInt(params.id)
    
    // Check if config exists and belongs to user
    const existingConfig = getBackupConfig(configId)
    if (!existingConfig || existingConfig.user_id !== user.userId) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    const success = deleteBackupConfig(configId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete config error:', error)
    return NextResponse.json({ error: 'Failed to delete config' }, { status: 500 })
  }
}
