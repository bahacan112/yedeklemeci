import nodemailer from 'nodemailer'
import { createEmailLog, updateEmailLog } from './database'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// Environment-based SMTP configuration
function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USERNAME!,
      pass: process.env.SMTP_PASSWORD!
    },
    from_email: process.env.SMTP_FROM_EMAIL!,
    from_name: process.env.SMTP_FROM_NAME || 'Backup System'
  }
}

// Get email recipients from environment
function getEmailRecipients(): string[] {
  const recipients = process.env.EMAIL_RECIPIENTS || ''
  return recipients.split(',').map(email => email.trim()).filter(email => email.length > 0)
}

export async function sendEmail(userId: number, options: EmailOptions, notificationType: string): Promise<boolean> {
  try {
    // Check if SMTP is configured
    if (!process.env.SMTP_USERNAME || !process.env.SMTP_PASSWORD) {
      console.log('[EMAIL] SMTP not configured in environment variables, skipping email')
      return false
    }

    const smtpConfig = getSmtpConfig()

    // Create email log entry
    const emailLog = createEmailLog({
      user_id: userId,
      recipient_email: options.to,
      subject: options.subject,
      notification_type: notificationType,
      status: 'pending'
    })

    try {
      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.auth
      })

      // Send email
      await transporter.sendMail({
        from: `"${smtpConfig.from_name}" <${smtpConfig.from_email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      })

      // Update email log as sent
      updateEmailLog(emailLog.id, {
        status: 'sent',
        sent_at: new Date().toISOString()
      })

      console.log(`[EMAIL] Email sent successfully to ${options.to} - Subject: ${options.subject}`)
      return true

    } catch (error) {
      // Update email log with error
      updateEmailLog(emailLog.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })

      console.error('[EMAIL] Email sending failed:', error)
      return false
    }

  } catch (error) {
    console.error('[EMAIL] Email setup failed:', error)
    return false
  }
}

export async function sendBackupNotification(
  userId: number, 
  notificationType: 'backup_success' | 'backup_error' | 'backup_summary',
  data: any
): Promise<void> {
  try {
    // Get email recipients from environment variables
    const recipients = getEmailRecipients()
    
    if (recipients.length === 0) {
      console.log(`[EMAIL] No email recipients configured in environment variables`)
      return
    }

    console.log(`[EMAIL] Sending ${notificationType} notification to ${recipients.length} recipients`)

    // Generate email content based on notification type
    const emailContent = generateEmailContent(notificationType, data)

    // Send email to each recipient
    let successCount = 0
    for (const recipientEmail of recipients) {
      const success = await sendEmail(userId, {
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      }, notificationType)
      
      if (success) successCount++
    }

    console.log(`[EMAIL] Backup notification sent successfully to ${successCount}/${recipients.length} recipients`)

  } catch (error) {
    console.error('[EMAIL] Failed to send backup notification:', error)
  }
}

function generateEmailContent(notificationType: string, data: any): { subject: string; html: string; text: string } {
  const timestamp = new Date().toLocaleString('tr-TR')

  switch (notificationType) {
    case 'backup_success':
      return {
        subject: `✅ Yedekleme Başarılı - ${data.configName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background: #22c55e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">✅ Yedekleme Başarıyla Tamamlandı</h2>
            </div>
            <div style="padding: 20px;">
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <h3 style="margin: 0 0 15px 0; color: #166534;">${data.configName}</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 5px 0; font-weight: bold;">Tarih:</td><td style="padding: 5px 0;">${timestamp}</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold;">Dosya Adı:</td><td style="padding: 5px 0; font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${data.fileName}</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold;">Dosya Boyutu:</td><td style="padding: 5px 0;">${formatFileSize(data.fileSize)}</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold;">Kaynak Klasör:</td><td style="padding: 5px 0;">${data.sourceFolders} adet</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold;">İşlem Süresi:</td><td style="padding: 5px 0;">${Math.round(data.processingTime / 1000)} saniye</td></tr>
                  ${data.deletedOldBackups > 0 ? `<tr><td style="padding: 5px 0; font-weight: bold;">Silinen Eski Yedek:</td><td style="padding: 5px 0;">${data.deletedOldBackups} adet</td></tr>` : ''}
                </table>
              </div>
              <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">
                  📁 Yedekleme dosyası OneDrive ve Google Drive'a başarıyla yüklendi.<br>
                  🔄 Eski yedekler otomatik olarak temizlendi.<br>
                  ⏰ Bu otomatik bir mesajdır, lütfen yanıtlamayın.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
✅ YEDEKLEME BAŞARILI

Konfigürasyon: ${data.configName}
Tarih: ${timestamp}
Dosya Adı: ${data.fileName}
Dosya Boyutu: ${formatFileSize(data.fileSize)}
Kaynak Klasör Sayısı: ${data.sourceFolders}
İşlem Süresi: ${Math.round(data.processingTime / 1000)} saniye
${data.deletedOldBackups > 0 ? `Silinen Eski Yedek: ${data.deletedOldBackups} adet` : ''}

Yedekleme dosyası OneDrive ve Google Drive'a başarıyla yüklendi.
Bu otomatik bir mesajdır, lütfen yanıtlamayın.
        `
      }

    case 'backup_error':
      return {
        subject: `❌ Yedekleme Hatası - ${data.configName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">❌ Yedekleme Başarısız</h2>
            </div>
            <div style="padding: 20px;">
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <h3 style="margin: 0 0 15px 0; color: #991b1b;">${data.configName}</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 5px 0; font-weight: bold;">Tarih:</td><td style="padding: 5px 0;">${timestamp}</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold;">İşlem Süresi:</td><td style="padding: 5px 0;">${Math.round(data.processingTime / 1000)} saniye</td></tr>
                  <tr><td style="padding: 5px 0; font-weight: bold; vertical-align: top;">Hata:</td><td style="padding: 5px 0; font-family: monospace; background: #fee2e2; padding: 8px; border-radius: 4px; color: #991b1b;">${data.error}</td></tr>
                </table>
              </div>
              <div style="background: #fef3c7; padding: 15px; border-radius: 6px; border: 1px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  ⚠️ <strong>Önerilen İşlemler:</strong><br>
                  • Yedekleme konfigürasyonunu kontrol edin<br>
                  • OneDrive ve Google Drive bağlantılarını test edin<br>
                  • Kaynak klasörlerin erişilebilir olduğundan emin olun<br>
                  • Gerekirse yedekleme işlemini manuel olarak tekrar deneyin
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
❌ YEDEKLEME BAŞARISIZ

Konfigürasyon: ${data.configName}
Tarih: ${timestamp}
İşlem Süresi: ${Math.round(data.processingTime / 1000)} saniye
Hata: ${data.error}

Önerilen İşlemler:
• Yedekleme konfigürasyonunu kontrol edin
• OneDrive ve Google Drive bağlantılarını test edin
• Kaynak klasörlerin erişilebilir olduğundan emin olun
• Gerekirse yedekleme işlemini manuel olarak tekrar deneyin
        `
      }

    case 'backup_summary':
      return {
        subject: `📊 Yedekleme Özeti - ${data.successCount}/${data.totalConfigs} Başarılı`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">📊 Yedekleme Özeti</h2>
            </div>
            <div style="padding: 20px;">
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; font-weight: bold;">Tarih:</td><td style="padding: 8px 0;">${timestamp}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Toplam Konfigürasyon:</td><td style="padding: 8px 0;">${data.totalConfigs}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Başarılı:</td><td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${data.successCount}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Başarısız:</td><td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${data.errorCount}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Toplam İşlem Süresi:</td><td style="padding: 8px 0;">${Math.round(data.totalProcessingTime / 1000)} saniye</td></tr>
                </table>
              </div>
              
              <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Detaylar:</h3>
              ${data.results.map((result: any) => `
                <div style="background: ${result.success ? '#f0fdf4' : '#fef2f2'}; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid ${result.success ? '#22c55e' : '#ef4444'};">
                  <h4 style="margin: 0 0 10px 0; color: ${result.success ? '#166534' : '#991b1b'};">${result.success ? '✅' : '❌'} ${result.configName}</h4>
                  ${result.success ? `
                    <p style="margin: 5px 0; font-size: 14px;"><strong>Dosya:</strong> <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px;">${result.fileName}</code></p>
                    <p style="margin: 5px 0; font-size: 14px;"><strong>Boyut:</strong> ${formatFileSize(result.fileSize)}</p>
                    <p style="margin: 5px 0; font-size: 14px;"><strong>Kaynak Klasör:</strong> ${result.sourceFolders} adet</p>
                    ${result.deletedOldBackups > 0 ? `<p style="margin: 5px 0; font-size: 14px;"><strong>Silinen Eski Yedek:</strong> ${result.deletedOldBackups} adet</p>` : ''}
                  ` : `
                    <p style="margin: 5px 0; color: #ef4444; font-size: 14px;"><strong>Hata:</strong> ${result.error}</p>
                  `}
                  <p style="margin: 5px 0; font-size: 14px;"><strong>Süre:</strong> ${Math.round(result.processingTime / 1000)} saniye</p>
                </div>
              `).join('')}
              
              <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin-top: 20px;">
                <p style="margin: 0; color: #475569; font-size: 14px;">
                  📈 Bu özet tüm yedekleme konfigürasyonlarının durumunu gösterir.<br>
                  ⏰ Bu otomatik bir mesajdır, lütfen yanıtlamayın.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
📊 YEDEKLEME ÖZETİ

Tarih: ${timestamp}
Toplam Konfigürasyon: ${data.totalConfigs}
Başarılı: ${data.successCount}
Başarısız: ${data.errorCount}
Toplam İşlem Süresi: ${Math.round(data.totalProcessingTime / 1000)} saniye

DETAYLAR:
${data.results.map((result: any) => `
${result.success ? '✅' : '❌'} ${result.configName}
${result.success ? `  Dosya: ${result.fileName}\n  Boyut: ${formatFileSize(result.fileSize)}\n  Kaynak Klasör: ${result.sourceFolders} adet${result.deletedOldBackups > 0 ? `\n  Silinen Eski Yedek: ${result.deletedOldBackups} adet` : ''}` : `  Hata: ${result.error}`}
  Süre: ${Math.round(result.processingTime / 1000)} saniye
`).join('\n')}

Bu özet tüm yedekleme konfigürasyonlarının durumunu gösterir.
Bu otomatik bir mesajdır, lütfen yanıtlamayın.
        `
      }

    default:
      return {
        subject: 'Yedekleme Bildirimi',
        html: '<p>Yedekleme işlemi tamamlandı.</p>',
        text: 'Yedekleme işlemi tamamlandı.'
      }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
