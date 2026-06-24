package hosted

import "time"

// TenantStatus represents the lifecycle state of a hosted tenant.
type TenantStatus string

const (
	TenantTrial    TenantStatus = "trial"
	TenantActive   TenantStatus = "active"
	TenantSuspended TenantStatus = "suspended"
	TenantDeleted  TenantStatus = "deleted"
)

// Tenant represents a hosted lattice customer.
type Tenant struct {
	ID            string      `json:"id"`
	Email         string      `json:"email"`
	Slug          string      `json:"slug"`           // subdomain: {slug}.lattice.black
	APIKey        string      `json:"-"`              // never expose in JSON responses
	Status        TenantStatus `json:"status"`
	StripeCustomerID string   `json:"-"`              
	StripeSubID   string      `json:"-"`              
	TrialEndsAt   *time.Time  `json:"trial_ends_at,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	SuspendedAt   *time.Time  `json:"suspended_at,omitempty"`
}

// TenantURL returns the full URL for the tenant's status page.
func (t Tenant) TenantURL() string {
	return "https://" + t.Slug + ".lattice.black"
}

// DashboardURL returns the dashboard URL for the tenant.
func (t Tenant) DashboardURL() string {
	return "https://" + t.Slug + ".lattice.black/dashboard"
}

// SignupRequest is the data collected from the signup form.
type SignupRequest struct {
	Email  string `json:"email"`
	Slug   string `json:"slug"`
}

// SignupResponse is returned after a successful signup.
type SignupResponse struct {
	TenantID    string `json:"tenant_id"`
	TenantURL   string `json:"tenant_url"`
	DashboardURL string `json:"dashboard_url"`
	APIKey      string `json:"api_key"`
	Status      string `json:"status"`
	TrialEndsAt string `json:"trial_ends_at,omitempty"`
}