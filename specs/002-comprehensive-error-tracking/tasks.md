# Tasks: Comprehensive Error Tracking and Performance Monitoring

**Input**: Design documents from `/specs/002-comprehensive-error-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are not explicitly requested in the specification, so test tasks are excluded. Focus is on implementation and integration.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `packages/{core,plugin-express,plugin-nextjs,api,web}/src/`
- Paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency installation

- [ ] T001 [P] Install error-stack-parser-es in packages/plugin-express and packages/plugin-nextjs
- [ ] T002 [P] Install chart.js@^4.4.0 and react-chartjs-2@^5.2.0 in packages/web
- [ ] T003 [P] Install swr@^2.2.4 in packages/web for polling
- [ ] T004 [P] Update tsconfig.json in packages/core to enable sourceMap and inlineSources
- [ ] T005 [P] Update tsconfig.json in packages/plugin-express to enable sourceMap and inlineSources
- [ ] T006 [P] Update tsconfig.json in packages/plugin-nextjs to enable sourceMap and inlineSources
- [ ] T007 Update package.json in packages/api to add --enable-source-maps to start script

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create database migration for pg_partman and pg_cron extensions in packages/api/migrations/
- [ ] T009 Create database migration for error_events partitioned table in packages/api/migrations/
- [ ] T010 Create database migration for performance_traces partitioned table in packages/api/migrations/
- [ ] T011 Create database migration for breadcrumbs partitioned table in packages/api/migrations/
- [ ] T012 Create database migration for sessions table in packages/api/migrations/
- [ ] T013 Create database migration for alert_rules table in packages/api/migrations/
- [ ] T014 Create database migration for alert_notifications table in packages/api/migrations/
- [ ] T015 Create database migration for service_health materialized view in packages/api/migrations/
- [ ] T016 Setup pg_partman configuration for error_events (daily partitions, 7 premake) in migration
- [ ] T017 Setup pg_partman configuration for performance_traces (daily partitions) in migration
- [ ] T018 Setup pg_partman configuration for breadcrumbs (daily partitions) in migration
- [ ] T019 Setup pg_cron jobs for partition maintenance in migration
- [ ] T020 Setup pg_cron job for service_health refresh (every 30 seconds) in migration
- [ ] T021 [P] Create ErrorType enum in packages/core/src/types/error.ts
- [ ] T022 [P] Create ErrorEvent interface in packages/core/src/types/error.ts
- [ ] T023 [P] Create StackFrame interface in packages/core/src/types/error.ts
- [ ] T024 [P] Create PerformanceTrace interface in packages/core/src/types/performance.ts
- [ ] T025 [P] Create OperationType enum in packages/core/src/types/performance.ts
- [ ] T026 [P] Create Breadcrumb interface in packages/core/src/types/breadcrumb.ts
- [ ] T027 [P] Create BreadcrumbCategory enum in packages/core/src/types/breadcrumb.ts
- [ ] T028 [P] Create BreadcrumbLevel enum in packages/core/src/types/breadcrumb.ts
- [ ] T029 [P] Create Session interface in packages/core/src/types/session.ts
- [ ] T030 [P] Create AlertRule interface in packages/core/src/types/alert.ts
- [ ] T031 [P] Create AlertNotification interface in packages/core/src/types/alert.ts
- [ ] T032 [P] Create HealthStatus enum ('healthy' | 'degraded' | 'critical') in packages/core/src/constants/index.ts
- [ ] T033 Update packages/core/src/index.ts to export all new types and enums
- [ ] T034 Build @lattice.black/core package (yarn workspace @lattice.black/core build)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Capture and View Application Errors (Priority: P1) 🎯 MVP

**Goal**: Capture unhandled errors from monitored services with full stack traces and display them in a searchable dashboard

**Independent Test**:
1. Trigger an error in a monitored Express app → verify error appears in POST /errors response
2. Trigger an error in Next.js app → verify error appears in dashboard at /dashboard/errors
3. View error details → verify full stack trace with line numbers is visible

### Implementation for User Story 1

#### Error Capture (Server-side)

- [ ] T035 [P] [US1] Create error-sanitizer utility in packages/api/src/lib/error-sanitizer.ts (scrub passwords, tokens, PII from error messages and stack traces)
- [ ] T036 [P] [US1] Create stack-trace-parser utility in packages/api/src/lib/stack-trace-parser.ts (use error-stack-parser-es to parse Error.stack)
- [ ] T037 [US1] Create error-capture middleware for Express in packages/plugin-express/src/middleware/error-capture.ts (captures unhandled errors, parses stack, sanitizes, sends to API)
- [ ] T038 [US1] Update LatticeExpress class in packages/plugin-express/src/index.ts to include errorHandler() method that returns error-capture middleware
- [ ] T039 [US1] Update packages/plugin-express README.md with error capture setup instructions

#### Error Capture (Client-side)

- [ ] T040 [P] [US1] Create global-error.tsx in packages/plugin-nextjs/src/error-boundary/global-error.tsx (App Router global error boundary)
- [ ] T041 [P] [US1] Create error.tsx in packages/plugin-nextjs/src/error-boundary/error.tsx (App Router page-level error boundary)
- [ ] T042 [P] [US1] Create browser-sdk.ts in packages/plugin-nextjs/src/client/browser-sdk.ts (window.onerror, unhandledrejection handlers)
- [ ] T043 [US1] Create captureError helper in packages/plugin-nextjs/src/client/browser-sdk.ts (parse stack, sanitize, send to API)
- [ ] T044 [US1] Create initLatticeMonitoring function in packages/plugin-nextjs/src/index.ts (setup error handlers)
- [ ] T045 [US1] Update packages/plugin-nextjs README.md with error capture setup instructions

#### Error Storage & API

- [ ] T046 [US1] Create error-service.ts in packages/api/src/services/error-service.ts (error aggregation by fingerprint, storage in error_events table)
- [ ] T047 [US1] Implement calculateErrorFingerprint function in error-service.ts (hash service_id, error_type, message, top stack frame)
- [ ] T048 [US1] Implement storeError function in error-service.ts (check fingerprint, update count or insert new)
- [ ] T049 [US1] Implement listErrors function in error-service.ts (query with filters: service_id, environment, error_type, resolved, search, time range)
- [ ] T050 [US1] Implement getErrorById function in error-service.ts (fetch single error with full details)
- [ ] T051 [US1] Implement updateErrorStatus function in error-service.ts (mark resolved/ignored)
- [ ] T052 [US1] Create POST /errors endpoint in packages/api/src/routes/errors.ts (error ingestion from plugins)
- [ ] T053 [US1] Create GET /errors endpoint in packages/api/src/routes/errors.ts (list with pagination, filtering, search)
- [ ] T054 [US1] Create GET /errors/:id endpoint in packages/api/src/routes/errors.ts (error detail)
- [ ] T055 [US1] Create PATCH /errors/:id endpoint in packages/api/src/routes/errors.ts (update status)
- [ ] T056 [US1] Create GET /errors/stats endpoint in packages/api/src/routes/errors.ts (time-series aggregation for charts)
- [ ] T057 [US1] Register errors routes in packages/api/src/index.ts

#### Error Dashboard UI

- [ ] T058 [P] [US1] Create ErrorList component in packages/web/src/components/ErrorList.tsx (table with columns: error_type, message, count, last_seen, service, environment)
- [ ] T059 [P] [US1] Create ErrorDetail component in packages/web/src/components/ErrorDetail.tsx (full error display with metadata)
- [ ] T060 [P] [US1] Create StackTrace component in packages/web/src/components/StackTrace.tsx (formatted stack trace with syntax highlighting)
- [ ] T061 [US1] Create /dashboard/errors page in packages/web/src/app/dashboard/errors/page.tsx (list view with filters, search, SWR polling every 5s)
- [ ] T062 [US1] Create /dashboard/errors/[id] page in packages/web/src/app/dashboard/errors/[id]/page.tsx (detail view)
- [ ] T063 [US1] Add "Errors" navigation link to dashboard layout in packages/web/src/app/dashboard/layout.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - errors captured from Express and Next.js apps, stored with aggregation, viewable in dashboard with full stack traces

---

## Phase 4: User Story 2 - Track Performance Bottlenecks (Priority: P2)

**Goal**: Capture timing data for operations and identify slow endpoints/queries in a performance dashboard

**Independent Test**:
1. Make API requests to monitored service → verify performance traces appear in POST /performance/traces response
2. View /dashboard/performance → verify average response times, slowest endpoints, and charts are displayed
3. Trigger a slow operation (>3s) → verify it's highlighted as slow in dashboard

### Implementation for User Story 2

#### Performance Capture

- [ ] T064 [US2] Update MetricsTracker in packages/plugin-express/src/middleware/metrics-tracker.ts to capture performance traces (operation name, type, duration, breakdown)
- [ ] T065 [US2] Add performance trace submission to MetricsTracker (POST to /performance/traces with batching)
- [ ] T066 [US2] Create addPerformanceTrace helper in packages/plugin-nextjs/src/client/browser-sdk.ts (capture fetch timing, page load timing)

#### Performance Storage & API

- [ ] T067 [US2] Create performance-service.ts in packages/api/src/services/performance-service.ts (store traces, calculate metrics)
- [ ] T068 [US2] Implement storePerformanceTrace function in performance-service.ts (insert into performance_traces table)
- [ ] T069 [US2] Implement getPerformanceMetrics function in performance-service.ts (aggregate avg, p50, p95, p99 response times)
- [ ] T070 [US2] Implement getSlowestOperations function in performance-service.ts (top N slowest by avg duration)
- [ ] T071 [US2] Create POST /performance/traces endpoint in packages/api/src/routes/performance.ts (trace ingestion)
- [ ] T072 [US2] Create GET /performance/traces endpoint in packages/api/src/routes/performance.ts (list with filters)
- [ ] T073 [US2] Create GET /performance/traces/:id endpoint in packages/api/src/routes/performance.ts (trace detail with breakdown)
- [ ] T074 [US2] Create GET /performance/metrics endpoint in packages/api/src/routes/performance.ts (aggregated metrics with time buckets)
- [ ] T075 [US2] Register performance routes in packages/api/src/index.ts

#### Performance Dashboard UI

- [ ] T076 [P] [US2] Create PerformanceChart component in packages/web/src/components/PerformanceChart.tsx (Chart.js line chart for response times over time)
- [ ] T077 [P] [US2] Create SlowestOperations component in packages/web/src/components/SlowestOperations.tsx (table of slowest endpoints)
- [ ] T078 [US2] Create /dashboard/performance page in packages/web/src/app/dashboard/performance/page.tsx (metrics, charts, slowest operations, SWR polling)
- [ ] T079 [US2] Add "Performance" navigation link to dashboard layout

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - errors tracked, performance monitored

---

## Phase 5: User Story 3 - Understand User Context When Errors Occur (Priority: P3)

**Goal**: Track user actions as breadcrumbs to provide context for debugging errors

**Independent Test**:
1. Perform sequence of actions in app (navigate, click button, API call) → trigger error
2. View error in dashboard → verify breadcrumb trail shows actions leading to error in chronological order
3. View session details → verify session duration and breadcrumb count

### Implementation for User Story 3

#### Breadcrumb & Session Capture

- [ ] T080 [P] [US3] Create addBreadcrumb helper in packages/plugin-nextjs/src/client/breadcrumbs.ts (record navigation, clicks, console, fetch events)
- [ ] T081 [P] [US3] Create session management in packages/plugin-nextjs/src/client/browser-sdk.ts (generate ULID session_id, store in sessionStorage)
- [ ] T082 [US3] Update browser-sdk initLatticeMonitoring to support autoBreadcrumbs config (navigation, clicks, console, fetch)
- [ ] T083 [US3] Add automatic breadcrumb tracking for navigation events (router changes)
- [ ] T084 [US3] Add automatic breadcrumb tracking for click events (buttons, links)
- [ ] T085 [US3] Add automatic breadcrumb tracking for console.log/warn/error
- [ ] T086 [US3] Add automatic breadcrumb tracking for fetch requests
- [ ] T087 [US3] Update captureError in browser-sdk to include session_id

#### Breadcrumb Storage & API

- [ ] T088 [US3] Create breadcrumb-service.ts in packages/api/src/services/breadcrumb-service.ts (store breadcrumbs, manage sessions)
- [ ] T089 [US3] Implement storeBreadcrumb function in breadcrumb-service.ts (insert, maintain max 100 per session)
- [ ] T090 [US3] Implement createSession function in breadcrumb-service.ts (create new session record)
- [ ] T091 [US3] Implement endSession function in breadcrumb-service.ts (mark session ended, calculate duration)
- [ ] T092 [US3] Implement getBreadcrumbsBySession function in breadcrumb-service.ts (fetch breadcrumbs for session, ordered by timestamp)
- [ ] T093 [US3] Create POST /breadcrumbs endpoint in packages/api/src/routes/breadcrumbs.ts (breadcrumb ingestion)
- [ ] T094 [US3] Create GET /breadcrumbs endpoint in packages/api/src/routes/breadcrumbs.ts (list by session_id)
- [ ] T095 [US3] Create POST /sessions endpoint in packages/api/src/routes/breadcrumbs.ts (create session)
- [ ] T096 [US3] Create POST /sessions/:id/end endpoint in packages/api/src/routes/breadcrumbs.ts (end session)
- [ ] T097 [US3] Register breadcrumb routes in packages/api/src/index.ts
- [ ] T098 [US3] Update getErrorById in error-service.ts to include related breadcrumbs (if session_id present)

#### Breadcrumb UI

- [ ] T099 [P] [US3] Create BreadcrumbTimeline component in packages/web/src/components/BreadcrumbTimeline.tsx (chronological list with icons by category)
- [ ] T100 [US3] Update ErrorDetail component to display BreadcrumbTimeline (if session_id present)
- [ ] T101 [US3] Add session info to ErrorDetail (session duration, breadcrumb count)

**Checkpoint**: All three user stories now work independently - errors with context, performance monitoring, breadcrumb trails

---

## Phase 6: User Story 4 - Monitor System Health in Real-Time (Priority: P4)

**Goal**: Provide real-time dashboard showing health status of all monitored services with error rates and performance metrics

**Independent Test**:
1. View /dashboard/health → verify all services shown with health status (healthy/degraded/critical)
2. Trigger high error rate (>10/min) → verify service health changes to critical
3. Wait 10 seconds → verify dashboard auto-updates with new metrics (SWR polling)

### Implementation for User Story 4

#### Health Monitoring API

- [ ] T102 [US4] Create GET /health/services endpoint in packages/api/src/routes/health.ts (query service_health materialized view, filter by environment/status)
- [ ] T103 [US4] Create GET /health/services/:id endpoint in packages/api/src/routes/health.ts (detailed metrics with trends)
- [ ] T104 [US4] Implement getServiceHealth function to query materialized view and format response
- [ ] T105 [US4] Implement getServiceHealthDetail function to include error_trends, performance_trends, top_errors
- [ ] T106 [US4] Register health routes in packages/api/src/index.ts

#### Health Dashboard UI

- [ ] T107 [P] [US4] Create HealthIndicator component in packages/web/src/components/HealthIndicator.tsx (visual status: green/yellow/red circles)
- [ ] T108 [P] [US4] Create ServiceHealthCard component in packages/web/src/components/ServiceHealthCard.tsx (service name, status, error rate, response time)
- [ ] T109 [P] [US4] Create HealthTrends component in packages/web/src/components/HealthTrends.tsx (Chart.js line charts for error rate and response time trends)
- [ ] T110 [US4] Create or update /dashboard/health page in packages/web/src/app/dashboard/health/page.tsx (grid of ServiceHealthCards, SWR polling every 5s)
- [ ] T111 [US4] Create /dashboard/health/[serviceId] page (detailed health view with trends)
- [ ] T112 [US4] Add "Health" navigation link to dashboard layout (may already exist from service discovery feature)

**Checkpoint**: All four user stories functional - errors, performance, breadcrumbs, real-time health monitoring

---

## Phase 7: User Story 5 - Receive Alerts for Critical Issues (Priority: P5)

**Goal**: Configure alert rules that send notifications when error rates or performance thresholds are breached

**Independent Test**:
1. Create alert rule for error rate > 10/min via dashboard
2. Trigger errors exceeding threshold → verify alert notification appears in /alerts/notifications
3. Verify alert grouping prevents duplicate notifications within evaluation window

### Implementation for User Story 5

#### Alert Evaluation & Notification

- [ ] T113 [US5] Create alert-service.ts in packages/api/src/services/alert-service.ts (evaluate rules, send notifications)
- [ ] T114 [US5] Implement evaluateAlertRules function in alert-service.ts (query active rules, check conditions against metrics)
- [ ] T115 [US5] Implement checkErrorRateCondition function (query error_events for rate calculation)
- [ ] T116 [US5] Implement checkErrorTypeCondition function (query error_events for specific types)
- [ ] T117 [US5] Implement checkPerformanceCondition function (query performance_traces for avg response time)
- [ ] T118 [US5] Implement sendNotification function (email, webhook support)
- [ ] T119 [US5] Implement alertGrouping logic (check for duplicate alerts within evaluation window)
- [ ] T120 [US5] Implement recoveryNotification logic (send when condition resolves)
- [ ] T121 [US5] Setup periodic alert evaluation job (every 1 minute via cron or background worker)

#### Alert Configuration API

- [ ] T122 [US5] Create GET /alerts/rules endpoint in packages/api/src/routes/alerts.ts (list alert rules with filters)
- [ ] T123 [US5] Create POST /alerts/rules endpoint in packages/api/src/routes/alerts.ts (create new alert rule)
- [ ] T124 [US5] Create GET /alerts/rules/:id endpoint in packages/api/src/routes/alerts.ts (get rule detail)
- [ ] T125 [US5] Create PATCH /alerts/rules/:id endpoint in packages/api/src/routes/alerts.ts (update rule, enable/disable)
- [ ] T126 [US5] Create DELETE /alerts/rules/:id endpoint in packages/api/src/routes/alerts.ts (delete rule)
- [ ] T127 [US5] Create GET /alerts/notifications endpoint in packages/api/src/routes/alerts.ts (list notification history)
- [ ] T128 [US5] Register alert routes in packages/api/src/index.ts

#### Alert Dashboard UI

- [ ] T129 [P] [US5] Create AlertRuleCard component in packages/web/src/components/AlertRuleCard.tsx (display rule, enable/disable toggle)
- [ ] T130 [P] [US5] Create AlertRuleForm component in packages/web/src/components/AlertRuleForm.tsx (create/edit alert rules)
- [ ] T131 [P] [US5] Create AlertNotificationList component in packages/web/src/components/AlertNotificationList.tsx (notification history table)
- [ ] T132 [US5] Create /dashboard/alerts page in packages/web/src/app/dashboard/alerts/page.tsx (list rules, create button)
- [ ] T133 [US5] Create /dashboard/alerts/new page (create new rule form)
- [ ] T134 [US5] Create /dashboard/alerts/[id]/edit page (edit rule form)
- [ ] T135 [US5] Add "Alerts" navigation link to dashboard layout

**Checkpoint**: All five user stories complete and independently functional - comprehensive error tracking, performance monitoring, user context, health monitoring, and alerting

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

- [ ] T136 [P] Create retention-service.ts in packages/api/src/services/retention-service.ts (update pg_partman retention based on subscription tier)
- [ ] T137 [P] Implement updateRetentionPolicies function (query organizations, set 7d/90d/365d based on tier)
- [ ] T138 [P] Setup periodic retention policy sync job (daily via cron)
- [ ] T139 [P] Add Redis caching layer to error query endpoints (3-5s TTL to handle SWR polling load)
- [ ] T140 [P] Add Redis caching layer to performance metrics endpoints
- [ ] T141 [P] Add Redis caching layer to health endpoints
- [ ] T142 [P] Create integration test for error capture → storage → retrieval flow in tests/integration/error-flow.test.ts
- [ ] T143 [P] Create integration test for performance trace → metrics → dashboard flow in tests/integration/performance-flow.test.ts
- [ ] T144 [P] Create integration test for breadcrumb → error → context flow in tests/integration/breadcrumb-flow.test.ts
- [ ] T145 [P] Create integration test for alert rule → trigger → notification flow in tests/integration/alert-flow.test.ts
- [ ] T146 Update packages/plugin-express/README.md with complete setup instructions matching quickstart.md
- [ ] T147 Update packages/plugin-nextjs/README.md with complete setup instructions matching quickstart.md
- [ ] T148 Add error tracking documentation to packages/web/src/app/docs/page.tsx
- [ ] T149 Performance optimization: Add database query indexes if missing from initial migrations
- [ ] T150 Security audit: Verify all sensitive data sanitization is working correctly
- [ ] T151 Run through quickstart.md validation: Setup Express app, Next.js app, trigger errors, verify dashboard

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories CAN proceed in parallel if team capacity allows
  - Or sequentially in priority order: US1 → US2 → US3 → US4 → US5
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories ✅ Fully independent
- **User Story 2 (P2)**: Can start after Foundational - No dependencies on other stories ✅ Fully independent
- **User Story 3 (P3)**: Can start after Foundational - Integrates with US1 (adds breadcrumbs to error details) but independently testable
- **User Story 4 (P4)**: Can start after Foundational - Reads from US1 and US2 data but independently testable
- **User Story 5 (P5)**: Can start after Foundational - Evaluates US1 and US2 metrics but independently testable

### Within Each User Story

- Setup tasks before implementation
- Core utilities before services
- Services before API endpoints
- API endpoints before UI components
- Parallel opportunities for different files marked with [P]

### Parallel Opportunities

#### Within Foundational Phase (Phase 2)
All database migrations can run sequentially, but type definitions (T021-T033) can all run in parallel.

#### Within User Story 1 (Phase 3)
```bash
# Launch all capture implementations in parallel:
Task: T035 [P] [US1] error-sanitizer.ts
Task: T036 [P] [US1] stack-trace-parser.ts
Task: T040 [P] [US1] global-error.tsx
Task: T041 [P] [US1] error.tsx
Task: T042 [P] [US1] browser-sdk.ts

