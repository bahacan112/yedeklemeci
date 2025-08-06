-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Backup configurations table
DROP TABLE IF EXISTS backup_configs;
DROP TABLE IF EXISTS backup_sources;

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

-- New table for multiple source paths
CREATE TABLE IF NOT EXISTS backup_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    source_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES backup_configs (id) ON DELETE CASCADE
);

-- Backup history table
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

-- Insert default user (will be overridden by env variables)
INSERT OR IGNORE INTO users (username, password) 
VALUES ('admin', 'admin123');
