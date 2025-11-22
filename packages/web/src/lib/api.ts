import type {
  ServicesListResponse,
  ServiceDetailResponse,
  ServiceMetricsStat,
  ServiceConnection,
  MetricsStatsResponse,
  MetricsConnectionsResponse,
  RecentMetricsResponse
} from '@/types'
import { auth } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

/**
 * Get headers with API key authentication and distributed tracing
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await auth()

  if (!session?.user) {
    throw new Error('Authentication required. Please sign in.')
  }

  const apiKey = process.env.LATTICE_API_KEY
  if (!apiKey) {
    throw new Error('LATTICE_API_KEY environment variable is not set')
  }

  return {
    'Content-Type': 'application/json',
    'X-Lattice-API-Key': apiKey,
    'X-Origin-Service': 'lattice-web', // Distributed tracing header
  }
}

export async function fetchServices(params?: {
  status?: string
  environment?: string
  framework?: string
  limit?: number
  offset?: number
}): Promise<ServicesListResponse> {
  const searchParams = new URLSearchParams()

  if (params?.status) searchParams.set('status', params.status)
  if (params?.environment) searchParams.set('environment', params.environment)
  if (params?.framework) searchParams.set('framework', params.framework)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())

  const url = `${API_BASE_URL}/services${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  const headers = await getAuthHeaders()
  const response = await fetch(url, {
    headers,
    cache: 'no-store', // Always fetch fresh data for service discovery
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch services: ${response.statusText}`)
  }

  return response.json() as Promise<ServicesListResponse>
}

export async function fetchServiceById(id: string): Promise<ServiceDetailResponse> {
  const url = `${API_BASE_URL}/services/${id}`

  const headers = await getAuthHeaders()
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch service: ${response.statusText}`)
  }

  return response.json() as Promise<ServiceDetailResponse>
}

export async function fetchMetricsStats(serviceId?: string): Promise<ServiceMetricsStat[]> {
  const url = `${API_BASE_URL}/metrics/stats${serviceId ? `?serviceId=${serviceId}` : ''}`

  const headers = await getAuthHeaders()
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics stats: ${response.statusText}`)
  }

  const data = await response.json() as MetricsStatsResponse
  return data.stats || []
}

export async function fetchMetricsConnections(): Promise<ServiceConnection[]> {
  const url = `${API_BASE_URL}/metrics/connections`

  const headers = await getAuthHeaders()
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch metrics connections: ${response.statusText}`)
  }

  const data = await response.json() as MetricsConnectionsResponse
  return data.connections || []
}

export async function fetchRecentMetrics(serviceName: string, limit: number = 1000): Promise<RecentMetricsResponse> {
  const url = `${API_BASE_URL}/metrics/recent/${encodeURIComponent(serviceName)}?limit=${limit}`

  const headers = await getAuthHeaders()
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch recent metrics: ${response.statusText}`)
  }

  return response.json() as Promise<RecentMetricsResponse>
}
