import { NextRequest, NextResponse } from 'next/server'
import { verifyUser, getBackupConfigsByUser, getBackupHistoryByConfig } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password are required'
      }, { status: 400 })
    }

    // Authenticate user
    const user = await verifyUser(username, password)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials'
      }, { status: 401 })
    }

    // Get all backup configurations
    const configs = await getBackupConfigsByUser(user.id)
    
    const configsWithHistory = configs.map(config => {
      const history = getBackupHistoryByConfig(config.id)
      const lastBackup = history[0] // Most recent backup
      
      return {
        id: config.id,
        name: config.name,
        sourceFolders: config.sources?.length || 0,
        retentionDays: config.retention_days,
        lastBackup: lastBackup ? {
          date: lastBackup.backup_date,
          status: lastBackup.status,
          fileName: lastBackup.file_name,
          fileSize: lastBackup.file_size,
          error: lastBackup.error_message
        } : null,
        totalBackups: history.length
      }
    })

    return NextResponse.json({
      success: true,
      user: username,
      timestamp: new Date().toISOString(),
      totalConfigs: configs.length,
      configs: configsWithHistory
    })

  } catch (error) {
    console.error('[CRON] Status check failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
