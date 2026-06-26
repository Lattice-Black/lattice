package hosted

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	s, err := NewStore(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { s.Close() })
	return s
}

func TestCreateAndGetTenant(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC().Truncate(time.Second)
	trialEnds := now.AddDate(0, 0, 14)

	tenant := Tenant{
		ID:          "tnt_test123",
		Email:       "test@example.com",
		Slug:        "test-slug",
		APIKey:      "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:      TenantTrial,
		TrialEndsAt: &trialEnds,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	err := s.CreateTenant(tenant)
	require.NoError(t, err)

	// Get by ID
	got, err := s.GetTenant("tnt_test123")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "test@example.com", got.Email)
	assert.Equal(t, "test-slug", got.Slug)
	assert.Equal(t, TenantTrial, got.Status)
	require.NotNil(t, got.TrialEndsAt)
	assert.Equal(t, trialEnds.Unix(), got.TrialEndsAt.Unix())

	// Get by slug
	got, err = s.GetTenantBySlug("test-slug")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "tnt_test123", got.ID)

	// Get by email
	got, err = s.GetTenantByEmail("test@example.com")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "tnt_test123", got.ID)
}

func TestGetTenantNotFound(t *testing.T) {
	s := newTestStore(t)

	got, err := s.GetTenant("nonexistent")
	require.NoError(t, err)
	assert.Nil(t, got)

	got, err = s.GetTenantByEmail("nobody@example.com")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestSlugExists(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:          "tnt_test123",
		Email:       "test@example.com",
		Slug:        "my-slug",
		APIKey:      "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:      TenantTrial,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Slug should be taken
	exists, err := s.SlugExists("my-slug")
	require.NoError(t, err)
	assert.True(t, exists)

	// Different slug should be available
	exists, err = s.SlugExists("other-slug")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestSlugReuseAfterDelete(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:          "tnt_test123",
		Email:       "test@example.com",
		Slug:        "reusable-slug",
		APIKey:      "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:      TenantTrial,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Slug is taken
	exists, _ := s.SlugExists("reusable-slug")
	assert.True(t, exists)

	// Soft delete (mark as deleted)
	require.NoError(t, s.UpdateTenantStatus("tnt_test123", TenantDeleted))

	// Slug should now be available for reuse
	exists, _ = s.SlugExists("reusable-slug")
	assert.False(t, exists)
}

func TestUpdateTenantStatus(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:          "tnt_test123",
		Email:       "test@example.com",
		Slug:        "test-slug",
		APIKey:      "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:      TenantTrial,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Suspend the tenant
	err := s.UpdateTenantStatus("tnt_test123", TenantSuspended)
	require.NoError(t, err)

	got, err := s.GetTenant("tnt_test123")
	require.NoError(t, err)
	assert.Equal(t, TenantSuspended, got.Status)
	require.NotNil(t, got.SuspendedAt)

	// Reactivate
	err = s.UpdateTenantStatus("tnt_test123", TenantActive)
	require.NoError(t, err)

	got, err = s.GetTenant("tnt_test123")
	require.NoError(t, err)
	assert.Equal(t, TenantActive, got.Status)
}

func TestListTenants(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	// Create multiple tenants
	for i := 0; i < 3; i++ {
		tenant := Tenant{
			ID:          "tnt_test" + string(rune('a'+i)),
			Email:       "test" + string(rune('a'+i)) + "@example.com",
			Slug:        "slug-" + string(rune('a'+i)),
			APIKey:      "lat_key" + string(rune('a'+i)),
			PasswordHash: "$2a$10$somehash",
			Status:      TenantTrial,
			CreatedAt:   now.Add(time.Duration(i) * time.Hour),
			UpdatedAt:   now,
		}
		require.NoError(t, s.CreateTenant(tenant))
	}

	// List all
	tenants, err := s.ListTenants("")
	require.NoError(t, err)
	assert.Len(t, tenants, 3)

	// List by status
	tenants, err = s.ListTenants("trial")
	require.NoError(t, err)
	assert.Len(t, tenants, 3)

	// Mark one as active
	require.NoError(t, s.UpdateTenantStatus("tnt_testa", TenantActive))

	tenants, err = s.ListTenants("trial")
	require.NoError(t, err)
	assert.Len(t, tenants, 2)

	tenants, err = s.ListTenants("active")
	require.NoError(t, err)
	assert.Len(t, tenants, 1)
}

func TestListTenantsExcludesDeleted(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:          "tnt_deleted",
		Email:       "deleted@example.com",
		Slug:        "deleted-slug",
		APIKey:      "lat_deleted",
		PasswordHash: "$2a$10$somehash",
		Status:      TenantActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Delete it
	require.NoError(t, s.UpdateTenantStatus("tnt_deleted", TenantDeleted))

	// Should not appear in list
	tenants, err := s.ListTenants("")
	require.NoError(t, err)
	assert.Len(t, tenants, 0)

	// Should not appear by email
	got, err := s.GetTenantByEmail("deleted@example.com")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestUpdateTenant(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:           "tnt_test123",
		Email:        "test@example.com",
		Slug:         "test-slug",
		APIKey:       "lat_abcd1234",
		PasswordHash: "$2a$10$somehash",
		Status:       TenantTrial,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	// Update tenant fields
	tenant.Email = "newemail@example.com"
	tenant.StripeCustomerID = "cus_123"
	tenant.StripeSubID = "sub_456"
	tenant.Status = TenantActive
	tenant.TrialEndsAt = nil
	tenant.UpdatedAt = time.Now().UTC()

	err := s.UpdateTenant(tenant)
	require.NoError(t, err)

	got, err := s.GetTenant("tnt_test123")
	require.NoError(t, err)
	assert.Equal(t, "newemail@example.com", got.Email)
	assert.Equal(t, "cus_123", got.StripeCustomerID)
	assert.Equal(t, "sub_456", got.StripeSubID)
	assert.Equal(t, TenantActive, got.Status)
	assert.Nil(t, got.TrialEndsAt)
}

func TestGetTenantByStripeCustomer(t *testing.T) {
	s := newTestStore(t)
	now := time.Now().UTC()

	tenant := Tenant{
		ID:               "tnt_test123",
		Email:            "test@example.com",
		Slug:             "test-slug",
		APIKey:           "lat_abcd1234",
		PasswordHash:     "$2a$10$somehash",
		Status:           TenantActive,
		StripeCustomerID: "cus_abc123",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	require.NoError(t, s.CreateTenant(tenant))

	got, err := s.GetTenantByStripeCustomer("cus_abc123")
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "tnt_test123", got.ID)

	// Not found
	got, err = s.GetTenantByStripeCustomer("cus_nonexistent")
	require.NoError(t, err)
	assert.Nil(t, got)
}

func TestTenantURLs(t *testing.T) {
	tenant := Tenant{Slug: "acme"}
	assert.Equal(t, "https://acme.lattice.black", tenant.TenantURL("lattice.black"))
	assert.Equal(t, "https://acme.lattice.black/dashboard", tenant.DashboardURL("lattice.black"))
	assert.Equal(t, "https://acme.staging.lattice.black", tenant.TenantURL("staging.lattice.black"))
}

func TestSlugRegex(t *testing.T) {
	valid := []string{"abc", "a-b-c", "my-company", "test123", "a1b2c3"}
	invalid := []string{"", "ab", "-abc", "abc-", "ABC", "a_b", "a.b", "a" + string(make([]byte, 35))}

	for _, s := range valid {
		assert.True(t, slugRegex.MatchString(s), "expected %q to be valid", s)
	}
	for _, s := range invalid {
		assert.False(t, slugRegex.MatchString(s), "expected %q to be invalid", s)
	}
}