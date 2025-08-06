import Database from 'better-sqlite3'
import { hash, compare } from 'bcryptjs'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'backup.db'))

// Initialize database
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backup_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        onedrive_path TEXT NOT NULL,
        googledrive_path TEXT NOT NULL,
        retention_days INTEGER DEFAULT 7,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS backup_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER NOT NULL,
        source_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_id) REFERENCES backup_configs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_id INTEGER NOT NULL,
        backup_date DATE NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        onedrive_uploaded BOOLEAN DEFAULT FALSE,
        googledrive_uploaded BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_id) REFERENCES backup_configs (id)
    );

    CREATE TABLE IF NOT EXISTS smtp_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_secure BOOLEAN DEFAULT TRUE,
        smtp_username TEXT NOT NULL,
        smtp_password TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS email_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        notification_types TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `)

  const defaultUsername = process.env.DEFAULT_USERNAME || 'admin'
  const defaultPassword = process.env.DEFAULT_PASSWORD || 'admin123'
  createUser(defaultUsername, defaultPassword)
}

// Add new interfaces for SMTP and email functionality
export interface SmtpConfig {
  id: number
  user_id: number
  name: string
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_username: string
  smtp_password: string
  from_email: string
  from_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailRecipient {
  id: number
  user_id: number
  email: string
  name?: string
  notification_types: string[]
  is_active: boolean
  created_at: string
}

export interface EmailLog {
  id: number
  user_id: number
  recipient_email: string
  subject: string
  notification_type: string
  status: string
  error_message?: string
  sent_at?: string
  created_at: string
}

// Existing interfaces...
export interface User {
  id: number
  username: string
  created_at: string
}

export interface BackupConfig {
  id: number
  user_id: number
  name: string
  onedrive_path: string
  googledrive_path: string
  retention_days: number
  created_at: string
  updated_at: string
  sources?: BackupSource[]
}

export interface BackupSource {
  id: number
  config_id: number
  source_path: string
  created_at: string
}

export interface BackupHistory {
  id: number
  config_id: number
  backup_date: string
  file_name: string
  file_size: number
  onedrive_uploaded: boolean
  googledrive_uploaded: boolean
  status: string
  error_message?: string
  created_at: string
}

// Existing user operations...
export async function createUser(username: string, password: string): Promise<User | null> {
  try {
    const hashedPassword = await hash(password, 12)
    const stmt = db.prepare('INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)')
    const result = stmt.run(username, hashedPassword)
    
    if (result.changes > 0) {
      return getUserByUsername(username)
    }
    return null
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

export function getUserByUsername(username: string): User | null {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE username = ?')
  return stmt.get(username) as User | null
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
  const user = stmt.get(username) as any
  
  if (user && await compare(password, user.password)) {
    return { id: user.id, username: user.username, created_at: user.created_at }
  }
  return null
}

// SMTP Configuration operations
export function createSmtpConfig(config: Omit<SmtpConfig, 'id' | 'created_at' | 'updated_at'>): SmtpConfig {
  const stmt = db.prepare(`
    INSERT INTO smtp_configs (user_id, name, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, from_email, from_name, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    config.user_id,
    config.name,
    config.smtp_host,
    config.smtp_port,
    config.smtp_secure ? 1 : 0,  // Boolean'ı integer'a çevir
    config.smtp_username,
    config.smtp_password,
    config.from_email,
    config.from_name,
    config.is_active ? 1 : 0  // Boolean'ı integer'a çevir
  )
  
  return getSmtpConfig(result.lastInsertRowid as number)!
}

export function getSmtpConfig(id: number): SmtpConfig | null {
  const stmt = db.prepare('SELECT * FROM smtp_configs WHERE id = ?')
  const result = stmt.get(id) as any
  
  if (result) {
    // Integer'ları boolean'a çevir
    result.smtp_secure = result.smtp_secure === 1
    result.is_active = result.is_active === 1
    return result as SmtpConfig
  }
  
  return null
}

