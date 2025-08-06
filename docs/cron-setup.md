# EasyPanel Cron Job Kurulumu

Bu dokümantasyon, EasyPanel'de otomatik yedekleme için cron job kurulumunu açıklar.

## API Endpoints

### 1. Tüm Konfigürasyonları Yedekleme
**Endpoint:** `POST /api/cron/backup`

**Parametreler:**
\`\`\`json
{
  "username": "admin",
  "password": "admin123"
}
\`\`\`

### 2. Belirli Konfigürasyonu Yedekleme (YENİ!)
**Endpoint:** `POST /api/cron/backup-config`

**Parametreler:**
\`\`\`json
{
  "username": "admin",
  "password": "admin123",
  "configName": "Projeler Yedekleme"
}
\`\`\`

**Başarılı Yanıt:**
\`\`\`json
{
  "success": true,
  "message": "Configuration 'Projeler Yedekleme' backup completed successfully",
  "user": "admin",
  "timestamp": "2024-01-15T14:30:25.123Z",
  "result": {
    "configId": 1,
    "configName": "Projeler Yedekleme",
    "sourceFolders": 7,
    "success": true,
    "fileName": "backup_Projeler_Yedekleme_2024-01-15_14-30-25.zip",
    "fileSize": 1048576,
    "deletedOldBackups": 1,
    "processingTime": 15000
  }
}
\`\`\`

### 3. Durum Kontrolü
**Endpoint:** `POST /api/cron/status`

**Parametreler:**
\`\`\`json
{
  "username": "admin",
  "password": "admin123"
}
\`\`\`

## EasyPanel Cron Job Kurulumu

### 1. Tüm Konfigürasyonları Günlük Yedekleme (Her gün saat 02:00)
\`\`\`bash
# Cron ifadesi: 0 2 * * *
curl -X POST https://your-app.easypanel.app/api/cron/backup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
\`\`\`

### 2. Belirli Konfigürasyonu Yedekleme (YENİ!)
\`\`\`bash
# Projeler için günlük yedekleme (Her gün saat 01:00)
# Cron ifadesi: 0 1 * * *
curl -X POST https://your-app.easypanel.app/api/cron/backup-config \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","configName":"Projeler Yedekleme"}'

# Belgeler için haftalık yedekleme (Her Pazar saat 03:00)
# Cron ifadesi: 0 3 * * 0
curl -X POST https://your-app.easypanel.app/api/cron/backup-config \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","configName":"Belgeler Yedekleme"}'
\`\`\`

### 3. Saatlik Durum Kontrolü
\`\`\`bash
# Cron ifadesi: 0 * * * *
curl -X POST https://your-app.easypanel.app/api/cron/status \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
\`\`\`

## EasyPanel'de Kurulum Adımları

1. **EasyPanel Dashboard'a giriş yapın**
2. **Uygulamanızı seçin**
3. **"Cron Jobs" sekmesine gidin**
4. **"Add Cron Job" butonuna tıklayın**

### Örnek Cron Job Konfigürasyonları:

#### Projeler Günlük Yedekleme:
- **Name:** `Daily Projects Backup`
- **Schedule:** `0 1 * * *` (Her gün saat 01:00)
- **Command:** 
\`\`\`bash
curl -X POST https://your-app.easypanel.app/api/cron/backup-config \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","configName":"Projeler Yedekleme"}' \
  --max-time 3600 \
  --retry 3
\`\`\`

#### Belgeler Haftalık Yedekleme:
- **Name:** `Weekly Documents Backup`
- **Schedule:** `0 3 * * 0` (Her Pazar saat 03:00)
- **Command:**
\`\`\`bash
curl -X POST https://your-app.easypanel.app/api/cron/backup-config \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","configName":"Belgeler Yedekleme"}' \
  --max-time 3600 \
  --retry 3
\`\`\`

#### Tüm Konfigürasyonlar Aylık Yedekleme:
- **Name:** `Monthly Full Backup`
- **Schedule:** `0 2 1 * *` (Her ayın 1'i saat 02:00)
- **Command:**
\`\`\`bash
curl -X POST https://your-app.easypanel.app/api/cron/backup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  --max-time 7200 \
  --retry 3
\`\`\`

## Cron Schedule Örnekleri

| Açıklama | Cron İfadesi | Kullanım |
|----------|--------------|----------|
| Her gün saat 01:00 | `0 1 * * *` | Kritik projeler günlük yedekleme |
| Her gün saat 02:00 | `0 2 * * *` | Tüm konfigürasyonlar günlük yedekleme |
| Her Pazar saat 03:00 | `0 3 * * 0` | Belgeler haftalık yedekleme |
| Her ayın 1'i saat 02:00 | `0 2 1 * *` | Aylık tam yedekleme |
| Her 6 saatte bir | `0 */6 * * *` | Durum kontrolü |
| Haftanın her günü saat 01:00 | `0 1 * * 1-5` | İş günleri yedekleme |

## Avantajlar

### Belirli Konfigürasyon Yedekleme:
- ✅ **Daha hızlı**: Sadece seçilen konfigürasyon işlenir
- ✅ **Daha az kaynak**: CPU ve bandwidth tasarrufu
- ✅ **Esnek zamanlama**: Her konfigürasyon için farklı saat
- ✅ **Hata izolasyonu**: Bir konfigürasyon hatası diğerlerini etkilemez

### Tüm Konfigürasyonlar Yedekleme:
- ✅ **Tek seferde tümü**: Tüm konfigürasyonlar aynı anda
- ✅ **Özet rapor**: Genel durum raporu
- ✅ **Basit kurulum**: Tek cron job

## Hata Yönetimi

API endpoint'leri aşağıdaki durumlarda hata döndürür:

- **400:** Eksik parametreler (username/password/configName)
- **401:** Geçersiz kimlik bilgileri
- **404:** Konfigürasyon bulunamadı
- **500:** Sunucu hatası

## Loglar

Cron job çalıştırıldığında console'da detaylı loglar görüntülenir:

\`\`\`
[CRON-CONFIG] Starting backup for config: Projeler Yedekleme by user: admin
[CRON-CONFIG] Processing config: Projeler Yedekleme (ID: 1)
[CRON-CONFIG] Successfully completed backup for config: Projeler Yedekleme
\`\`\`

## Güvenlik

- API endpoint'leri sadece POST method'u kabul eder
- Username ve password her istekte doğrulanır
- Konfigürasyon adı doğrulanır
- Hassas bilgiler response'da yer almaz
- Rate limiting önerilir (EasyPanel seviyesinde)

## Monitoring

Cron job'ların çalışıp çalışmadığını kontrol etmek için:

1. EasyPanel logs sekmesini kontrol edin
2. `/api/cron/status` endpoint'ini kullanın
3. Backup history'yi veritabanından kontrol edin
4. Email bildirimlerini kontrol edin

## Örnek Kullanım Senaryoları

### Senaryo 1: Farklı Öncelikler
\`\`\`bash
# Kritik projeler - Her 6 saatte bir
0 */6 * * * curl -X POST .../api/cron/backup-config -d '{"configName":"Kritik Projeler"}'

# Normal projeler - Günlük
0 2 * * * curl -X POST .../api/cron/backup-config -d '{"configName":"Projeler"}'

# Arşiv - Haftalık
0 3 * * 0 curl -X POST .../api/cron/backup-config -d '{"configName":"Arşiv"}'
\`\`\`

### Senaryo 2: İş Saatleri Dışında
\`\`\`bash
# Mesai başlangıcından önce
0 7 * * 1-5 curl -X POST .../api/cron/backup-config -d '{"configName":"Günlük İş"}'

# Mesai bitiminden sonra
0 19 * * 1-5 curl -X POST .../api/cron/backup-config -d '{"configName":"Günlük Rapor"}'
