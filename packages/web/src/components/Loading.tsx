import { Card, CardContent, Skeleton, Grid } from '@duro/core'

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-2 border-gray-800 animate-ping" />
        <div className="absolute inset-2 border border-gray-700" />
      </div>
    </div>
  )
}

export function LoadingCard() {
  return (
    <Card>
      <CardContent className="p-6">
        <Skeleton className="h-6 mb-4 w-3/4" />
        <Skeleton className="h-4 mb-2 w-full" />
        <Skeleton className="h-4 mb-4 w-2/3" />
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-24 mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </CardContent>
    </Card>
  )
}

export function LoadingGrid() {
  return (
    <Grid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }, (_, i) => (
        <LoadingCard key={i} />
      ))}
    </Grid>
  )
}