export function getSmtpConfigsByUser(userId: number): SmtpConfig[] {
  const stmt = db.prepare('SELECT * FROM smtp_configs WHERE user_id = ? ORDER BY created_at DESC')
  const results = stmt.all(userId) as any[]
  
  // Integer'ları boolean'a çevir
  return results.map(result => ({
    ...result,
    smtp_secure: result.smtp_secure === 1,
    is_active: result.is_active === 1
  })) as SmtpConfig[]
}

export function getActiveSmtpConfig(userId: number): SmtpConfig | null {
  const stmt = db.prepare('SELECT * FROM smtp_configs WHERE user_id = ? AND is_active = 1 LIMIT 1')
  const result = stmt.get(userId) as any
  
  if (result) {
    // Integer'ları boolean'a çevir
    result.smtp_secure = result.smtp_secure === 1
    result.is_active = result.is_active === 1
    return result as SmtpConfig
  }
  
  return null
}

export function updateSmtpConfig(id: number, updates: Partial<SmtpConfig>): SmtpConfig | null {
  // Boolean değerleri integer'a çevir
  const processedUpdates = { ...updates }
  if (typeof processedUpdates.smtp_secure === 'boolean') {
    processedUpdates.smtp_secure = processedUpdates.smtp_secure ? 1 : 0 as any
  }
  if (typeof processedUpdates.is_active === 'boolean') {
    processedUpdates.is_active = processedUpdates.is_active ? 1 : 0 as any
  }
  
  const fields = Object.keys(processedUpdates).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ')
  const values = Object.values(processedUpdates).filter((_, index) => Object.keys(processedUpdates)[index] !== 'id')
  
  const stmt = db.prepare(`UPDATE smtp_configs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
  stmt.run(...values, id)
  
  return getSmtpConfig(id)
}

export function deleteSmtpConfig(id: number): boolean {
  const stmt = db.prepare('DELETE FROM smtp_configs WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// Email Recipients operations
export function createEmailRecipient(recipient: Omit<EmailRecipient, 'id' | 'created_at'>): EmailRecipient {
  const notificationTypesJson = JSON.stringify(recipient.notification_types)
  
  const stmt = db.prepare(`
    INSERT INTO email_recipients (user_id, email, name, notification_types, is_active)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    recipient.user_id,
    recipient.email,
    recipient.name,
    notificationTypesJson,
    recipient.is_active ? 1 : 0  // Boolean'ı integer'a çevir
  )
  
  return getEmailRecipient(result.lastInsertRowid as number)!
}

export function getEmailRecipient(id: number): EmailRecipient | null {
  const stmt = db.prepare('SELECT * FROM email_recipients WHERE id = ?')
  const result = stmt.get(id) as any
  
  if (result) {
    return {
      ...result,
      notification_types: JSON.parse(result.notification_types),
      is_active: result.is_active === 1  // Integer'ı boolean'a çevir
    }
  }
  return null
}

export function getEmailRecipientsByUser(userId: number): EmailRecipient[] {
  const stmt = db.prepare('SELECT * FROM email_recipients WHERE user_id = ? ORDER BY created_at DESC')
  const results = stmt.all(userId) as any[]
  
  return results.map(result => ({
    ...result,
    notification_types: JSON.parse(result.notification_types),
    is_active: result.is_active === 1  // Integer'ı boolean'a çevir
  }))
}

export function getActiveEmailRecipients(userId: number, notificationType: string): EmailRecipient[] {
  const stmt = db.prepare('SELECT * FROM email_recipients WHERE user_id = ? AND is_active = 1')
  const results = stmt.all(userId) as any[]
  
  return results
    .map(result => ({
      ...result,
      notification_types: JSON.parse(result.notification_types),
      is_active: result.is_active === 1  // Integer'ı boolean'a çevir
    }))
    .filter(recipient => recipient.notification_types.includes(notificationType))
}

export function updateEmailRecipient(id: number, updates: Partial<EmailRecipient>): EmailRecipient | null {
  const updateData = { ...updates }
  
  if (updates.notification_types) {
    updateData.notification_types = JSON.stringify(updates.notification_types) as any
  }
  
  if (typeof updateData.is_active === 'boolean') {
    updateData.is_active = updateData.is_active ? 1 : 0 as any
  }
  
  const fields = Object.keys(updateData).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ')
  const values = Object.values(updateData).filter((_, index) => Object.keys(updateData)[index] !== 'id')
  
  const stmt = db.prepare(`UPDATE email_recipients SET ${fields} WHERE id = ?`)
  stmt.run(...values, id)
  
  return getEmailRecipient(id)
}

