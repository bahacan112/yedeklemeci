-- SMTP configurations table
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

-- Email recipients table
CREATE TABLE IF NOT EXISTS email_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    notification_types TEXT NOT NULL, -- JSON array: ["backup_success", "backup_error", "backup_summary"]
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Email logs table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    error_message TEXT,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Insert default SMTP config (will be updated via UI)
INSERT OR IGNORE INTO smtp_configs (user_id, name, smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password, from_email, from_name) 
SELECT id, 'Default SMTP', 'smtp.gmail.com', 587, TRUE, 'your-email@gmail.com', 'your-app-password', 'your-email@gmail.com', 'Backup System'
FROM users WHERE username = 'admin';
