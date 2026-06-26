package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Lattice-Black/lattice/internal/reducer"
	"github.com/Lattice-Black/lattice/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// =================================================================
// API Response/Request Types — these match the frontend's expectations.
// JSON uses snake_case. Durations are in seconds.
// =================================================================

// --- Monitor API Types ---

type MonitorResponse struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	URL            string `json:"url"`
	Type           string `json:"type"`
	Interval       int    `json:"interval"`       // seconds
	Timeout        int    `json:"timeout"`         // seconds
	ExpectedStatus int    `json:"expected_status,omitempty"`
	Group          string `json:"group,omitempty"`
	Enabled        bool   `json:"enabled"`
	Status         string `json:"status"`
	Latency        int64  `json:"latency,omitempty"`
	LastChecked    string `json:"last_checked,omitempty"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

func monitorToResponse(m reducer.Monitor, latestCheck *reducer.Check) MonitorResponse {
	resp := MonitorResponse{
		ID:             m.ID,
		Name:           m.Name,
		URL:            m.URL,
		Type:           string(m.Type),
		Interval:       int(m.Interval / time.Second),
		Timeout:        int(m.Timeout / time.Second),
		ExpectedStatus: m.ExpectedStatus,
		Group:          m.Group,
		Enabled:        m.Enabled,
		Status:         string(reducer.StatusUnknown),
		CreatedAt:      m.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      m.UpdatedAt.Format(time.RFC3339),
	}

	if latestCheck != nil {
		resp.Status = string(latestCheck.Status)
		resp.Latency = latestCheck.LatencyMs
		resp.LastChecked = latestCheck.CheckedAt.Format(time.RFC3339)
	}

	return resp
}

// --- Status API Types ---

type StatusMonitor struct {
	ID        string             `json:"id"`
	Name      string             `json:"name"`
	Group     string             `json:"group,omitempty"`
	Status    string             `json:"status"`
	Latency   int64              `json:"latency,omitempty"`
	Uptime90d float64            `json:"uptime_90d"`
	History   []store.DailyHistory `json:"history"`
}

type StatusResponse struct {
	SiteName          string           `json:"site_name"`
	LogoURL           string           `json:"logo_url,omitempty"`
	OverallStatus     string           `json:"overall_status"`
	Monitors          []StatusMonitor  `json:"monitors"`
	ActiveIncidents   []IncidentResp   `json:"active_incidents"`
	PastIncidents     []IncidentResp   `json:"past_incidents"`
	ActiveMaintenance []MaintenanceResp `json:"active_maintenance"`
}

// --- Incident API Types ---

type IncidentUpdateResp struct {
	ID        string `json:"id"`
	Status    string `json:"status"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}

type IncidentResp struct {
	ID          string                `json:"id"`
	Title       string                `json:"title"`
	MonitorID   string                `json:"monitor_id,omitempty"`
	MonitorName string                `json:"monitor_name,omitempty"`
	Severity    string                `json:"severity"`
	Status      string                `json:"status"`
	Updates     []IncidentUpdateResp  `json:"updates"`
	CreatedAt   string                `json:"created_at"`
	ResolvedAt  string                `json:"resolved_at,omitempty"`
}

func incidentToResp(inc reducer.Incident, updates []reducer.IncidentUpdate, monitorName string) IncidentResp {
	resp := IncidentResp{
		ID:          inc.ID,
		Title:       inc.Title,
		MonitorID:   inc.MonitorID,
		MonitorName: monitorName,
		Severity:    string(inc.Severity),
		Status:      string(inc.Status),
		Updates:     make([]IncidentUpdateResp, 0, len(updates)),
		CreatedAt:   inc.CreatedAt.Format(time.RFC3339),
	}
	if inc.ResolvedAt != nil {
		resp.ResolvedAt = inc.ResolvedAt.Format(time.RFC3339)
	}
	for _, u := range updates {
		resp.Updates = append(resp.Updates, IncidentUpdateResp{
			ID:        u.ID,
			Status:    string(u.Status),
			Message:   u.Message,
			CreatedAt: u.CreatedAt.Format(time.RFC3339),
		})
	}
	return resp
}

// --- Maintenance API Types ---