export function deleteEmailRecipient(id: number): boolean {
  const stmt = db.prepare('DELETE FROM email_recipients WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// Email Logs operations
export function createEmailLog(log: Omit<EmailLog, 'id' | 'created_at'>): EmailLog {
  const stmt = db.prepare(`
    INSERT INTO email_logs (user_id, recipient_email, subject, notification_type, status, error_message, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    log.user_id,
    log.recipient_email,
    log.subject,
    log.notification_type,
    log.status,
    log.error_message,
    log.sent_at
  )
  
  return getEmailLog(result.lastInsertRowid as number)!
}

export function getEmailLog(id: number): EmailLog | null {
  const stmt = db.prepare('SELECT * FROM email_logs WHERE id = ?')
  return stmt.get(id) as EmailLog | null
}

export function getEmailLogsByUser(userId: number, limit: number = 50): EmailLog[] {
  const stmt = db.prepare('SELECT * FROM email_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
  return stmt.all(userId, limit) as EmailLog[]
}

export function updateEmailLog(id: number, updates: Partial<EmailLog>): EmailLog | null {
  const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ')
  const values = Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id')
  
  const stmt = db.prepare(`UPDATE email_logs SET ${fields} WHERE id = ?`)
  stmt.run(...values, id)
  
  return getEmailLog(id)
}

// Existing backup operations... (keep all existing functions)
export function createBackupConfig(config: Omit<BackupConfig, 'id' | 'created_at' | 'updated_at' | 'sources'>, sourcePaths: string[]): BackupConfig {
  const stmt = db.prepare(`
    INSERT INTO backup_configs (user_id, name, onedrive_path, googledrive_path, retention_days)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    config.user_id,
    config.name,
    config.onedrive_path,
    config.googledrive_path,
    config.retention_days
  )
  
  const configId = result.lastInsertRowid as number
  
  // Add source paths
  const sourceStmt = db.prepare('INSERT INTO backup_sources (config_id, source_path) VALUES (?, ?)')
  for (const sourcePath of sourcePaths) {
    sourceStmt.run(configId, sourcePath)
  }
  
  return getBackupConfig(configId)!
}

export function getBackupConfig(id: number): BackupConfig | null {
  const stmt = db.prepare('SELECT * FROM backup_configs WHERE id = ?')
  const config = stmt.get(id) as BackupConfig | null
  
  if (config) {
    // Get source paths
    const sourcesStmt = db.prepare('SELECT * FROM backup_sources WHERE config_id = ?')
    config.sources = sourcesStmt.all(id) as BackupSource[]
  }
  
  return config
}

export function getBackupConfigsByUser(userId: number): BackupConfig[] {
  const stmt = db.prepare('SELECT * FROM backup_configs WHERE user_id = ? ORDER BY created_at DESC')
  const configs = stmt.all(userId) as BackupConfig[]
  
  // Get source paths for each config
  for (const config of configs) {
    const sourcesStmt = db.prepare('SELECT * FROM backup_sources WHERE config_id = ?')
    config.sources = sourcesStmt.all(config.id) as BackupSource[]
  }
  
  return configs
}

export function updateBackupConfig(id: number, updates: Partial<BackupConfig>): BackupConfig | null {
  const fields = Object.keys(updates).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ')
  const values = Object.values(updates).filter((_, index) => Object.keys(updates)[index] !== 'id')
  
  const stmt = db.prepare(`UPDATE backup_configs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
  stmt.run(...values, id)
  
  return getBackupConfig(id)
}

export function deleteBackupConfig(id: number): boolean {
  const stmt = db.prepare('DELETE FROM backup_configs WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

// Add new functions for managing backup sources
export function addBackupSource(configId: number, sourcePath: string): BackupSource {
  const stmt = db.prepare('INSERT INTO backup_sources (config_id, source_path) VALUES (?, ?)')
  const result = stmt.run(configId, sourcePath)
  
  const sourceStmt = db.prepare('SELECT * FROM backup_sources WHERE id = ?')
  return sourceStmt.get(result.lastInsertRowid) as BackupSource
}

export function removeBackupSource(sourceId: number): boolean {
  const stmt = db.prepare('DELETE FROM backup_sources WHERE id = ?')
  const result = stmt.run(sourceId)
  return result.changes > 0
}

export function getBackupSources(configId: number): BackupSource[] {
  const stmt = db.prepare('SELECT * FROM backup_sources WHERE config_id = ?')
  return stmt.all(configId) as BackupSource[]
}

// Backup history operations
export function createBackupHistory(history: Omit<BackupHistory, 'id' | 'created_at'>): BackupHistory {
  const stmt = db.prepare(`
    INSERT INTO backup_history (config_id, backup_date, file_name, file_size, onedrive_uploaded, googledrive_uploaded, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    history.config_id,
    history.backup_date,
    history.file_name,
    history.file_size,
    history.onedrive_uploaded ? 1 : 0,  // Boolean'ı integer'a çevir
    history.googledrive_uploaded ? 1 : 0,  // Boolean'ı integer'a çevir
    history.status,
    history.error_message
  )
  
  return getBackupHistory(result.lastInsertRowid as number)!
}

export function getBackupHistory(id: number): BackupHistory | null {
  const stmt = db.prepare('SELECT * FROM backup_history WHERE id = ?')
  const result = stmt.get(id) as any
  
  if (result) {
    // Integer'ları boolean'a çevir
    result.onedrive_uploaded = result.onedrive_uploaded === 1
    result.googledrive_uploaded = result.googledrive_uploaded === 1
    return result as BackupHistory
  }
  
  return null
}

export function getBackupHistoryByConfig(configId: number): BackupHistory[] {
  const stmt = db.prepare('SELECT * FROM backup_history WHERE config_id = ? ORDER BY backup_date DESC')
  const results = stmt.all(configId) as any[]
  
  // Integer'ları boolean'a çevir
  return results.map(result => ({
    ...result,
    onedrive_uploaded: result.onedrive_uploaded === 1,
    googledrive_uploaded: result.googledrive_uploaded === 1
  })) as BackupHistory[]
}

export function updateBackupHistory(id: number, updates: Partial<BackupHistory>): BackupHistory | null {
  // Boolean değerleri integer'a çevir
  const processedUpdates = { ...updates }
  if (typeof processedUpdates.onedrive_uploaded === 'boolean') {
    processedUpdates.onedrive_uploaded = processedUpdates.onedrive_uploaded ? 1 : 0 as any
  }
  if (typeof processedUpdates.googledrive_uploaded === 'boolean') {
    processedUpdates.googledrive_uploaded = processedUpdates.googledrive_uploaded ? 1 : 0 as any
  }
  
  const fields = Object.keys(processedUpdates).filter(key => key !== 'id').map(key => `${key} = ?`).join(', ')
  const values = Object.values(processedUpdates).filter((_, index) => Object.keys(processedUpdates)[index] !== 'id')
  
  const stmt = db.prepare(`UPDATE backup_history SET ${fields} WHERE id = ?`)
  stmt.run(...values, id)
  
  return getBackupHistory(id)
}

export function cleanupOldBackups(configId: number, retentionDays: number): BackupHistory[] {
  // Get old backups to delete
  const stmt = db.prepare(`
    SELECT * FROM backup_history 
    WHERE config_id = ? 
    ORDER BY backup_date DESC 
    LIMIT -1 OFFSET ?
  `)
  const oldBackups = stmt.all(configId, retentionDays) as BackupHistory[]
  
  if (oldBackups.length > 0) {
    const deleteStmt = db.prepare(`
      DELETE FROM backup_history 
      WHERE config_id = ? 
      AND backup_date NOT IN (
        SELECT backup_date FROM backup_history 
        WHERE config_id = ? 
        ORDER BY backup_date DESC 
        LIMIT ?
      )
    `)
    deleteStmt.run(configId, configId, retentionDays)
  }
  
  return oldBackups
}

// Initialize database on import
initDatabase()

export default db
