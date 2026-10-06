import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type {
  CountryItem,
  LanguageItem,
  TimeZoneItem,
  DocumentTypeItem,
  CountryTimeZoneItem,
  NotificationTypeItem
} from '../types'

/**
 * Consulta listado paginado de países mediante el motor DQB
 */
export async function fetchCountries(
  params?: DataQueryParams
): Promise<PaginatedResponse<CountryItem>> {
  const response = await apiClient.get<PaginatedResponse<CountryItem>>(
    ENDPOINTS.CATALOGS.COUNTRIES,
    { params }
  )
  return response.data
}

/**
 * Consulta listado paginado de zonas horarias de un país específico mediante DQB
 */
export async function fetchCountryTimezones(
  countryId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<CountryTimeZoneItem>> {
  const response = await apiClient.get<PaginatedResponse<CountryTimeZoneItem>>(
    ENDPOINTS.CATALOGS.COUNTRY_TIMEZONES(countryId),
    { params }
  )
  return response.data
}

/**
 * Consulta listado paginado de zonas horarias maestras mediante el motor DQB
 */
export async function fetchTimezones(
  params?: DataQueryParams
): Promise<PaginatedResponse<TimeZoneItem>> {
  const response = await apiClient.get<PaginatedResponse<TimeZoneItem>>(
    ENDPOINTS.CATALOGS.TIMEZONES,
    { params }
  )
  return response.data
}

/**
 * Consulta listado paginado de tipos de documento mediante el motor DQB
 */
export async function fetchDocumentTypes(
  params?: DataQueryParams
): Promise<PaginatedResponse<DocumentTypeItem>> {
  const response = await apiClient.get<PaginatedResponse<DocumentTypeItem>>(
    ENDPOINTS.CATALOGS.DOCUMENT_TYPES,
    { params }
  )
  return response.data
}

/**
 * Consulta listado paginado de idiomas mediante el motor DQB
 */
export async function fetchLanguages(
  params?: DataQueryParams
): Promise<PaginatedResponse<LanguageItem>> {
  const response = await apiClient.get<PaginatedResponse<LanguageItem>>(
    ENDPOINTS.CATALOGS.LANGUAGES,
    { params }
  )
  return response.data
}

/**
 * Consulta listado paginado de tipos de notificación mediante el motor DQB
 */
export async function fetchNotificationTypes(
  params?: DataQueryParams
): Promise<PaginatedResponse<NotificationTypeItem>> {
  const response = await apiClient.get<PaginatedResponse<NotificationTypeItem>>(
    ENDPOINTS.CATALOGS.NOTIFICATION_TYPES,
    { params }
  )
  return response.data
}

// Aliases para retrocompatibilidad
export const getCountries = fetchCountries
export const getCountryTimeZones = fetchCountryTimezones
export const getTimeZones = fetchTimezones
export const getDocumentTypes = fetchDocumentTypes
export const getLanguages = fetchLanguages
export const getNotificationTypes = fetchNotificationTypes

