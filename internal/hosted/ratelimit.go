package hosted

import (
	"net/http"
	"sync"
	"time"
)

// rateLimiter is a simple in-memory IP-based rate limiter.
// It tracks request timestamps per IP and rejects requests that exceed
// the configured limit within the window.
type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string][]time.Time
	limit    int
	window   time.Duration
}

// newRateLimiter creates a rate limiter that allows `limit` requests
// per `window` per IP address.
func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
	// Start cleanup goroutine to evict stale entries
	go rl.cleanup()
	return rl
}

// allow returns true if the IP is within the rate limit, false otherwise.
// It also prunes old entries for the given IP.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Filter out old timestamps
	var recent []time.Time
	for _, t := range rl.visitors[ip] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= rl.limit {
		rl.visitors[ip] = recent
		return false
	}

	recent = append(recent, now)
	rl.visitors[ip] = recent
	return true
}

// cleanup periodically removes stale entries to prevent unbounded memory growth.
func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-rl.window)
		for ip, timestamps := range rl.visitors {
			var recent []time.Time
			for _, t := range timestamps {
				if t.After(cutoff) {
					recent = append(recent, t)
				}
			}
			if len(recent) == 0 {
				delete(rl.visitors, ip)
			} else {
				rl.visitors[ip] = recent
			}
		}
		rl.mu.Unlock()
	}
}

// RateLimit middleware limits the number of requests per IP within a time window.
// Requests that exceed the limit receive a 429 Too Many Requests response.
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, window)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
				// Use the first IP in the X-Forwarded-For chain
				ip = forwarded
				if idx := indexOf(ip, ','); idx > 0 {
					ip = ip[:idx]
				}
			}

			if !rl.allow(ip) {
				w.Header().Set("Retry-After", "60")
				JSON(w, http.StatusTooManyRequests, map[string]string{
					"error": "rate limit exceeded, try again later",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// indexOf returns the index of the first occurrence of c in s, or -1 if not found.
func indexOf(s string, c byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			return i
		}
	}
	return -1
}

// IsLiveStripeKey returns true if the key is a live (non-test) Stripe secret key.
func IsLiveStripeKey(key string) bool {
	return len(key) >= 8 && key[:8] == "sk_live_"
}