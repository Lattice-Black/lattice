package api

import (
	"net/http"

	"github.com/Lattice-Black/lattice/internal/config"
	"github.com/Lattice-Black/lattice/internal/scheduler"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/go-chi/chi/v5"
)

// Server is the HTTP API server for Lattice.
type Server struct {
	store     store.Store
	scheduler *scheduler.Scheduler
	cfg       *config.Config
	router    chi.Router
}

// NewServer creates a new API server.
func NewServer(st store.Store, sched *scheduler.Scheduler, cfg *config.Config) *Server {
	s := &Server{
		store:     st,
		scheduler: sched,
		cfg:       cfg,
		router:    chi.NewRouter(),
	}

	s.setupRoutes()
	return s
}

// Handler returns the HTTP handler for the server.
func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) setupRoutes() {
	r := s.router

	// Global middleware
	r.Use(RequestLogger)
	r.Use(CORS(s.cfg.Server.CORSOrigins))

	// Public routes (no auth required)
	r.Get("/status", s.handleGetStatus)
	r.Get("/status/history/{id}", s.handleGetStatusHistory)
	r.Get("/api/health", s.handleHealth)

	// Admin routes (require API key)
	r.Route("/api", func(r chi.Router) {
		r.Use(APIKeyAuth(s.cfg.Server.APIKey))

		// Monitors
		r.Get("/monitors", s.handleListMonitors)
		r.Post("/monitors", s.handleCreateMonitor)
		r.Get("/monitors/{id}", s.handleGetMonitor)
		r.Put("/monitors/{id}", s.handleUpdateMonitor)
		r.Delete("/monitors/{id}", s.handleDeleteMonitor)

		// Incidents
		r.Get("/incidents", s.handleListIncidents)
		r.Post("/incidents", s.handleCreateIncident)
		r.Get("/incidents/{id}", s.handleGetIncident)
		r.Put("/incidents/{id}", s.handleUpdateIncident)
		r.Post("/incidents/{id}/resolve", s.handleResolveIncident)

		// Notifications
		r.Get("/notifications", s.handleListNotifications)
		r.Post("/notifications", s.handleCreateNotification)
		r.Delete("/notifications/{id}", s.handleDeleteNotification)

		// Maintenance
		r.Get("/maintenance", s.handleListMaintenance)
		r.Post("/maintenance", s.handleCreateMaintenance)
		r.Delete("/maintenance/{id}", s.handleDeleteMaintenance)

		// Settings
		r.Get("/settings", s.handleGetSettings)
		r.Put("/settings", s.handleUpdateSettings)
	})
}
