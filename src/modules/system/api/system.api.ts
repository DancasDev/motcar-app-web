import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type { ApiResponse } from '@/types/api'
import type {
  SystemBinnacleItem,
  AuditableEntityOption,
  StorageLockerItem,
  LockerFileItem,
  UploadFileResponse,
  MetadataSchemaItem,
  MetadataFieldItem,
  MetadataFieldTypeItem,
  SaveMetadataFieldPayload,
  SendInvitationPayload,
  SendInvitationResponse,
  RequestPasswordRecoveryPayload,
  RequestPasswordRecoveryResponse,
  ConfirmPasswordRecoveryPayload,
  ConfirmPasswordRecoveryResponse
} from '../types'

// ---------------------------------------------------------------------
// 1. Auditoría Global del Sistema (Bitácoras)
// ---------------------------------------------------------------------

export async function fetchSystemBinnacles(
  params?: DataQueryParams
): Promise<PaginatedResponse<SystemBinnacleItem>> {
  const response = await apiClient.get<PaginatedResponse<SystemBinnacleItem>>(
    ENDPOINTS.SYSTEM.BINNACLES,
    { params }
  )
  return response.data
}

export async function fetchBinnacleById(
  id: string | number
): Promise<ApiResponse<SystemBinnacleItem>> {
  const response = await apiClient.get<ApiResponse<SystemBinnacleItem>>(
    ENDPOINTS.SYSTEM.BINNACLE_BY_ID(id)
  )
  return response.data
}

export async function fetchAuditableEntities(): Promise<ApiResponse<AuditableEntityOption[]>> {
  const response = await apiClient.get<ApiResponse<AuditableEntityOption[]>>(
    ENDPOINTS.SYSTEM.BINNACLE_FROM_ENTITIES
  )
  return response.data
}

export async function exportBinnacles(
  format = 'xlsx',
  params?: DataQueryParams
): Promise<Blob> {
  const response = await apiClient.get<Blob>(
    ENDPOINTS.SYSTEM.BINNACLE_EXPORT(format),
    {
      params,
      responseType: 'blob'
    }
  )
  return response.data
}

// ---------------------------------------------------------------------
// 2. Almacenamiento y Archivos (Storage y Lockers)
// ---------------------------------------------------------------------

export async function fetchStorageLockers(
  params?: DataQueryParams
): Promise<PaginatedResponse<StorageLockerItem>> {
  const response = await apiClient.get<PaginatedResponse<StorageLockerItem>>(
    ENDPOINTS.SYSTEM.STORAGE_LOCKERS,
    { params }
  )
  return response.data
}

export async function fetchLockerById(
  id: string | number
): Promise<ApiResponse<StorageLockerItem>> {
  const response = await apiClient.get<ApiResponse<StorageLockerItem>>(
    ENDPOINTS.SYSTEM.STORAGE_LOCKER_BY_ID(id)
  )
  return response.data
}

export async function fetchLockerFiles(
  lockerId: string | number
): Promise<LockerFileItem[]> {
  const response = await apiClient.get<LockerFileItem[] | { data: LockerFileItem[] }>(
    ENDPOINTS.SYSTEM.STORAGE_LOCKER_FILES(lockerId)
  )
  if (Array.isArray(response.data)) {
    return response.data
  }
  if (response.data && Array.isArray((response.data as { data: LockerFileItem[] }).data)) {
    return (response.data as { data: LockerFileItem[] }).data
  }
  return []
}

export async function uploadFileToLocker(
  lockerKey: string,
  file: File
): Promise<UploadFileResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<UploadFileResponse | { data: UploadFileResponse }>(
    ENDPOINTS.SYSTEM.STORAGE_UPLOAD(lockerKey),
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  )
  const data = response.data as unknown as Record<string, unknown>
  if (data && 'data' in data && typeof data.data === 'object' && data.data !== null) {
    return data.data as UploadFileResponse
  }
  return response.data as UploadFileResponse
}

