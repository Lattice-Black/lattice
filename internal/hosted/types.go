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

// --- Admin Layer ---

// AdminRole represents the access level of an admin user.
type AdminRole string

const (
	RoleSuperAdmin AdminRole = "super_admin" // full control, can manage other admins
	RoleAdmin      AdminRole = "admin"      // can manage tenants, cannot manage other admins
)

// AdminUser represents a control-plane administrator.
type AdminUser struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Role         AdminRole `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

// AdminSession represents an authenticated admin session.
type AdminSession struct {
	Token     string    `json:"-"`
	AdminID   string    `json:"admin_id"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
	IP        string    `json:"-"`
}

// AuditLog records an admin action for compliance and debugging.
type AuditLog struct {
	ID         string    `json:"id"`
	AdminID    string    `json:"admin_id"`
	AdminEmail string   `json:"admin_email"`
	Action     string    `json:"action"`
	TargetType string   `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Details    string    `json:"details,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// AdminLoginRequest is used to authenticate an admin user.
type AdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AdminLoginResponse is returned after successful admin authentication.
type AdminLoginResponse struct {
	Admin AdminUser `json:"admin"`
}

// CreateAdminUserRequest is used by a super_admin to create a new admin.
type CreateAdminUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     AdminRole `json:"role"`
}

// ChangePasswordRequest is used by an admin to change their own password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

// UpdateTenantRequest allows an admin to modify tenant fields.
type UpdateTenantRequest struct {
	Email  *string `json:"email,omitempty"`
	Slug   *string `json:"slug,omitempty"`
	Status *TenantStatus `json:"status,omitempty"`
}

// ResetTenantKeyResponse returns the new API key after a reset.
type ResetTenantKeyResponse struct {
	APIKey string `json:"api_key"`
}

// ResetTenantPasswordResponse returns a temporary password after a reset.
type ResetTenantPasswordResponse struct {
	TempPassword string `json:"temp_password"`
}

// ExtendTrialRequest extends a tenant's trial period.
type ExtendTrialRequest struct {
	Days int `json:"days"`
}

// ExtendTrialResponse returns the new trial end time.
type ExtendTrialResponse struct {
	TrialEndsAt string `json:"trial_ends_at"`
}

// AdminContextKey is used to store admin auth info in request context.
type AdminContextKey struct{}

// AdminContextInfo holds the authenticated admin's info from the context.
type AdminContextInfo struct {
	AdminID    string
	AdminEmail string
	Role       AdminRole
	Source     string // "session" or "api_key"
}