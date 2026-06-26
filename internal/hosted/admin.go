package hosted

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookieName = "lattice_admin_session"
	sessionDuration   = 24 * time.Hour
)

// --- Middleware ---

// adminCombinedAuth authenticates admin requests via either:
//   1. Session cookie (set by admin login) — used by the admin UI
//   2. X-API-Key header / Bearer token (admin API key) — used by automation/CI
//
// On success, the authenticated admin info is stored in the request context.
func (s *Server) adminCombinedAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try session cookie first
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil && cookie.Value != "" {
			session, admin, err := s.store.GetSessionByToken(cookie.Value)
			if err != nil {
				log.Printf("admin auth: session lookup error: %v", err)
				Unauthorized(w)
				return
			}
			if session != nil && admin != nil {
				// Sliding renewal: extend the session on each request
				newExpiry := time.Now().UTC().Add(sessionDuration)
				if err := s.store.ExtendSession(cookie.Value, newExpiry); err != nil {
					log.Printf("admin auth: failed to extend session: %v", err)
				}
				// Refresh the cookie with the new expiry
				setSessionCookie(w, cookie.Value, newExpiry, r.TLS != nil)

				ctx := context.WithValue(r.Context(), AdminContextKey{}, AdminContextInfo{
					AdminID:    admin.ID,
					AdminEmail: admin.Email,
					Role:       admin.Role,
					Source:     "session",
				})
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		// Fall back to API key auth
		key := r.Header.Get("X-API-Key")
		if key == "" {
			auth := r.Header.Get("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				key = strings.TrimPrefix(auth, "Bearer ")
			}
		}
		if key != "" && key == s.cfg.AdminAPIKey {
			ctx := context.WithValue(r.Context(), AdminContextKey{}, AdminContextInfo{
				AdminID:    "api_key",
				AdminEmail: "api-key-automation",
				Role:       RoleSuperAdmin, // API key always has full access
				Source:     "api_key",
			})
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		Unauthorized(w)
	})
}

// requireSuperAdmin wraps a handler to require super_admin role.
func (s *Server) requireSuperAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := r.Context().Value(AdminContextKey{}).(AdminContextInfo)
		if !ok || info.Role != RoleSuperAdmin {
			JSON(w, 403, map[string]string{"error": "super admin access required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// getAdminInfo extracts admin auth info from the request context.
func getAdminInfo(r *http.Request) (AdminContextInfo, bool) {
	info, ok := r.Context().Value(AdminContextKey{}).(AdminContextInfo)
	return info, ok
}

// --- Cookie Helpers ---

func setSessionCookie(w http.ResponseWriter, token string, expires time.Time, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func clearSessionCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
	})
}

// --- Audit Helper ---

func (s *Server) audit(r *http.Request, action, targetType, targetID, details string) {
	info, ok := getAdminInfo(r)
	if !ok {
		return
	}
	log := AuditLog{
		ID:         generateAuditLogID(),
		AdminID:    info.AdminID,
		AdminEmail: info.AdminEmail,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Details:    details,
		CreatedAt:  time.Now().UTC(),
	}
	if err := s.store.CreateAuditLog(log); err != nil {
		logmsg("audit: failed to create audit log: %v", err)
	}
}

// logmsg is a thin wrapper to avoid shadowing the `log` package in audit().
func logmsg(format string, args ...any) {
	log.Printf(format, args...)
}

// --- Admin Auth Handlers ---

func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	var req AdminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		BadRequest(w, "valid email is required")
		return
	}
	if req.Password == "" {
		BadRequest(w, "password is required")
		return
	}

	admin, err := s.store.GetAdminUserByEmail(email)
	if err != nil {
		InternalError(w, "failed to lookup admin")
		return
	}
	if admin == nil {
		// Generic error to prevent email enumeration
		BadRequest(w, "invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		BadRequest(w, "invalid email or password")
		return
	}

	// Create session
	token, err := generateSessionToken()
	if err != nil {
		InternalError(w, "failed to generate session token")
		return
	}

	expiresAt := time.Now().UTC().Add(sessionDuration)
	session := AdminSession{
		Token:     token,
		AdminID:   admin.ID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
		IP:        r.RemoteAddr,
	}
	if err := s.store.CreateSession(session); err != nil {
		InternalError(w, "failed to create session")
		return
	}

	// Update last login
	if err := s.store.UpdateAdminLastLogin(admin.ID); err != nil {
		log.Printf("admin login: failed to update last login: %v", err)
	}

	setSessionCookie(w, token, expiresAt, r.TLS != nil)

	// Audit log
	s.audit(r, "admin.login", "admin_user", admin.ID, "")

	JSON(w, 200, AdminLoginResponse{Admin: *admin})
}

