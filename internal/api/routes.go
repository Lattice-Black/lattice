package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// --- Public Routes ---

// StatusResponse represents the public status page data.
type StatusResponse struct {
	Settings  reducer.Settings         `json:"settings"`
	Monitors  []MonitorStatus          `json:"monitors"`
	Incidents []IncidentWithUpdates    `json:"incidents"`
}

// MonitorStatus represents a monitor with its latest check status.
type MonitorStatus struct {
	Monitor     reducer.Monitor `json:"monitor"`
	LatestCheck *reducer.Check  `json:"latestCheck,omitempty"`
}

// IncidentWithUpdates represents an incident with its timeline updates.
type IncidentWithUpdates struct {
	Incident reducer.Incident         `json:"incident"`
	Updates  []reducer.IncidentUpdate `json:"updates"`
}

func (s *Server) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	state := s.scheduler.GetState()

	// Build monitor statuses with latest checks
	var monitorStatuses []MonitorStatus
	for _, m := range state.Monitors {
		status := MonitorStatus{Monitor: m}
		if check, err := s.store.GetLatestCheck(m.ID); err == nil && check != nil {
			status.LatestCheck = check
		}
		monitorStatuses = append(monitorStatuses, status)
	}

	// Get active incidents (not resolved)
	var activeIncidents []IncidentWithUpdates
	for _, inc := range state.Incidents {
		if inc.Status != reducer.IncidentResolved {
			incWithUpdates := IncidentWithUpdates{
				Incident: inc,
				Updates:  state.IncidentUpdates[inc.ID],
			}
			activeIncidents = append(activeIncidents, incWithUpdates)
		}
	}

	resp := StatusResponse{
		Settings:  state.Settings,
		Monitors:  monitorStatuses,
		Incidents: activeIncidents,
	}

	JSON(w, http.StatusOK, resp)
}

// HistoryResponse represents the 90-day check history for a monitor.
type HistoryResponse struct {
	MonitorID string          `json:"monitorId"`
	Checks    []reducer.Check `json:"checks"`
}

func (s *Server) handleGetStatusHistory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify monitor exists
	monitor, err := s.store.GetMonitor(id)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if monitor == nil {
		NotFound(w)
		return
	}

	// Get checks from last 90 days
	since := time.Now().AddDate(0, 0, -90)
	checks, err := s.store.GetChecks(id, since)
	if err != nil {
		InternalError(w, "failed to get checks")
		return
	}

	resp := HistoryResponse{
		MonitorID: id,
		Checks:    checks,
	}

	JSON(w, http.StatusOK, resp)
}

