package monitor

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/google/uuid"
	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

// Checker performs health checks on monitors.
type Checker interface {
	Check(ctx context.Context, monitor reducer.Monitor) reducer.Check
}

// HTTPChecker performs HTTP/HTTPS health checks.
type HTTPChecker struct {
	client *http.Client
}

// NewHTTPChecker creates a new HTTP checker.
func NewHTTPChecker() *HTTPChecker {
	return &HTTPChecker{
		client: &http.Client{
			// Timeout is set per-request based on monitor config
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				// Don't follow redirects - let the original response determine status
				return http.ErrUseLastResponse
			},
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: false,
				},
				DisableKeepAlives: true,
			},
		},
	}
}

// Check performs an HTTP GET request and returns the check result.
func (c *HTTPChecker) Check(ctx context.Context, monitor reducer.Monitor) reducer.Check {
	check := reducer.Check{
		ID:        uuid.New().String(),
		MonitorID: monitor.ID,
		CheckedAt: time.Now().UTC(),
	}

	// Create request with timeout
	ctx, cancel := context.WithTimeout(ctx, monitor.Timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", monitor.URL, nil)
	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("failed to create request: %v", err)
		return check
	}

	// Add standard headers
	req.Header.Set("User-Agent", "Lattice-Monitor/1.0")

	// Perform the request
	start := time.Now()
	resp, err := c.client.Do(req)
	latency := time.Since(start)

	check.LatencyMs = latency.Milliseconds()

	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("request failed: %v", err)
		return check
	}
	defer resp.Body.Close()

	check.StatusCode = resp.StatusCode

	// Determine status based on expected status code
	expectedStatus := monitor.ExpectedStatus
	if expectedStatus == 0 {
		expectedStatus = 200
	}

	if resp.StatusCode == expectedStatus {
		check.Status = reducer.StatusUp
	} else if resp.StatusCode >= 500 {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("server error: %d", resp.StatusCode)
	} else if resp.StatusCode >= 400 {
		check.Status = reducer.StatusDegraded
		check.Error = fmt.Sprintf("client error: %d", resp.StatusCode)
	} else {
		check.Status = reducer.StatusDegraded
		check.Error = fmt.Sprintf("unexpected status: %d (expected %d)", resp.StatusCode, expectedStatus)
	}

	return check
}

// TCPChecker performs TCP connectivity checks.
type TCPChecker struct{}

// NewTCPChecker creates a new TCP checker.
func NewTCPChecker() *TCPChecker {
	return &TCPChecker{}
}

// Check performs a TCP dial and returns the check result.
func (c *TCPChecker) Check(ctx context.Context, monitor reducer.Monitor) reducer.Check {
	check := reducer.Check{
		ID:        uuid.New().String(),
		MonitorID: monitor.ID,
		CheckedAt: time.Now().UTC(),
	}

	// Parse the address from the URL
	// Expected format: tcp://host:port or just host:port
	addr := monitor.URL
	if len(addr) > 6 && addr[:6] == "tcp://" {
		addr = addr[6:]
	}

	// Perform TCP dial with timeout
	dialer := &net.Dialer{
		Timeout: monitor.Timeout,
	}

	start := time.Now()
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	latency := time.Since(start)

	check.LatencyMs = latency.Milliseconds()

	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("connection failed: %v", err)
		return check
	}
	defer conn.Close()

	check.Status = reducer.StatusUp
	return check
}

// DNSChecker performs DNS resolution checks.
type DNSChecker struct {
	resolver *net.Resolver
}

// NewDNSChecker creates a new DNS checker.
func NewDNSChecker() *DNSChecker {
	return &DNSChecker{
		resolver: net.DefaultResolver,
	}
}