func (s *Server) handleAdminLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err == nil && cookie.Value != "" {
		_ = s.store.DeleteSession(cookie.Value)
		s.audit(r, "admin.logout", "admin_user", "", "")
	}
	clearSessionCookie(w, r.TLS != nil)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAdminMe(w http.ResponseWriter, r *http.Request) {
	info, ok := getAdminInfo(r)
	if !ok {
		Unauthorized(w)
		return
	}

	// If authenticated via API key, return a synthetic admin profile
	if info.Source == "api_key" {
		JSON(w, 200, AdminUser{
			ID:    "api_key",
			Email: info.AdminEmail,
			Role:  RoleSuperAdmin,
		})
		return
	}

	admin, err := s.store.GetAdminUser(info.AdminID)
	if err != nil || admin == nil {
		Unauthorized(w)
		return
	}
	JSON(w, 200, admin)
}

func (s *Server) handleAdminChangePassword(w http.ResponseWriter, r *http.Request) {
	info, ok := getAdminInfo(r)
	if !ok || info.Source != "session" {
		BadRequest(w, "password change requires session auth")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		BadRequest(w, "current_password and new_password are required")
		return
	}
	if len(req.NewPassword) < 8 {
		BadRequest(w, "new password must be at least 8 characters")
		return
	}

	admin, err := s.store.GetAdminUser(info.AdminID)
	if err != nil || admin == nil {
		InternalError(w, "failed to lookup admin")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		BadRequest(w, "current password is incorrect")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		InternalError(w, "failed to hash password")
		return
	}

	if err := s.store.UpdateAdminPassword(admin.ID, string(hash)); err != nil {
		InternalError(w, "failed to update password")
		return
	}

	s.audit(r, "admin.change_password", "admin_user", admin.ID, "")
	w.WriteHeader(http.StatusNoContent)
}

// --- Admin User Management Handlers (super_admin only) ---

func (s *Server) handleListAdminUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.store.ListAdminUsers()
	if err != nil {
		InternalError(w, "failed to list admin users")
		return
	}
	if users == nil {
		users = []AdminUser{}
	}
	JSON(w, 200, users)
}

func (s *Server) handleCreateAdminUser(w http.ResponseWriter, r *http.Request) {
	var req CreateAdminUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		BadRequest(w, "valid email is required")
		return
	}
	if len(req.Password) < 8 {
		BadRequest(w, "password must be at least 8 characters")
		return
	}
	if req.Role != RoleSuperAdmin && req.Role != RoleAdmin {
		BadRequest(w, "invalid role; must be 'super_admin' or 'admin'")
		return
	}

	// Check if email is already taken
	existing, err := s.store.GetAdminUserByEmail(email)
	if err != nil {
		InternalError(w, "failed to check email")
		return
	}
	if existing != nil {
		BadRequest(w, "an admin with this email already exists")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		InternalError(w, "failed to hash password")
		return
	}

	now := time.Now().UTC()
	admin := AdminUser{
		ID:           generateAdminID(),
		Email:        email,
		PasswordHash: string(hash),
		Role:         req.Role,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.store.CreateAdminUser(admin); err != nil {
		InternalError(w, "failed to create admin user")
		return
	}

	s.audit(r, "admin.create", "admin_user", admin.ID, "email="+admin.Email+" role="+string(admin.Role))

	JSON(w, 201, admin)
}

func (s *Server) handleDeleteAdminUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		BadRequest(w, "id is required")
		return
	}

	// Prevent self-deletion
	info, _ := getAdminInfo(r)
	if info.AdminID == id {
		BadRequest(w, "cannot delete your own account")
		return
	}

	// Prevent deleting the last super_admin
	target, err := s.store.GetAdminUser(id)
	if err != nil {
		InternalError(w, "failed to lookup admin")
		return
	}
	if target == nil {
		NotFound(w)
		return
	}
	if target.Role == RoleSuperAdmin {
		users, err := s.store.ListAdminUsers()
		if err != nil {
			InternalError(w, "failed to list admins")
			return
		}
		superCount := 0
		for _, u := range users {
			if u.Role == RoleSuperAdmin {
				superCount++
			}
		}
		if superCount <= 1 {
			BadRequest(w, "cannot delete the last super admin")
			return
		}
	}

	if err := s.store.DeleteAdminUser(id); err != nil {
		InternalError(w, "failed to delete admin user")
		return
	}

	s.audit(r, "admin.delete", "admin_user", id, "")
	w.WriteHeader(http.StatusNoContent)
}

// --- Tenant Access Handler ---

// handleGetTenantKey returns the tenant's API key so an admin can access
// the tenant's dashboard directly. This is a super_admin only operation.
func (s *Server) handleGetTenantKey(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil {
		InternalError(w, "failed to get tenant")
		return
	}
	if tenant == nil {
		NotFound(w)
		return
	}

	s.audit(r, "tenant.view_key", "tenant", id, "slug="+tenant.Slug)
	JSON(w, 200, map[string]string{
		"api_key":       tenant.APIKey,
		"dashboard_url": tenant.DashboardURL(s.cfg.BaseDomain),
		"login_url":     "https://" + tenant.Slug + "." + s.cfg.BaseDomain + "/login?key=" + tenant.APIKey,
	})
}

