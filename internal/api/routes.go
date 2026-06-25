package api

import (
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/Lattice-Black/lattice/internal/config"
	"github.com/Lattice-Black/lattice/internal/scheduler"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/Lattice-Black/lattice/internal/web"
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
	r.Use(LimitBody)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Public API routes (no auth required)
		r.Get("/health", s.handleHealth)
		r.Get("/status", s.handleGetStatus)
		r.Get("/status/history/{id}", s.handleGetStatusHistory)

		// Admin routes (require API key)
		r.Group(func(r chi.Router) {
			r.Use(APIKeyAuth(s.cfg.Server.APIKey))

			// Monitors
			r.Get("/monitors", s.handleListMonitors)
			r.Post("/monitors", s.handleCreateMonitor)
			r.Get("/monitors/{id}", s.handleGetMonitor)
			r.Put("/monitors/{id}", s.handleUpdateMonitor)
			r.Patch("/monitors/{id}", s.handlePatchMonitor)
			r.Delete("/monitors/{id}", s.handleDeleteMonitor)
			r.Get("/monitors/{id}/history", s.handleMonitorHistory)

			// Incidents
			r.Get("/incidents", s.handleListIncidents)
			r.Post("/incidents", s.handleCreateIncident)
			r.Get("/incidents/{id}", s.handleGetIncident)
			r.Put("/incidents/{id}", s.handleUpdateIncident)
			r.Post("/incidents/{id}/updates", s.handleAddIncidentUpdate)
			r.Post("/incidents/{id}/resolve", s.handleResolveIncident)
			r.Delete("/incidents/{id}", s.handleDeleteIncident)

			// Notifications
			r.Get("/notifications", s.handleListNotifications)
			r.Post("/notifications", s.handleCreateNotification)
			r.Get("/notifications/{id}", s.handleGetNotification)
			r.Put("/notifications/{id}", s.handleUpdateNotification)
			r.Delete("/notifications/{id}", s.handleDeleteNotification)
			r.Post("/notifications/{id}/test", s.handleTestNotification)

			// Maintenance
			r.Get("/maintenance", s.handleListMaintenance)
			r.Post("/maintenance", s.handleCreateMaintenance)
			r.Get("/maintenance/{id}", s.handleGetMaintenance)
			r.Put("/maintenance/{id}", s.handleUpdateMaintenance)
			r.Delete("/maintenance/{id}", s.handleDeleteMaintenance)

			// Settings
			r.Get("/settings", s.handleGetSettings)
			r.Put("/settings", s.handleUpdateSettings)
		})
	})

	// Serve app (dashboard, status page, login) at /status, /dashboard/*, /login
	appHandler := serveSPA(web.AppFS, "app")
	r.Handle("/status", appHandler)
	r.Handle("/status/*", appHandler)
	r.Handle("/dashboard", appHandler)
	r.Handle("/dashboard/*", appHandler)
	r.Handle("/login", appHandler)
	r.Handle("/login/*", appHandler)

	// Shared static assets (/assets/*) — both the marketing site and the
	// dashboard app emit build artifacts to /assets/ with content-hashed
	// filenames, so there is no collision. This handler tries the app FS
	// first, then falls back to the site FS.
	r.Handle("/assets/*", serveStaticFromFSes(
		fsItem{fsys: web.AppFS, subdir: "app"},
		fsItem{fsys: web.SiteFS, subdir: "site"},
	))

	// Serve marketing site at root (catch-all for everything else)
	r.Handle("/*", serveSPA(web.SiteFS, "site"))
}

// serveSPA returns an http.Handler that serves a single-page application.
// It serves static files from the embedded FS, falling back to index.html for SPA routing.
func serveSPA(fsys fs.FS, subdir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Clean the URL path
		urlPath := strings.TrimPrefix(r.URL.Path, "/")

		// Try to find the file in the embedded FS
		filePath := path.Join(subdir, urlPath)

		// Try to open the file
		file, err := fsys.Open(filePath)
		if err == nil {
			defer file.Close()
			stat, err := file.Stat()
			if err == nil && !stat.IsDir() {
				// Set content type based on extension
				contentType := getContentType(filePath)
				w.Header().Set("Content-Type", contentType)
				// Use http.ServeContent for proper caching, ETag, range support
				http.ServeContent(w, r, stat.Name(), stat.ModTime(), file.(io.ReadSeeker))
				return
			}
		}

		// Fall back to index.html for SPA routing
		indexPath := path.Join(subdir, "index.html")
		indexFile, err := fsys.Open(indexPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer indexFile.Close()

		content, err := io.ReadAll(indexFile)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(content)
	})
}

// fsItem pairs an embedded filesystem with its top-level subdirectory.
type fsItem struct {
	fsys  fs.FS
	subdir string
}

// serveStaticFromFSes returns an http.Handler that tries to serve a static
// file from one of several embedded filesystems (in order). Unlike
// serveSPA it does NOT fall back to index.html — if the file is not found
// in any FS it returns a 404.
func serveStaticFromFSes(items ...fsItem) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := strings.TrimPrefix(r.URL.Path, "/")

		for _, item := range items {
			filePath := path.Join(item.subdir, urlPath)
			file, err := item.fsys.Open(filePath)
			if err != nil {
				continue
			}
			stat, err := file.Stat()
			if err != nil || stat.IsDir() {
				file.Close()
				continue
			}
			contentType := getContentType(filePath)
			w.Header().Set("Content-Type", contentType)
			http.ServeContent(w, r, stat.Name(), stat.ModTime(), file.(io.ReadSeeker))
			file.Close()
			return
		}

		http.NotFound(w, r)
	})
}

// getContentType returns the content type for a file based on its extension.
func getContentType(filePath string) string {
	ext := path.Ext(filePath)
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	default:
		return "application/octet-stream"
	}
}