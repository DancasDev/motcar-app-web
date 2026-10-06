import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchAuditableEntities as apiFetchAuditableEntities,
  fetchStorageLockers as apiFetchStorageLockers,
  fetchLockerFiles as apiFetchLockerFiles,
  uploadFileToLocker as apiUploadFileToLocker,
  deleteLockerFile as apiDeleteLockerFile,
  exportBinnacles as apiExportBinnacles,
  fetchMetadataSchemas as apiFetchMetadataSchemas,
  fetchMetadataFieldTypes as apiFetchMetadataFieldTypes,
  sendUserInvitation as apiSendUserInvitation,
  requestPasswordRecovery as apiRequestPasswordRecovery,
  confirmPasswordRecovery as apiConfirmPasswordRecovery
} from '../api/system.api'
import type {
  AuditableEntityOption,
  StorageLockerItem,
  LockerFileItem,
  MetadataSchemaItem,
  MetadataFieldTypeItem,
  UploadFileResponse,
  SendInvitationResponse
} from '../types'
import type { DataQueryParams } from '@/types/query'

export const useSystemStore = defineStore('system', () => {
  const entities = ref<AuditableEntityOption[]>([])
  const lockers = ref<StorageLockerItem[]>([])
  const selectedLockerId = ref<number | null>(null)
  const lockerFiles = ref<LockerFileItem[]>([])
  const metadataSchemas = ref<MetadataSchemaItem[]>([])
  const fieldTypes = ref<MetadataFieldTypeItem[]>([])

  const isLoading = ref<boolean>(false)
  const isUploading = ref<boolean>(false)
  const isExporting = ref<boolean>(false)

  /**
   * Carga los tipos de entidad disponibles para auditoría
   */
  async function loadAuditableEntities(): Promise<AuditableEntityOption[]> {
    if (entities.value.length > 0) return entities.value
    try {
      const res = await apiFetchAuditableEntities()
      entities.value = res.data || []
      return entities.value
    } catch (err) {
      console.error('Error loading auditable entities:', err)
      return []
    }
  }

  /**
   * Carga el listado de casilleros de almacenamiento (lockers)
   */
  async function loadLockers(force = false): Promise<StorageLockerItem[]> {
    if (lockers.value.length > 0 && !force) return lockers.value
    isLoading.value = true
    try {
      const res = await apiFetchStorageLockers({ itemsPerPage: 100 })
      lockers.value = res.data || []
      if (lockers.value.length > 0 && !selectedLockerId.value) {
        selectedLockerId.value = Number(lockers.value[0].id)
      }
      return lockers.value
    } catch (err) {
      console.error('Error loading storage lockers:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Carga los archivos dentro de un locker
   */
  async function loadLockerFiles(lockerId: number | string): Promise<LockerFileItem[]> {
    if (!lockerId) {
      lockerFiles.value = []
      return []
    }
    isLoading.value = true
    try {
      const files = await apiFetchLockerFiles(lockerId)
      lockerFiles.value = files || []
      return lockerFiles.value
    } catch (err) {
      console.error(`Error loading files for locker ${lockerId}:`, err)
      lockerFiles.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sube un archivo a un locker específico
   */
  async function uploadFile(
    lockerKey: string,
    file: File
  ): Promise<UploadFileResponse> {
    isUploading.value = true
    try {
      const res = await apiUploadFileToLocker(lockerKey, file)
      if (selectedLockerId.value) {
        await loadLockerFiles(selectedLockerId.value)
      }
      return res
    } finally {
      isUploading.value = false
    }
  }

  /**
   * Elimina un archivo físico de un locker
   */
  async function deleteFile(
    lockerId: number | string,
    filename: string
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiDeleteLockerFile(lockerId, filename)
      await loadLockerFiles(lockerId)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Exporta las bitácoras a un archivo Excel y dispara la descarga en el navegador
   */
  async function exportBinnaclesToExcel(params?: DataQueryParams): Promise<void> {
    isExporting.value = true
    try {
      const blob = await apiExportBinnacles('xlsx', params)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria_sistema_${new Date().toISOString().substring(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Carga esquemas de metadatos dinámicos
   */
  async function loadMetadataSchemas(): Promise<MetadataSchemaItem[]> {
    if (metadataSchemas.value.length > 0) return metadataSchemas.value
    try {
      const res = await apiFetchMetadataSchemas({ itemsPerPage: 100 })
      metadataSchemas.value = res.data || []
      return metadataSchemas.value
    } catch (err) {
      console.error('Error loading metadata schemas:', err)
      return []
    }
  }

  /**
   * Carga los tipos de datos de campos de metadatos
   */
  async function loadFieldTypes(): Promise<MetadataFieldTypeItem[]> {
    if (fieldTypes.value.length > 0) return fieldTypes.value
    try {
      const res = await apiFetchMetadataFieldTypes({ itemsPerPage: 100 })
      fieldTypes.value = res.data || []
      return fieldTypes.value
    } catch (err) {
      console.error('Error loading metadata field types:', err)
      return []
    }
  }

  /**
   * Envía una invitación de usuario por correo
   */
  async function sendInvitation(userId: number): Promise<SendInvitationResponse> {
    isLoading.value = true
    try {
      const res = await apiSendUserInvitation({ user_id: userId })
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Solicita código OTP para recuperación de contraseña (Servicio del Sistema)
   */
  async function requestPasswordRecovery(email: string): Promise<{ verification_id: number; message: string }> {
    isLoading.value = true
    try {
      const res = await apiRequestPasswordRecovery({ email })
      return {
        verification_id: res.data.verification_id,
        message: res.messages?.success || 'Código de recuperación enviado.'
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Confirma restablecimiento de contraseña con OTP (Servicio del Sistema)
   */
  async function confirmPasswordRecovery(
    verificationId: number,
    otpCode: string,
    password: string
  ): Promise<{ user_id: number; message: string }> {
    isLoading.value = true
    try {
      const res = await apiConfirmPasswordRecovery({
        verification_id: verificationId,
        otp_code: otpCode,
        password
      })
      return {
        user_id: res.data.user_id,
        message: res.messages?.success || 'Contraseña restablecida exitosamente.'
      }
    } finally {
      isLoading.value = false
    }
  }

  return {
    entities,
    lockers,
    selectedLockerId,
    lockerFiles,
    metadataSchemas,
    fieldTypes,
    isLoading,
    isUploading,
    isExporting,
    loadAuditableEntities,
    loadLockers,
    loadLockerFiles,
    uploadFile,
    deleteFile,
    exportBinnaclesToExcel,
    loadMetadataSchemas,
    loadFieldTypes,
    sendInvitation,
    requestPasswordRecovery,
    confirmPasswordRecovery
  }
})
