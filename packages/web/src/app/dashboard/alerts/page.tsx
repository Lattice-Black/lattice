'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Heading,
  Text,
  Input,
  Label,
  Alert,
  AlertTitle,
  AlertDescription,
  Badge,
} from '@duro/core';

type MetricType = 'error_rate' | 'response_time' | 'error_count' | 'uptime';
type Condition = 'gt' | 'lt' | 'eq';

interface AlertRule {
  id: string;
  name: string;
  service_id: string | null;
  environment: string | null;
  metric_type: MetricType;
  condition: Condition;
  threshold: number;
  window_minutes: number;
  notification_channels: string[];
  enabled: boolean;
}

interface AlertNotification {
  id: string;
  triggered_at: string;
  message: string;
}

interface RulesResponse {
  rules: AlertRule[];
}

interface NotificationsResponse {
  notifications: AlertNotification[];
  count: number;
}

const fetcher = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  return res.json() as Promise<unknown>;
};

export default function AlertsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    service_id: '',
    environment: '',
    metric_type: 'error_rate' as MetricType,
    condition: 'gt' as Condition,
    threshold: 0,
    window_minutes: 5,
    notification_channels: ['email'],
    enabled: true,
  });

  const rulesResult = useSWR<RulesResponse>(
    '/api/v1/alerts/rules',
    fetcher as (url: string) => Promise<RulesResponse>,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );
  const { data: rulesData, isLoading, mutate } = rulesResult;

  const { data: notificationsData } = useSWR<NotificationsResponse>(
    '/api/v1/alerts/notifications?acknowledged=false&limit=10',
    fetcher as (url: string) => Promise<NotificationsResponse>,
    {
      refreshInterval: 5000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/v1/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData({
          name: '',
          service_id: '',
          environment: '',
          metric_type: 'error_rate',
          condition: 'gt',
          threshold: 0,
          window_minutes: 5,
          notification_channels: ['email'],
          enabled: true,
        });
        void mutate();
      }
    } catch (err) {
      console.error('Failed to create alert rule:', err);
    }
  };

  const toggleRuleEnabled = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/v1/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      void mutate();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) {
      return;
    }

    try {
      await fetch(`/api/v1/alerts/rules/${ruleId}`, {
        method: 'DELETE',
      });
      void mutate();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <Heading level={1} className="text-4xl mb-2 tracking-tight">
              Alert Rules
            </Heading>
            <Text size="sm" className="text-gray-500">
              Configure alerts for errors, performance, and uptime
            </Text>
          </div>
          <Button
            variant={showCreateForm ? 'outline' : 'primary'}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : 'Create Alert Rule'}
          </Button>
        </div>
      </div>

      {/* Recent Notifications */}
      {notificationsData && notificationsData.notifications.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>Recent Alerts ({notificationsData.count})</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {notificationsData.notifications.slice(0, 3).map((notif) => (
                <Text key={notif.id} size="sm" className="font-mono">
                  {new Date(notif.triggered_at).toLocaleString()}: {notif.message}
                </Text>
              ))}
            </div>
            <Link
              href="/dashboard/alerts/notifications"
              className="text-sm text-yellow-400 hover:text-yellow-300 mt-3 inline-block"
            >
              View all notifications →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Alert Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="High error rate alert"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_id">Service ID (optional)</Label>
                  <Input
                    id="service_id"
                    type="text"
                    value={formData.service_id}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, service_id: e.target.value })
                    }
                    placeholder="Leave empty for all services"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <select
                    id="environment"
                    value={formData.environment}
                    onChange={(e) =>
                      setFormData({ ...formData, environment: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
                  >
                    <option value="">All Environments</option>
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metric_type">Metric Type</Label>
                  <select
                    id="metric_type"
                    value={formData.metric_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        metric_type: e.target.value as MetricType,
                      })
                    }
                    className="w-full px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
                  >
                    <option value="error_rate">Error Rate (%)</option>
                    <option value="error_count">Error Count</option>
                    <option value="response_time">Response Time (ms)</option>
                    <option value="uptime">Uptime (%)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <select
                    id="condition"
                    value={formData.condition}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        condition: e.target.value as Condition,
                      })
                    }
                    className="w-full px-3 py-2 bg-black border-2 border-gray-800 text-white focus:border-white focus:outline-none"
                  >
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                    <option value="eq">Equal to</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="threshold">Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    required
                    step="0.01"
                    value={formData.threshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({
                        ...formData,
                        threshold: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="window_minutes">Time Window (minutes)</Label>
                  <Input
                    id="window_minutes"
                    type="number"
                    required
                    min="1"
                    value={formData.window_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({
                        ...formData,
                        window_minutes: parseInt(e.target.value, 10),
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <Button type="submit" variant="primary">
                  Create Rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-16 h-16 border-2 border-gray-800 relative">
            <div className="absolute inset-2 border border-gray-700 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error */}
      {rulesResult.error && (
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load alert rules. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Rules List */}
      {rulesData && (
        <div className="space-y-4">
          {rulesData.rules.length === 0 && !showCreateForm && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
                  <div className="absolute inset-4 border border-gray-800" />
                </div>
                <Heading level={3} className="mb-2">
                  No Alert Rules
                </Heading>
                <Text size="sm" className="text-gray-500 font-mono">
                  Create one to get started
                </Text>
              </div>
            </div>
          )}

          {rulesData.rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="py-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Heading level={3}>{rule.name}</Heading>
                      <Badge variant={rule.enabled ? 'success' : 'secondary'}>
                        {rule.enabled ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </div>
                    <Text size="sm" className="text-gray-500 mb-3">
                      {rule.service_id || 'All services'}{' '}
                      {rule.environment && `(${rule.environment})`}
                    </Text>
                    <Text size="sm" className="font-mono">
                      Alert when{' '}
                      <span className="text-white">{rule.metric_type}</span> is{' '}
                      <span className="text-yellow-500">
                        {rule.condition === 'gt'
                          ? '>'
                          : rule.condition === 'lt'
                            ? '<'
                            : '='}
                      </span>{' '}
                      <span className="text-white">{rule.threshold}</span> over{' '}
                      <span className="text-white">
                        {rule.window_minutes} minutes
                      </span>
                    </Text>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={rule.enabled ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => void toggleRuleEnabled(rule.id, rule.enabled)}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void deleteRule(rule.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
