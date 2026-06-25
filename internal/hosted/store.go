package hosted

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Store manages tenant data in SQLite.
type Store struct {
	db *sql.DB
}

// NewStore creates a new tenant store at the given path.
func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("failed to open hosted database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping hosted database: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to migrate hosted database: %w", err)
	}

	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			slug TEXT NOT NULL,
			api_key TEXT NOT NULL,
			password_hash TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'trial',
			stripe_customer_id TEXT NOT NULL DEFAULT '',
			stripe_sub_id TEXT NOT NULL DEFAULT '',
			trial_ends_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			suspended_at TEXT
		);
		-- Partial unique index: slug must be unique only among non-deleted tenants
		CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE status != 'deleted';
		CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
		CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
		CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
	`)
	if err != nil {
		return err
	}

	// Migrate from old schema: if the table was created with `slug TEXT NOT NULL UNIQUE`,
	// the column-level UNIQUE constraint prevents slug reuse after soft-delete.
	// We recreate the table without it and rely on the partial unique index instead.
	return s.migrateDropSlugUnique()
}

// migrateDropSlugUnique checks if the tenants table has a column-level UNIQUE
// constraint on slug and migrates it to use only the partial unique index.
func (s *Store) migrateDropSlugUnique() error {
	// Check the table's CREATE SQL for a column-level UNIQUE on slug.
	// We can't use sqlite_autoindex_tenants_1 because that index also covers
	// the PRIMARY KEY (id TEXT PRIMARY KEY), so it always exists.
	var tableSQL string
	err := s.db.QueryRow(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tenants'`).Scan(&tableSQL)
	if err != nil {
		return fmt.Errorf("failed to read tenants schema: %w", err)
	}

	// If the slug column does NOT have a column-level UNIQUE constraint,
	// the migration has already been applied.
	if !strings.Contains(tableSQL, "slug TEXT NOT NULL UNIQUE") {
		return nil // already migrated
	}

	// Recreate the table without the column-level UNIQUE constraint.
	// IMPORTANT: preserve existing password_hash values instead of blanking them.
	_, err = s.db.Exec(`
		CREATE TABLE tenants_new (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			slug TEXT NOT NULL,
			api_key TEXT NOT NULL,
			password_hash TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'trial',
			stripe_customer_id TEXT NOT NULL DEFAULT '',
			stripe_sub_id TEXT NOT NULL DEFAULT '',
			trial_ends_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			suspended_at TEXT
		);
		INSERT INTO tenants_new SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at FROM tenants;
		DROP TABLE tenants;
		ALTER TABLE tenants_new RENAME TO tenants;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE status != 'deleted';
		CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
		CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
		CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
	`)
	return err
}

