import { NextRequest, NextResponse } from 'next/server'
import { createSmtpConfig, getSmtpConfigsByUser, updateSmtpConfig, deleteSmtpConfig } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configs = getSmtpConfigsByUser(user.userId)
    
    // Hide sensitive password information
    const safeConfigs = configs.map(config => ({
      ...config,
      smtp_password: '***hidden***'
    }))

    return NextResponse.json({ configs: safeConfigs })
  } catch (error) {
    console.error('Get SMTP configs error:', error)
    return NextResponse.json({ error: 'Failed to get SMTP configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, smtpHost, smtpPort, smtpSecure, smtpUsername, smtpPassword, fromEmail, fromName, isActive } = await request.json()

    if (!name || !smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !fromEmail || !fromName) {
      return NextResponse.json({ error: 'Tüm alanlar zorunludur' }, { status: 400 })
    }

    // If this is set as active, deactivate other configs
    if (isActive) {
      const existingConfigs = getSmtpConfigsByUser(user.userId)
      for (const config of existingConfigs) {
        if (config.is_active) {
          updateSmtpConfig(config.id, { is_active: false })
        }
      }
    }

    const config = createSmtpConfig({
      user_id: user.userId,
      name,
      smtp_host: smtpHost,
      smtp_port: parseInt(smtpPort),
      smtp_secure: smtpSecure,
      smtp_username: smtpUsername,
      smtp_password: smtpPassword,
      from_email: fromEmail,
      from_name: fromName,
      is_active: isActive
    })

    // Hide password in response
    const safeConfig = {
      ...config,
      smtp_password: '***hidden***'
    }

    return NextResponse.json({ config: safeConfig })
  } catch (error) {
    console.error('Create SMTP config error:', error)
    return NextResponse.json({ error: 'Failed to create SMTP config' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, ...updates } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Config ID is required' }, { status: 400 })
    }

    // If this is set as active, deactivate other configs
    if (updates.is_active) {
      const existingConfigs = getSmtpConfigsByUser(user.userId)
      for (const config of existingConfigs) {
        if (config.is_active && config.id !== id) {
          updateSmtpConfig(config.id, { is_active: false })
        }
      }
    }

    const config = updateSmtpConfig(id, updates)
    
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    // Hide password in response
    const safeConfig = {
      ...config,
      smtp_password: '***hidden***'
    }

    return NextResponse.json({ config: safeConfig })
  } catch (error) {
    console.error('Update SMTP config error:', error)
    return NextResponse.json({ error: 'Failed to update SMTP config' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Config ID is required' }, { status: 400 })
    }

    const success = deleteSmtpConfig(parseInt(id))
    
    if (!success) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete SMTP config error:', error)
    return NextResponse.json({ error: 'Failed to delete SMTP config' }, { status: 500 })
  }
}
