import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { ApiResponse } from '@/types/api'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type {
  NotificationItem,
  UnreadCountData,
  NotificationChannelItem,
  UpdateChannelsPayload,
  BinnacleItem,
  UpdatePasswordPayload
} from '../types'

/**
 * Obtiene el total de notificaciones no leídas del usuario autenticado
 */
export async function fetchUnreadNotificationsCount(): Promise<number> {
  const response = await apiClient.get<ApiResponse<UnreadCountData>>(
    ENDPOINTS.MY.UNREAD_COUNT
  )
  return response.data.data.unread
}

/**
 * Consulta listado paginado de notificaciones personales mediante el motor DQB
 */
export async function fetchMyNotifications(
  params?: DataQueryParams
): Promise<PaginatedResponse<NotificationItem>> {
  const response = await apiClient.get<PaginatedResponse<NotificationItem>>(
    ENDPOINTS.MY.NOTIFICATIONS,
    { params }
  )
  return response.data
}

/**
 * Marca una notificación individual como leída
 */
export async function markNotificationAsRead(
  notificationId: string | number
): Promise<void> {
  await apiClient.put(ENDPOINTS.MY.NOTIFICATION_BY_ID(notificationId))
}

/**
 * Obtiene la lista de canales de notificación configurables y su estado
 */
export async function fetchNotificationChannels(): Promise<NotificationChannelItem[]> {
  const response = await apiClient.get<ApiResponse<NotificationChannelItem[]>>(
    ENDPOINTS.MY.CHANNELS
  )
  return response.data.data
}

/**
 * Actualiza los canales de notificación habilitados para el usuario
 */
export async function updateNotificationChannels(
  payload: UpdateChannelsPayload
): Promise<NotificationChannelItem[]> {
  // El backend exige null cuando no hay canales habilitados
  const formattedChannels =
    payload.notification_channels && payload.notification_channels.length > 0
      ? payload.notification_channels
      : null

  const response = await apiClient.put<ApiResponse<NotificationChannelItem[]>>(
    ENDPOINTS.MY.CHANNELS,
    { notification_channels: formattedChannels }
  )
  return response.data.data
}

/**
 * Consulta la bitácora personal de eventos del usuario mediante el motor DQB
 */
export async function fetchMyBinnacles(
  params?: DataQueryParams
): Promise<PaginatedResponse<BinnacleItem>> {
  const response = await apiClient.get<PaginatedResponse<BinnacleItem>>(
    ENDPOINTS.MY.BINNACLES,
    { params }
  )
  return response.data
}

/**
 * Actualiza la contraseña del usuario autenticado (limpia force_to='0')
 */
export async function updateMyPassword(
  payload: UpdatePasswordPayload
): Promise<ApiResponse<{ id: number; affected: boolean; require_login: boolean }>> {
  const response = await apiClient.put<
    ApiResponse<{ id: number; affected: boolean; require_login: boolean }>
  >(ENDPOINTS.MY.PASSWORD, payload)
  return response.data
}
