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
	Slug          string      `json:"slug"`            // subdomain: {slug}.{baseDomain}
	APIKey        string      `json:"-"`               // never exposed in list responses
	PasswordHash  string      `json:"-"`
	Status        TenantStatus `json:"status"`
	StripeCustomerID string   `json:"-"`
	StripeSubID   string      `json:"-"`
	TrialEndsAt   *time.Time  `json:"trial_ends_at,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	SuspendedAt   *time.Time  `json:"suspended_at,omitempty"`
}

// TenantURL returns the full URL for the tenant's status page.
func (t Tenant) TenantURL(baseDomain string) string {
	return "https://" + t.Slug + "." + baseDomain
}

// DashboardURL returns the dashboard URL for the tenant.
func (t Tenant) DashboardURL(baseDomain string) string {
	return "https://" + t.Slug + "." + baseDomain + "/dashboard"
}

// SignupRequest is the data collected from the signup form.
type SignupRequest struct {
	Email    string `json:"email"`
	Slug     string `json:"slug"`
	Password string `json:"password"`
}

// SignupResponse is returned after a successful signup.
type SignupResponse struct {
	TenantID     string `json:"tenant_id"`
	TenantURL    string `json:"tenant_url"`
	DashboardURL string `json:"dashboard_url"`
	APIKey       string `json:"api_key,omitempty"`
	Status       string `json:"status"`
	TrialEndsAt  string `json:"trial_ends_at,omitempty"`
}

// LoginRequest is used to authenticate a tenant on the control plane.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse is returned after successful authentication.
type LoginResponse struct {
	Exists       bool   `json:"exists"`
	TenantURL    string `json:"tenant_url,omitempty"`
	DashboardURL string `json:"dashboard_url,omitempty"`
	APIKey       string `json:"api_key,omitempty"`
	Status       string `json:"status,omitempty"`
}

// PublicConfig is returned by the config endpoint for the frontend.
type PublicConfig struct {
	BaseDomain  string `json:"base_domain"`
	PriceYearly int    `json:"price_yearly"`
	TrialDays   int    `json:"trial_days"`
}