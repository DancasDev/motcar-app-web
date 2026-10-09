export interface LocalizedName {
  es?: string
  en?: string
  [lang: string]: string | undefined
}

export interface CountryItem {
  id: string | number
  code: string
  name: string | LocalizedName
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface LanguageItem {
  id: string | number
  code: string
  name: string | LocalizedName
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface TimeZoneItem {
  id: string | number
  code?: string
  name?: string
  offset?: string
  country_id?: string | number
  country_code?: string
  time_zone_id?: string | number
  time_zone_code?: string
  is_default?: string | number | boolean
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface DocumentTypeItem {
  id: string | number
  code: string
  name: string | LocalizedName
  width?: string | number
  height?: string | number
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface CountryTimeZoneItem {
  id: string | number
  country_id: string | number
  country_code: string
  time_zone_id: string | number
  time_zone_code: string
  is_default: string | number | boolean
  is_disabled?: string | number | boolean
}

export interface NotificationTypeItem {
  id: string | number
  code: string
  name: string | LocalizedName
  description?: string | LocalizedName | null
  channels: string | number
  action_url?: string | null
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface PersonItem {
  id: string | number
  identification_type?: string
  identification_value?: string
  first_name: string
  last_name: string
  phone_primary?: string
  phone_secondary?: string | null
  address?: string | null
  city?: string | null
  metadata?: Record<string, any> | null
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
  full_name?: string
}

