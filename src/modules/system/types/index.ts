// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES - MÓDULO SYSTEM (SISTEMA, AUDITORÍA Y ALMACENAMIENTO)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro de Auditoría (Bitácora Global)
 */
export interface SystemBinnacleItem {
  id: number | string
  from_entity_type?: string
  from_entity_id?: string | number
  to_entity_type?: string
  to_entity_id?: string | number
  action: string
  date: string
  ip?: string
  data?: Record<string, unknown> | string | null
  session_id?: string | null
  description?: string
}

/**
 * Opciones de Entidades Auditables (from_entity_type)
 */
export interface AuditableEntityOption {
  id: string | number
  description: string
}

/**
 * Parámetros de Exportación de Bitácoras
 */
export interface ExportBinnaclesParams {
  fields?: string
  filters?: string
  order?: string
  headers?: string
}

/**
 * Casillero de Almacenamiento (Storage Locker)
 */
export interface StorageLockerItem {
  id: number | string
  locker_key: string
  name: string
  allowed_mimes?: string | string[]
  max_size?: number
  optimize_file?: string | number | boolean
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Archivo Almacenado en un Locker
 */
export interface LockerFileItem {
  path: string
  filename?: string
  url: string
  size: number
  mime_type: string
  last_modified?: number | string
}

/**
 * Respuesta de Subida de Archivo
 */
export interface UploadFileResponse {
  path: string
  filename: string
  url: string
}

/**
 * Esquema de Metadatos Dinámicos (EAV)
 */
export interface MetadataSchemaItem {
  id: number | string
  code: string
  table_name: string
  storage_column: string
  unique_keys?: unknown
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Campo de Metadato Dinámico
 */
export interface MetadataFieldItem {
  id: number | string
  metadata_schema_id: number | string
  metadata_field_type_id: number | string
  metadata_field_type_code?: string
  metadata_schema_group_id?: number | string | null
  metadata_schema_group_code?: string | null
  code: string
  attribute_values?: {
    label?: { es?: string; en?: string } | string
    [key: string]: unknown
  } | null
  rules?: unknown[] | null
  position?: number
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Tipo de Campo de Metadato (Catálogo Técnico)
 */
export interface MetadataFieldTypeItem {
  id: number | string
  code: string
  name?: string
  description?: string
  attribute_schema?: Record<string, unknown> | null
  is_disabled?: string | number | boolean
}

/**
 * Payload para guardar o modificar campos de metadatos
 */
export interface SaveMetadataFieldPayload {
  code: string
  metadata_field_type_id: number | string
  metadata_schema_group_id?: number | string | null
  attribute_values?: Record<string, unknown>
  rules?: unknown[]
  position?: number
}

/**
 * Invitación de Usuario
 */
export interface UserInvitationItem {
  user_id: number | string
  expires_at: string
  email?: string
  username?: string
  status?: string
}

export interface SendInvitationPayload {
  user_id: number
}

export interface SendInvitationResponse {
  user_id: number
  expires_at: string
}

/**
 * Recuperación de Contraseña (Password Recovery)
 */
export interface RequestPasswordRecoveryPayload {
  email: string
}

export interface RequestPasswordRecoveryResponse {
  verification_id: number
}

export interface ConfirmPasswordRecoveryPayload {
  verification_id: number
  otp_code: string
  password: string
}

export interface ConfirmPasswordRecoveryResponse {
  user_id: number
}
