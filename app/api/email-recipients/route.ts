import { NextRequest, NextResponse } from 'next/server'
import { createEmailRecipient, getEmailRecipientsByUser, updateEmailRecipient, deleteEmailRecipient } from '@/lib/database'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const recipients = getEmailRecipientsByUser(user.userId)
    return NextResponse.json({ recipients })
  } catch (error) {
    console.error('Get email recipients error:', error)
    return NextResponse.json({ error: 'Failed to get email recipients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name, notificationTypes, isActive } = await request.json()

    if (!email || !notificationTypes || notificationTypes.length === 0) {
      return NextResponse.json({ error: 'Email ve bildirim türleri zorunludur' }, { status: 400 })
    }

    const recipient = createEmailRecipient({
      user_id: user.userId,
      email,
      name,
      notification_types: notificationTypes,
      is_active: isActive !== false
    })

    return NextResponse.json({ recipient })
  } catch (error) {
    console.error('Create email recipient error:', error)
    return NextResponse.json({ error: 'Failed to create email recipient' }, { status: 500 })
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
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 })
    }

    const recipient = updateEmailRecipient(id, updates)
    
    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    return NextResponse.json({ recipient })
  } catch (error) {
    console.error('Update email recipient error:', error)
    return NextResponse.json({ error: 'Failed to update email recipient' }, { status: 500 })
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
      return NextResponse.json({ error: 'Recipient ID is required' }, { status: 400 })
    }

    const success = deleteEmailRecipient(parseInt(id))
    
    if (!success) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete email recipient error:', error)
    return NextResponse.json({ error: 'Failed to delete email recipient' }, { status: 500 })
  }
}
