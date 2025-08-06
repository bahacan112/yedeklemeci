'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react'

export default function MicrosoftSetupGuide() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runDebugTest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/microsoft/debug', { method: 'POST' })
      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      setDebugInfo({ success: false, error: 'Debug test failed' })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Microsoft Azure Kurulum Rehberi
          </CardTitle>
          <CardDescription>
            Microsoft OneDrive bağlantısı için Azure App Registration kurulumu
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setup">Kurulum Adımları</TabsTrigger>
          <TabsTrigger value="debug">Debug & Test</TabsTrigger>
          <TabsTrigger value="troubleshooting">Sorun Giderme</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Azure Portal'a Giriş</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Azure Portal'a gidin ve Microsoft hesabınızla giriş yapın:</p>
                <Button variant="outline" className="mb-4" asChild>
                  <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Azure Portal'ı Aç
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. App Registration Oluşturma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p><strong>Navigasyon:</strong> Azure Active Directory → App registrations → New registration</p>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><strong>Name:</strong> Backup Application</p>
                    <p><strong>Supported account types:</strong> Accounts in this organizational directory only</p>
                    <p><strong>Redirect URI:</strong> Boş bırakın</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Client Secret Oluşturma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p><strong>Navigasyon:</strong> Certificates & secrets → New client secret</p>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-800 font-medium">⚠️ Önemli:</p>
                    <p className="text-red-700">Secret value'yu hemen kopyalayın! Bir daha gösterilmeyecek.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">4. API Permissions (En Kritik Adım)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p><strong>Navigasyon:</strong> API permissions → Add a permission → Microsoft Graph → <strong>Application permissions</strong></p>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-blue-800 font-medium">Gerekli İzinler:</p>
                    <ul className="list-disc list-inside text-blue-700 mt-2 space-y-1">
                      <li>Files.Read.All</li>
                      <li>Files.ReadWrite.All</li>
                      <li>Sites.Read.All</li>
                      <li>Sites.ReadWrite.All</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <p className="text-green-800 font-medium">🔑 Kritik:</p>
                    <p className="text-green-700">İzinleri ekledikten sonra <strong>"Grant admin consent for [Organization]"</strong> butonuna tıklayın!</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">5. Environment Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p>.env.local dosyanıza aşağıdaki bilgileri ekleyin:</p>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span>MICROSOFT_TENANT_ID=your_tenant_id_here</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard('MICROSOFT_TENANT_ID=')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>MICROSOFT_CLIENT_ID=your_client_id_here</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard('MICROSOFT_CLIENT_ID=')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>MICROSOFT_CLIENT_SECRET=your_client_secret_here</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard('MICROSOFT_CLIENT_SECRET=')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Tenant ID:</strong> App registration Overview sayfasındaki "Directory (tenant) ID"</p>
                    <p><strong>Client ID:</strong> App registration Overview sayfasındaki "Application (client) ID"</p>
                    <p><strong>Client Secret:</strong> Adım 3'te oluşturduğunuz secret value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Microsoft Bağlantı Debug</CardTitle>
              <CardDescription>
                Detaylı hata analizi ve bağlantı testi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={runDebugTest} disabled={isLoading} className="mb-4">
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Test Ediliyor...
                  </>
                ) : (
                  'Debug Test Çalıştır'
                )}
              </Button>

              {debugInfo && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {debugInfo.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {debugInfo.success ? 'Bağlantı Başarılı!' : 'Bağlantı Başarısız'}
                    </span>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm overflow-auto">
                      {JSON.stringify(debugInfo, null, 2)}
                    </pre>
                  </div>

                  {!debugInfo.success && debugInfo.possibleCauses && (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="font-medium text-red-800 mb-2">Olası Nedenler:</p>
                      <ul className="list-disc list-inside text-red-700 space-y-1">
                        {debugInfo.possibleCauses.map((cause: string, index: number) => (
                          <li key={index}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sık Karşılaşılan Hatalar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium text-red-800">AADSTS70011: Invalid scope</h4>
                    <p className="text-red-700 mt-1">
                      <strong>Çözüm:</strong> API permissions'da "Application permissions" seçtiğinizden emin olun, "Delegated permissions" değil.
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium text-red-800">AADSTS700016: Application not found</h4>
                    <p className="text-red-700 mt-1">
                      <strong>Çözüm:</strong> Client ID'nin doğru olduğundan ve app registration'ın aynı tenant'ta olduğundan emin olun.
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium text-red-800">AADSTS7000215: Invalid client secret</h4>
                    <p className="text-red-700 mt-1">
                      <strong>Çözüm:</strong> Client secret'ın doğru kopyalandığından emin olun. Yeni bir secret oluşturmayı deneyin.
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium text-red-800">Insufficient privileges</h4>
                    <p className="text-red-700 mt-1">
                      <strong>Çözüm:</strong> Admin consent verildiğinden emin olun. API permissions sayfasında yeşil tik işareti olmalı.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kontrol Listesi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="tenant" />
                    <label htmlFor="tenant">Tenant ID doğru kopyalandı</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="client" />
                    <label htmlFor="client">Client ID doğru kopyalandı</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="secret" />
                    <label htmlFor="secret">Client Secret doğru kopyalandı</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="permissions" />
                    <label htmlFor="permissions">Application permissions eklendi (Delegated değil)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="consent" />
                    <label htmlFor="consent">Admin consent verildi</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="env" />
                    <label htmlFor="env">Environment variables .env.local'e eklendi</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="restart" />
                    <label htmlFor="restart">Uygulama yeniden başlatıldı</label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
