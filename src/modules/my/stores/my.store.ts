import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchUnreadNotificationsCount,
  fetchMyNotifications,
  markNotificationAsRead,
  fetchNotificationChannels,
  updateNotificationChannels
} from '../api/my.api'
import type {
  NotificationItem,
  NotificationChannelItem
} from '../types'

export const useMyStore = defineStore('my', () => {
  // Estado reactivo
  const unreadCount = ref(0)
  const notifications = ref<NotificationItem[]>([])
  const channels = ref<NotificationChannelItem[]>([])
  const isLoading = ref(false)
  const isUpdatingChannels = ref(false)

  // Acciones
  async function loadUnreadCount(): Promise<number> {
    try {
      const count = await fetchUnreadNotificationsCount()
      unreadCount.value = count
      return count
    } catch {
      return unreadCount.value
    }
  }

  async function loadNotifications(limit = 10): Promise<NotificationItem[]> {
    isLoading.value = true
    try {
      const res = await fetchMyNotifications({
        itemsPerPage: limit,
        order: JSON.stringify({ id: 'DESC' })
      })
      notifications.value = res.data
      return notifications.value
    } catch {
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function markAsRead(notificationId: string | number): Promise<void> {
    await markNotificationAsRead(notificationId)
    // Actualizar reactivamente en memoria
    const index = notifications.value.findIndex((n) => String(n.id) === String(notificationId))
    if (index !== -1) {
      notifications.value[index] = {
        ...notifications.value[index],
        read_at: new Date().toISOString()
      }
    }
    if (unreadCount.value > 0) {
      unreadCount.value -= 1
    }
  }

  async function markAllAsRead(): Promise<void> {
    const unreadItems = notifications.value.filter((n) => !n.read_at)
    if (unreadItems.length === 0) return

    await Promise.allSettled(unreadItems.map((n) => markNotificationAsRead(n.id)))
    const now = new Date().toISOString()
    notifications.value = notifications.value.map((n) => ({
      ...n,
      read_at: n.read_at || now
    }))
    unreadCount.value = 0
  }

  async function loadChannels(): Promise<NotificationChannelItem[]> {
    isLoading.value = true
    try {
      const data = await fetchNotificationChannels()
      channels.value = data
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function saveChannels(channelIds: string[]): Promise<NotificationChannelItem[]> {
    isUpdatingChannels.value = true
    try {
      const updated = await updateNotificationChannels({
        notification_channels: channelIds
      })
      channels.value = updated
      return updated
    } finally {
      isUpdatingChannels.value = false
    }
  }

  return {
    unreadCount,
    notifications,
    channels,
    isLoading,
    isUpdatingChannels,
    loadUnreadCount,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    loadChannels,
    saveChannels
  }
})
