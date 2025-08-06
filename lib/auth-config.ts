export const microsoftConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  tenantId: process.env.MICROSOFT_TENANT_ID!,
  scopes: [
    'https://graph.microsoft.com/Files.ReadWrite.All',
    'https://graph.microsoft.com/User.Read',
    'offline_access'
  ]
}

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
}
