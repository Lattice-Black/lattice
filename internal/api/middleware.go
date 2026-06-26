package api

import (
	"log"
	"net/http"
	"strings"
	"time"
)

// APIKeyAuth returns middleware that validates the API key from X-API-Key header
// or Authorization: Bearer token.
// If apiKey is empty, all requests are rejected (admin routes are locked).
func APIKeyAuth(apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If no API key is configured, reject all requests
			if apiKey == "" {
				Unauthorized(w)
				return
			}

			// Check X-API-Key header first
			key := r.Header.Get("X-API-Key")

			// Fall back to Authorization: Bearer token
			if key == "" {
				auth := r.Header.Get("Authorization")
				if strings.HasPrefix(auth, "Bearer ") {
					key = strings.TrimPrefix(auth, "Bearer ")
				}
			}

			// Validate the key
			if key == "" || key != apiKey {
				Unauthorized(w)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// MaxBodySize limits the size of request bodies to prevent memory exhaustion.
const MaxBodySize = 1 << 20 // 1 MB

// LimitBody returns middleware that limits request body size.
func LimitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, MaxBodySize)
		next.ServeHTTP(w, r)
	})
}

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// RequestLogger returns middleware that logs HTTP requests.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		wrapped := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)

		latency := time.Since(start)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, wrapped.status, latency)
	})
}

// CORS returns middleware that handles CORS with configurable origins.
func CORS(origins []string) func(http.Handler) http.Handler {
	// Build a set of allowed origins for fast lookup
	allowedOrigins := make(map[string]bool)
	allowAll := false
	for _, o := range origins {
		if o == "*" {
			allowAll = true
			break
		}
		allowedOrigins[o] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Determine which origin to allow
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if origin != "" && allowedOrigins[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-API-Key")
			w.Header().Set("Access-Control-Max-Age", "86400")

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
