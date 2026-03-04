import { useQuery } from '@tanstack/react-query'
import { statusApi, StatusResponse } from '../api/status'

export function useStatus() {
  return useQuery<StatusResponse>({
    queryKey: ['status'],
    queryFn: statusApi.get,
    refetchInterval: 30000,
    staleTime: 15000,
  })
}
