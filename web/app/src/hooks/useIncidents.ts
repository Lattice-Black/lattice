import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  incidentsApi,
  Incident,
  CreateIncidentInput,
  AddIncidentUpdateInput,
} from '../api/incidents'

export function useIncidents(status?: 'active' | 'resolved') {
  return useQuery<Incident[]>({
    queryKey: ['incidents', status],
    queryFn: () => incidentsApi.list(status),
    refetchInterval: 60000,
    staleTime: 30000,
  })
}

export function useIncident(id: string) {
  return useQuery<Incident>({
    queryKey: ['incidents', id],
    queryFn: () => incidentsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateIncidentInput) => incidentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}

export function useAddIncidentUpdate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AddIncidentUpdateInput }) =>
      incidentsApi.addUpdate(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      queryClient.invalidateQueries({ queryKey: ['incidents', id] })
    },
  })
}

export function useResolveIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      incidentsApi.resolve(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}

export function useDeleteIncident() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => incidentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}