type MaintenanceResp struct {
	ID          string `json:"id"`
	MonitorID   string `json:"monitor_id"`
	MonitorName string `json:"monitor_name,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	CreatedAt   string `json:"created_at"`
}

func maintenanceToResp(mw reducer.MaintenanceWindow, monitorName string) MaintenanceResp {
	return MaintenanceResp{
		ID:          mw.ID,
		MonitorID:   mw.MonitorID,
		MonitorName: monitorName,
		Title:       mw.Title,
		Description: mw.Description,
		StartTime:   mw.StartsAt.Format(time.RFC3339),
		EndTime:     mw.EndsAt.Format(time.RFC3339),
		CreatedAt:   mw.CreatedAt.Format(time.RFC3339),
	}
}

// --- Notification API Types ---

type NotificationChannelResp struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Enabled   bool              `json:"enabled"`
	Config    map[string]string `json:"config"`
	CreatedAt string            `json:"created_at"`
	UpdatedAt string            `json:"updated_at"`
}

func notificationToResp(ch reducer.NotificationChannel) NotificationChannelResp {
	return NotificationChannelResp{
		ID:        ch.ID,
		Name:      ch.Name,
		Type:      string(ch.Type),
		Enabled:   ch.Enabled,
		Config:    ch.Config,
		CreatedAt: ch.CreatedAt.Format(time.RFC3339),
		UpdatedAt: ch.UpdatedAt.Format(time.RFC3339),
	}
}

// --- Settings API Types ---

type SettingsResp struct {
	SiteName     string `json:"site_name"`
	LogoURL      string `json:"logo_url,omitempty"`
	AccentColor  string `json:"accent_color"`
	CustomCSS    string `json:"custom_css,omitempty"`
	CustomDomain string `json:"custom_domain,omitempty"`
}

func settingsToResp(s reducer.Settings) SettingsResp {
	return SettingsResp{
		SiteName:     s.SiteName,
		LogoURL:      s.LogoURL,
		AccentColor:  s.AccentColor,
		CustomCSS:    s.CustomCSS,
		CustomDomain: s.CustomDomain,
	}
}

// =================================================================
// Public Routes
// =================================================================

func (s *Server) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	state := s.scheduler.GetState()

	// Build monitor statuses with latest checks and history
	var monitors []StatusMonitor
	overallStatus := "operational"

	for _, m := range state.Monitors {
		sm := StatusMonitor{
			ID:    m.ID,
			Name:  m.Name,
			Group: m.Group,
			Status: string(reducer.StatusUnknown),
		}

		// Get latest check
		if check, err := s.store.GetLatestCheck(m.ID); err == nil && check != nil {
			sm.Status = string(check.Status)
			sm.Latency = check.LatencyMs
		}

		// Get 90-day history
		history, err := s.store.GetDailyHistory(m.ID, 90)
		if err == nil {
			if history != nil {
				sm.History = history
			} else {
				sm.History = []store.DailyHistory{}
			}
			// Calculate uptime percentage
			if len(history) > 0 {
				totalUp := 0.0
				for _, h := range history {
					if h.Status == "up" {
						totalUp += 1
					} else if h.Status == "degraded" {
						totalUp += 0.5
					}
				}
				sm.Uptime90d = (totalUp / float64(len(history))) * 100
			} else {
				sm.Uptime90d = 100 // no history = assume 100%
			}
		} else {
			sm.History = []store.DailyHistory{}
			sm.Uptime90d = 100
		}

		// Track overall status
		switch sm.Status {
		case string(reducer.StatusDown):
			overallStatus = "major_outage"
		case string(reducer.StatusDegraded):
			if overallStatus != "major_outage" {
				overallStatus = "degraded"
			}
		}

		monitors = append(monitors, sm)
	}

	if monitors == nil {
		monitors = []StatusMonitor{}
	}

	// Get monitor names lookup
	monitorNames := make(map[string]string)
	for id, m := range state.Monitors {
		monitorNames[id] = m.Name
	}

	// Build incidents
	var activeIncidents, pastIncidents []IncidentResp
	for _, inc := range state.Incidents {
		updates := state.IncidentUpdates[inc.ID]
		monitorName := monitorNames[inc.MonitorID]
		resp := incidentToResp(inc, updates, monitorName)

		if inc.Status == reducer.IncidentResolved {
			pastIncidents = append(pastIncidents, resp)
		} else {
			activeIncidents = append(activeIncidents, resp)
		}
	}
	if activeIncidents == nil {
		activeIncidents = []IncidentResp{}
	}
	if pastIncidents == nil {
		pastIncidents = []IncidentResp{}
	}

	// Build active maintenance
	now := time.Now().UTC()
	var activeMaintenance []MaintenanceResp
	for _, mw := range state.MaintenanceWindows {
		if now.After(mw.StartsAt) && now.Before(mw.EndsAt) {
			activeMaintenance = append(activeMaintenance, maintenanceToResp(mw, monitorNames[mw.MonitorID]))
		}
	}
	if activeMaintenance == nil {
		activeMaintenance = []MaintenanceResp{}
	}

	resp := StatusResponse{
		SiteName:          state.Settings.SiteName,
		LogoURL:           state.Settings.LogoURL,
		OverallStatus:     overallStatus,
		Monitors:          monitors,
		ActiveIncidents:   activeIncidents,
		PastIncidents:     pastIncidents,
		ActiveMaintenance: activeMaintenance,
	}

	JSON(w, http.StatusOK, resp)
}

func (s *Server) handleGetStatusHistory(w http.ResponseWriter, r *http.Request) {
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

	history, err := s.store.GetDailyHistory(id, 90)
	if err != nil {
		InternalError(w, "failed to get history")
		return
	}
	if history == nil {
		history = []store.DailyHistory{}
	}

	JSON(w, http.StatusOK, history)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// =================================================================
// Monitor Routes
// =================================================================

func (s *Server) handleListMonitors(w http.ResponseWriter, r *http.Request) {
	monitors, err := s.store.ListMonitors()
	if err != nil {
		InternalError(w, "failed to list monitors")
		return
	}

	var result []MonitorResponse
	for _, m := range monitors {
		var latestCheck *reducer.Check
		if check, err := s.store.GetLatestCheck(m.ID); err == nil && check != nil {
			latestCheck = check
		}
		result = append(result, monitorToResponse(m, latestCheck))
	}
	if result == nil {
		result = []MonitorResponse{}
	}
	JSON(w, http.StatusOK, result)
}

type CreateMonitorRequest struct {
	Name           string `json:"name"`
	URL            string `json:"url"`
	Type           string `json:"type"`
	Interval       int    `json:"interval"`  // seconds
	Timeout        int    `json:"timeout"`   // seconds
	ExpectedStatus int    `json:"expected_status,omitempty"`
	Group          string `json:"group,omitempty"`
}

func (s *Server) handleCreateMonitor(w http.ResponseWriter, r *http.Request) {
	var req CreateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

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

	interval := time.Duration(req.Interval) * time.Second
	if interval == 0 {
		interval = 60 * time.Second
	}
	timeout := time.Duration(req.Timeout) * time.Second
	if timeout == 0 {
		timeout = 10 * time.Second
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
		Now:            time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	monitor, err := s.store.GetMonitor(action.ID)
	if err != nil || monitor == nil {
		InternalError(w, "failed to retrieve created monitor")
		return
	}

	s.scheduler.AddMonitor(r.Context(), *monitor)

	JSON(w, http.StatusCreated, monitorToResponse(*monitor, nil))
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

	var latestCheck *reducer.Check
	if check, err := s.store.GetLatestCheck(id); err == nil && check != nil {
		latestCheck = check
	}

	JSON(w, http.StatusOK, monitorToResponse(*monitor, latestCheck))
}

type UpdateMonitorRequest struct {
	Name           *string `json:"name"`
	URL            *string `json:"url"`
	Type           *string `json:"type"`
	Interval       *int    `json:"interval"`        // seconds
	Timeout        *int    `json:"timeout"`         // seconds
	ExpectedStatus *int    `json:"expected_status"`
	Enabled        *bool   `json:"enabled"`
	Group          *string `json:"group"`
}

func (s *Server) handleUpdateMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

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
		Now:            time.Now().UTC(),
	}

	if req.Type != nil {
		t := reducer.MonitorType(*req.Type)
		action.Type = &t
	}

	if req.Interval != nil {
		d := time.Duration(*req.Interval) * time.Second
		action.Interval = &d
	}

	if req.Timeout != nil {
		d := time.Duration(*req.Timeout) * time.Second
		action.Timeout = &d
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	monitor, err := s.store.GetMonitor(id)
	if err != nil || monitor == nil {
		InternalError(w, "failed to retrieve updated monitor")
		return
	}

	s.scheduler.UpdateMonitor(r.Context(), *monitor)

	var latestCheck *reducer.Check
	if check, err := s.store.GetLatestCheck(id); err == nil && check != nil {
		latestCheck = check
	}

	JSON(w, http.StatusOK, monitorToResponse(*monitor, latestCheck))
}

// handlePatchMonitor handles partial updates (mainly toggling enabled).
func (s *Server) handlePatchMonitor(w http.ResponseWriter, r *http.Request) {
	s.handleUpdateMonitor(w, r)
}

func (s *Server) handleDeleteMonitor(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	existing, err := s.store.GetMonitor(id)
	if err != nil {
		InternalError(w, "failed to get monitor")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	if err := s.scheduler.Dispatch(r.Context(), reducer.DeleteMonitor{ID: id}); err != nil {
		InternalError(w, err.Error())
		return
	}

	s.scheduler.RemoveMonitor(id)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMonitorHistory(w http.ResponseWriter, r *http.Request) {
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

	days := 90
	history, err := s.store.GetDailyHistory(id, days)
	if err != nil {
		InternalError(w, "failed to get history")
		return
	}
	if history == nil {
		history = []store.DailyHistory{}
	}

	JSON(w, http.StatusOK, history)
}

// =================================================================
// Incident Routes
// =================================================================

func (s *Server) handleListIncidents(w http.ResponseWriter, r *http.Request) {
	// Support ?status=active or ?status=resolved
	statusFilter := r.URL.Query().Get("status")

	var includeResolved bool
	switch statusFilter {
	case "active":
		includeResolved = false
	case "resolved":
		// Only resolved — we'll filter below
		includeResolved = true
	default:
		includeResolved = true // all
	}

	incidents, err := s.store.ListIncidents(includeResolved)
	if err != nil {
		InternalError(w, "failed to list incidents")
		return
	}

	// Get monitor names
	state := s.scheduler.GetState()
	monitorNames := make(map[string]string)
	for id, m := range state.Monitors {
		monitorNames[id] = m.Name
	}

	var result []IncidentResp
	for _, inc := range incidents {
		// If filtering for resolved only, skip non-resolved
		if statusFilter == "resolved" && inc.Status != reducer.IncidentResolved {
			continue
		}

		updates, err := s.store.GetIncidentUpdates(inc.ID)
		if err != nil {
			updates = []reducer.IncidentUpdate{}
		}
		result = append(result, incidentToResp(inc, updates, monitorNames[inc.MonitorID]))
	}
	if result == nil {
		result = []IncidentResp{}
	}

	JSON(w, http.StatusOK, result)
}

type CreateIncidentRequest struct {
	MonitorID string `json:"monitor_id,omitempty"`
	Title     string `json:"title"`
	Severity  string `json:"severity"`
	Message   string `json:"message"`
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
		Message:     req.Message,
		Now:         time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	incident, err := s.store.GetIncident(action.ID)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve created incident")
		return
	}

	updates, _ := s.store.GetIncidentUpdates(action.ID)

	state := s.scheduler.GetState()
	monitorName := ""
	if m, ok := state.Monitors[req.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusCreated, incidentToResp(*incident, updates, monitorName))
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

	updates, err := s.store.GetIncidentUpdates(id)
	if err != nil {
		updates = []reducer.IncidentUpdate{}
	}

	state := s.scheduler.GetState()
	monitorName := ""
	if m, ok := state.Monitors[incident.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusOK, incidentToResp(*incident, updates, monitorName))
}

type UpdateIncidentRequest struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (s *Server) handleUpdateIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

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
		Now:     time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	incident, err := s.store.GetIncident(id)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve updated incident")
		return
	}

	updates, _ := s.store.GetIncidentUpdates(id)

	state := s.scheduler.GetState()
	monitorName := ""
	if m, ok := state.Monitors[incident.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusOK, incidentToResp(*incident, updates, monitorName))
}

type AddIncidentUpdateRequest struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (s *Server) handleAddIncidentUpdate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	existing, err := s.store.GetIncident(id)
	if err != nil {
		InternalError(w, "failed to get incident")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	var req AddIncidentUpdateRequest
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
		Now:     time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	incident, err := s.store.GetIncident(id)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve incident")
		return
	}

	updates, _ := s.store.GetIncidentUpdates(id)

	state := s.scheduler.GetState()
	monitorName := ""
	if m, ok := state.Monitors[incident.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusOK, incidentToResp(*incident, updates, monitorName))
}

type ResolveIncidentRequest struct {
	Message string `json:"message"`
}

func (s *Server) handleResolveIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

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
		Now:     time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	incident, err := s.store.GetIncident(id)
	if err != nil || incident == nil {
		InternalError(w, "failed to retrieve resolved incident")
		return
	}

	updates, _ := s.store.GetIncidentUpdates(id)

	state := s.scheduler.GetState()
	monitorName := ""
	if m, ok := state.Monitors[incident.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusOK, incidentToResp(*incident, updates, monitorName))
}

func (s *Server) handleDeleteIncident(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	existing, err := s.store.GetIncident(id)
	if err != nil {
		InternalError(w, "failed to get incident")
		return
	}
	if existing == nil {
		NotFound(w)
		return
	}

	if err := s.scheduler.Dispatch(r.Context(), reducer.DeleteIncident{ID: id}); err != nil {
		InternalError(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =================================================================
// Notification Routes
// =================================================================

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	channels, err := s.store.ListNotificationChannels()
	if err != nil {
		InternalError(w, "failed to list notifications")
		return
	}

	var result []NotificationChannelResp
	for _, ch := range channels {
		result = append(result, notificationToResp(ch))
	}
	if result == nil {
		result = []NotificationChannelResp{}
	}
	JSON(w, http.StatusOK, result)
}

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

	now := time.Now().UTC()
	action := reducer.CreateNotificationChannel{
		ID:     uuid.New().String(),
		Type:   reducer.NotificationChannelType(req.Type),
		Name:   req.Name,
		Config: req.Config,
		Now:    now,
	}

	if action.Config == nil {
		action.Config = make(map[string]string)
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	state := s.scheduler.GetState()
	channel, exists := state.NotificationChannels[action.ID]
	if !exists {
		InternalError(w, "failed to retrieve created notification")
		return
	}

	JSON(w, http.StatusCreated, notificationToResp(channel))
}

func (s *Server) handleGetNotification(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	channel, err := s.store.GetNotificationChannel(id)
	if err != nil {
		InternalError(w, "failed to get notification channel")
		return
	}
	if channel == nil {
		NotFound(w)
		return
	}

	JSON(w, http.StatusOK, notificationToResp(*channel))
}

type UpdateNotificationRequest struct {
	Name    *string           `json:"name"`
	Config  map[string]string `json:"config"`
	Enabled *bool             `json:"enabled"`
}

func (s *Server) handleUpdateNotification(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	state := s.scheduler.GetState()
	if _, exists := state.NotificationChannels[id]; !exists {
		NotFound(w)
		return
	}

	var req UpdateNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	action := reducer.UpdateNotificationChannel{
		ID:      id,
		Name:    req.Name,
		Config:  req.Config,
		Enabled: req.Enabled,
		Now:     time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	state = s.scheduler.GetState()
	channel, exists := state.NotificationChannels[id]
	if !exists {
		InternalError(w, "failed to retrieve updated notification")
		return
	}

	JSON(w, http.StatusOK, notificationToResp(channel))
}

func (s *Server) handleDeleteNotification(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	state := s.scheduler.GetState()
	if _, exists := state.NotificationChannels[id]; !exists {
		NotFound(w)
		return
	}

	if err := s.scheduler.Dispatch(r.Context(), reducer.DeleteNotificationChannel{ID: id}); err != nil {
		InternalError(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleTestNotification(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	state := s.scheduler.GetState()
	_, exists := state.NotificationChannels[id]
	if !exists {
		NotFound(w)
		return
	}

	// Build a test notification and send it through the registry
	// by dispatching a fake SendNotification effect.
	sn := reducer.SendNotification{
		ChannelID: id,
		Title:     "Lattice Test Notification",
		Message:   "This is a test notification from Lattice. If you received this, your notification channel is configured correctly.",
		Severity:  reducer.SeverityMinor,
	}

	// Use the scheduler's effect handler if available
	if s.scheduler.HasEffectHandler() {
		if err := s.scheduler.HandleEffect(r.Context(), sn); err != nil {
			JSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": err.Error()})
			return
		}
	} else {
		// No effect handler registered (e.g. running without notification dispatchers)
		JSON(w, http.StatusOK, map[string]interface{}{"success": false, "error": "no notification dispatcher configured"})
		return
	}

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}

// =================================================================
// Maintenance Routes
// =================================================================

func (s *Server) handleListMaintenance(w http.ResponseWriter, r *http.Request) {
	windows, err := s.store.ListMaintenanceWindows()
	if err != nil {
		InternalError(w, "failed to list maintenance windows")
		return
	}

	state := s.scheduler.GetState()
	monitorNames := make(map[string]string)
	for id, m := range state.Monitors {
		monitorNames[id] = m.Name
	}

	var result []MaintenanceResp
	for _, mw := range windows {
		result = append(result, maintenanceToResp(mw, monitorNames[mw.MonitorID]))
	}
	if result == nil {
		result = []MaintenanceResp{}
	}
	JSON(w, http.StatusOK, result)
}

type CreateMaintenanceRequest struct {
	MonitorID   string `json:"monitor_id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
}

