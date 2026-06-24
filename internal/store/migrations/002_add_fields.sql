-- Add description and created_at to maintenance_windows
ALTER TABLE maintenance_windows ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE maintenance_windows ADD COLUMN created_at TEXT NOT NULL DEFAULT '';

-- Add created_at and updated_at to notification_channels
ALTER TABLE notification_channels ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE notification_channels ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';