// --- Audit Log Handler ---

func (s *Server) handleListAuditLogs(w http.ResponseWriter, r *http.Request) {
	limit := 50
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := parseInt(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := parseInt(v); err == nil && n >= 0 {
			offset = n
		}
	}

	logs, err := s.store.ListAuditLogs(limit, offset)
	if err != nil {
		InternalError(w, "failed to list audit logs")
		return
	}
	if logs == nil {
		logs = []AuditLog{}
	}
	JSON(w, 200, logs)
}

// --- Enhanced Tenant Management Handlers ---

func (s *Server) handleUpdateTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil {
		InternalError(w, "failed to get tenant")
		return
	}
	if tenant == nil {
		NotFound(w)
		return
	}

	var req UpdateTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	changed := false
	details := ""

	if req.Email != nil {
		email := strings.TrimSpace(strings.ToLower(*req.Email))
		if email == "" || !strings.Contains(email, "@") {
			BadRequest(w, "invalid email")
			return
		}
		tenant.Email = email
		changed = true
		details += "email "
	}

	if req.Slug != nil {
		slug := strings.TrimSpace(strings.ToLower(*req.Slug))
		if !slugRegex.MatchString(slug) {
			BadRequest(w, "invalid slug")
			return
		}
		// Check slug isn't taken by another tenant
		if slug != tenant.Slug {
			exists, err := s.store.SlugExists(slug)
			if err != nil {
				InternalError(w, "failed to check slug")
				return
			}
			if exists {
				BadRequest(w, "slug already taken")
				return
			}
		}
		tenant.Slug = slug
		changed = true
		details += "slug "
	}

	if req.Status != nil {
		tenant.Status = *req.Status
		changed = true
		details += "status=" + string(*req.Status)
	}

	if !changed {
		BadRequest(w, "no fields to update")
		return
	}

	tenant.UpdatedAt = time.Now().UTC()
	if err := s.store.UpdateTenant(*tenant); err != nil {
		InternalError(w, "failed to update tenant")
		return
	}

	s.audit(r, "tenant.update", "tenant", id, details)
	JSON(w, 200, tenant)
}

func (s *Server) handleResetTenantKey(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil {
		InternalError(w, "failed to get tenant")
		return
	}
	if tenant == nil {
		NotFound(w)
		return
	}

	newKey := generateAPIKey()
	tenant.APIKey = newKey
	tenant.UpdatedAt = time.Now().UTC()

	if err := s.store.UpdateTenant(*tenant); err != nil {
		InternalError(w, "failed to update tenant")
		return
	}

	// Re-provision k8s with new API key env
	if err := s.provisioner.Provision(r.Context(), *tenant); err != nil {
		log.Printf("warning: re-provision failed after key reset: %v", err)
	}

	s.audit(r, "tenant.reset_key", "tenant", id, "")
	JSON(w, 200, ResetTenantKeyResponse{APIKey: newKey})
}

func (s *Server) handleResetTenantPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil {
		InternalError(w, "failed to get tenant")
		return
	}
	if tenant == nil {
		NotFound(w)
		return
	}

	// Generate a temporary password
	tempPassword := "Lat" + uuid.New().String()[:12]

	hash, err := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)
	if err != nil {
		InternalError(w, "failed to hash password")
		return
	}

	tenant.PasswordHash = string(hash)
	tenant.UpdatedAt = time.Now().UTC()

	if err := s.store.UpdateTenant(*tenant); err != nil {
		InternalError(w, "failed to update tenant")
		return
	}

	s.audit(r, "tenant.reset_password", "tenant", id, "")
	JSON(w, 200, ResetTenantPasswordResponse{TempPassword: tempPassword})
}

func (s *Server) handleExtendTenantTrial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil {
		InternalError(w, "failed to get tenant")
		return
	}
	if tenant == nil {
		NotFound(w)
		return
	}

	var req ExtendTrialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}
	if req.Days <= 0 || req.Days > 365 {
		BadRequest(w, "days must be between 1 and 365")
		return
	}

	var base time.Time
	if tenant.TrialEndsAt != nil && tenant.TrialEndsAt.After(time.Now()) {
		base = *tenant.TrialEndsAt
	} else {
		base = time.Now().UTC()
	}
	newExpiry := base.AddDate(0, 0, req.Days)
	tenant.TrialEndsAt = &newExpiry
	tenant.UpdatedAt = time.Now().UTC()

	if err := s.store.UpdateTenant(*tenant); err != nil {
		InternalError(w, "failed to update tenant")
		return
	}

	s.audit(r, "tenant.extend_trial", "tenant", id, fmt.Sprintf("days=+%d", req.Days))
	JSON(w, 200, ExtendTrialResponse{TrialEndsAt: newExpiry.Format(time.RFC3339)})
}

// parseInt parses an integer from a string.
func parseInt(s string) (int, error) {
	return strconv.Atoi(s)
}