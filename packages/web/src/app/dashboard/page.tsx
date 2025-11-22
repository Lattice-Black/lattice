'use client';

import Link from 'next/link'
import { ServicesList } from '@/components/services-list'
import { Button, Heading, Text } from '@duro/core'

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <div className="flex items-start justify-between">
          <div>
            <Heading level={1} className="text-4xl mb-2 tracking-tight">
              Service Discovery
            </Heading>
            <Text size="sm" className="text-gray-500">
              Real-time monitoring of discovered services and their metadata
            </Text>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/metrics">
              <Button variant="outline" size="sm">
                Metrics
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

      {/* Stats Overview - Removed for now, will be added back with client-side rendering */}

      {/* Services Grid */}
      <ServicesList />
    </div>
  )
}
