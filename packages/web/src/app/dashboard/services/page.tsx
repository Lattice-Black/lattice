'use client';

import { ServicesList } from '@/components/services-list'
import { Heading, Text } from '@duro/core'

export default function ServicesPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-800 pb-8">
        <div>
          <Heading level={1} className="text-4xl mb-2 tracking-tight">
            Services
          </Heading>
          <Text size="sm" className="text-gray-500">
            All discovered services and their metadata
          </Text>
        </div>
      </div>

      {/* Services Grid */}
      <ServicesList />
    </div>
  )
}