// HealthResponse represents the health check response.
type HealthResponse struct {
	Status string `json:"status"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusOK, HealthResponse{Status: "ok"})
}

// --- Monitor Routes ---

func (s *Server) handleListMonitors(w http.ResponseWriter, r *http.Request) {
	monitors, err := s.store.ListMonitors()
	if err != nil {
		InternalError(w, "failed to list monitors")
		return
	}
	if monitors == nil {
		monitors = []reducer.Monitor{}
	}
	JSON(w, http.StatusOK, monitors)
}

// CreateMonitorRequest represents a request to create a monitor.
type CreateMonitorRequest struct {
	Name           string `json:"name"`
	URL            string `json:"url"`
	Type           string `json:"type"`
	Interval       string `json:"interval"`
	Timeout        string `json:"timeout"`
	ExpectedStatus int    `json:"expectedStatus"`
	Group          string `json:"group"`
}

func (s *Server) handleCreateMonitor(w http.ResponseWriter, r *http.Request) {
	var req CreateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	// Validate required fields
	if req.Name == "" {
		BadRequest(w, "name is required")
		return
	}
	if req.URL == "" {
		BadRequest(w, "url is required")
		return
	}
	if req.Type == "" {
		BadRequest(w, "type is required")
		return
	}

	// Parse durations with defaults
	interval := 60 * time.Second
	if req.Interval != "" {
		d, err := time.ParseDuration(req.Interval)
		if err != nil {
			BadRequest(w, "invalid interval")
			return
		}
		interval = d
	}

	timeout := 10 * time.Second
	if req.Timeout != "" {
		d, err := time.ParseDuration(req.Timeout)
		if err != nil {
			BadRequest(w, "invalid timeout")
			return
		}
		timeout = d
	}

	expectedStatus := req.ExpectedStatus
	if expectedStatus == 0 && (req.Type == "http" || req.Type == "https") {
		expectedStatus = 200
	}

	action := reducer.CreateMonitor{
		ID:             uuid.New().String(),
		Name:           req.Name,
		URL:            req.URL,
		Type:           reducer.MonitorType(req.Type),
		Interval:       interval,
		Timeout:        timeout,
		ExpectedStatus: expectedStatus,
		Group:          req.Group,
		Now:            time.Now(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get the created monitor
	monitor, err := s.store.GetMonitor(action.ID)
	if err != nil || monitor == nil {
		InternalError(w, "failed to retrieve created monitor")
		return
	}

	// Add to scheduler
	s.scheduler.AddMonitor(r.Context(), *monitor)

	JSON(w, http.StatusCreated, monitor)
}

func (s *Server) handleGetMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	monitor, err := s.store.GetMonitor(id)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if monitor == nil {
		NotFound(w)
		return
	}

	JSON(w, http.StatusOK, monitor)
}

// UpdateMonitorRequest represents a request to update a monitor.
type UpdateMonitorRequest struct {
	Name           *string `json:"name"`
	URL            *string `json:"url"`
	Interval       *string `json:"interval"`
	Timeout        *string `json:"timeout"`
	ExpectedStatus *int    `json:"expectedStatus"`
	Enabled        *bool   `json:"enabled"`
	Group          *string `json:"group"`
}

func (s *Server) handleUpdateMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify monitor exists
	existing, err := s.store.GetMonitor(id)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	var req UpdateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	action := reducer.UpdateMonitor{
		ID:             id,
		Name:           req.Name,
		URL:            req.URL,
		ExpectedStatus: req.ExpectedStatus,
		Enabled:        req.Enabled,
		Group:          req.Group,
		Now:            time.Now(),
	}

	// Parse durations if provided
	if req.Interval != nil {
		d, err := time.ParseDuration(*req.Interval)
		if err != nil {
			BadRequest(w, "invalid interval")
			return
		}
		action.Interval = &d
	}

	if req.Timeout != nil {
		d, err := time.ParseDuration(*req.Timeout)
		if err != nil {
			BadRequest(w, "invalid timeout")
			return
		}
		action.Timeout = &d
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get the updated monitor
	monitor, err := s.store.GetMonitor(id)
	if err != nil || monitor == nil {
		InternalError(w, "failed to retrieve updated monitor")
		return
	}

	// Update scheduler
	s.scheduler.UpdateMonitor(r.Context(), *monitor)

	JSON(w, http.StatusOK, monitor)
}

func (s *Server) handleDeleteMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify monitor exists
	existing, err := s.store.GetMonitor(id)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	action := reducer.DeleteMonitor{ID: id}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Remove from scheduler
	s.scheduler.RemoveMonitor(id)

	w.WriteHeader(http.StatusNoContent)
}

// --- Incident Routes ---

func (s *Server) handleListIncidents(w http.ResponseWriter, r *http.Request) {
	// Check for includeResolved query parameter
	includeResolved := r.URL.Query().Get("includeResolved") == "true"

	incidents, err := s.store.ListIncidents(includeResolved)
	if err != nil {
		InternalError(w, "failed to list incidents")
		return
	}
	if incidents == nil {
		incidents = []reducer.Incident{}
	}
	JSON(w, http.StatusOK, incidents)
}

// CreateIncidentRequest represents a request to create an incident.
type CreateIncidentRequest struct {
	MonitorID string `json:"monitorId"`
	Title     string `json:"title"`
	Severity  string `json:"severity"`
}

func (s *Server) handleCreateIncident(w http.ResponseWriter, r *http.Request) {
	var req CreateIncidentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.Title == "" {
		BadRequest(w, "title is required")
		return
	}
	if req.Severity == "" {
		BadRequest(w, "severity is required")
		return
	}

	// Validate monitor exists if provided
	if req.MonitorID != "" {
		monitor, err := s.store.GetMonitor(req.MonitorID)
		if err != nil {
			InternalError(w, "failed to get monitor")
			return
		}
		if monitor == nil {
			BadRequest(w, "monitor not found")
			return
		}
	}

	action := reducer.CreateIncident{
		ID:          uuid.New().String(),
		MonitorID:   req.MonitorID,
		Title:       req.Title,
		Severity:    reducer.Severity(req.Severity),
		AutoCreated: false,
		Now:         time.Now(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get the created incident
	incident, err := s.store.GetIncident(action.ID)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve created incident")
		return
	}

	JSON(w, http.StatusCreated, incident)
}

func (s *Server) handleGetIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	incident, err := s.store.GetIncident(id)
	if err != nil {
		InternalError(w, "failed to get incident")
		return
	}
	if incident == nil {
		NotFound(w)
		return
	}

	// Get updates
	updates, err := s.store.GetIncidentUpdates(id)
	if err != nil {
		InternalError(w, "failed to get incident updates")
		return
	}

	resp := IncidentWithUpdates{
		Incident: *incident,
		Updates:  updates,
	}

	JSON(w, http.StatusOK, resp)
}

// UpdateIncidentRequest represents a request to update an incident.
type UpdateIncidentRequest struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (s *Server) handleUpdateIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify incident exists
	existing, err := s.store.GetIncident(id)
	if err != nil {
		InternalError(w, "failed to get incident")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	var req UpdateIncidentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.Status == "" {
		BadRequest(w, "status is required")
		return
	}

	action := reducer.UpdateIncident{
		ID:      id,
		Status:  reducer.IncidentStatus(req.Status),
		Message: req.Message,
		Now:     time.Now(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get the updated incident
	incident, err := s.store.GetIncident(id)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve updated incident")
		return
	}

	JSON(w, http.StatusOK, incident)
}

// ResolveIncidentRequest represents a request to resolve an incident.
type ResolveIncidentRequest struct {
	Message string `json:"message"`
}

func (s *Server) handleResolveIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Verify incident exists
	existing, err := s.store.GetIncident(id)
	if err != nil {
		InternalError(w, "failed to get incident")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	var req ResolveIncidentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	action := reducer.ResolveIncident{
		ID:      id,
		Message: req.Message,
		Now:     time.Now(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get the resolved incident
	incident, err := s.store.GetIncident(id)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve resolved incident")
		return
	}

	JSON(w, http.StatusOK, incident)
}

// --- Notification Routes ---

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	channels, err := s.store.ListNotificationChannels()
	if err != nil {
		InternalError(w, "failed to list notifications")
		return
	}
	if channels == nil {
		channels = []reducer.NotificationChannel{}
	}
	JSON(w, http.StatusOK, channels)
}

// CreateNotificationRequest represents a request to create a notification channel.
type CreateNotificationRequest struct {
	Type   string            `json:"type"`
	Name   string            `json:"name"`
	Config map[string]string `json:"config"`
}

func (s *Server) handleCreateNotification(w http.ResponseWriter, r *http.Request) {
	var req CreateNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.Name == "" {
		BadRequest(w, "name is required")
		return
	}
	if req.Type == "" {
		BadRequest(w, "type is required")
		return
	}

	action := reducer.CreateNotificationChannel{
		ID:     uuid.New().String(),
		Type:   reducer.NotificationChannelType(req.Type),
		Name:   req.Name,
		Config: req.Config,
	}

	if action.Config == nil {
		action.Config = make(map[string]string)
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get from state since we don't have a GetNotificationChannel method
	state := s.scheduler.GetState()
	channel, exists := state.NotificationChannels[action.ID]
	if !exists {
		InternalError(w, "failed to retrieve created notification")
		return
	}

	JSON(w, http.StatusCreated, channel)
}

func (s *Server) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check if notification exists
	state := s.scheduler.GetState()
	if _, exists := state.NotificationChannels[id]; !exists {
		NotFound(w)
		return
	}

	action := reducer.DeleteNotificationChannel{ID: id}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Maintenance Routes ---

func (s *Server) handleListMaintenance(w http.ResponseWriter, r *http.Request) {
	windows, err := s.store.ListMaintenanceWindows()
	if err != nil {
		InternalError(w, "failed to list maintenance windows")
		return
	}
	if windows == nil {
		windows = []reducer.MaintenanceWindow{}
	}
	JSON(w, http.StatusOK, windows)
}

// CreateMaintenanceRequest represents a request to create a maintenance window.
type CreateMaintenanceRequest struct {
	MonitorID string    `json:"monitorId"`
	Title     string    `json:"title"`
	StartsAt  time.Time `json:"startsAt"`
	EndsAt    time.Time `json:"endsAt"`
}

func (s *Server) handleCreateMaintenance(w http.ResponseWriter, r *http.Request) {
	var req CreateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.MonitorID == "" {
		BadRequest(w, "monitorId is required")
		return
	}
	if req.Title == "" {
		BadRequest(w, "title is required")
		return
	}
	if req.StartsAt.IsZero() {
		BadRequest(w, "startsAt is required")
		return
	}
	if req.EndsAt.IsZero() {
		BadRequest(w, "endsAt is required")
		return
	}

	// Validate monitor exists
	monitor, err := s.store.GetMonitor(req.MonitorID)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if monitor == nil {
		BadRequest(w, "monitor not found")
		return
	}

	action := reducer.CreateMaintenanceWindow{
		ID:        uuid.New().String(),
		MonitorID: req.MonitorID,
		Title:     req.Title,
		StartsAt:  req.StartsAt,
		EndsAt:    req.EndsAt,
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	// Get from state
	state := s.scheduler.GetState()
	window, exists := state.MaintenanceWindows[action.ID]
	if !exists {
		InternalError(w, "failed to retrieve created maintenance window")
		return
	}

	JSON(w, http.StatusCreated, window)
}

func (s *Server) handleDeleteMaintenance(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Check if maintenance window exists
	state := s.scheduler.GetState()
	if _, exists := state.MaintenanceWindows[id]; !exists {
		NotFound(w)
		return
	}

	action := reducer.DeleteMaintenanceWindow{ID: id}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// --- Settings Routes ---

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.store.GetSettings()
	if err != nil {
		InternalError(w, "failed to get settings")
		return
	}
	JSON(w, http.StatusOK, settings)
}

// UpdateSettingsRequest represents a request to update settings.
type UpdateSettingsRequest struct {
	SiteName     *string `json:"siteName"`
	LogoURL      *string `json:"logoUrl"`
	AccentColor  *string `json:"accentColor"`
	CustomCSS    *string `json:"customCss"`
	CustomDomain *string `json:"customDomain"`
}

func (s *Server) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	action := reducer.UpdateSettings{
		SiteName:     req.SiteName,
		LogoURL:      req.LogoURL,
		AccentColor:  req.AccentColor,
		CustomCSS:    req.CustomCSS,
		CustomDomain: req.CustomDomain,
	}

	if err := s.scheduler.Dispatch(context.Background(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	settings, err := s.store.GetSettings()
	if err != nil {
		InternalError(w, "failed to get settings")
		return
	}

	JSON(w, http.StatusOK, settings)
}