func (s *Server) handleCreateMaintenance(w http.ResponseWriter, r *http.Request) {
	var req CreateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		BadRequest(w, "invalid JSON")
		return
	}

	if req.MonitorID == "" {
		BadRequest(w, "monitor_id is required")
		return
	}
	if req.Title == "" {
		BadRequest(w, "title is required")
		return
	}

	startsAt, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		BadRequest(w, "invalid start_time format")
		return
	}
	endsAt, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		BadRequest(w, "invalid end_time format")
		return
	}

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
		ID:          uuid.New().String(),
		MonitorID:   req.MonitorID,
		Title:       req.Title,
		Description: req.Description,
		StartsAt:    startsAt,
		EndsAt:      endsAt,
		Now:         time.Now().UTC(),
	}

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	state := s.scheduler.GetState()
	mw, exists := state.MaintenanceWindows[action.ID]
	if !exists {
		InternalError(w, "failed to retrieve created maintenance window")
		return
	}

	JSON(w, http.StatusCreated, maintenanceToResp(mw, monitor.Name))
}

func (s *Server) handleGetMaintenance(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	state := s.scheduler.GetState()
	mw, exists := state.MaintenanceWindows[id]
	if !exists {
		NotFound(w)
		return
	}

	monitorName := ""
	if m, ok := state.Monitors[mw.MonitorID]; ok {
		monitorName = m.Name
	}

	JSON(w, http.StatusOK, maintenanceToResp(mw, monitorName))
}

