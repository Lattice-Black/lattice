'use client';

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fetchServices } from '@/lib/api'
import { NetworkGraph } from '@/components/NetworkGraph'
import {
  Button,
  Card,
  CardContent,
  Heading,
  Text,
  Alert,
  AlertTitle,
  AlertDescription,
} from '@duro/core'
import type { Service } from '@/types'

function GraphView() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadServices = async () => {
      try {
        const data = await fetchServices({ limit: 50 })
        setServices(data.services || [])
      } catch (err) {
        console.error('Failed to fetch services:', err)
        setError('Failed to load services')
      } finally {
        setIsLoading(false)
      }
    }
    void loadServices()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-16 h-16 border-2 border-gray-800 relative">
          <div className="absolute inset-2 border border-gray-700 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!services || services.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-24 h-24 border-2 border-gray-800 mb-6 mx-auto relative">
            <div className="absolute inset-4 border border-gray-800" />
          </div>
          <Heading level={2} className="text-xl mb-2">
            No Services to Display
          </Heading>
          <Text size="sm" className="text-gray-500">
            Start your services with Lattice plugin to see the network graph
          </Text>
        </div>
      </div>
    )
  }

  return <NetworkGraph services={services} />
}

export default function NetworkGraphPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <Heading level={1} className="text-3xl md:text-4xl mb-2 tracking-tight">
              Network Graph
            </Heading>
            <Text size="sm" className="text-gray-500">
              Visual representation of service connections and dependencies
            </Text>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Services
              </Button>
            </Link>
            <Link href="/dashboard/metrics">
              <Button variant="outline" size="sm">
                Metrics
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-6">
          <Text size="sm" className="font-semibold mb-4 uppercase tracking-wider text-gray-500">
            Legend
          </Text>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-2 border-gray-700 relative flex-shrink-0">
              <div className="absolute inset-2 border border-gray-800" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-700" />
            </div>
            <div>
              <Text size="sm" className="text-white font-mono">Active Service</Text>
              <Text size="xs" className="text-gray-500">Currently running</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-2 border-gray-800 relative flex-shrink-0">
              <div className="absolute inset-2 border border-gray-900" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900" />
            </div>
            <div>
              <Text size="sm" className="text-gray-500 font-mono">Inactive Service</Text>
              <Text size="xs" className="text-gray-600">Not responding</Text>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-px bg-gray-700" />
            </div>
            <div>
              <Text size="sm" className="text-white font-mono">Connection</Text>
              <Text size="xs" className="text-gray-500">Service relationship</Text>
            </div>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Graph */}
      <GraphView />
    </div>
  )
}
