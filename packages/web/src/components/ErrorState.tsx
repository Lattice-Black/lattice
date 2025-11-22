import { Card, CardContent, Button, Alert, AlertTitle, AlertDescription } from '@duro/core'

interface ErrorStateProps {
  error: Error
  reset?: () => void
}

export function ErrorState({ error, reset }: ErrorStateProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <Alert variant="error" className="mb-6">
            <AlertTitle>Error Loading Data</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
          {reset && (
            <Button
              variant="outline"
              onClick={reset}
              className="w-full"
            >
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