func (s *Server) handleUpdateMaintenance(w http.ResponseWriter, r *http.Request) {
	// Maintenance windows are immutable once created in the current model.
	// Delete and recreate if changes are needed.
	Error(w, http.StatusMethodNotAllowed, "maintenance windows are immutable; delete and recreate")
}

func (s *Server) handleDeleteMaintenance(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	state := s.scheduler.GetState()
	if _, exists := state.MaintenanceWindows[id]; !exists {
		NotFound(w)
		return
	}

	if err := s.scheduler.Dispatch(r.Context(), reducer.DeleteMaintenanceWindow{ID: id}); err != nil {
		InternalError(w, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// =================================================================
// Settings Routes
// =================================================================

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := s.store.GetSettings()
	if err != nil {
		InternalError(w, "failed to get settings")
		return
	}
	JSON(w, http.StatusOK, settingsToResp(*settings))
}

type UpdateSettingsRequest struct {
	SiteName     *string `json:"site_name"`
	LogoURL      *string `json:"logo_url"`
	AccentColor  *string `json:"accent_color"`
	CustomCSS    *string `json:"custom_css"`
	CustomDomain *string `json:"custom_domain"`
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

	if err := s.scheduler.Dispatch(r.Context(), action); err != nil {
		InternalError(w, err.Error())
		return
	}

	settings, err := s.store.GetSettings()
	if err != nil {
		InternalError(w, "failed to get settings")
		return
	}

	JSON(w, http.StatusOK, settingsToResp(*settings))
}