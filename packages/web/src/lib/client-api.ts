import type {
  ServicesListResponse,
  ServiceDetailResponse,
  ServiceMetricsStat,
  ServiceConnection,
  MetricsStatsResponse,
  MetricsConnectionsResponse
} from '@/types'
import { getSession } from 'next-auth/react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

/**
 * Get headers with authentication token and distributed tracing (client-side)
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession()

  if (!session?.user) {
    throw new Error('Authentication required. Please sign in.')
  }

  return {
    'Content-Type': 'application/json',
    'X-User-Id': session.user.id,
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
