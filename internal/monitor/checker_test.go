package monitor

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPChecker_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		Name:           "Test",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, "mon-1", check.MonitorID)
	assert.Equal(t, reducer.StatusUp, check.Status)
	assert.Equal(t, 200, check.StatusCode)
	assert.Empty(t, check.Error)
	assert.GreaterOrEqual(t, check.LatencyMs, int64(0))
	assert.NotEmpty(t, check.ID)
}

func TestHTTPChecker_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Equal(t, 500, check.StatusCode)
	assert.Contains(t, check.Error, "server error")
}

func TestHTTPChecker_ClientError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDegraded, check.Status)
	assert.Equal(t, 404, check.StatusCode)
	assert.Contains(t, check.Error, "client error")
}

func TestHTTPChecker_UnexpectedStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDegraded, check.Status)
	assert.Equal(t, 201, check.StatusCode)
	assert.Contains(t, check.Error, "unexpected status")
}

func TestHTTPChecker_CustomExpectedStatus(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 204,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
	assert.Equal(t, 204, check.StatusCode)
	assert.Empty(t, check.Error)
}

func TestHTTPChecker_ConnectionRefused(t *testing.T) {
	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            "http://127.0.0.1:59999", // Unlikely to be in use
		Type:           reducer.MonitorHTTP,
		Timeout:        1 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Contains(t, check.Error, "request failed")
}

func TestHTTPChecker_Timeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        100 * time.Millisecond,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Contains(t, check.Error, "request failed")
}

func TestHTTPChecker_InvalidURL(t *testing.T) {
	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            "://invalid-url",
		Type:           reducer.MonitorHTTP,
		Timeout:        1 * time.Second,
		ExpectedStatus: 200,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Contains(t, check.Error, "failed to create request")
}

func TestTCPChecker_Success(t *testing.T) {
	// Start a TCP listener
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()

	go func() {
		conn, _ := listener.Accept()
		if conn != nil {
			conn.Close()
		}
	}()

	checker := NewTCPChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     listener.Addr().String(),
		Type:    reducer.MonitorTCP,
		Timeout: 5 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
	assert.Empty(t, check.Error)
	assert.GreaterOrEqual(t, check.LatencyMs, int64(0))
}

func TestTCPChecker_WithProtocolPrefix(t *testing.T) {
	// Start a TCP listener
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer listener.Close()

	go func() {
		conn, _ := listener.Accept()
		if conn != nil {
			conn.Close()
		}
	}()

	checker := NewTCPChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     "tcp://" + listener.Addr().String(),
		Type:    reducer.MonitorTCP,
		Timeout: 5 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
}

func TestTCPChecker_ConnectionRefused(t *testing.T) {
	checker := NewTCPChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     "127.0.0.1:59998", // Unlikely to be in use
		Type:    reducer.MonitorTCP,
		Timeout: 1 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Contains(t, check.Error, "connection failed")
}

func TestDNSChecker_Success(t *testing.T) {
	checker := NewDNSChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     "localhost",
		Type:    reducer.MonitorDNS,
		Timeout: 5 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
	assert.Empty(t, check.Error)
}

func TestDNSChecker_WithProtocolPrefix(t *testing.T) {
	checker := NewDNSChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     "dns://localhost",
		Type:    reducer.MonitorDNS,
		Timeout: 5 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
}

func TestDNSChecker_NoSuchHost(t *testing.T) {
	checker := NewDNSChecker()
	monitor := reducer.Monitor{
		ID:      "mon-1",
		URL:     "this-domain-definitely-does-not-exist-abc123xyz.invalid",
		Type:    reducer.MonitorDNS,
		Timeout: 5 * time.Second,
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusDown, check.Status)
	assert.Contains(t, check.Error, "DNS lookup failed")
}

func TestNewChecker(t *testing.T) {
	tests := []struct {
		monitorType reducer.MonitorType
		expected    string
	}{
		{reducer.MonitorHTTP, "*monitor.HTTPChecker"},
		{reducer.MonitorHTTPS, "*monitor.HTTPChecker"},
		{reducer.MonitorTCP, "*monitor.TCPChecker"},
		{reducer.MonitorDNS, "*monitor.DNSChecker"},
		{reducer.MonitorICMP, "*monitor.HTTPChecker"}, // Fallback for unimplemented
	}

	for _, tt := range tests {
		t.Run(string(tt.monitorType), func(t *testing.T) {
			checker := NewChecker(tt.monitorType)
			assert.NotNil(t, checker)
		})
	}
}

func TestHTTPChecker_UserAgent(t *testing.T) {
	var receivedUA string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedUA = r.Header.Get("User-Agent")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 200,
	}

	checker.Check(context.Background(), monitor)

	assert.Equal(t, "Lattice-Monitor/1.0", receivedUA)
}

func TestHTTPChecker_NoFollowRedirects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/redirected", http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	checker := NewHTTPChecker()
	monitor := reducer.Monitor{
		ID:             "mon-1",
		URL:            server.URL,
		Type:           reducer.MonitorHTTP,
		Timeout:        5 * time.Second,
		ExpectedStatus: 302, // Expect the redirect, not the final page
	}

	check := checker.Check(context.Background(), monitor)

	assert.Equal(t, reducer.StatusUp, check.Status)
	assert.Equal(t, 302, check.StatusCode)
}
