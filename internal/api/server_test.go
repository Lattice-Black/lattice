package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Lattice-Black/lattice/internal/config"
	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/Lattice-Black/lattice/internal/scheduler"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testAPIKey = "test-api-key-12345"

func setupTestServer(t *testing.T) (*Server, func()) {
	t.Helper()

	// Create temporary database
	tmpFile, err := os.CreateTemp("", "lattice-test-*.db")
	require.NoError(t, err)
	tmpFile.Close()

	st, err := store.New(tmpFile.Name())
	require.NoError(t, err)

	state, err := st.LoadState()
	require.NoError(t, err)

	cfg := &config.Config{
		Server: config.ServerConfig{
			Port:        8080,
			Host:        "0.0.0.0",
			APIKey:      testAPIKey,
			CORSOrigins: []string{"*"},
		},
		Database: config.DatabaseConfig{
			Path:          tmpFile.Name(),
			RetentionDays: 90,
		},
	}

	sched := scheduler.New(st, state, nil)
	server := NewServer(st, sched, cfg)

	cleanup := func() {
		st.Close()
		os.Remove(tmpFile.Name())
	}

	return server, cleanup
}

func TestHealth(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp HealthResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "ok", resp.Status)
}

func TestPublicStatusNoAuth(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Public status should work without auth
	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp StatusResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, "Lattice Status", resp.Settings.SiteName)
}

func TestAdminRoutesRequireAuth(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/monitors"},
		{http.MethodPost, "/api/monitors"},
		{http.MethodGet, "/api/incidents"},
		{http.MethodPost, "/api/incidents"},
		{http.MethodGet, "/api/notifications"},
		{http.MethodPost, "/api/notifications"},
		{http.MethodGet, "/api/maintenance"},
		{http.MethodPost, "/api/maintenance"},
		{http.MethodGet, "/api/settings"},
		{http.MethodPut, "/api/settings"},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, nil)
			w := httptest.NewRecorder()

			server.Handler().ServeHTTP(w, req)

			assert.Equal(t, http.StatusUnauthorized, w.Code)
		})
	}
}