// CreateTenant inserts a new tenant.
func (s *Store) CreateTenant(t Tenant) error {
	var trialEnds *string
	if t.TrialEndsAt != nil {
		v := t.TrialEndsAt.Format(time.RFC3339)
		trialEnds = &v
	}
	var suspended *string
	if t.SuspendedAt != nil {
		v := t.SuspendedAt.Format(time.RFC3339)
		suspended = &v
	}

	_, err := s.db.Exec(`
		INSERT INTO tenants (id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, t.ID, t.Email, t.Slug, t.APIKey, t.PasswordHash, string(t.Status), t.StripeCustomerID, t.StripeSubID, trialEnds, t.CreatedAt.Format(time.RFC3339), t.UpdatedAt.Format(time.RFC3339), suspended)
	if err != nil {
		return fmt.Errorf("failed to create tenant: %w", err)
	}
	return nil
}

// GetTenant retrieves a tenant by ID.
func (s *Store) GetTenant(id string) (*Tenant, error) {
	row := s.db.QueryRow(`
		SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at
		FROM tenants WHERE id = ?
	`, id)
	return scanTenant(row)
}

// GetTenantBySlug retrieves a tenant by their subdomain slug.
func (s *Store) GetTenantBySlug(slug string) (*Tenant, error) {
	row := s.db.QueryRow(`
		SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at
		FROM tenants WHERE slug = ?
	`, slug)
	return scanTenant(row)
}

// GetTenantByStripeCustomer retrieves a tenant by Stripe customer ID.
func (s *Store) GetTenantByStripeCustomer(customerID string) (*Tenant, error) {
	row := s.db.QueryRow(`
		SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at
		FROM tenants WHERE stripe_customer_id = ?
	`, customerID)
	return scanTenant(row)
}

// GetTenantByEmail retrieves a non-deleted tenant by email.
func (s *Store) GetTenantByEmail(email string) (*Tenant, error) {
	row := s.db.QueryRow(`
		SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at
		FROM tenants WHERE email = ? AND status != 'deleted'
	`, email)
	return scanTenant(row)
}

// ListTenants returns all non-deleted tenants, optionally filtered by status.
func (s *Store) ListTenants(statusFilter string) ([]Tenant, error) {
	var query string
	var args []interface{}
	if statusFilter != "" {
		query = `SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at FROM tenants WHERE status = ? ORDER BY created_at DESC`
		args = append(args, statusFilter)
	} else {
		query = `SELECT id, email, slug, api_key, password_hash, status, stripe_customer_id, stripe_sub_id, trial_ends_at, created_at, updated_at, suspended_at FROM tenants WHERE status != 'deleted' ORDER BY created_at DESC`
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tenants: %w", err)
	}
	defer rows.Close()

	var tenants []Tenant
	for rows.Next() {
		t, err := scanTenantRow(rows)
		if err != nil {
			return nil, err
		}
		tenants = append(tenants, *t)
	}
	return tenants, rows.Err()
}

// UpdateTenant updates an existing tenant.
func (s *Store) UpdateTenant(t Tenant) error {
	var trialEnds *string
	if t.TrialEndsAt != nil {
		v := t.TrialEndsAt.Format(time.RFC3339)
		trialEnds = &v
	}
	var suspended *string
	if t.SuspendedAt != nil {
		v := t.SuspendedAt.Format(time.RFC3339)
		suspended = &v
	}

	_, err := s.db.Exec(`
		UPDATE tenants SET email = ?, slug = ?, api_key = ?, password_hash = ?, status = ?, stripe_customer_id = ?, stripe_sub_id = ?, trial_ends_at = ?, updated_at = ?, suspended_at = ?
		WHERE id = ?
	`, t.Email, t.Slug, t.APIKey, t.PasswordHash, string(t.Status), t.StripeCustomerID, t.StripeSubID, trialEnds, t.UpdatedAt.Format(time.RFC3339), suspended, t.ID)
	if err != nil {
		return fmt.Errorf("failed to update tenant: %w", err)
	}
	return nil
}

// UpdateTenantStatus updates only the status of a tenant.
func (s *Store) UpdateTenantStatus(id string, status TenantStatus) error {
	var suspended *string
	if status == TenantSuspended {
		v := time.Now().UTC().Format(time.RFC3339)
		suspended = &v
	}
	_, err := s.db.Exec(`
		UPDATE tenants SET status = ?, updated_at = ?, suspended_at = ?
		WHERE id = ?
	`, string(status), time.Now().UTC().Format(time.RFC3339), suspended, id)
	return err
}

// DeleteTenant removes a tenant from the database.
func (s *Store) DeleteTenant(id string) error {
	_, err := s.db.Exec("DELETE FROM tenants WHERE id = ?", id)
	return err
}

// SlugExists checks if a slug is already taken.
func (s *Store) SlugExists(slug string) (bool, error) {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM tenants WHERE slug = ? AND status != 'deleted'", slug).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func scanTenant(row *sql.Row) (*Tenant, error) {
	var t Tenant
	var status string
	var trialEnds, suspended sql.NullString
	var createdAt, updatedAt string

	err := row.Scan(&t.ID, &t.Email, &t.Slug, &t.APIKey, &t.PasswordHash, &status, &t.StripeCustomerID, &t.StripeSubID, &trialEnds, &createdAt, &updatedAt, &suspended)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan tenant: %w", err)
	}

	t.Status = TenantStatus(status)
	t.CreatedAt = parseTime(createdAt)
	t.UpdatedAt = parseTime(updatedAt)
	if trialEnds.Valid {
		v := parseTime(trialEnds.String)
		t.TrialEndsAt = &v
	}
	if suspended.Valid {
		v := parseTime(suspended.String)
		t.SuspendedAt = &v
	}
	return &t, nil
}

func scanTenantRow(rows *sql.Rows) (*Tenant, error) {
	var t Tenant
	var status string
	var trialEnds, suspended sql.NullString
	var createdAt, updatedAt string

	err := rows.Scan(&t.ID, &t.Email, &t.Slug, &t.APIKey, &t.PasswordHash, &status, &t.StripeCustomerID, &t.StripeSubID, &trialEnds, &createdAt, &updatedAt, &suspended)
	if err != nil {
		return nil, fmt.Errorf("failed to scan tenant: %w", err)
	}

	t.Status = TenantStatus(status)
	t.CreatedAt = parseTime(createdAt)
	t.UpdatedAt = parseTime(updatedAt)
	if trialEnds.Valid {
		v := parseTime(trialEnds.String)
		t.TrialEndsAt = &v
	}
	if suspended.Valid {
		v := parseTime(suspended.String)
		t.SuspendedAt = &v
	}
	return &t, nil
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}