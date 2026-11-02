<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import {
  fetchParticipantContract,
  emitContract,
  signContract,
  fetchContractPdf
} from '../api/financing.api'
import {
  uploadFileToLocker,
  resolveStorageFileUrl
} from '@/modules/system/api/system.api'
import { ENV } from '@/config/env'
import type { ParticipantItem, ContractDetailData } from '../types'
import AppModal from '@/components/common/AppModal.vue'

interface Props {
  modelValue: boolean
  participant: ParticipantItem | null
  groupId: string | number
  groupName?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'contract-updated'): void
  (e: 'message', text: string, color?: 'success' | 'error' | 'warning' | 'info'): void
}>()

const branchesStore = useBranchesStore()

function showMessage(text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
  emit('message', text, color)
}

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const isLoadingContract = ref(false)
const isDownloadingPdf = ref(false)
const isSubmittingSign = ref(false)
const isReplacingFile = ref(false)
const isLoadingDocument = ref(false)

const contract = ref<ContractDetailData | null>(null)
const signedDate = ref(new Date().toISOString().split('T')[0])
const signedFile = ref<File | null>(null)
const signError = ref<string | null>(null)

async function loadContract(): Promise<void> {
  if (!branchesStore.activeBranchId || !props.groupId || !props.participant?.id) {
    contract.value = null
    return
  }

  isLoadingContract.value = true
  signError.value = null
  isReplacingFile.value = false
  signedFile.value = null

  try {
    const res = await fetchParticipantContract(
      branchesStore.activeBranchId,
      props.groupId,
      props.participant.id
    )
    contract.value = res.data || null
  } catch (err: unknown) {
    const errorObj = err as any
    if (errorObj?.response?.status === 404) {
      contract.value = null
    } else {
      console.error('Error al cargar contrato:', err)
      contract.value = null
    }
  } finally {
    isLoadingContract.value = false
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      signedDate.value = new Date().toISOString().split('T')[0]
      loadContract()
    } else {
      contract.value = null
      signedFile.value = null
      signError.value = null
      isReplacingFile.value = false
    }
  }
)

/**
 * 1. Descarga el contrato oficial en PDF.
 * Si no ha sido emitido aún, lo emite automáticamente en segundo plano.
 */
async function handleDownloadPdf(): Promise<void> {
  if (!branchesStore.activeBranchId || !props.groupId || !props.participant?.id) return

  isDownloadingPdf.value = true
  try {
    // Si no está emitido, emitir automáticamente primero
    if (!contract.value) {
      await emitContract(branchesStore.activeBranchId, props.groupId, props.participant.id)
      await loadContract()
    }

    const blob = await fetchContractPdf(
      branchesStore.activeBranchId,
      props.groupId,
      props.participant.id
    )

    const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    const filename = `Contrato-${props.participant.client_first_name || 'Cliente'}-${props.participant.client_last_name || ''}-Turno-${props.participant.position || props.participant.id}.pdf`

    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000)
    showMessage('Contrato descargado exitosamente.')
    emit('contract-updated')
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al obtener el PDF del contrato.')
    showMessage(msg, 'error')
  } finally {
    isDownloadingPdf.value = false
  }
}

/**
 * 2. Formalización: Sube el contrato firmado y registra la firma.
 */
async function handleSignContract(): Promise<void> {
  if (!branchesStore.activeBranchId || !props.groupId || !props.participant?.id) return

  if (!signedDate.value) {
    signError.value = 'Ingresa la fecha de firma del contrato.'
    return
  }

  if (!signedFile.value && !contract.value?.file_url) {
    signError.value = 'Debes seleccionar el archivo digitalizado o escaneado del contrato.'
    return
  }

  isSubmittingSign.value = true
  signError.value = null

  try {
    // 1. Si no existe emisión previa, emitirlo primero
    if (!contract.value) {
      await emitContract(branchesStore.activeBranchId, props.groupId, props.participant.id)
    }

    let finalFileUrl = contract.value?.file_url || ''

    // 2. Si se seleccionó un archivo nuevo, subirlo al locker privado
    if (signedFile.value) {
      const uploadRes = await uploadFileToLocker('documents/contracts/signed', signedFile.value)
      // Construir URL válida estricta requerida por la API
      finalFileUrl =
        uploadRes.url ||
        `${ENV.API_BASE_URL}/system/storage/${uploadRes.path}`
    }

    // 3. Registrar firma
    await signContract(branchesStore.activeBranchId, props.groupId, props.participant.id, {
      file_url: finalFileUrl,
      signed_date: signedDate.value
    })

    showMessage('Contrato firmado y formalizado exitosamente.')
    await loadContract()
    emit('contract-updated')
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al formalizar el contrato.')
    signError.value = msg
    showMessage(msg, 'error')
  } finally {
    isSubmittingSign.value = false
  }
}

async function handleOpenFile(url: string | null | undefined): Promise<void> {
  if (!url) return

  isLoadingDocument.value = true
  try {
    const accessibleUrl = await resolveStorageFileUrl(
      'documents/contracts/signed',
      url
    )
    if (accessibleUrl) {
      window.open(accessibleUrl, '_blank')
    }
  } catch (err: unknown) {
    console.error('Error al abrir documento:', err)
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'No se pudo generar el enlace seguro para visualizar el documento.')
    showMessage(msg, 'error')
  } finally {
    isLoadingDocument.value = false
  }
}
</script>

