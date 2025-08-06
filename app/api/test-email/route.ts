import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USERNAME || !process.env.SMTP_PASSWORD) {
      return NextResponse.json({ 
        error: 'SMTP not configured. Please set SMTP_USERNAME and SMTP_PASSWORD in environment variables.' 
      }, { status: 400 })
    }

    // Get test recipient from environment or use a default
    const testRecipient = process.env.EMAIL_RECIPIENTS?.split(',')[0]?.trim() || process.env.SMTP_FROM_EMAIL

    if (!testRecipient) {
      return NextResponse.json({ 
        error: 'No test recipient found. Please set EMAIL_RECIPIENTS in environment variables.' 
      }, { status: 400 })
    }

    // Send test email
    const success = await sendEmail(user.userId, {
      to: testRecipient,
      subject: 'Test Email - Backup System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">🧪 Test Email</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Bu bir test emailidir.</p>
            <p><strong>Gönderilme Zamanı:</strong> ${new Date().toLocaleString('tr-TR')}</p>
            <p><strong>Kullanıcı:</strong> ${user.username}</p>
            <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
            <p><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</p>
          </div>
          <p style="color: #666;">SMTP konfigürasyonunuz başarıyla çalışıyor!</p>
        </div>
      `,
      text: `
Test Email - Backup System

Bu bir test emailidir.
Gönderilme Zamanı: ${new Date().toLocaleString('tr-TR')}
Kullanıcı: ${user.username}
SMTP Host: ${process.env.SMTP_HOST}
SMTP Port: ${process.env.SMTP_PORT}

SMTP konfigürasyonunuz başarıyla çalışıyor!
      `
    }, 'test')

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: `Test email sent successfully to ${testRecipient}`,
        recipient: testRecipient
      })
    } else {
      return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
  }
}
