'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle, Mail, Send, Loader2, Settings, Info } from 'lucide-react'

export default function EmailSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; recipient?: string } | null>(null)

  const sendTestEmail = async () => {
    setIsLoading(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await response.json()
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: data.message,
          recipient: data.recipient
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Test email gönderilemedi'
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Bağlantı hatası'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Ayarları</h2>
          <p className="text-gray-600">Environment variables ile SMTP konfigürasyonu</p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config">Konfigürasyon</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Environment Variables Konfigürasyonu
              </CardTitle>
              <CardDescription>
                SMTP ayarları .env.local dosyasından okunur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800">Environment Variables</h4>
                      <p className="text-blue-700 text-sm mt-1">
                        SMTP ayarları artık .env.local dosyasında saklanıyor. Bu daha güvenli ve yönetilebilir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm space-y-1">
                  <div># SMTP Configuration</div>
                  <div>SMTP_HOST=smtp.gmail.com</div>
                  <div>SMTP_PORT=587</div>
                  <div>SMTP_SECURE=true</div>
                  <div>SMTP_USERNAME=your-email@gmail.com</div>
                  <div>SMTP_PASSWORD=your-app-password</div>
                  <div>SMTP_FROM_EMAIL=your-email@gmail.com</div>
                  <div>SMTP_FROM_NAME=Backup System</div>
                  <div></div>
                  <div># Email Recipients (comma separated)</div>
                  <div>EMAIL_RECIPIENTS=admin@company.com,backup@company.com</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">SMTP Ayarları:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li><strong>SMTP_HOST:</strong> SMTP sunucu adresi</li>
                      <li><strong>SMTP_PORT:</strong> SMTP port (587/465)</li>
                      <li><strong>SMTP_SECURE:</strong> TLS/SSL kullanımı</li>
                      <li><strong>SMTP_USERNAME:</strong> Email kullanıcı adı</li>
                      <li><strong>SMTP_PASSWORD:</strong> Email şifresi/app password</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Gönderen Bilgileri:</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li><strong>SMTP_FROM_EMAIL:</strong> Gönderen email</li>
                      <li><strong>SMTP_FROM_NAME:</strong> Gönderen adı</li>
                      <li><strong>EMAIL_RECIPIENTS:</strong> Alıcı listesi (virgülle ayrılmış)</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 mb-2">Gmail için App Password:</h4>
                  <ol className="list-decimal list-inside text-yellow-700 text-sm space-y-1">
                    <li>Google hesabınızda 2-Factor Authentication'ı aktifleştirin</li>
                    <li>Google Account Settings → Security → App passwords</li>
                    <li>"Mail" için yeni bir app password oluşturun</li>
                    <li>Oluşturulan 16 haneli kodu SMTP_PASSWORD olarak kullanın</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Test
              </CardTitle>
              <CardDescription>
                SMTP konfigürasyonunuzu test edin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={sendTestEmail} 
                  disabled={isLoading}
                  className="w-full md:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Test Email Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Test Email Gönder
                    </>
                  )}
                </Button>

                {testResult && (
                  <div className={`border rounded-lg p-4 ${
                    testResult.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {testResult.success ? 'Test Başarılı!' : 'Test Başarısız'}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${
                      testResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {testResult.message}
                    </p>
                    {testResult.recipient && (
                      <p className="mt-1 text-sm text-green-600">
                        Alıcı: {testResult.recipient}
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Test Detayları:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Test emaili EMAIL_RECIPIENTS listesindeki ilk adrese gönderilir</li>
                    <li>• SMTP ayarları environment variables'dan okunur</li>
                    <li>• Başarılı gönderim email_logs tablosuna kaydedilir</li>
                    <li>• Hata durumunda detaylı hata mesajı gösterilir</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
