import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  notificationsApi,
  NotificationChannel,
  CreateNotificationInput,
  UpdateNotificationInput,
} from '../api/notifications'

export function useNotifications() {
  return useQuery<NotificationChannel[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
  })
}

export function useNotification(id: string) {
  return useQuery<NotificationChannel>({
    queryKey: ['notifications', id],
    queryFn: () => notificationsApi.get(id),
    enabled: !!id,
  })
}

export function useCreateNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateNotificationInput) => notificationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUpdateNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNotificationInput }) =>
      notificationsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', id] })
    },
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useTestNotification() {
  return useMutation({
    mutationFn: (id: string) => notificationsApi.test(id),
  })
}