<template>
  <AppModal
    v-model="isOpen"
    title="Gestión de Contrato"
    :subtitle="`${participant?.client_first_name || 'Cliente'} ${participant?.client_last_name || ''} · Turno #${participant?.position || 'N/A'}`"
    max-width="560"
    hide-submit
    cancel-text="Cerrar"
  >
    <div v-if="isLoadingContract" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" size="36" />
      <div class="text-caption text-medium-emphasis mt-2">Cargando datos del contrato...</div>
    </div>

    <div v-else class="d-flex flex-column ga-4 py-1">
      <!-- 1. Sección: Emisión -->
      <v-card variant="outlined" rounded="lg" class="pa-4">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-file-document-outline" color="primary" size="20" />
            <span class="text-subtitle-2 font-weight-bold text-high-emphasis">Emisión</span>
          </div>

          <v-chip
            size="small"
            :color="contract ? 'primary' : 'grey-darken-1'"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ contract ? 'Emitido' : 'Pendiente' }}
          </v-chip>
        </div>

        <div v-if="contract" class="d-flex flex-column ga-1 text-body-2 mb-3">
          <div>
            <span class="text-medium-emphasis">Código:</span>
            <strong class="ml-1 text-high-emphasis font-family-monospace">{{ contract.code }}</strong>
          </div>
          <div>
            <span class="text-medium-emphasis">Fecha de emisión:</span>
            <span class="ml-1 font-weight-medium text-high-emphasis">{{ contract.issue_date?.split(' ')[0] || contract.issue_date }}</span>
          </div>
        </div>
        <div v-else class="text-caption text-medium-emphasis mb-3">
          Documento listo para ser emitido.
        </div>

        <div class="d-flex justify-end">
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-download"
            class="text-none font-weight-bold"
            :loading="isDownloadingPdf"
            data-testid="btn-download-contract-pdf"
            @click="handleDownloadPdf"
          >
            Descargar PDF
          </v-btn>
        </div>
      </v-card>

      <!-- 2. Sección: Formalización -->
      <v-card variant="outlined" rounded="lg" class="pa-4">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-cloud-upload-outline" color="primary" size="20" />
            <span class="text-subtitle-2 font-weight-bold text-high-emphasis">Formalización</span>
          </div>

          <v-chip
            size="small"
            :color="contract?.sign_status === '1' ? 'primary' : 'grey-darken-1'"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ contract?.sign_status === '1' ? 'Firmado' : 'Sin Firmar' }}
          </v-chip>
        </div>

        <!-- Si ya está firmado y no en modo de reemplazo -->
        <div v-if="contract?.sign_status === '1' && !isReplacingFile">
          <div class="d-flex align-center justify-space-between flex-wrap ga-3 bg-surface-variant pa-3 rounded-lg mb-3">
            <div class="d-flex align-center ga-2">
              <v-icon icon="mdi-check-circle" color="primary" size="18" />
              <span class="text-body-2 text-high-emphasis font-weight-medium">
                Firmado el {{ contract.signed_date }}
              </span>
            </div>

            <v-btn
              v-if="contract.file_url"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-eye-outline"
              size="small"
              class="text-none font-weight-bold"
              :loading="isLoadingDocument"
              data-testid="btn-view-contract-document"
              @click="handleOpenFile(contract.file_url)"
            >
              Ver Documento
            </v-btn>
          </div>

          <div class="d-flex justify-end">
            <v-btn
              variant="plain"
              color="grey-darken-1"
              size="small"
              class="text-none font-weight-medium"
              @click="isReplacingFile = true"
            >
              Reemplazar Documento
            </v-btn>
          </div>
        </div>

        <!-- Formulario para subir archivo y fecha de firma -->
        <div v-else>
          <v-row density="compact" class="mb-1">
            <v-col cols="12" sm="5">
              <v-text-field
                v-model="signedDate"
                label="Fecha de Firma *"
                type="date"
                variant="outlined"
                density="compact"
                hide-details
                data-testid="input-contract-signed-date"
              />
            </v-col>

            <v-col cols="12" sm="7">
              <v-file-input
                v-model="signedFile"
                label="Adjuntar archivo firmado *"
                accept=".pdf,image/*"
                prepend-icon=""
                prepend-inner-icon="mdi-paperclip"
                variant="outlined"
                density="compact"
                show-size
                hide-details
                data-testid="input-contract-signed-file"
              />
            </v-col>
          </v-row>

          <v-alert
            v-if="signError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2 mb-0"
            closable
            @click:close="signError = null"
          >
            {{ signError }}
          </v-alert>

          <div class="d-flex align-center justify-end ga-2 mt-3">
            <v-btn
              v-if="isReplacingFile"
              variant="plain"
              color="grey-darken-1"
              class="text-none font-weight-medium"
              @click="isReplacingFile = false"
            >
              Cancelar
            </v-btn>

            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-cloud-upload-outline"
              class="text-none font-weight-bold"
              :loading="isSubmittingSign"
              :disabled="!signedFile"
              data-testid="btn-submit-signed-contract"
              @click="handleSignContract"
            >
              Subir
            </v-btn>
          </div>
        </div>
      </v-card>
    </div>
  </AppModal>
</template>
