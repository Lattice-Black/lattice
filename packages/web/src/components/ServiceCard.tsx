import Link from 'next/link'
import { Card, CardContent, Badge, Heading, Text } from '@duro/core'
import { Service } from '@/types'
import { getRelativeTime } from '@/lib/utils'

interface ServiceCardProps {
  service: Service
  routeCount?: number
  dependencyCount?: number
}

export function ServiceCard({ service, routeCount = 0, dependencyCount = 0 }: ServiceCardProps) {
  const statusVariant = {
    active: 'primary' as const,
    inactive: 'secondary' as const,
    unknown: 'secondary' as const,
  }[service.status]

  return (
    <Link href={`/dashboard/services/${service.id}`}>
      <Card className="group hover:border-gray-600 transition-all duration-200">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <Heading level={3} className="text-lg mb-1 group-hover:text-gray-300 transition-colors">
                {service.name}
              </Heading>
              {service.version && (
                <Text size="xs" className="text-gray-500">
                  v{service.version}
                </Text>
              )}
            </div>
            <Badge variant={statusVariant} size="sm">
              {service.status}
            </Badge>
          </div>

          {/* Description */}
          {service.description && (
            <Text size="sm" className="text-gray-400 mb-4 line-clamp-2">
              {service.description}
            </Text>
          )}

          {/* Tech Stack */}
          <div className="space-y-2 mb-4">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" size="sm">
                {service.framework}
              </Badge>
              <Badge variant="secondary" size="sm">
                {service.language}
              </Badge>
              {service.environment && (
                <Badge variant="secondary" size="sm">
                  {service.environment}
                </Badge>
              )}
            </div>
          </div>

          {/* Wireframe Icon */}
          <div className="mb-4 flex items-center justify-center py-4">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-2 border-gray-700" />
              <div className="absolute inset-2 border border-gray-800" />
              <div className="absolute inset-4 border border-gray-800" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-700" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-800">
            <div>
              <Text size="xs" className="text-gray-500 uppercase tracking-wider mb-1">
                Routes
              </Text>
              <Text size="lg" weight="semibold">
                {routeCount}
              </Text>
            </div>
            <div>
              <Text size="xs" className="text-gray-500 uppercase tracking-wider mb-1">
                Dependencies
              </Text>
              <Text size="lg" weight="semibold">
                {dependencyCount}
              </Text>
            </div>
            <div>
              <Text size="xs" className="text-gray-500 uppercase tracking-wider mb-1">
                Last Seen
              </Text>
              <Text size="xs" className="text-gray-400">
                {getRelativeTime(service.lastSeen)}
              </Text>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
