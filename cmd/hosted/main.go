package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Lattice-Black/lattice/internal/hosted"
)

func main() {
	configPath := flag.String("config", "", "path to config file (not yet implemented, uses env vars)")
	flag.Parse()
	_ = configPath

	cfg := hosted.Config{
		ListenAddr:           getEnv("HOSTED_LISTEN_ADDR", ":8090"),
		TenantNamespace:      getEnv("HOSTED_NAMESPACE", "hosted-lattice"),
		TenantImage:          getEnv("HOSTED_TENANT_IMAGE", "ghcr.io/lattice-black/lattice:latest"),
		ClusterIssuer:        getEnv("HOSTED_CLUSTER_ISSUER", "letsencrypt-dns01"),
		AdminAPIKey:          getEnv("HOSTED_ADMIN_API_KEY", ""),
		DBPath:               getEnv("HOSTED_DB_PATH", "/data/hosted.db"),
		FrontendDir:          getEnv("HOSTED_FRONTEND_DIR", ""),
		AdminFrontendDir:     getEnv("HOSTED_ADMIN_FRONTEND_DIR", ""),
		BaseDomain:           getEnv("HOSTED_BASE_DOMAIN", "lattice.black"),
		BootstrapAdminEmail:    getEnv("HOSTED_BOOTSTRAP_ADMIN_EMAIL", ""),
		BootstrapAdminPassword: getEnv("HOSTED_BOOTSTRAP_ADMIN_PASSWORD", ""),
		Stripe: hosted.StripeConfig{
			SecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
			WebhookSecret: getEnv("STRIPE_WEBHOOK_SECRET", ""),
			PriceID:       getEnv("STRIPE_PRICE_ID", ""),
			SuccessURL:    getEnv("STRIPE_SUCCESS_URL", "https://hosted.lattice.black/success.html"),
			CancelURL:     getEnv("STRIPE_CANCEL_URL", "https://lattice.black/#pricing"),
		},
	}

	if cfg.AdminAPIKey == "" {
		log.Println("WARNING: HOSTED_ADMIN_API_KEY not set — API key admin access will be unavailable")
	}

	if cfg.BootstrapAdminEmail == "" {
		log.Println("INFO: HOSTED_BOOTSTRAP_ADMIN_EMAIL not set — create admin users manually or via the admin UI")
	}

	// Warn if using live Stripe keys (should use test keys in development)
	if cfg.Stripe.SecretKey != "" {
		if hosted.IsLiveStripeKey(cfg.Stripe.SecretKey) {
			log.Println("WARNING: Using LIVE Stripe secret key. Ensure this is a production deployment.")
			log.Println("WARNING: If this is a development/staging environment, use test keys (sk_test_...) instead.")
		}
		if cfg.Stripe.WebhookSecret == "" {
			log.Println("WARNING: STRIPE_WEBHOOK_SECRET not set — Stripe webhooks will fail verification")
		}
	}

	server, err := hosted.NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create hosted server: %v", err)
	}
	defer server.Close()

	httpServer := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      server.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Hosted control plane listening on %s", cfg.ListenAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	log.Println("Stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
