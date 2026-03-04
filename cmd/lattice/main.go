package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Lattice-Black/lattice/internal/api"
	"github.com/Lattice-Black/lattice/internal/config"
	"github.com/Lattice-Black/lattice/internal/notify"
	"github.com/Lattice-Black/lattice/internal/scheduler"
	"github.com/Lattice-Black/lattice/internal/store"
)

func main() {
	configPath := flag.String("config", "", "path to config file (default: lattice.yaml)")
	flag.Parse()

	// Load configuration
	cfg, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Open store
	st, err := store.New(cfg.Database.Path)
	if err != nil {
		log.Fatalf("Failed to open store: %v", err)
	}
	defer st.Close()

	// Load state from store
	state, err := st.LoadState()
	if err != nil {
		log.Fatalf("Failed to load state: %v", err)
	}

	log.Printf("Loaded state: %d monitors, %d incidents, %d notification channels",
		len(state.Monitors), len(state.Incidents), len(state.NotificationChannels))

	// Create notification registry
	notifyRegistry := notify.NewRegistry(state)
	notifyRegistry.Register(notify.NewSlackDispatcher())
	notifyRegistry.Register(notify.NewDiscordDispatcher())
	notifyRegistry.Register(notify.NewEmailDispatcher())
	notifyRegistry.Register(notify.NewWebhookDispatcher())
	notifyRegistry.Register(notify.NewNtfyDispatcher())

	// Create scheduler with notification handler
	sched := scheduler.New(st, state, notifyRegistry)

	// Create API server
	server := api.NewServer(st, sched, cfg)

	// Create HTTP server
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      server.Handler(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start scheduler in background
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := sched.Start(ctx); err != nil {
		log.Fatalf("Failed to start scheduler: %v", err)
	}
	log.Printf("Scheduler started")

	// Start HTTP server in background
	go func() {
		log.Printf("Starting server on %s", addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")

	// Stop scheduler
	sched.Stop()

	// Shutdown HTTP server with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}

func loadConfig(path string) (*config.Config, error) {
	// Try explicit path first
	if path != "" {
		return config.Load(path)
	}

	// Try lattice.yaml in current directory
	if _, err := os.Stat("lattice.yaml"); err == nil {
		return config.Load("lattice.yaml")
	}

	// Return default config
	return &config.Config{
		Server: config.ServerConfig{
			Port:        8080,
			Host:        "0.0.0.0",
			CORSOrigins: []string{"*"},
		},
		Database: config.DatabaseConfig{
			Path:          "./lattice.db",
			RetentionDays: 90,
		},
	}, nil
}
