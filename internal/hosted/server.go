package hosted

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

// Config holds the hosted control plane configuration.
type Config struct {
	ListenAddr          string
	TenantNamespace     string
	TenantImage         string
	ClusterIssuer       string
	AdminAPIKey         string // API key for automation/CI admin access
	DBPath              string
	FrontendDir         string // path to the hosted frontend (signup page)
	AdminFrontendDir    string // path to the admin SPA build
	BaseDomain          string // base domain for tenant URLs (e.g. "lattice.black" or "staging.lattice.black")

	// Bootstrap admin: if set and no admin users exist, create a super_admin
	BootstrapAdminEmail    string
	BootstrapAdminPassword string

	Stripe StripeConfig
}

// Server is the hosted control plane HTTP server.
type Server struct {
	cfg         Config
	store       *Store
	provisioner *Provisioner
	billing     *Billing
	router      chi.Router
}

// NewServer creates and configures the hosted control plane server.
func NewServer(cfg Config) (*Server, error) {
	if cfg.BaseDomain == "" {
		cfg.BaseDomain = "lattice.black"
	}

	store, err := NewStore(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create store: %w", err)
	}

	prov := NewProvisioner(cfg.TenantNamespace, cfg.TenantImage, cfg.ClusterIssuer, cfg.BaseDomain)

	// Ensure namespace exists
	if err := prov.EnsureNamespace(context.Background()); err != nil {
		log.Printf("Warning: failed to ensure namespace: %v", err)
	}

	var billing *Billing
	if cfg.Stripe.SecretKey != "" {
		billing = NewBilling(cfg.Stripe, store, prov)
	}

	s := &Server{
		cfg:         cfg,
		store:       store,
		provisioner: prov,
		billing:     billing,
		router:      chi.NewRouter(),
	}

	s.setupRoutes()

	// Bootstrap the first admin user if configured
	if err := s.bootstrapAdmin(); err != nil {
		log.Printf("Warning: failed to bootstrap admin: %v", err)
	}

	// Clean expired sessions on startup
	if n, err := store.CleanExpiredSessions(); err != nil {
		log.Printf("Warning: failed to clean expired sessions: %v", err)
	} else if n > 0 {
		log.Printf("Cleaned %d expired admin sessions", n)
	}

	return s, nil
}

func (s *Server) setupRoutes() {
	r := s.router

	// Auth rate limiter: 10 requests per minute per IP for signup/login
	authLimiter := RateLimit(10, time.Minute)
	// Slug check rate limiter: 30 requests per minute per IP
	slugLimiter := RateLimit(30, time.Minute)

	// Public routes
	r.Get("/api/hosted/health", s.handleHealth)      // health check for k8s probes
	r.Get("/api/hosted/config", s.handleGetConfig)      // returns public config for frontend

	// Rate-limited auth routes
	r.With(authLimiter).Post("/api/hosted/signup", s.handleSignup)
	r.With(authLimiter).Post("/api/hosted/login", s.handleLogin)
	r.With(slugLimiter).Get("/api/hosted/check-slug/{slug}", s.handleCheckSlug)

	// Stripe webhook (no auth, verified by signature)
	r.Post("/api/hosted/stripe/webhook", s.handleStripeWebhook)

	// Admin auth routes (public — login/logout)
	r.Post("/api/hosted/admin/login", s.handleAdminLogin)
	r.Post("/api/hosted/admin/logout", s.handleAdminLogout)

	// Admin-protected routes (session cookie OR API key)
	r.Group(func(r chi.Router) {
		r.Use(s.adminCombinedAuth)

		// Admin self-service
		r.Get("/api/hosted/admin/me", s.handleAdminMe)
		r.Post("/api/hosted/admin/change-password", s.handleAdminChangePassword)

		// Audit log (admin+)
		r.Get("/api/hosted/admin/audit", s.handleListAuditLogs)

		// Admin user management (super_admin only)
		r.Group(func(r chi.Router) {
			r.Use(s.requireSuperAdmin)
			r.Get("/api/hosted/admin/users", s.handleListAdminUsers)
			r.Post("/api/hosted/admin/users", s.handleCreateAdminUser)
			r.Delete("/api/hosted/admin/users/{id}", s.handleDeleteAdminUser)
		})

		// Tenant management (admin+)
		r.Get("/api/hosted/tenants", s.handleListTenants)
		r.Get("/api/hosted/tenants/{id}", s.handleGetTenant)
		r.Put("/api/hosted/tenants/{id}", s.handleUpdateTenant)
		r.Delete("/api/hosted/tenants/{id}", s.handleDeleteTenant)
		r.Post("/api/hosted/tenants/{id}/suspend", s.handleSuspendTenant)
		r.Post("/api/hosted/tenants/{id}/activate", s.handleActivateTenant)

		// Enhanced tenant actions (admin+)
		r.Post("/api/hosted/tenants/{id}/reset-key", s.handleResetTenantKey)
		r.Post("/api/hosted/tenants/{id}/reset-password", s.handleResetTenantPassword)
		r.Post("/api/hosted/tenants/{id}/extend-trial", s.handleExtendTenantTrial)
	})

	// Serve the admin SPA at /admin/*
	if s.cfg.AdminFrontendDir != "" {
		adminHandler := serveAdminSPA(s.cfg.AdminFrontendDir)
		r.Handle("/admin", adminHandler)
		r.Handle("/admin/*", adminHandler)
	}

	// Serve the signup frontend (catch-all)
	if s.cfg.FrontendDir != "" {
		r.Handle("/*", http.FileServer(http.Dir(s.cfg.FrontendDir)))
	}
}

