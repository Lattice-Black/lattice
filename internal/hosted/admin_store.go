package hosted

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// migrateAdminTables creates the admin_users, admin_sessions, and audit_logs
// tables if they don't already exist. Called from Store.migrate().
func (s *Store) migrateAdminTables() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS admin_users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'admin',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			last_login_at TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

		CREATE TABLE IF NOT EXISTS admin_sessions (
			token TEXT PRIMARY KEY,
			admin_id TEXT NOT NULL,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL,
			ip TEXT NOT NULL DEFAULT '',
			FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
		CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			admin_id TEXT NOT NULL,
			admin_email TEXT NOT NULL,
			action TEXT NOT NULL,
			target_type TEXT NOT NULL,
			target_id TEXT NOT NULL,
			details TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
	`)
	return err
}

// --- Admin User Operations ---

// CreateAdminUser inserts a new admin user.
func (s *Store) CreateAdminUser(u AdminUser) error {
	var lastLogin *string
	if u.LastLoginAt != nil {
		v := u.LastLoginAt.Format(time.RFC3339)
		lastLogin = &v
	}
	_, err := s.db.Exec(`
		INSERT INTO admin_users (id, email, password_hash, role, created_at, updated_at, last_login_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, u.ID, u.Email, u.PasswordHash, string(u.Role), u.CreatedAt.Format(time.RFC3339), u.UpdatedAt.Format(time.RFC3339), lastLogin)
	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}
	return nil
}

// GetAdminUser retrieves an admin user by ID.
func (s *Store) GetAdminUser(id string) (*AdminUser, error) {
	row := s.db.QueryRow(`
		SELECT id, email, password_hash, role, created_at, updated_at, last_login_at
		FROM admin_users WHERE id = ?
	`, id)
	return scanAdminUser(row)
}

// GetAdminUserByEmail retrieves an admin user by email.
func (s *Store) GetAdminUserByEmail(email string) (*AdminUser, error) {
	row := s.db.QueryRow(`
		SELECT id, email, password_hash, role, created_at, updated_at, last_login_at
		FROM admin_users WHERE email = ?
	`, email)
	return scanAdminUser(row)
}

