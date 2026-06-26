import { useState } from 'react'

interface DayData {
  date: string
  status: 'up' | 'down' | 'degraded' | 'unknown'
  uptime_percent: number
}

interface UptimeBarsProps {
  history: DayData[]
  height?: number
}

const statusColors = {
  up: 'bg-status-up',
  down: 'bg-status-down',
  degraded: 'bg-status-degraded',
  unknown: 'bg-no-data',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function UptimeBars({ history, height = 32 }: UptimeBarsProps) {
  // Defensive guard: history may be null from the API when no checks exist yet
  const safeHistory = history ?? []
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const days: DayData[] = []
  const today = new Date()

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const dayData = safeHistory.find(h => h.date === dateStr)
    days.push(
      dayData || {
        date: dateStr,
        status: 'unknown',
        uptime_percent: 0,
      }
    )
  }

  const handleMouseEnter = (index: number, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoveredIndex(index)
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  return (
    <div className="relative">
      <div className="flex gap-px" style={{ height }}>
        {days.map((day, index) => (
          <div
            key={day.date}
            className={`flex-1 min-w-[3px] rounded-sm ${statusColors[day.status]} hover:opacity-80 transition-opacity cursor-pointer`}
            onMouseEnter={(e) => handleMouseEnter(index, e)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>

      {hoveredIndex !== null && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-surface border border-border rounded px-2 py-1 text-sm whitespace-nowrap shadow-lg">
            <div className="text-text-primary font-medium">
              {formatDate(days[hoveredIndex].date)}
            </div>
            <div className="text-text-secondary font-mono text-xs">
              {days[hoveredIndex].status === 'unknown'
                ? 'No data'
                : `${days[hoveredIndex].uptime_percent.toFixed(1)}% uptime`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
