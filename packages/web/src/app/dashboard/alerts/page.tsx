'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type MetricType = 'error_rate' | 'response_time' | 'error_count' | 'uptime';
type Condition = 'gt' | 'lt' | 'eq';

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

  const { data: rulesData, error, isLoading, mutate } = useSWR(
    '/api/v1/alerts/rules',
    fetcher,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    }
  );

  const { data: notificationsData } = useSWR(
    '/api/v1/alerts/notifications?acknowledged=false&limit=10',
    fetcher,
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
        mutate();
      }
    } catch (error) {
      console.error('Failed to create alert rule:', error);
    }
  };

  const toggleRuleEnabled = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/v1/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      mutate();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
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
      mutate();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-gray-600 mt-2">
            Configure alerts for errors, performance, and uptime
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Create Alert Rule'}
        </button>
      </div>

      {/* Recent Notifications */}
      {notificationsData && notificationsData.notifications.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-900 mb-3">
            Recent Alerts ({notificationsData.count})
          </h2>
          <div className="space-y-2">
            {notificationsData.notifications.slice(0, 3).map((notif: any) => (
              <div key={notif.id} className="text-sm text-yellow-800">
                {new Date(notif.triggered_at).toLocaleString()}: {notif.message}
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/alerts/notifications"
            className="text-sm text-yellow-700 hover:text-yellow-900 mt-2 inline-block"
          >
            View all notifications →
          </Link>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Create Alert Rule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="High error rate alert"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service ID (optional)
              </label>
              <input
                type="text"
                value={formData.service_id}
                onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Leave empty for all services"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Environment (optional)
              </label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Environments</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metric Type
              </label>
              <select
                value={formData.metric_type}
                onChange={(e) => setFormData({ ...formData, metric_type: e.target.value as MetricType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="error_rate">Error Rate (%)</option>
                <option value="error_count">Error Count</option>
                <option value="response_time">Response Time (ms)</option>
                <option value="uptime">Uptime (%)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition
              </label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as Condition })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gt">Greater than</option>
                <option value="lt">Less than</option>
                <option value="eq">Equal to</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Threshold
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Window (minutes)
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.window_minutes}
                onChange={(e) => setFormData({ ...formData, window_minutes: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Rule
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load alert rules. Please try again.
        </div>
      )}

      {/* Rules List */}
      {rulesData && (
        <div className="space-y-4">
          {rulesData.rules.length === 0 && !showCreateForm && (
            <div className="text-center py-12 text-gray-500">
              No alert rules configured. Create one to get started.
            </div>
          )}

          {rulesData.rules.map((rule: any) => (
            <div key={rule.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {rule.service_id || 'All services'} {rule.environment && `(${rule.environment})`}
                  </p>
                  <p className="text-sm text-gray-700 mt-2">
                    Alert when <span className="font-mono">{rule.metric_type}</span> is{' '}
                    <span className="font-semibold">
                      {rule.condition === 'gt' ? '>' : rule.condition === 'lt' ? '<' : '='}
                    </span>{' '}
                    <span className="font-mono">{rule.threshold}</span> over{' '}
                    <span className="font-mono">{rule.window_minutes} minutes</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRuleEnabled(rule.id, rule.enabled)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      rule.enabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