// ListAdminUsers returns all admin users.
func (s *Store) ListAdminUsers() ([]AdminUser, error) {
	rows, err := s.db.Query(`
		SELECT id, email, password_hash, role, created_at, updated_at, last_login_at
		FROM admin_users ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list admin users: %w", err)
	}
	defer rows.Close()

	var users []AdminUser
	for rows.Next() {
		u, err := scanAdminUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

// DeleteAdminUser removes an admin user by ID.
func (s *Store) DeleteAdminUser(id string) error {
	result, err := s.db.Exec("DELETE FROM admin_users WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete admin user: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("admin user not found: %s", id)
	}
	return nil
}

// UpdateAdminLastLogin updates the last_login_at timestamp.
func (s *Store) UpdateAdminLastLogin(id string) error {
	_, err := s.db.Exec(`
		UPDATE admin_users SET last_login_at = ? WHERE id = ?
	`, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

// UpdateAdminPassword updates an admin user's password hash.
func (s *Store) UpdateAdminPassword(id string, passwordHash string) error {
	_, err := s.db.Exec(`
		UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?
	`, passwordHash, time.Now().UTC().Format(time.RFC3339), id)
	return err
}

// CountAdminUsers returns the number of admin users.
func (s *Store) CountAdminUsers() (int, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM admin_users").Scan(&count)
	return count, err
}

func scanAdminUser(row *sql.Row) (*AdminUser, error) {
	var u AdminUser
	var role string
	var lastLogin sql.NullString
	var createdAt, updatedAt string

	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &role, &createdAt, &updatedAt, &lastLogin)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan admin user: %w", err)
	}

	u.Role = AdminRole(role)
	u.CreatedAt = parseTime(createdAt)
	u.UpdatedAt = parseTime(updatedAt)
	if lastLogin.Valid {
		t := parseTime(lastLogin.String)
		u.LastLoginAt = &t
	}
	return &u, nil
}

func scanAdminUserRow(rows *sql.Rows) (*AdminUser, error) {
	var u AdminUser
	var role string
	var lastLogin sql.NullString
	var createdAt, updatedAt string

	err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &role, &createdAt, &updatedAt, &lastLogin)
	if err != nil {
		return nil, fmt.Errorf("failed to scan admin user: %w", err)
	}

	u.Role = AdminRole(role)
	u.CreatedAt = parseTime(createdAt)
	u.UpdatedAt = parseTime(updatedAt)
	if lastLogin.Valid {
		t := parseTime(lastLogin.String)
		u.LastLoginAt = &t
	}
	return &u, nil
}

// --- Session Operations ---

// CreateSession inserts a new admin session.
func (s *Store) CreateSession(session AdminSession) error {
	_, err := s.db.Exec(`
		INSERT INTO admin_sessions (token, admin_id, expires_at, created_at, ip)
		VALUES (?, ?, ?, ?, ?)
	`, session.Token, session.AdminID, session.ExpiresAt.Format(time.RFC3339), session.CreatedAt.Format(time.RFC3339), session.IP)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	return nil
}

// GetSessionByToken retrieves a session by its token, including the admin user.
// Returns nil if the session doesn't exist or has expired.
func (s *Store) GetSessionByToken(token string) (*AdminSession, *AdminUser, error) {
	row := s.db.QueryRow(`
		SELECT s.token, s.admin_id, s.expires_at, s.created_at, s.ip,
		       u.id, u.email, u.password_hash, u.role, u.created_at, u.updated_at, u.last_login_at
		FROM admin_sessions s
		JOIN admin_users u ON s.admin_id = u.id
		WHERE s.token = ? AND s.expires_at > ?
	`, token, time.Now().UTC().Format(time.RFC3339))

	var session AdminSession
	var admin AdminUser
	var role string
	var sessionExpiresAt, sessionCreatedAt string
	var adminCreatedAt, adminUpdatedAt string
	var lastLogin sql.NullString

	err := row.Scan(
		&session.Token, &session.AdminID, &sessionExpiresAt, &sessionCreatedAt, &session.IP,
		&admin.ID, &admin.Email, &admin.PasswordHash, &role, &adminCreatedAt, &adminUpdatedAt, &lastLogin,
	)
	if err == sql.ErrNoRows {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed to scan session: %w", err)
	}

	session.ExpiresAt = parseTime(sessionExpiresAt)
	session.CreatedAt = parseTime(sessionCreatedAt)
	admin.Role = AdminRole(role)
	admin.CreatedAt = parseTime(adminCreatedAt)
	admin.UpdatedAt = parseTime(adminUpdatedAt)
	if lastLogin.Valid {
		t := parseTime(lastLogin.String)
		admin.LastLoginAt = &t
	}

	return &session, &admin, nil
}

// DeleteSession removes a session by token.
func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec("DELETE FROM admin_sessions WHERE token = ?", token)
	return err
}

// ExtendSession updates the expiry time of a session.
func (s *Store) ExtendSession(token string, expiresAt time.Time) error {
	_, err := s.db.Exec(`
		UPDATE admin_sessions SET expires_at = ? WHERE token = ?
	`, expiresAt.Format(time.RFC3339), token)
	return err
}

// CleanExpiredSessions removes all expired sessions from the database.
func (s *Store) CleanExpiredSessions() (int64, error) {
	result, err := s.db.Exec("DELETE FROM admin_sessions WHERE expires_at <= ?", time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// --- Audit Log Operations ---

// CreateAuditLog inserts a new audit log entry.
func (s *Store) CreateAuditLog(log AuditLog) error {
	_, err := s.db.Exec(`
		INSERT INTO audit_logs (id, admin_id, admin_email, action, target_type, target_id, details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, log.ID, log.AdminID, log.AdminEmail, log.Action, log.TargetType, log.TargetID, log.Details, log.CreatedAt.Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("failed to create audit log: %w", err)
	}
	return nil
}

// ListAuditLogs returns recent audit log entries with pagination.
func (s *Store) ListAuditLogs(limit, offset int) ([]AuditLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.Query(`
		SELECT id, admin_id, admin_email, action, target_type, target_id, details, created_at
		FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list audit logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		var createdAt string
		err := rows.Scan(&l.ID, &l.AdminID, &l.AdminEmail, &l.Action, &l.TargetType, &l.TargetID, &l.Details, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit log: %w", err)
		}
		l.CreatedAt = parseTime(createdAt)
		logs = append(logs, l)
	}
	return logs, rows.Err()
}

// --- Helpers ---

// generateSessionToken creates a cryptographically random session token.
func generateSessionToken() (string, error) {
	return uuid.New().String() + uuid.New().String(), nil
}

// generateAdminID creates a new admin user ID.
func generateAdminID() string {
	return "adm_" + uuid.New().String()[:12]
}

// generateAuditLogID creates a new audit log ID.
func generateAuditLogID() string {
	return "log_" + uuid.New().String()[:12]
}