# Launch all UI components in parallel:
Task: T058 [P] [US1] ErrorList.tsx
Task: T059 [P] [US1] ErrorDetail.tsx
Task: T060 [P] [US1] StackTrace.tsx
```

#### Across User Stories (if team capacity allows)
```bash
# After Foundational phase completes, all stories can start in parallel:
Developer A: Phase 3 (US1 - Error Capture)
Developer B: Phase 4 (US2 - Performance)
Developer C: Phase 5 (US3 - Breadcrumbs)
Developer D: Phase 6 (US4 - Health Monitoring)
Developer E: Phase 7 (US5 - Alerting)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Fastest path to value:**

1. Complete Phase 1: Setup (T001-T007) - ~1 hour
2. Complete Phase 2: Foundational (T008-T034) - ~4-6 hours
3. Complete Phase 3: User Story 1 (T035-T063) - ~12-16 hours
4. **STOP and VALIDATE**: Test error capture from Express and Next.js, view in dashboard
5. Deploy MVP if ready (basic error tracking is now live!)

**Total MVP Effort**: ~20-25 hours for fully functional error tracking

### Incremental Delivery

Each user story adds value without breaking previous stories:

1. **Week 1**: Setup + Foundational + US1 → Error tracking live ✅
2. **Week 2**: Add US2 → Performance monitoring added ✅
3. **Week 3**: Add US3 → User context breadcrumbs added ✅
4. **Week 4**: Add US4 → Real-time health dashboard added ✅
5. **Week 5**: Add US5 → Alerting system added ✅
6. **Week 6**: Polish & integration testing