// Handler returns the HTTP handler.
func (s *Server) Handler() http.Handler { return s.router }

// Close cleans up resources.
func (s *Server) Close() error {
	return s.store.Close()
}

// bootstrapAdmin creates the first super_admin user if bootstrap credentials
// are configured and no admin users exist yet. This allows initial admin
// access without manual DB operations.
func (s *Server) bootstrapAdmin() error {
	if s.cfg.BootstrapAdminEmail == "" || s.cfg.BootstrapAdminPassword == "" {
		return nil // not configured
	}

	count, err := s.store.CountAdminUsers()
	if err != nil {
		return fmt.Errorf("failed to count admin users: %w", err)
	}
	if count > 0 {
		return nil // admins already exist
	}

	email := strings.TrimSpace(strings.ToLower(s.cfg.BootstrapAdminEmail))
	hash, err := bcrypt.GenerateFromPassword([]byte(s.cfg.BootstrapAdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash bootstrap password: %w", err)
	}

	now := time.Now().UTC()
	admin := AdminUser{
		ID:           generateAdminID(),
		Email:        email,
		PasswordHash: string(hash),
		Role:         RoleSuperAdmin,
		CreatedAt:    now,
		UpdatedAt:   now,
	}

	if err := s.store.CreateAdminUser(admin); err != nil {
		return fmt.Errorf("failed to create bootstrap admin: %w", err)
	}

	log.Printf("Bootstrapped super admin: %s", email)
	return nil
}

// --- Public Handlers ---

var slugRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$`)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	JSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	JSON(w, 200, PublicConfig{
		BaseDomain:  s.cfg.BaseDomain,
		PriceYearly: 25,
		TrialDays:   14,
	})
}

func (s *Server) handleSignup(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Slug = strings.TrimSpace(strings.ToLower(req.Slug))

	if req.Email == "" {
		BadRequest(w, "email is required")
		return
	}
	if !strings.Contains(req.Email, "@") {
		BadRequest(w, "invalid email")
		return
	}
	if len(req.Password) < 8 {
		BadRequest(w, "password must be at least 8 characters")
		return
	}
	if !slugRegex.MatchString(req.Slug) {
		BadRequest(w, "invalid slug: use 3-32 chars, lowercase letters, numbers, and hyphens")
		return
	}

	// Check slug isn't taken
	exists, err := s.store.SlugExists(req.Slug)
	if err != nil {
		InternalError(w, "failed to check slug availability")
		return
	}
	if exists {
		BadRequest(w, "that subdomain is already taken")
		return
	}

	// Check email isn't already registered
	existing, err := s.store.GetTenantByEmail(req.Email)
	if err != nil {
		InternalError(w, "failed to check email")
		return
	}
	if existing != nil {
		BadRequest(w, "an account with this email already exists")
		return
	}

	// Hash the password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		InternalError(w, "failed to hash password")
		return
	}

	// Create the tenant
	now := time.Now().UTC()
	trialEnds := now.AddDate(0, 0, 14) // 14-day trial

	tenant := Tenant{
		ID:           generateTenantID(),
		Email:        req.Email,
		Slug:         req.Slug,
		APIKey:       generateAPIKey(),
		PasswordHash: string(hash),
		Status:       TenantTrial,
		TrialEndsAt:  &trialEnds,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// If Stripe is configured, create a checkout session
	if s.billing != nil {
		checkoutURL, err := s.billing.CreateCheckoutSession(tenant)
		if err != nil {
			log.Printf("Error creating checkout session: %v", err)
			InternalError(w, "failed to create checkout session")
			return
		}

		// Save tenant first
		if err := s.store.CreateTenant(tenant); err != nil {
			InternalError(w, "failed to create tenant")
			return
		}

		// Provision the k8s resources
		if err := s.provisioner.Provision(r.Context(), tenant); err != nil {
			log.Printf("Error provisioning tenant: %v", err)
			// Don't fail — the tenant can retry provisioning
		}

		JSON(w, 201, map[string]any{
			"tenant_id":     tenant.ID,
			"checkout_url":  checkoutURL,
			"tenant_url":    tenant.TenantURL(s.cfg.BaseDomain),
			"status":         "trial",
			"trial_ends_at":  trialEnds.Format(time.RFC3339),
		})
		return
	}

	// No Stripe — just create the tenant with a trial (manual billing)
	if err := s.store.CreateTenant(tenant); err != nil {
		InternalError(w, "failed to create tenant")
		return
	}

	// Provision k8s resources
	if err := s.provisioner.Provision(r.Context(), tenant); err != nil {
		log.Printf("Error provisioning tenant: %v", err)
	}

	JSON(w, 201, SignupResponse{
		TenantID:     tenant.ID,
		TenantURL:    tenant.TenantURL(s.cfg.BaseDomain),
		DashboardURL: tenant.DashboardURL(s.cfg.BaseDomain),
		APIKey:       tenant.APIKey,
		Status:       "trial",
		TrialEndsAt:  trialEnds.Format(time.RFC3339),
	})
}

func (s *Server) handleCheckSlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if !slugRegex.MatchString(slug) {
		JSON(w, 200, map[string]any{"available": false, "reason": "invalid slug format"})
		return
	}

	exists, err := s.store.SlugExists(slug)
	if err != nil {
		InternalError(w, "failed to check slug")
		return
	}

	JSON(w, 200, map[string]any{
		"available": !exists,
		"slug":      slug,
		"url":       slug + "." + s.cfg.BaseDomain,
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
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

	tenant, err := s.store.GetTenantByEmail(email)
	if err != nil {
		InternalError(w, "failed to lookup account")
		return
	}
	if tenant == nil {
		// Return generic error to avoid email enumeration
		JSON(w, 200, LoginResponse{Exists: false})
		return
	}

	// Verify password
	if tenant.PasswordHash == "" {
		// Legacy tenant without password — treat as invalid credentials
		BadRequest(w, "please reset your password (your account predates password auth)")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(tenant.PasswordHash), []byte(req.Password)); err != nil {
		BadRequest(w, "invalid email or password")
		return
	}

	// Authentication succeeded — return tenant URL and API key
	JSON(w, 200, LoginResponse{
		Exists:       true,
		TenantURL:    tenant.TenantURL(s.cfg.BaseDomain),
		DashboardURL: tenant.DashboardURL(s.cfg.BaseDomain),
		APIKey:       tenant.APIKey,
		Status:       string(tenant.Status),
	})
}

// --- Stripe Webhook ---

func (s *Server) handleStripeWebhook(w http.ResponseWriter, r *http.Request) {
	if s.billing == nil {
		http.Error(w, "billing not configured", http.StatusServiceUnavailable)
		return
	}

	payload, err := io.ReadAll(r.Body)
	if err != nil {
		BadRequest(w, "failed to read body")
		return
	}

	signature := r.Header.Get("Stripe-Signature")
	if err := s.billing.HandleWebhook(payload, signature); err != nil {
		log.Printf("Stripe webhook error: %v", err)
		http.Error(w, "webhook error", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// --- Admin Handlers ---

func (s *Server) handleListTenants(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")
	tenants, err := s.store.ListTenants(statusFilter)
	if err != nil {
		InternalError(w, "failed to list tenants")
		return
	}
	if tenants == nil {
		tenants = []Tenant{}
	}
	JSON(w, 200, tenants)
}

func (s *Server) handleGetTenant(w http.ResponseWriter, r *http.Request) {
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
	JSON(w, 200, tenant)
}

func (s *Server) handleDeleteTenant(w http.ResponseWriter, r *http.Request) {
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

	// Deprovision k8s resources
	if err := s.provisioner.Deprovision(r.Context(), tenant.Slug); err != nil {
		log.Printf("Warning: deprovision error: %v", err)
	}

	// Optionally cancel Stripe subscription
	if s.billing != nil && tenant.StripeSubID != "" {
		if err := s.billing.CancelSubscription(tenant.StripeSubID); err != nil {
			log.Printf("Warning: failed to cancel subscription: %v", err)
		}
	}

	// Mark as deleted in DB
	if err := s.store.UpdateTenantStatus(id, TenantDeleted); err != nil {
		InternalError(w, "failed to delete tenant")
		return
	}

	s.audit(r, "tenant.delete", "tenant", id, "slug="+tenant.Slug)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleSuspendTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil || tenant == nil {
		NotFound(w)
		return
	}

	if err := s.provisioner.Scale(r.Context(), tenant.Slug, 0); err != nil {
		log.Printf("Warning: failed to scale down: %v", err)
	}
	if err := s.store.UpdateTenantStatus(id, TenantSuspended); err != nil {
		InternalError(w, "failed to suspend tenant")
		return
	}

	s.audit(r, "tenant.suspend", "tenant", id, "slug="+tenant.Slug)
	JSON(w, 200, map[string]string{"status": "suspended"})
}

func (s *Server) handleActivateTenant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenant, err := s.store.GetTenant(id)
	if err != nil || tenant == nil {
		NotFound(w)
		return
	}

	if err := s.provisioner.Scale(r.Context(), tenant.Slug, 1); err != nil {
		log.Printf("Warning: failed to scale up: %v", err)
	}
	if err := s.store.UpdateTenantStatus(id, TenantActive); err != nil {
		InternalError(w, "failed to activate tenant")
		return
	}

	s.audit(r, "tenant.activate", "tenant", id, "slug="+tenant.Slug)
	JSON(w, 200, map[string]string{"status": "active"})
}

// --- Helpers ---

// serveAdminSPA returns an http.Handler that serves the admin SPA from the
// given directory. Static files are served directly; all other paths fall
// back to index.html for client-side routing.
func serveAdminSPA(dir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip the /admin prefix
		relPath := strings.TrimPrefix(r.URL.Path, "/admin")
		relPath = strings.TrimPrefix(relPath, "/")

		// Try to serve the file directly
		filePath := filepath.Join(dir, relPath)
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}

		// Fall back to index.html for SPA routing
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		json.NewEncoder(w).Encode(v)
	}
}

func BadRequest(w http.ResponseWriter, msg string) {
	JSON(w, 400, map[string]string{"error": msg})
}

func NotFound(w http.ResponseWriter) {
	JSON(w, 404, map[string]string{"error": "not found"})
}

func Unauthorized(w http.ResponseWriter) {
	JSON(w, 401, map[string]string{"error": "unauthorized"})
}

func InternalError(w http.ResponseWriter, msg string) {
	JSON(w, 500, map[string]string{"error": msg})
}