'use client';

import { useState, useEffect } from 'react'
import { fetchMetricsStats, fetchMetricsConnections } from '@/lib/api'
import type { ServiceMetricsStat, ServiceConnection } from '@/types'
import Link from 'next/link'
import {
  Button,
  Card,
  CardContent,
  Heading,
  Text,
  Badge,
} from '@duro/core'

function SystemHealthSummary({ stats }: { stats: ServiceMetricsStat[] }) {
  if (!stats || stats.length === 0) {
    return null
  }

  // Calculate aggregate metrics
  const totalRequests = stats.reduce((sum, s) => sum + (s.total_requests || 0), 0)
  const avgResponseTime = Math.round(
    stats.reduce((sum, s) => sum + (s.avg_response_time_ms || 0), 0) / stats.length
  )
  const avgErrorRate = stats.reduce((sum, s) => sum + (Number(s.error_rate) || 0), 0) / stats.length
  const healthyServices = stats.filter(s => Number(s.error_rate) < 1 && Number(s.avg_response_time_ms) < 500).length

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
            Total Services
          </Text>
          <Text className="text-4xl font-bold text-white font-mono">
            {stats.length}
          </Text>
          <Text size="xs" className="text-gray-500 font-mono mt-2">
            {healthyServices} healthy
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
            Total Requests
          </Text>
          <Text className="text-4xl font-bold text-white font-mono">
            {totalRequests.toLocaleString()}
          </Text>
          <Text size="xs" className="text-gray-500 font-mono mt-2">
            last 1 hour
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
            Avg Response Time
          </Text>
          <Text className={`text-4xl font-bold font-mono ${avgResponseTime > 500 ? 'text-yellow-500' : 'text-white'}`}>
            {avgResponseTime}
            <span className="text-lg text-gray-500">ms</span>
          </Text>
          <Text size="xs" className="text-gray-500 font-mono mt-2">
            across all services
          </Text>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-2">
            Avg Error Rate
          </Text>
          <Text className={`text-4xl font-bold font-mono ${avgErrorRate > 5 ? 'text-red-500' : avgErrorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
            {avgErrorRate.toFixed(1)}%
          </Text>
          <Text size="xs" className="text-gray-500 font-mono mt-2">
            system-wide average
          </Text>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricsStatsGrid({ stats }: { stats: ServiceMetricsStat[] }) {
  if (!stats || stats.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
            <div className="absolute inset-4 border border-gray-800" />
          </div>
          <Heading level={3} className="mb-2">
            No Metrics Data
          </Heading>
          <Text size="sm" className="text-gray-500 font-mono">
            Make some requests to your services to see metrics
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {stats.map((stat: ServiceMetricsStat) => {
        const errorRate = Number(stat.error_rate || 0)
        const avgTime = Number(stat.avg_response_time_ms || 0)

        // Determine health status based on metrics
        const isHealthy = errorRate < 1 && avgTime < 500
        const isDegraded = errorRate >= 1 && errorRate < 5

        const healthVariant = isHealthy ? 'success' : isDegraded ? 'warning' : 'error'
        const healthStatus = isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'CRITICAL'

        return (
          <Link
            key={stat.id}
            href={`/dashboard/services/${stat.id}`}
          >
            <Card className="hover:border-gray-700 transition-all cursor-pointer group">
              <CardContent className="p-6">
                {/* Service Name & Health */}
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex-1">
                    <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-1">
                      Service
                    </Text>
                    <Text className="text-xl font-bold text-white truncate group-hover:text-gray-200">
                      {stat.name}
                    </Text>
                  </div>
                  <Badge variant={healthVariant}>
                    {healthStatus}
                  </Badge>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Total Requests */}
                  <div>
                    <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-1">
                      Requests
                    </Text>
                    <Text className="text-2xl font-bold text-white font-mono">
                      {(stat.total_requests || 0).toLocaleString()}
                    </Text>
                  </div>

                  {/* Avg Response Time */}
                  <div>
                    <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-1">
                      Avg Time
                    </Text>
                    <Text className={`text-2xl font-bold font-mono ${avgTime > 500 ? 'text-yellow-500' : avgTime > 1000 ? 'text-red-500' : 'text-white'}`}>
                      {avgTime.toLocaleString()}
                      <span className="text-sm text-gray-500 ml-1">ms</span>
                    </Text>
                  </div>

                  {/* Error Rate */}
                  <div>
                    <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-1">
                      Error Rate
                    </Text>
                    <Text className={`text-2xl font-bold font-mono ${errorRate > 5 ? 'text-red-500' : errorRate > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {errorRate.toFixed(1)}%
                    </Text>
                  </div>

                  {/* Last Request */}
                  <div>
                    <Text size="sm" className="text-gray-500 uppercase tracking-wider mb-1">
                      Last Request
                    </Text>
                    <Text size="xs" className="text-gray-400 font-mono">
                      {stat.last_request_time ? new Date(stat.last_request_time).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function ConnectionsTable({ connections }: { connections: ServiceConnection[] }) {
  if (!connections || connections.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
            <div className="absolute inset-4 border border-gray-800" />
          </div>
          <Heading level={3} className="mb-2">
            No Connections Detected
          </Heading>
          <Text size="sm" className="text-gray-500 font-mono">
            Services will appear here when they communicate with each other
          </Text>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 font-mono text-xs text-gray-500 uppercase tracking-wider">
                Source Service
              </th>
              <th className="text-left p-4 font-mono text-xs text-gray-500 uppercase tracking-wider">
                Target Service
              </th>
              <th className="text-right p-4 font-mono text-xs text-gray-500 uppercase tracking-wider">
                Call Count
              </th>
              <th className="text-right p-4 font-mono text-xs text-gray-500 uppercase tracking-wider">
                Avg Response Time
              </th>
            </tr>
          </thead>
          <tbody>
            {connections.map((conn: ServiceConnection, idx: number) => (
              <tr key={idx} className="border-b border-gray-800 last:border-b-0 hover:bg-gray-900/50 transition-colors">
                <td className="p-4 text-white font-mono text-sm">
                  {conn.source_service}
                </td>
                <td className="p-4 text-white font-mono text-sm">
                  {conn.target_service}
                </td>
                <td className="p-4 text-right text-white font-bold">
                  {conn.call_count}
                </td>
                <td className="p-4 text-right text-white">
                  {conn.avg_response_time}
                  <span className="text-sm text-gray-500 ml-1">ms</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {[1, 2, 3, 4].map(i => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="h-4 bg-gray-800 w-24 mb-2 animate-pulse" />
            <div className="h-10 bg-gray-800 w-16 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function MetricsPage() {
  const [stats, setStats] = useState<ServiceMetricsStat[]>([])
  const [connections, setConnections] = useState<ServiceConnection[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, connectionsData] = await Promise.all([
          fetchMetricsStats(),
          fetchMetricsConnections()
        ])
        setStats(statsData || [])
        setConnections(connectionsData || [])
      } catch (error) {
        console.error('Failed to fetch metrics:', error)
      } finally {
        setIsLoadingStats(false)
        setIsLoadingConnections(false)
      }
    }
    void loadData()
  }, [])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <Heading level={1} className="text-4xl mb-2 tracking-tight">
              Runtime Metrics
            </Heading>
            <Text size="sm" className="text-gray-500">
              Real-time performance statistics from your services
            </Text>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Services
              </Button>
            </Link>
            <Link href="/dashboard/graph">
              <Button variant="outline" size="sm">
                Network Graph
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* System Health Summary */}
      {isLoadingStats ? <LoadingPlaceholder /> : <SystemHealthSummary stats={stats} />}

      {/* Service Statistics */}
      <div className="space-y-4">
        <div>
          <Heading level={2} className="text-2xl mb-1">
            Service Statistics
          </Heading>
          <Text size="sm" className="text-gray-500">
            Last 1 hour of request data
          </Text>
        </div>
        {isLoadingStats ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-2 border-gray-800 relative">
              <div className="absolute inset-2 border border-gray-700 animate-pulse" />
            </div>
          </div>
        ) : (
          <MetricsStatsGrid stats={stats} />
        )}
      </div>

      {/* Inter-Service Connections */}
      <div className="space-y-4">
        <div>
          <Heading level={2} className="text-2xl mb-1">
            Inter-Service Communication
          </Heading>
          <Text size="sm" className="text-gray-500">
            Service-to-service call patterns
          </Text>
        </div>
        {isLoadingConnections ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-16 h-16 border-2 border-gray-800 relative">
              <div className="absolute inset-2 border border-gray-700 animate-pulse" />
            </div>
          </div>
        ) : (
          <ConnectionsTable connections={connections} />
        )}
      </div>
    </div>
  )
}
