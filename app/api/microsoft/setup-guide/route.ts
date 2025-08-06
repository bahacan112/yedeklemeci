import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    title: 'Microsoft Azure App Registration Kurulum Rehberi - Kullanıcı OneDrive',
    steps: [
      {
        step: 1,
        title: 'Azure Portal\'a Giriş',
        description: 'https://portal.azure.com adresine gidin ve Microsoft hesabınızla giriş yapın.'
      },
      {
        step: 2,
        title: 'App Registration Oluşturma',
        description: 'Azure Active Directory > App registrations > New registration',
        details: [
          'Name: OneDrive User Backup Application',
          'Supported account types: Accounts in this organizational directory only',
          'Redirect URI: Boş bırakın'
        ]
      },
      {
        step: 3,
        title: 'Client Secret Oluşturma',
        description: 'Certificates & secrets > New client secret',
        details: [
          'Description: OneDrive User Backup Secret',
          'Expires: 24 months (önerilen)',
          'Value\'yu kopyalayın - bir daha gösterilmeyecek!'
        ]
      },
      {
        step: 4,
        title: 'API Permissions Ekleme - KULLANICI ONEDRIVE İÇİN',
        description: 'API permissions > Add a permission > Microsoft Graph > Application permissions',
        requiredPermissions: [
          'Files.Read.All - Tüm kullanıcıların dosyalarını okuma',
          'Files.ReadWrite.All - Tüm kullanıcıların dosyalarını okuma/yazma',
          'User.Read.All - Kullanıcı bilgilerini okuma',
          'Directory.Read.All - Dizin bilgilerini okuma'
        ],
        important: 'Permissions ekledikten sonra "Grant admin consent" butonuna tıklayın!',
        note: 'Bu izinler belirli kullanıcıların OneDrive\'larına application authentication ile erişim sağlar.'
      },
      {
        step: 5,
        title: 'Environment Variables',
        description: '.env.local dosyanıza aşağıdaki bilgileri ekleyin:',
        envVars: {
          MICROSOFT_TENANT_ID: 'Overview sayfasındaki Directory (tenant) ID',
          MICROSOFT_CLIENT_ID: 'Overview sayfasındaki Application (client) ID',
          MICROSOFT_CLIENT_SECRET: 'Adım 3\'te oluşturduğunuz secret value',
          TARGET_USER_EMAIL: 'Erişmek istediğiniz kullanıcının email adresi (örn: user@company.com)'
        }
      },
      {
        step: 6,
        title: 'Test Etme',
        description: 'Uygulamada "Bağlantı Testi" butonuna tıklayarak bağlantıyı test edin.'
      }
    ],
    troubleshooting: [
      {
        problem: 'TARGET_USER_EMAIL environment variable not set',
        solution: '.env.local dosyasına TARGET_USER_EMAIL=user@yourdomain.com ekleyin'
      },
      {
        problem: 'User not found: email@domain.com',
        solution: 'Email adresinin doğru olduğundan ve kullanıcının organizasyonda bulunduğundan emin olun'
      },
      {
        problem: 'AADSTS70011: Invalid scope',
        solution: 'API permissions\'da Application permissions seçtiğinizden emin olun'
      },
      {
        problem: 'Insufficient privileges',
        solution: 'Admin consent verildiğinden emin olun. API permissions sayfasında yeşil tik işareti olmalı'
      },
      {
        problem: 'Microsoft OneDrive access failed: 403',
        solution: 'Files.ReadWrite.All ve User.Read.All izinlerinin verildiğinden ve admin consent\'in yapıldığından emin olun'
      }
    ],
    testEndpoint: '/api/connection-test',
    documentationLinks: [
      'https://docs.microsoft.com/en-us/graph/auth-v2-service',
      'https://docs.microsoft.com/en-us/graph/permissions-reference',
      'https://docs.microsoft.com/en-us/graph/api/user-get',
      'https://docs.microsoft.com/en-us/graph/api/drive-get'
    ],
    userOneDriveNotes: [
      'Belirli kullanıcının OneDrive\'ına erişim için TARGET_USER_EMAIL gereklidir',
      'Application permissions ile kullanıcı OneDrive\'larına erişim mümkündür',
      '/me endpoint\'i yerine /users/{user-id}/drive kullanılır',
      'Admin consent mutlaka verilmelidir',
      'Kullanıcı organizasyonda bulunmalıdır'
    ]
  })
}
