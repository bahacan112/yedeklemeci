'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, FolderOpen, X } from 'lucide-react'
import OneDriveFolderBrowser from '@/components/onedrive-folder-browser'

interface BackupConfig {
  id?: number
  name: string
  sourcePaths: string[]
  oneDrivePath: string
  googleDrivePath: string
  retentionDays: number
  sources?: { id: number; source_path: string }[]
}

interface BackupConfigFormProps {
  config?: BackupConfig
  isOpen: boolean
  onClose: () => void
  onSave: (config: BackupConfig) => Promise<void>
  title: string
  description: string
}

export default function BackupConfigForm({
  config,
  isOpen,
  onClose,
  onSave,
  title,
  description
}: BackupConfigFormProps) {
  const [formData, setFormData] = useState<BackupConfig>({
    name: '',
    sourcePaths: [],
    oneDrivePath: '',
    googleDrivePath: '',
    retentionDays: 7
  })
  const [showFolderBrowser, setShowFolderBrowser] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (config) {
      setFormData({
        id: config.id,
        name: config.name,
        sourcePaths: config.sources?.map(s => s.source_path) || config.sourcePaths || [],
        oneDrivePath: config.oneDrivePath || '',
        googleDrivePath: config.googleDrivePath || '',
        retentionDays: config.retentionDays || 7
      })
    } else {
      setFormData({
        name: '',
        sourcePaths: [],
        oneDrivePath: '',
        googleDrivePath: '',
        retentionDays: 7
      })
    }
  }, [config, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.sourcePaths.length === 0) {
      alert('En az bir kaynak klasör seçmelisiniz')
      return
    }

    setIsLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Save error:', error)
      alert('Konfigürasyon kaydedilemedi')
    } finally {
      setIsLoading(false)
    }
  }

  const removePath = (pathToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      sourcePaths: prev.sourcePaths.filter(path => path !== pathToRemove)
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Konfigürasyon Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Projeler Yedekleme"
                required
              />
            </div>
            <div>
              <Label htmlFor="retention">Saklama Süresi (Gün)</Label>
              <Input
                id="retention"
                type="number"
                min="1"
                max="30"
                value={formData.retentionDays}
                onChange={(e) => setFormData(prev => ({ ...prev, retentionDays: parseInt(e.target.value) }))}
                required
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Kaynak Klasörler (OneDrive)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFolderBrowser(!showFolderBrowser)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {showFolderBrowser ? 'Tarayıcıyı Kapat' : 'Klasör Tarayıcısını Aç'}
              </Button>
            </div>
            
            {formData.sourcePaths.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-2">
                  Seçilen Klasörler ({formData.sourcePaths.length}):
                </p>
                <div className="space-y-1">
                  {formData.sourcePaths.map((path, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                      <span className="text-sm font-mono text-green-700">{path}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePath(path)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showFolderBrowser && (
              <div className="border rounded-lg p-4 bg-white">
                <OneDriveFolderBrowser
                  selectedPaths={formData.sourcePaths}
                  onPathsChange={(paths) => setFormData(prev => ({ ...prev, sourcePaths: paths }))}
                  maxSelections={10}
                />
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="onedrive">OneDrive Yedek Yolu</Label>
            <Input
              id="onedrive"
              value={formData.oneDrivePath}
              onChange={(e) => setFormData(prev => ({ ...prev, oneDrivePath: e.target.value }))}
              placeholder="/Backups/Projeler"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="googledrive">Google Drive Yedek Yolu</Label>
            <Input
              id="googledrive"
              value={formData.googleDrivePath}
              onChange={(e) => setFormData(prev => ({ ...prev, googleDrivePath: e.target.value }))}
              placeholder="/Backups/Projeler"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || formData.sourcePaths.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