func TestAdminRoutesWithAPIKey(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Test with X-API-Key header
	req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAdminRoutesWithBearerToken(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Test with Authorization: Bearer header
	req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMonitorCRUD(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Create monitor
	createReq := CreateMonitorRequest{
		Name:     "Test Monitor",
		URL:      "https://example.com",
		Type:     "https",
		Interval: "30s",
		Timeout:  "5s",
		Group:    "test",
	}
	body, _ := json.Marshal(createReq)

	req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created reducer.Monitor
	err := json.Unmarshal(w.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.Equal(t, "Test Monitor", created.Name)
	assert.Equal(t, "https://example.com", created.URL)
	assert.Equal(t, reducer.MonitorHTTPS, created.Type)
	assert.Equal(t, 30*time.Second, created.Interval)
	assert.Equal(t, 5*time.Second, created.Timeout)
	assert.Equal(t, "test", created.Group)
	assert.True(t, created.Enabled)

	monitorID := created.ID

	// Get monitor
	req = httptest.NewRequest(http.MethodGet, "/api/monitors/"+monitorID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var fetched reducer.Monitor
	err = json.Unmarshal(w.Body.Bytes(), &fetched)
	require.NoError(t, err)
	assert.Equal(t, monitorID, fetched.ID)

	// List monitors
	req = httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var monitors []reducer.Monitor
	err = json.Unmarshal(w.Body.Bytes(), &monitors)
	require.NoError(t, err)
	assert.Len(t, monitors, 1)

	// Update monitor
	enabled := false
	updateReq := UpdateMonitorRequest{
		Enabled: &enabled,
	}
	body, _ = json.Marshal(updateReq)

	req = httptest.NewRequest(http.MethodPut, "/api/monitors/"+monitorID, bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var updated reducer.Monitor
	err = json.Unmarshal(w.Body.Bytes(), &updated)
	require.NoError(t, err)
	assert.False(t, updated.Enabled)

	// Delete monitor
	req = httptest.NewRequest(http.MethodDelete, "/api/monitors/"+monitorID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)

	// Verify deleted
	req = httptest.NewRequest(http.MethodGet, "/api/monitors/"+monitorID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestIncidentCRUD(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// First create a monitor (incidents require a monitor due to FK constraint)
	monitorReq := CreateMonitorRequest{
		Name: "Test Monitor",
		URL:  "https://example.com",
		Type: "https",
	}
	body, _ := json.Marshal(monitorReq)

	req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code)

	var monitor reducer.Monitor
	err := json.Unmarshal(w.Body.Bytes(), &monitor)
	require.NoError(t, err)

	// Create incident
	createReq := CreateIncidentRequest{
		MonitorID: monitor.ID,
		Title:     "Test Incident",
		Severity:  "major",
	}
	body, _ = json.Marshal(createReq)

	req = httptest.NewRequest(http.MethodPost, "/api/incidents", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created reducer.Incident
	err = json.Unmarshal(w.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.Equal(t, "Test Incident", created.Title)
	assert.Equal(t, reducer.SeverityMajor, created.Severity)
	assert.Equal(t, reducer.IncidentInvestigating, created.Status)

	incidentID := created.ID

	// Get incident
	req = httptest.NewRequest(http.MethodGet, "/api/incidents/"+incidentID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var incWithUpdates IncidentWithUpdates
	err = json.Unmarshal(w.Body.Bytes(), &incWithUpdates)
	require.NoError(t, err)
	assert.Equal(t, incidentID, incWithUpdates.Incident.ID)

	// Update incident
	updateReq := UpdateIncidentRequest{
		Status:  "identified",
		Message: "We identified the issue",
	}
	body, _ = json.Marshal(updateReq)

	req = httptest.NewRequest(http.MethodPut, "/api/incidents/"+incidentID, bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var updated reducer.Incident
	err = json.Unmarshal(w.Body.Bytes(), &updated)
	require.NoError(t, err)
	assert.Equal(t, reducer.IncidentIdentified, updated.Status)

	// Resolve incident
	resolveReq := ResolveIncidentRequest{
		Message: "Issue resolved",
	}
	body, _ = json.Marshal(resolveReq)

	req = httptest.NewRequest(http.MethodPost, "/api/incidents/"+incidentID+"/resolve", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resolved reducer.Incident
	err = json.Unmarshal(w.Body.Bytes(), &resolved)
	require.NoError(t, err)
	assert.Equal(t, reducer.IncidentResolved, resolved.Status)
	assert.NotNil(t, resolved.ResolvedAt)

	// List incidents (should be empty without includeResolved)
	req = httptest.NewRequest(http.MethodGet, "/api/incidents", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var incidents []reducer.Incident
	err = json.Unmarshal(w.Body.Bytes(), &incidents)
	require.NoError(t, err)
	assert.Len(t, incidents, 0)

	// List incidents with includeResolved
	req = httptest.NewRequest(http.MethodGet, "/api/incidents?includeResolved=true", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &incidents)
	require.NoError(t, err)
	assert.Len(t, incidents, 1)
}

func TestNotificationCRUD(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Create notification
	createReq := CreateNotificationRequest{
		Type: "slack",
		Name: "Test Slack",
		Config: map[string]string{
			"webhook_url": "https://hooks.slack.com/test",
		},
	}
	body, _ := json.Marshal(createReq)

	req := httptest.NewRequest(http.MethodPost, "/api/notifications", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created reducer.NotificationChannel
	err := json.Unmarshal(w.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.Equal(t, "Test Slack", created.Name)
	assert.Equal(t, reducer.NotifySlack, created.Type)

	channelID := created.ID

	// List notifications
	req = httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var channels []reducer.NotificationChannel
	err = json.Unmarshal(w.Body.Bytes(), &channels)
	require.NoError(t, err)
	assert.Len(t, channels, 1)

	// Delete notification
	req = httptest.NewRequest(http.MethodDelete, "/api/notifications/"+channelID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)

	// Verify deleted
	req = httptest.NewRequest(http.MethodDelete, "/api/notifications/"+channelID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestMaintenanceCRUD(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// First create a monitor
	monitorReq := CreateMonitorRequest{
		Name: "Test Monitor",
		URL:  "https://example.com",
		Type: "https",
	}
	body, _ := json.Marshal(monitorReq)

	req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var monitor reducer.Monitor
	err := json.Unmarshal(w.Body.Bytes(), &monitor)
	require.NoError(t, err)

	// Create maintenance window
	startsAt := time.Now().Add(time.Hour)
	endsAt := startsAt.Add(2 * time.Hour)
	createReq := CreateMaintenanceRequest{
		MonitorID: monitor.ID,
		Title:     "Scheduled Maintenance",
		StartsAt:  startsAt,
		EndsAt:    endsAt,
	}
	body, _ = json.Marshal(createReq)

	req = httptest.NewRequest(http.MethodPost, "/api/maintenance", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created reducer.MaintenanceWindow
	err = json.Unmarshal(w.Body.Bytes(), &created)
	require.NoError(t, err)
	assert.Equal(t, "Scheduled Maintenance", created.Title)
	assert.Equal(t, monitor.ID, created.MonitorID)

	windowID := created.ID

	// List maintenance windows
	req = httptest.NewRequest(http.MethodGet, "/api/maintenance", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var windows []reducer.MaintenanceWindow
	err = json.Unmarshal(w.Body.Bytes(), &windows)
	require.NoError(t, err)
	assert.Len(t, windows, 1)

	// Delete maintenance window
	req = httptest.NewRequest(http.MethodDelete, "/api/maintenance/"+windowID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)

	// Verify deleted
	req = httptest.NewRequest(http.MethodDelete, "/api/maintenance/"+windowID, nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSettings(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Get settings
	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var settings reducer.Settings
	err := json.Unmarshal(w.Body.Bytes(), &settings)
	require.NoError(t, err)
	assert.Equal(t, "Lattice Status", settings.SiteName)
	assert.Equal(t, "#4d9f5d", settings.AccentColor)

	// Update settings
	newSiteName := "My Status Page"
	newAccentColor := "#ff0000"
	updateReq := UpdateSettingsRequest{
		SiteName:    &newSiteName,
		AccentColor: &newAccentColor,
	}
	body, _ := json.Marshal(updateReq)

	req = httptest.NewRequest(http.MethodPut, "/api/settings", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	err = json.Unmarshal(w.Body.Bytes(), &settings)
	require.NoError(t, err)
	assert.Equal(t, "My Status Page", settings.SiteName)
	assert.Equal(t, "#ff0000", settings.AccentColor)
}

func TestStatusHistory(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Create a monitor first
	monitorReq := CreateMonitorRequest{
		Name: "Test Monitor",
		URL:  "https://example.com",
		Type: "https",
	}
	body, _ := json.Marshal(monitorReq)

	req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(body))
	req.Header.Set("X-API-Key", testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var monitor reducer.Monitor
	err := json.Unmarshal(w.Body.Bytes(), &monitor)
	require.NoError(t, err)

	// Get history (public, no auth required)
	req = httptest.NewRequest(http.MethodGet, "/status/history/"+monitor.ID, nil)
	w = httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var historyResp HistoryResponse
	err = json.Unmarshal(w.Body.Bytes(), &historyResp)
	require.NoError(t, err)
	assert.Equal(t, monitor.ID, historyResp.MonitorID)
	assert.Empty(t, historyResp.Checks) // No checks yet
}

func TestStatusHistoryNotFound(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	req := httptest.NewRequest(http.MethodGet, "/status/history/nonexistent-id", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestCreateMonitorValidation(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	testCases := []struct {
		name    string
		request CreateMonitorRequest
		errMsg  string
	}{
		{
			name:    "missing name",
			request: CreateMonitorRequest{URL: "https://example.com", Type: "https"},
			errMsg:  "name is required",
		},
		{
			name:    "missing url",
			request: CreateMonitorRequest{Name: "Test", Type: "https"},
			errMsg:  "url is required",
		},
		{
			name:    "missing type",
			request: CreateMonitorRequest{Name: "Test", URL: "https://example.com"},
			errMsg:  "type is required",
		},
		{
			name:    "invalid interval",
			request: CreateMonitorRequest{Name: "Test", URL: "https://example.com", Type: "https", Interval: "invalid"},
			errMsg:  "invalid interval",
		},
		{
			name:    "invalid timeout",
			request: CreateMonitorRequest{Name: "Test", URL: "https://example.com", Type: "https", Timeout: "invalid"},
			errMsg:  "invalid timeout",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.request)

			req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(body))
			req.Header.Set("X-API-Key", testAPIKey)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.Handler().ServeHTTP(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)

			var errResp ErrorResponse
			err := json.Unmarshal(w.Body.Bytes(), &errResp)
			require.NoError(t, err)
			assert.Equal(t, tc.errMsg, errResp.Error)
		})
	}
}

func TestCORS(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// Test preflight request
	req := httptest.NewRequest(http.MethodOptions, "/api/monitors", nil)
	req.Header.Set("Origin", "https://example.com")
	req.Header.Set("Access-Control-Request-Method", "POST")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
	assert.Contains(t, w.Header().Get("Access-Control-Allow-Methods"), "POST")
}
