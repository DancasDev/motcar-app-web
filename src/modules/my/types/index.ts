export interface NotificationItem {
  id: string | number
  notification_type_id: string | number
  notification_type_code?: string
  channel_type: string | number
  channel_key?: string | null
  title: string
  message: string
  payload?: unknown
  status: string | number
  retry_count?: string | number
  max_retries?: string | number
  next_attempt_at?: string | null
  error_message?: string | null
  sent_at?: string | null
  read_at?: string | null
  created_at?: string
  updated_at?: string | null
}

export interface UnreadCountData {
  unread: number
}

export interface NotificationChannelItem {
  channel: string
  available: boolean
  enabled: boolean
  channel_key: string | null
}

export interface UpdateChannelsPayload {
  notification_channels: string[] | null
}

export interface BinnacleItem {
  id: string | number
  from_entity_type?: string | null
  from_entity_id?: string | null
  to_entity_type: string
  to_entity_id: string
  action: string
  date: string
  ip: string
  data?: string | Record<string, unknown> | null
  session_id?: string | null
  description: string
}

export interface UpdatePasswordPayload {
  password_current: string
  password_new: string
}
