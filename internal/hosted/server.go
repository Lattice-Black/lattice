package hosted

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// Config holds the hosted control plane configuration.
type Config struct {
	ListenAddr      string
	TenantNamespace string
	TenantImage     string
	ClusterIssuer   string
	AdminAPIKey     string
	DBPath          string
	FrontendDir     string // path to the hosted frontend (signup page)

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
	store, err := NewStore(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create store: %w", err)
	}

	prov := NewProvisioner(cfg.TenantNamespace, cfg.TenantImage, cfg.ClusterIssuer)

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
	return s, nil
}

func (s *Server) setupRoutes() {
	r := s.router

	// Public routes
	r.Get("/api/hosted/signup", s.handleGetSignup) // returns signup page info
	r.Post("/api/hosted/signup", s.handleSignup)
	r.Get("/api/hosted/check-slug/{slug}", s.handleCheckSlug)
	r.Post("/api/hosted/login", s.handleLogin) // retrieve tenant URL + API key by email

	// Stripe webhook (no auth, verified by signature)
	r.Post("/api/hosted/stripe/webhook", s.handleStripeWebhook)

	// Admin routes (require admin API key)
	r.Group(func(r chi.Router) {
		r.Use(s.adminAuth)
		r.Get("/api/hosted/tenants", s.handleListTenants)
		r.Get("/api/hosted/tenants/{id}", s.handleGetTenant)
		r.Delete("/api/hosted/tenants/{id}", s.handleDeleteTenant)
		r.Post("/api/hosted/tenants/{id}/suspend", s.handleSuspendTenant)
		r.Post("/api/hosted/tenants/{id}/activate", s.handleActivateTenant)
	})

	// Serve the signup frontend
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

// --- Public Handlers ---

var slugRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$`)

func (s *Server) handleGetSignup(w http.ResponseWriter, r *http.Request) {
	JSON(w, 200, map[string]any{
		"price_yearly":       25,
		"trial_days":         14,
		"available_features": []string{"unlimited_monitors", "unlimited_status_pages", "90_day_history", "all_notifications", "incident_management", "custom_domain", "priority_support"},
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

	// Create the tenant
	now := time.Now().UTC()
	trialEnds := now.AddDate(0, 0, 14) // 14-day trial

	tenant := Tenant{
		ID:          generateTenantID(),
		Email:       req.Email,
		Slug:        req.Slug,
		APIKey:      generateAPIKey(),
		Status:      TenantTrial,
		TrialEndsAt: &trialEnds,
		CreatedAt:   now,
		UpdatedAt:   now,
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
			"tenant_id":    tenant.ID,
			"checkout_url": checkoutURL,
			"tenant_url":   tenant.TenantURL(),
			"status":       "trial",
			"trial_ends_at": trialEnds.Format(time.RFC3339),
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
		TenantURL:    tenant.TenantURL(),
		DashboardURL: tenant.DashboardURL(),
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
		"url":       slug + ".lattice.black",
	})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		BadRequest(w, "valid email is required")
		return
	}

	tenant, err := s.store.GetTenantByEmail(email)
	if err != nil {
		InternalError(w, "failed to lookup account")
		return
	}
	if tenant == nil {
		JSON(w, 200, map[string]any{"exists": false})
		return
	}

	// Return tenant URL and fresh API key so they can access their dashboard
	JSON(w, 200, map[string]any{
		"exists":        true,
		"tenant_url":    tenant.TenantURL(),
		"dashboard_url": tenant.DashboardURL(),
		"api_key":       tenant.APIKey,
		"status":        string(tenant.Status),
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

	JSON(w, 200, map[string]string{"status": "active"})
}

// --- Middleware ---

func (s *Server) adminAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-API-Key")
		if key == "" {
			auth := r.Header.Get("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				key = strings.TrimPrefix(auth, "Bearer ")
			}
		}
		if key == "" || key != s.cfg.AdminAPIKey {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// --- Helpers ---

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

func InternalError(w http.ResponseWriter, msg string) {
	JSON(w, 500, map[string]string{"error": msg})
}