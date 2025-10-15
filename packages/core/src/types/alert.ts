/**
 * Alert Configuration Types
 * @module @lattice.black/core/types/alert
 */

export enum AlertConditionType {
  ErrorRate = 'error_rate',
  ErrorTypeMatch = 'error_type_match',
  PerformanceThreshold = 'performance_threshold',
}

export enum NotificationChannelType {
  Email = 'email',
  Webhook = 'webhook',
}

export enum NotificationStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Grouped = 'grouped',
}

export interface ErrorRateThreshold {
  errors_per_minute: number;
  comparison: 'greater_than' | 'less_than' | 'equals';
}

export interface ErrorTypeMatchThreshold {
  error_types: string[];
}

export interface PerformanceThreshold {
  avg_response_time_ms: number;
  comparison: 'greater_than' | 'less_than' | 'equals';
}

export type AlertThreshold = ErrorRateThreshold | ErrorTypeMatchThreshold | PerformanceThreshold;

export interface EmailNotificationChannel {
  type: NotificationChannelType.Email;
  address: string;
}

export interface WebhookNotificationChannel {
  type: NotificationChannelType.Webhook;
  url: string;
}

export type NotificationChannel = EmailNotificationChannel | WebhookNotificationChannel;

export interface AlertRule {
  /** Unique alert rule identifier */
  id: string;
  /** Organization that owns this rule */
  organization_id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is active */
  enabled: boolean;
  /** Specific service (null = all services) */
  service_id?: string;
  /** Specific environment (null = all environments) */
  environment?: string;
  /** Type of condition */
  condition_type: AlertConditionType;
  /** Threshold configuration */
  threshold: AlertThreshold;
  /** Time window for evaluation (minutes) */
  evaluation_window_minutes: number;
  /** Notification channels */
  notification_channels: NotificationChannel[];
  /** When rule last triggered */
  last_triggered_at?: Date;
  /** Total times rule has triggered */
  trigger_count: number;
  /** When rule was created */
  created_at: Date;
  /** When rule was last updated */
  updated_at: Date;
}

export interface AlertRuleCreate {
  name: string;
  description?: string;
  service_id?: string;
  environment?: string;
  condition_type: AlertConditionType;
  threshold: AlertThreshold;
  evaluation_window_minutes?: number;
  notification_channels: NotificationChannel[];
}

export interface AlertNotification {
  /** Unique notification identifier */
  id: string;
  /** Alert rule that triggered */
  alert_rule_id: string;
  /** Service that triggered alert */
  service_id: string;
  /** Environment where alert triggered */
  environment: string;
  /** When alert was triggered */
  triggered_at: Date;
  /** When condition resolved (null if still active) */
  resolved_at?: Date;
  /** Notification status */
  notification_status: NotificationStatus;
  /** Channels notification was sent to */
  channels_notified: NotificationChannel[];
  /** Number of alerts grouped together */
  grouped_count: number;
  /** Snapshot of data that triggered alert */
  trigger_data: Record<string, any>;
  /** Error message if notification failed */
  error_message?: string;
}
