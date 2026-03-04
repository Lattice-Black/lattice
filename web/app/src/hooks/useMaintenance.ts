import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  maintenanceApi,
  MaintenanceWindow,
  CreateMaintenanceInput,
  UpdateMaintenanceInput,
} from '../api/maintenance'

export function useMaintenance(status?: 'upcoming' | 'active' | 'past') {
  return useQuery<MaintenanceWindow[]>({
    queryKey: ['maintenance', status],
    queryFn: () => maintenanceApi.list(status),
  })
}

export function useMaintenanceWindow(id: string) {
  return useQuery<MaintenanceWindow>({
    queryKey: ['maintenance', id],
    queryFn: () => maintenanceApi.get(id),
    enabled: !!id,
  })
}

export function useCreateMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMaintenanceInput) => maintenanceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    },
  })
}

export function useUpdateMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMaintenanceInput }) =>
      maintenanceApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance', id] })
    },
  })
}

export function useDeleteMaintenance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
    },
  })
}