### Parallel Team Strategy

With 3+ developers, maximize parallelism:

1. **Week 1**: Team completes Setup + Foundational together
2. **Week 2**:
   - Developer A: US1 (Error Capture)
   - Developer B: US2 (Performance)
   - Developer C: US3 (Breadcrumbs)
3. **Week 3**:
   - Developer A: US4 (Health Monitoring)
   - Developer B: US5 (Alerting)
   - Developer C: Integration testing
4. **Week 4**: Team does Polish together

---

## Task Summary

**Total Tasks**: 151 tasks

**Task Breakdown by Phase**:
- Phase 1 (Setup): 7 tasks
- Phase 2 (Foundational): 27 tasks (CRITICAL - blocks all user stories)
- Phase 3 (US1 - Error Capture): 29 tasks 🎯 MVP
- Phase 4 (US2 - Performance): 16 tasks
- Phase 5 (US3 - Breadcrumbs): 22 tasks
- Phase 6 (US4 - Health Monitoring): 11 tasks
- Phase 7 (US5 - Alerting): 23 tasks
- Phase 8 (Polish): 16 tasks

**Parallel Opportunities**: 45 tasks marked [P] can run in parallel

**Independent Test Criteria per Story**:
- US1: Error captured → stored → viewable with stack trace
- US2: Request made → timing captured → metrics displayed → slow operations highlighted
- US3: Actions performed → error occurs → breadcrumb trail visible in error details
- US4: Services monitored → health status calculated → dashboard updates in real-time
- US5: Alert rule created → condition breached → notification sent → recovery detected

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only)
- Captures errors from Express and Next.js
- Stores with aggregation and stack traces
- Displays in searchable dashboard
- Fully functional and deployable

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [Story] label (US1-US5) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Database migrations run sequentially (T008-T020) but types/interfaces can run in parallel
- Redis caching in Polish phase reduces load from SWR 5-second polling
- Tests not included as not explicitly requested in specification
- Source maps enabled in Setup phase ensure accurate stack traces with line numbers