export async function deleteLockerFile(
  lockerId: string | number,
  filename: string
): Promise<ApiResponse<{ message: string }>> {
  const response = await apiClient.delete<ApiResponse<{ message: string }>>(
    ENDPOINTS.SYSTEM.STORAGE_LOCKER_FILE_DELETE(lockerId, encodeURIComponent(filename))
  )
  return response.data
}

// ---------------------------------------------------------------------
// 3. Metadatos Dinámicos (EAV)
// ---------------------------------------------------------------------

export async function fetchMetadataSchemas(
  params?: DataQueryParams
): Promise<PaginatedResponse<MetadataSchemaItem>> {
  const response = await apiClient.get<PaginatedResponse<MetadataSchemaItem>>(
    ENDPOINTS.SYSTEM.METADATA_SCHEMAS,
    { params }
  )
  return response.data
}

export async function fetchMetadataSchemaRender(
  schemaId: string | number
): Promise<ApiResponse<unknown>> {
  const response = await apiClient.get<ApiResponse<unknown>>(
    ENDPOINTS.SYSTEM.METADATA_SCHEMA_RENDER(schemaId)
  )
  return response.data
}

export async function fetchMetadataFields(
  schemaId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<MetadataFieldItem>> {
  const response = await apiClient.get<PaginatedResponse<MetadataFieldItem>>(
    ENDPOINTS.SYSTEM.METADATA_FIELDS(schemaId),
    { params }
  )
  return response.data
}

export async function fetchMetadataFieldTypes(
  params?: DataQueryParams
): Promise<PaginatedResponse<MetadataFieldTypeItem>> {
  const response = await apiClient.get<PaginatedResponse<MetadataFieldTypeItem>>(
    ENDPOINTS.SYSTEM.METADATA_FIELD_TYPES,
    { params }
  )
  return response.data
}

export async function createMetadataField(
  schemaId: string | number,
  payload: SaveMetadataFieldPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.SYSTEM.METADATA_FIELDS(schemaId),
    payload
  )
  return response.data
}

export async function updateMetadataField(
  schemaId: string | number,
  fieldId: string | number,
  payload: Partial<SaveMetadataFieldPayload>
): Promise<ApiResponse<void>> {
  const response = await apiClient.put<ApiResponse<void>>(
    ENDPOINTS.SYSTEM.METADATA_FIELD_BY_ID(schemaId, fieldId),
    payload
  )
  return response.data
}

export async function deleteMetadataField(
  schemaId: string | number,
  fieldId: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.SYSTEM.METADATA_FIELD_BY_ID(schemaId, fieldId)
  )
  return response.data
}

// ---------------------------------------------------------------------
// 4. Servicios de Usuario (Invitaciones)
// ---------------------------------------------------------------------

export async function sendUserInvitation(
  payload: SendInvitationPayload
): Promise<ApiResponse<SendInvitationResponse>> {
  const response = await apiClient.post<ApiResponse<SendInvitationResponse>>(
    ENDPOINTS.SYSTEM.INVITATIONS,
    payload
  )
  return response.data
}

// ---------------------------------------------------------------------
// 5. Servicios de Seguridad (Recuperación de Contraseña)
// ---------------------------------------------------------------------

/**
 * Solicita el envío de un código OTP para recuperación de contraseña
 */
export async function requestPasswordRecovery(
  payload: RequestPasswordRecoveryPayload
): Promise<ApiResponse<RequestPasswordRecoveryResponse>> {
  const response = await apiClient.post<ApiResponse<RequestPasswordRecoveryResponse>>(
    ENDPOINTS.SYSTEM.PASSWORD_RECOVERY,
    payload
  )
  return response.data
}

/**
 * Confirma el restablecimiento de la contraseña validando verification_id y otp_code
 */
export async function confirmPasswordRecovery(
  payload: ConfirmPasswordRecoveryPayload
): Promise<ApiResponse<ConfirmPasswordRecoveryResponse>> {
  const response = await apiClient.put<ApiResponse<ConfirmPasswordRecoveryResponse>>(
    ENDPOINTS.SYSTEM.PASSWORD_RECOVERY,
    payload
  )
  return response.data
}
