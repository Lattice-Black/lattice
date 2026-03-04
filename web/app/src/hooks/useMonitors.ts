import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  monitorsApi,
  Monitor,
  CreateMonitorInput,
  UpdateMonitorInput,
  MonitorHistory,
} from '../api/monitors'

export function useMonitors() {
  return useQuery<Monitor[]>({
    queryKey: ['monitors'],
    queryFn: monitorsApi.list,
    refetchInterval: 60000,
    staleTime: 30000,
  })
}

export function useMonitor(id: string) {
  return useQuery<Monitor>({
    queryKey: ['monitors', id],
    queryFn: () => monitorsApi.get(id),
    enabled: !!id,
  })
}

export function useMonitorHistory(id: string, days: number = 90) {
  return useQuery<MonitorHistory[]>({
    queryKey: ['monitors', id, 'history', days],
    queryFn: () => monitorsApi.history(id, days),
    enabled: !!id,
  })
}

export function useCreateMonitor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMonitorInput) => monitorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
}

export function useUpdateMonitor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMonitorInput }) =>
      monitorsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] })
      queryClient.invalidateQueries({ queryKey: ['monitors', id] })
    },
  })
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => monitorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
}

export function useToggleMonitor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      monitorsApi.toggle(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitors'] })
    },
  })
}
