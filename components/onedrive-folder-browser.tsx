'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Folder, File, ChevronRight, Home, ArrowLeft, Check, X, Search, Loader2, FolderOpen, Plus, Trash2, User } from 'lucide-react'

interface DriveItem {
  id: string
  name: string
  isFolder: boolean
  size: number
  lastModified: string
  path: string
  itemCount?: number
  isSubfolder?: boolean
}

interface BrowseData {
  currentPath: string
  parentPath: string | null
  folders: DriveItem[]
  files: DriveItem[]
  totalItems: number
  targetUser?: string
  userId?: string
}

interface OneDriveFolderBrowserProps {
  selectedPaths: string[]
  onPathsChange: (paths: string[]) => void
  maxSelections?: number
}

export default function OneDriveFolderBrowser({ 
  selectedPaths, 
  onPathsChange, 
  maxSelections = 10 
}: OneDriveFolderBrowserProps) {
  const [browseData, setBrowseData] = useState<BrowseData | null>(null)
  const [currentPath, setCurrentPath] = useState('/')
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showSubfolders, setShowSubfolders] = useState(false)

  useEffect(() => {
    loadFolder(currentPath)
  }, [currentPath, showSubfolders])

  const loadFolder = async (path: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      let url = `/api/onedrive/browse?path=${encodeURIComponent(path)}`
      if (showSubfolders) {
        url += `&recursive=true`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Klasör yüklenemedi')
      }
      
      const data = await response.json()
      setBrowseData(data)
      setCurrentPath(data.currentPath)
    } catch (error) {
      console.error('Browse error:', error)
      setError(error instanceof Error ? error.message : 'Bilinmeyen hata')
    } finally {
      setIsLoading(false)
    }
  }

  const navigateToFolder = (folderPath: string) => {
    setCurrentPath(folderPath)
  }

  const navigateUp = () => {
    if (browseData?.parentPath) {
      setCurrentPath(browseData.parentPath)
    }
  }

  const navigateToRoot = () => {
    setCurrentPath('/')
  }

  const togglePathSelection = (path: string) => {
    const isSelected = selectedPaths.includes(path)
    
    if (isSelected) {
      onPathsChange(selectedPaths.filter(p => p !== path))
    } else {
      if (selectedPaths.length < maxSelections) {
        onPathsChange([...selectedPaths, path])
      }
    }
  }

  const clearAllSelections = () => {
    onPathsChange([])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPathBreadcrumbs = () => {
    const breadcrumbs = [{ name: 'OneDrive', path: '/' }]
    
    if (currentPath !== '/') {
      const parts = currentPath.split('/').filter(part => part !== '')
      let buildPath = ''
      for (const part of parts) {
        buildPath += `/${part}`
        breadcrumbs.push({ name: part, path: buildPath })
      }
    }
    
    return breadcrumbs
  }

  const filteredFolders = browseData?.folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const filteredFiles = browseData?.files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p className="font-medium">Hata: {error}</p>
            <div className="mt-4 space-y-2">
              <Button onClick={() => loadFolder(currentPath)}>
                Tekrar Dene
              </Button>
              <div className="text-sm text-gray-600">
                <p>Olası çözümler:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>TARGET_USER_EMAIL environment variable'ını kontrol edin</li>
                  <li>Kullanıcının organizasyonda olduğundan emin olun</li>
                  <li>Microsoft Graph API izinlerini kontrol edin</li>
                  <li>Admin consent verildiğinden emin olun</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const SearchAndControls = () => (
    <div className="mb-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Klasör veya dosya ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showSubfolders"
          checked={showSubfolders}
          onChange={(e) => setShowSubfolders(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="showSubfolders" className="text-sm text-gray-600">
          Alt klasörleri de göster
        </label>
      </div>
    </div>
  )

  const FolderItem = ({ folder }: { folder: any }) => {
    const isSelected = selectedPaths.includes(folder.path)
    const canSelect = !isSelected && selectedPaths.length < maxSelections
    const isSubfolder = folder.isSubfolder || folder.name.includes('/')
    
    return (
      <div
        key={folder.id}
        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          isSelected 
            ? 'bg-green-50 border-green-200' 
            : 'hover:bg-gray-50 border-gray-200'
        } ${isSubfolder ? 'ml-4 border-l-2 border-l-blue-200' : ''}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Folder className={`h-5 w-5 ${isSelected ? 'text-green-600' : isSubfolder ? 'text-blue-500' : 'text-blue-600'}`} />
            <button
              onClick={() => navigateToFolder(folder.path)}
              className="font-medium text-left hover:text-blue-600 hover:underline truncate"
            >
              {isSubfolder ? folder.name.split('/').pop() : folder.name}
            </button>
            {isSubfolder && (
              <Badge variant="outline" className="text-xs">
                Alt klasör
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {folder.itemCount !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {folder.itemCount} öğe
              </Badge>
            )}
            <span>{formatDate(folder.lastModified)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => togglePathSelection(folder.path)}
            disabled={!canSelect && !isSelected}
          >
            {isSelected ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                Seçildi
              </>
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                Seç
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToFolder(folder.path)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selection Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Seçilen Klasörler</CardTitle>
              <CardDescription>
                {selectedPaths.length}/{maxSelections} klasör seçildi
              </CardDescription>
            </div>
            {selectedPaths.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllSelections}>
                <Trash2 className="mr-2 h-4 w-4" />
                Tümünü Temizle
              </Button>
            )}
          </div>
        </CardHeader>
        {selectedPaths.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {selectedPaths.map((path, index) => (
                <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-mono">{path}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePathSelection(path)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Browser */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              OneDrive - {browseData?.targetUser || 'Loading...'}
              {browseData?.userId && (
                <Badge variant="secondary" className="text-xs">
                  ID: {browseData.userId.substring(0, 8)}...
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={navigateToRoot}>
                <Home className="h-4 w-4" />
              </Button>
              {browseData?.parentPath && (
                <Button variant="outline" size="sm" onClick={navigateUp}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm text-gray-600">
            {getPathBreadcrumbs().map((crumb, index) => (
              <div key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                <button
                  onClick={() => navigateToFolder(crumb.path)}
                  className="hover:text-blue-600 hover:underline"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        </CardHeader>
        
        <CardContent>
          <SearchAndControls />

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Yükleniyor...</span>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-1">
                {/* Folders */}
                {filteredFolders.map((folder) => (
                  <FolderItem key={folder.id} folder={folder} />
                ))}

                {filteredFolders.length > 0 && filteredFiles.length > 0 && (
                  <Separator className="my-2" />
                )}

                {/* Files (for reference, not selectable) */}
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <File className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.lastModified)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredFolders.length === 0 && filteredFiles.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    {searchTerm ? 'Arama sonucu bulunamadı' : 'Bu klasör boş'}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
