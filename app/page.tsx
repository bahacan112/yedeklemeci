'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle, Cloud, HardDrive, Loader2, Plus, Settings, History, LogOut, FolderOpen, Edit, Trash2, Mail } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import OneDriveFolderBrowser from '@/components/onedrive-folder-browser'
import BackupConfigForm from '@/components/backup-config-form'
import EmailSettings from '@/components/email-settings'

interface User {
  id: number
  username: string
}

interface BackupConfig {
  id: number
  name: string
  source_path: string
  onedrive_path: string
  googledrive_path: string
  retention_days: number
  created_at: string
  sources?: { id: number; source_path: string }[]
}

interface BackupJob {
  id: string
  configId: number
  configName: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
}

export default function DriveBackupApp() {
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [configs, setConfigs] = useState<BackupConfig[]>([])
  const [jobs, setJobs] = useState<BackupJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<{
    microsoft: { connected: boolean; error: string | null }
    google: { connected: boolean; error: string | null }
  } | null>(null)
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<BackupConfig | null>(null)
  
  // New config form - updated for folder browser
  const [newConfig, setNewConfig] = useState({
    name: '',
    sourcePaths: [] as string[], // Changed to use folder browser
    oneDrivePath: '',
    googleDrivePath: '',
    retentionDays: 7
  })

  const [showFolderBrowser, setShowFolderBrowser] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user) {
      loadConfigs()
    }
  }, [user])

  const checkAuth = async () => {
    setIsCheckingAuth(true)
    try {
      console.log('[CLIENT] Checking authentication...')
      const response = await fetch('/api/auth/me', {
        credentials: 'include' // Important: include cookies
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[CLIENT] User authenticated:', data.user.username)
        setUser(data.user)
      } else {
        console.log('[CLIENT] User not authenticated')
        setUser(null)
      }
    } catch (error) {
      console.error('[CLIENT] Auth check failed:', error)
      setUser(null)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError('')

    try {
      console.log('[CLIENT] Attempting login for:', username)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important: include cookies
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('[CLIENT] Login successful')
        setUser(data.user)
        setUsername('')
        setPassword('')
        setLoginError('')
      } else {
        console.log('[CLIENT] Login failed:', data.error)
        setLoginError(data.error || 'Giriş başarısız')
      }
    } catch (error) {
      console.error('[CLIENT] Login error:', error)
      setLoginError('Bağlantı hatası')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('[CLIENT] Logging out...')
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      setConfigs([])
      setJobs([])
      console.log('[CLIENT] Logout successful')
    } catch (error) {
      console.error('[CLIENT] Logout failed:', error)
    }
  }

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/backup-configs', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs)
      } else if (response.status === 401) {
        // Token expired, redirect to login
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  const testConnections = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/connection-test', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setConnectionStatus(data.results)
      } else if (response.status === 401) {
        setUser(null)
      } else {
        alert('Bağlantı testi başarısız')
      }
    } catch (error) {
      alert('Bağlantı testi başarısız')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateConfig = async (configData: any) => {
    const response = await fetch('/api/backup-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configData)
    })

    if (response.ok) {
      loadConfigs()
    } else if (response.status === 401) {
      setUser(null)
    } else {
      throw new Error('Konfigürasyon oluşturulamadı')
    }
  }

  const handleEditConfig = async (configData: any) => {
    if (!editingConfig) return

    const response = await fetch(`/api/backup-configs/${editingConfig.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(configData)
    })

    if (response.ok) {
      loadConfigs()
      setEditingConfig(null)
    } else if (response.status === 401) {
      setUser(null)
    } else {
      throw new Error('Konfigürasyon güncellenemedi')
    }
  }

  const handleDeleteConfig = async (configId: number) => {
    try {
      const response = await fetch(`/api/backup-configs/${configId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        loadConfigs()
      } else if (response.status === 401) {
        setUser(null)
      } else {
        alert('Konfigürasyon silinemedi')
      }
    } catch (error) {
      alert('Konfigürasyon silinemedi')
    }
  }

  const openEditForm = (config: BackupConfig) => {
    setEditingConfig(config)
    setShowEditForm(true)
  }

  const handleRunBackup = async (configId: number, configName: string) => {
    const newJob: BackupJob = {
      id: Date.now().toString(),
      configId,
      configName,
      status: 'pending',
      progress: 0
    }

    setJobs(prev => [...prev, newJob])

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ configId })
      })

      setJobs(prev => prev.map(job => 
        job.id === newJob.id ? { ...job, status: 'processing', progress: 25 } : job
      ))

      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setJobs(prev => prev.map(job => 
        job.id === newJob.id ? { ...job, progress: 75 } : job
      ))

      await new Promise(resolve => setTimeout(resolve, 3000))

      if (response.ok) {
        const result = await response.json()
        setJobs(prev => prev.map(job => 
          job.id === newJob.id ? { ...job, status: 'completed', progress: 100 } : job
        ))
        
        if (result.deletedOldBackups > 0) {
          alert(`Yedekleme tamamlandı! ${result.deletedOldBackups} eski yedek silindi.`)
        }
      } else if (response.status === 401) {
        setUser(null)
      } else {
        throw new Error('Backup failed')
      }
    } catch (error) {
      setJobs(prev => prev.map(job => 
        job.id === newJob.id 
          ? { ...job, status: 'error', error: 'Yedekleme başarısız oldu' }
          : job
      ))
    }
  }

  const getStatusIcon = (status: BackupJob['status']) => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = (status: BackupJob['status']) => {
    switch (status) {
      case 'pending': return 'Bekliyor'
      case 'processing': return 'İşleniyor'
      case 'completed': return 'Tamamlandı'
      case 'error': return 'Hata'
    }
  }

  const ConnectionStatus = () => {
    if (!connectionStatus) return null

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Bağlantı Durumu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              {connectionStatus.microsoft.connected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Microsoft OneDrive</span>
              {connectionStatus.microsoft.error && (
                <span className="text-sm text-red-600">({connectionStatus.microsoft.error})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus.google.connected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">Google Drive</span>
              {connectionStatus.google.error && (
                <span className="text-sm text-red-600">({connectionStatus.google.error})</span>
              )}
            </div>
          </div>
          <Button 
            onClick={testConnections} 
            disabled={isLoading}
            className="mt-4"
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test ediliyor...
              </>
            ) : (
              'Bağlantıları Tekrar Test Et'
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Kimlik doğrulanıyor...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Giriş Yap</CardTitle>
            <CardDescription className="text-center">
              Drive Yedekleme Uygulaması
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Kullanıcı Adı</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {loginError && (
                <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                  {loginError}
                </div>
              )}
              
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Drive Yedekleme Uygulaması
            </h1>
            <p className="text-gray-600">Hoş geldin, {user?.username}!</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={testConnections} disabled={isLoading} variant="outline">
              <Cloud className="mr-2 h-4 w-4" />
              Bağlantı Testi
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Çıkış Yap
            </Button>
          </div>
        </div>

        <ConnectionStatus />

        <Tabs defaultValue="configs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="configs">
              <Settings className="mr-2 h-4 w-4" />
              Konfigürasyonlar
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <History className="mr-2 h-4 w-4" />
              Yedekleme İşleri
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" />
              Email Ayarları
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configs" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Konfigürasyonlar
                    </CardTitle>
                    <CardDescription>
                      Yedekleme konfigürasyonlarınızı yönetin
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Konfigürasyon
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-4">
              {configs.map((config) => (
                <Card key={config.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{config.name}</CardTitle>
                        <CardDescription>
                          {config.sources?.length || 0} klasör • {config.retention_days} gün saklama
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditForm(config)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Düzenle
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Sil
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Konfigürasyonu Sil</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{config.name}" konfigürasyonunu silmek istediğinizden emin misiniz? 
                                Bu işlem geri alınamaz.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>İptal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteConfig(config.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          onClick={() => handleRunBackup(config.id, config.name)}
                          disabled={jobs.some(job => job.configId === config.id && job.status === 'processing')}
                        >
                          <Cloud className="mr-2 h-4 w-4" />
                          Yedekle
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div>
                        <strong>Kaynak Klasörler:</strong>
                        <ul className="ml-4 mt-1">
                          {config.sources?.map((source, index) => (
                            <li key={source.id}>• {source.source_path}</li>
                          ))}
                        </ul>
                      </div>
                      <div><strong>OneDrive:</strong> {config.onedrive_path}</div>
                      <div><strong>Google Drive:</strong> {config.googledrive_path}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {configs.length === 0 && (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center text-gray-500">
                      <p>Henüz konfigürasyon oluşturulmadı</p>
                      <Button 
                        onClick={() => setShowCreateForm(true)}
                        className="mt-4"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        İlk Konfigürasyonunu Oluştur
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Aktif Yedekleme İşleri</CardTitle>
                <CardDescription>
                  Çalışan ve tamamlanan yedekleme işlerinin durumu
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Henüz yedekleme işi başlatılmadı
                  </p>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div key={job.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <span className="font-medium">{job.configName}</span>
                          </div>
                          <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                            {getStatusText(job.status)}
                          </Badge>
                        </div>
                        
                        {job.status !== 'error' && (
                          <Progress value={job.progress} className="mb-2" />
                        )}
                        
                        {job.error && (
                          <div className="text-sm text-red-600">{job.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email">
            <EmailSettings />
          </TabsContent>
        </Tabs>

        {/* Create Config Form */}
        <BackupConfigForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSave={handleCreateConfig}
          title="Yeni Konfigürasyon Oluştur"
          description="OneDrive'dan klasörleri seçerek yedekleme konfigürasyonu oluşturun"
        />

        {/* Edit Config Form */}
        <BackupConfigForm
          config={editingConfig ? {
            id: editingConfig.id,
            name: editingConfig.name,
            sourcePaths: editingConfig.sources?.map(s => s.source_path) || [],
            oneDrivePath: editingConfig.onedrive_path,
            googleDrivePath: editingConfig.googledrive_path,
            retentionDays: editingConfig.retention_days
          } : undefined}
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false)
            setEditingConfig(null)
          }}
          onSave={handleEditConfig}
          title="Konfigürasyonu Düzenle"
          description="Mevcut konfigürasyonu güncelleyin"
        />
      </div>
    </div>
  )
}