// Check performs a DNS lookup and returns the check result.
func (c *DNSChecker) Check(ctx context.Context, monitor reducer.Monitor) reducer.Check {
	check := reducer.Check{
		ID:        uuid.New().String(),
		MonitorID: monitor.ID,
		CheckedAt: time.Now().UTC(),
	}

	// Parse the hostname from the URL
	// Expected format: dns://hostname or just hostname
	hostname := monitor.URL
	if len(hostname) > 6 && hostname[:6] == "dns://" {
		hostname = hostname[6:]
	}

	// Create timeout context
	ctx, cancel := context.WithTimeout(ctx, monitor.Timeout)
	defer cancel()

	// Perform DNS lookup
	start := time.Now()
	addrs, err := c.resolver.LookupHost(ctx, hostname)
	latency := time.Since(start)

	check.LatencyMs = latency.Milliseconds()

	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("DNS lookup failed: %v", err)
		return check
	}

	if len(addrs) == 0 {
		check.Status = reducer.StatusDown
		check.Error = "DNS lookup returned no addresses"
		return check
	}

	check.Status = reducer.StatusUp
	return check
}

// ICMPChecker performs ICMP ping checks.
// If raw sockets are unavailable (common in Docker/unprivileged environments),
// it falls back to a DNS resolution check so the monitor still reports
// reachability rather than always failing.
type ICMPChecker struct{}

// NewICMPChecker creates a new ICMP checker.
func NewICMPChecker() *ICMPChecker {
	return &ICMPChecker{}
}

// Check performs an ICMP echo request and returns the check result.
// If the system doesn't allow raw sockets, it falls back to DNS resolution
// to verify the host is at least resolvable.
func (c *ICMPChecker) Check(ctx context.Context, monitor reducer.Monitor) reducer.Check {
	check := reducer.Check{
		ID:        uuid.New().String(),
		MonitorID: monitor.ID,
		CheckedAt: time.Now().UTC(),
	}

	// Parse the hostname/IP from the URL
	// Expected format: icmp://host or just host/IP
	host := monitor.URL
	if len(host) > 7 && host[:7] == "icmp://" {
		host = host[7:]
	}

	// Create the ICMP message
	m := icmp.Message{
		Type: ipv4.ICMPTypeEcho,
		Code: 0,
		Body: &icmp.Echo{
			ID:   1,
			Seq:  1,
			Data: []byte("LATTICE-PING"),
		},
	}

	mb, err := m.Marshal(nil)
	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("failed to marshal ICMP message: %v", err)
		return check
	}

	// Resolve the address
	dst, err := net.ResolveIPAddr("ip4", host)
	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("failed to resolve address: %v", err)
		return check
	}

	// Open a raw ICMP connection
	conn, err := icmp.ListenPacket("ip4:icmp", "0.0.0.0")
	if err != nil {
		// Raw sockets are not available (common in Docker without --cap-add=NET_RAW).
		// Fall back to a DNS resolution check so the monitor reports degraded
		// rather than always down. The host is at least resolvable.
		check.Status = reducer.StatusDegraded
		check.Error = fmt.Sprintf("ICMP unavailable (requires root/cap_net_raw); host resolves to %s", dst.IP)
		return check
	}
	defer conn.Close()

	// Set deadline based on timeout
	deadline := time.Now().Add(monitor.Timeout)
	conn.SetDeadline(deadline)

	start := time.Now()
	_, err = conn.WriteTo(mb, dst)
	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("failed to send ICMP: %v", err)
		return check
	}

	rb := make([]byte, 1500)
	_, _, err = conn.ReadFrom(rb)
	latency := time.Since(start)

	check.LatencyMs = latency.Milliseconds()

	if err != nil {
		check.Status = reducer.StatusDown
		check.Error = fmt.Sprintf("failed to receive ICMP reply: %v", err)
		return check
	}

	check.Status = reducer.StatusUp
	return check
}

// NewChecker creates the appropriate checker for a monitor type.
func NewChecker(monitorType reducer.MonitorType) Checker {
	switch monitorType {
	case reducer.MonitorHTTP, reducer.MonitorHTTPS:
		return NewHTTPChecker()
	case reducer.MonitorTCP:
		return NewTCPChecker()
	case reducer.MonitorDNS:
		return NewDNSChecker()
	case reducer.MonitorICMP:
		return NewICMPChecker()
	default:
		// Return HTTP checker as fallback
		return NewHTTPChecker()
	}
}