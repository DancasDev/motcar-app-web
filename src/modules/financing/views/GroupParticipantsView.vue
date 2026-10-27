<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useFinancingStore } from '../stores/financing.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchParticipants,
  createParticipant as apiCreateParticipant,
  updateParticipant as apiUpdateParticipant,
  deleteParticipant as apiDeleteParticipant,
  fetchSamGroupById,
  fetchPaymentFrequencies,
  emitContract,
  fetchContractPdf
} from '../api/financing.api'
import type {
  SamGroupItem,
  ParticipantItem,
  PaymentFrequencyItem
} from '../types'
import type { DqbFilterTuple } from '@/types/query'
import AppPaginatedSelect, { type PaginatedQueryParams } from '@/components/common/AppPaginatedSelect.vue'
import AppMetadataRenderer, { type MetadataSchemaPayload } from '@/components/common/AppMetadataRenderer.vue'
import { fetchMetadataSchemaRender } from '@/modules/system/api/system.api'
import { fetchPersons, fetchPersonById } from '@/modules/catalogs/api/catalogs.api'
import type { PersonItem } from '@/modules/catalogs/types'
import StatementModal from '../components/StatementModal.vue'

const route = useRoute()
const router = useRouter()
const branchesStore = useBranchesStore()
const financingStore = useFinancingStore()

const groupId = computed(() => String(route.params.groupId || ''))
const currentGroup = ref<SamGroupItem | null>(null)
const isLoadingGroup = ref(false)

const contractMetadataSchema = ref<MetadataSchemaPayload | null>(null)
const isLoadingSchema = ref(false)

async function loadContractMetadataSchema(): Promise<void> {
  let schemaId: string | number | null | undefined = currentGroup.value?.contract_type_metadata_schema_id

  if (!schemaId && currentGroup.value?.contract_type_id) {
    if (financingStore.contractTypes.length === 0) {
      await financingStore.loadCatalogs()
    }
    const found = financingStore.contractTypes.find(
      (c) => String(c.id) === String(currentGroup.value?.contract_type_id)
    )
    schemaId = found?.metadata_schema_id
  }

  if (!schemaId) {
    contractMetadataSchema.value = null
    return
  }

  isLoadingSchema.value = true
  try {
    const res = await fetchMetadataSchemaRender(schemaId)
    contractMetadataSchema.value = (res.data || null) as MetadataSchemaPayload | null
  } catch (err) {
    console.error('Error al cargar esquema de metadatos del contrato:', err)
    contractMetadataSchema.value = null
  } finally {
    isLoadingSchema.value = false
  }
}


function getFieldLabel(fieldDef: any): string {
  if (!fieldDef) return ''
  const attr = typeof fieldDef.attribute_values === 'string'
    ? (() => { try { return JSON.parse(fieldDef.attribute_values) } catch { return {} } })()
    : (fieldDef.attribute_values || {})
  return attr.label || fieldDef.name || fieldDef.code
}

async function loadGroupDetails(): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isLoadingGroup.value = true
  try {
    const res = await fetchSamGroupById(branchesStore.activeBranchId, groupId.value)
    currentGroup.value = res.data || null
    await loadContractMetadataSchema()
  } catch (err) {
    console.error('Error al cargar datos del grupo:', err)
  } finally {
    isLoadingGroup.value = false
  }
}

// ---------------------------------------------------------------------
// 1. Data Query de Participantes del Grupo
// ---------------------------------------------------------------------
const participantsQuery = useDataQuery<ParticipantItem>(
  async (params) => {
    if (!branchesStore.activeBranchId || !groupId.value) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchParticipants(branchesStore.activeBranchId, groupId.value, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['client_first_name', 'client_last_name', 'position']
  }
)

const participantHeaders = [
  { title: 'Turno', key: 'position', align: 'center' as const, sortable: true, width: '100px' },
  { title: 'Cliente Suscriptor', key: 'client', align: 'start' as const, sortable: false },
  { title: 'Referente', key: 'referrer', align: 'start' as const, sortable: false, width: '180px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Morosidad', key: 'is_overdue', align: 'center' as const, sortable: true, width: '110px' },
  { title: 'Adjudicación', key: 'awarded_at', align: 'center' as const, sortable: true, width: '140px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '80px' }
]

const statusOptions = [
  { text: 'Activo', value: '1' },
  { text: 'En Espera', value: '0' },
  { text: 'Retirado', value: '2' }
]

function handleStatusFilterChange(dqbFilter: DqbFilterTuple[] | null): void {
  if (dqbFilter && dqbFilter.length > 0) {
    participantsQuery.staticFilters.value = dqbFilter
  } else {
    participantsQuery.staticFilters.value = []
  }
  participantsQuery.page.value = 1
  participantsQuery.refresh()
}

// ---------------------------------------------------------------------
// 2. Diálogos de Participante (Crear, Editar, Detalles, Eliminar)
// ---------------------------------------------------------------------
const participantDialogOpen = ref(false)
const isSubmittingParticipant = ref(false)
const editingParticipantId = ref<string | number | null>(null)

// Modal de detalles
const detailsDialogOpen = ref(false)
const selectedParticipantDetails = ref<ParticipantItem | null>(null)

// Modal de eliminación
const deleteDialogOpen = ref(false)
const participantToDelete = ref<ParticipantItem | null>(null)
const isDeletingParticipant = ref(false)


function formatLocalized(name: unknown): string {
  if (!name) return ''
  if (typeof name === 'object') {
    const obj = name as Record<string, string>
    return obj.es || obj.en || Object.values(obj)[0] || ''
  }
  if (typeof name === 'string' && name.startsWith('{')) {
    try {
      const parsed = JSON.parse(name)
      return parsed.es || parsed.en || Object.values(parsed)[0] || name
    } catch {
      return name
    }
  }
  return String(name)
}

async function fetchFrequenciesOptions(params: PaginatedQueryParams): Promise<{ items: any[]; total: number }> {
  try {
    const dqbFilters: any[] = []
    if (params.search && params.search.trim()) {
      const term = params.search.trim()
      dqbFilters.push(['name', term, 'LIKE', 'AND', 'BOTH'])
    }
    const res = await fetchPaymentFrequencies({
      page: params.page,
      itemsPerPage: params.pageSize,
      filters: dqbFilters.length > 0 ? JSON.stringify(dqbFilters) : undefined
    })
    const items = (res.data || []).map((f: PaymentFrequencyItem) => ({
      ...f,
      id: Number(f.id),
      name: formatLocalized(f.name) || f.code
    }))
    return {
      items,
      total: res.count ?? items.length
    }
  } catch (err) {
    console.error('Error al consultar frecuencias:', err)
    return { items: [], total: 0 }
  }
}

async function fetchFrequencySingle(id: any): Promise<any> {
  if (!id) return null
  const found = financingStore.frequencies.find((f: any) => String(f.id) === String(id))
  if (found) {
    return {
      ...found,
      id: Number(found.id),
      name: formatLocalized(found.name) || found.code
    }
  }
  try {
    const res = await fetchPaymentFrequencies({ filters: JSON.stringify([['id', id]]) })
    const item = res.data?.[0]
    if (!item) return null
    return {
      ...item,
      id: Number(item.id),
      name: formatLocalized(item.name) || item.code
    }
  } catch {
    return null
  }
}


// Modal de Datos del Beneficio
const benefitDialogOpen = ref(false)
const selectedBenefitParticipant = ref<ParticipantItem | null>(null)
const isSubmittingBenefit = ref(false)
const benefitFormData = ref<Record<string, any>>({})

function openBenefitDialog(participant: ParticipantItem): void {
  selectedBenefitParticipant.value = participant
  let metadata: Record<string, any> = {}
  if (typeof participant.benefit_metadata === 'string') {
    try {
      metadata = JSON.parse(participant.benefit_metadata)
    } catch {
      metadata = {}
    }
  } else if (participant.benefit_metadata) {
    metadata = { ...(participant.benefit_metadata as Record<string, any>) }
  }

  if (!metadata.reference_value && currentGroup.value?.installment_amount && currentGroup.value?.installment_count) {
    metadata.reference_value = Number(currentGroup.value.installment_amount) * Number(currentGroup.value.installment_count)
  }
  if (!metadata.year) {
    metadata.year = new Date().getFullYear()
  }

  benefitFormData.value = metadata
  benefitDialogOpen.value = true
}

async function handleSaveBenefit(): Promise<void> {
  if (!selectedBenefitParticipant.value || !branchesStore.activeBranchId || !groupId.value) return

  isSubmittingBenefit.value = true
  try {
    await apiUpdateParticipant(
      branchesStore.activeBranchId,
      groupId.value,
      selectedBenefitParticipant.value.id,
      {
        benefit_metadata: { ...benefitFormData.value }
      }
    )
    showMessage('Datos del beneficio guardados exitosamente.')
    benefitDialogOpen.value = false
    selectedBenefitParticipant.value = null
    participantsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al guardar los datos del beneficio.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingBenefit.value = false
  }
}

// Autocompletado paginado de personas (Clientes y Asesores)
async function fetchPersonsOptions(params: PaginatedQueryParams): Promise<{ items: any[]; total: number }> {
  try {
    const dqbFilters: any[] = []
    if (params.search && params.search.trim()) {
      const term = params.search.trim()
      const searchTuples: DqbFilterTuple[] = [
        ['first_name', term, 'LIKE', 'AND', 'BOTH'],
        ['last_name', term, 'LIKE', 'OR', 'BOTH'],
        ['identification_value', term, 'LIKE', 'OR', 'BOTH']
      ]
      dqbFilters.push({ orGroupSearch: searchTuples })
    }
    const res = await fetchPersons({
      page: params.page,
      itemsPerPage: params.pageSize,
      filters: dqbFilters.length > 0 ? JSON.stringify(dqbFilters) : undefined
    })
    const items = (res.data || []).map((p: PersonItem) => ({
      ...p,
      id: Number(p.id),
      name: `${p.first_name} ${p.last_name} (${p.identification_value ? `CI: ${p.identification_value}` : `ID: #${p.id}`})`
    }))
    return {
      items,
      total: res.count ?? items.length
    }
  } catch (err) {
    console.error('Error al consultar personas para autocompletado:', err)
    return { items: [], total: 0 }
  }
}

async function fetchPersonSingle(id: any): Promise<any> {
  if (!id) return null
  try {
    const p = await fetchPersonById(id)
    if (!p) return null
    return {
      ...p,
      id: Number(p.id),
      name: `${p.first_name} ${p.last_name} (${p.identification_value ? `CI: ${p.identification_value}` : `ID: #${p.id}`})`
    }
  } catch {
    return null
  }
}

const participantFormData = ref<{
  client_id: number | null
  referrer_id: number | null
  position: number | null
  frequency_id: number | null
  frequency_base_date: string
  installment_amount: number | null
  installment_count: number | null
  status: string
  is_disabled: boolean
}>({
  client_id: null,
  referrer_id: null,
  position: null,
  frequency_id: null,
  frequency_base_date: '',
  installment_amount: null,
  installment_count: null,
  status: '1',
  is_disabled: false
})

function openCreateParticipantDialog(): void {
  editingParticipantId.value = null
  participantFormData.value = {
    client_id: null,
    referrer_id: null,
    position: null,
    frequency_id: null,
    frequency_base_date: '',
    installment_amount: null,
    installment_count: null,
    status: '1',
    is_disabled: false
  }
  participantDialogOpen.value = true
}

function openEditParticipantDialog(participant: ParticipantItem): void {
  editingParticipantId.value = participant.id
  participantFormData.value = {
    client_id: Number(participant.client_id),
    referrer_id: participant.referrer_id ? Number(participant.referrer_id) : null,
    position: participant.position ? Number(participant.position) : null,
    frequency_id: participant.frequency_id ? Number(participant.frequency_id) : null,
    frequency_base_date: participant.frequency_base_date || '',
    installment_amount: participant.installment_amount !== undefined && participant.installment_amount !== null
      ? Number(participant.installment_amount)
      : null,
    installment_count: participant.installment_count !== undefined && participant.installment_count !== null
      ? Number(participant.installment_count)
      : null,
    status: String(participant.status ?? '1'),
    is_disabled: participant.is_disabled === '1' || participant.is_disabled === true
  }
  participantDialogOpen.value = true
}

const parsedParticipantMetadata = computed(() => {
  if (!selectedParticipantDetails.value?.benefit_metadata) return {}
  const raw = selectedParticipantDetails.value.benefit_metadata
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return (raw as Record<string, any>) || {}
})

function openParticipantDetails(participant: ParticipantItem): void {
  selectedParticipantDetails.value = participant
  detailsDialogOpen.value = true
}

function promptDeleteParticipant(participant: ParticipantItem): void {
  participantToDelete.value = participant
  deleteDialogOpen.value = true
}

async function handleConfirmDeleteParticipant(): Promise<void> {
  if (!participantToDelete.value || !branchesStore.activeBranchId || !groupId.value) return
  isDeletingParticipant.value = true
  try {
    await apiDeleteParticipant(
      branchesStore.activeBranchId,
      groupId.value,
      participantToDelete.value.id
    )
    showMessage('Participante retirado exitosamente del grupo.')
    deleteDialogOpen.value = false
    participantToDelete.value = null
    participantsQuery.refresh()
    loadGroupDetails()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al eliminar participante.')
    showMessage(msg, 'error')
  } finally {
    isDeletingParticipant.value = false
  }
}

async function handleSaveParticipant(): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) {
    showMessage('Selecciona una sucursal activa válida.', 'error')
    return
  }
  if (!participantFormData.value.client_id) {
    showMessage('Selecciona el cliente suscriptor.', 'error')
    return
  }

  isSubmittingParticipant.value = true
  try {
    const customFrequencyId =
      participantFormData.value.frequency_id &&
      String(participantFormData.value.frequency_id) !== String(currentGroup.value?.frequency_id)
        ? Number(participantFormData.value.frequency_id)
        : null

    const customBaseDate =
      participantFormData.value.frequency_base_date &&
      participantFormData.value.frequency_base_date !== currentGroup.value?.frequency_base_date
        ? participantFormData.value.frequency_base_date
        : null

    const customAmount =
      participantFormData.value.installment_amount !== null &&
      participantFormData.value.installment_amount !== undefined &&
      Number(participantFormData.value.installment_amount) !== Number(currentGroup.value?.installment_amount)
        ? Number(participantFormData.value.installment_amount)
        : null

    const customCount =
      participantFormData.value.installment_count !== null &&
      participantFormData.value.installment_count !== undefined &&
      Number(participantFormData.value.installment_count) !== Number(currentGroup.value?.installment_count)
        ? Number(participantFormData.value.installment_count)
        : null

    const payload = {
      client_id: Number(participantFormData.value.client_id),
      referrer_id: participantFormData.value.referrer_id ? Number(participantFormData.value.referrer_id) : undefined,
      position: participantFormData.value.position ? Number(participantFormData.value.position) : undefined,
      frequency_id: customFrequencyId,
      frequency_base_date: customBaseDate,
      installment_amount: customAmount,
      installment_count: customCount,
      status: participantFormData.value.status,
      is_disabled: participantFormData.value.is_disabled ? '1' : '0'
    }

    if (editingParticipantId.value) {
      await apiUpdateParticipant(
        branchesStore.activeBranchId,
        groupId.value,
        editingParticipantId.value,
        payload
      )
      showMessage('Participante actualizado exitosamente.')
    } else {
      await apiCreateParticipant(
        branchesStore.activeBranchId,
        groupId.value,
        payload
      )
      showMessage('Participante incorporado exitosamente al grupo.')
    }

    participantDialogOpen.value = false
    participantsQuery.refresh()
    loadGroupDetails()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al guardar participante.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingParticipant.value = false
  }
}

// ---------------------------------------------------------------------
// 3. Generar Cuotas del Grupo
// ---------------------------------------------------------------------
const isGeneratingQuotes = ref(false)

async function handleGenerateGroupReceivables(): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isGeneratingQuotes.value = true
  try {
    const res = await financingStore.generateGroupReceivables(branchesStore.activeBranchId, groupId.value)
    showMessage(`Cronograma masivo generado. Cuotas generadas: ${res.generated || 0}`)
    participantsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al generar cuotas del grupo.')
    showMessage(msg, 'error')
  } finally {
    isGeneratingQuotes.value = false
  }
}

// ---------------------------------------------------------------------
// 4. Diálogo de Estado de Cuenta / Cartola por Participante
// ---------------------------------------------------------------------
const statementDialogOpen = ref(false)
const selectedParticipant = ref<ParticipantItem | null>(null)

function openQuotesDialog(participant: ParticipantItem): void {
  selectedParticipant.value = participant
  statementDialogOpen.value = true
}

// ---------------------------------------------------------------------
// 6. Emisión y Descarga de Contrato para Participante
// ---------------------------------------------------------------------
const isEmittingContract = ref(false)
const isLoadingContractPdf = ref<Record<string | number, boolean>>({})

async function handleDownloadContractPdf(participant: ParticipantItem): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isLoadingContractPdf.value[participant.id] = true
  try {
    const blob = await fetchContractPdf(branchesStore.activeBranchId, groupId.value, participant.id)
    const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    const newWindow = window.open(blobUrl, '_blank')
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `Contrato-Turno-${participant.position || participant.id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000)
  } catch (err: unknown) {
    const errorObj = err as any
    if (errorObj?.response?.status === 404) {
      showMessage('El participante aún no tiene un contrato emitido. Use "Emitir Contrato" primero.', 'warning')
    } else {
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.messages?.error ||
        errorObj?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Error al obtener el PDF del contrato.')
      showMessage(msg, 'error')
    }
  } finally {
    isLoadingContractPdf.value[participant.id] = false
  }
}

async function handleEmitContract(participant: ParticipantItem): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isEmittingContract.value = true
  try {
    await emitContract(branchesStore.activeBranchId, groupId.value, participant.id)
    showMessage(`Contrato emitido exitosamente para el suscriptor turno #${participant.position}. Abriendo PDF...`)
    participantsQuery.refresh()
    await handleDownloadContractPdf(participant)
  } catch (err: unknown) {
    const errorObj = err as any
    if (errorObj?.response?.data?.error === 'CONTRACT_ALREADY_EXISTS') {
      showMessage('El contrato ya fue emitido previamente. Abriendo PDF...', 'info')
      await handleDownloadContractPdf(participant)
    } else {
      const msg =
        errorObj?.response?.data?.message ||
        errorObj?.response?.data?.messages?.error ||
        errorObj?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Error al emitir contrato.')
      showMessage(msg, 'error')
    }
  } finally {
    isEmittingContract.value = false
  }
}

// ---------------------------------------------------------------------
// 7. Feedback y Reactividad
// ---------------------------------------------------------------------
const snackbar = ref<{
  show: boolean
  text: string
  color: 'success' | 'error' | 'warning' | 'info'
}>({

  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
  if (snackbar.value.show) {
    snackbar.value.show = false
    setTimeout(() => {
      snackbar.value = { show: true, text, color }
    }, 80)
  } else {
    snackbar.value = { show: true, text, color }
  }
}

watch(
  () => branchesStore.activeBranchId,
  (newBranchId) => {
    if (newBranchId) {
      loadGroupDetails()
      participantsQuery.refresh()
    }
  }
)

onMounted(() => {
  loadGroupDetails()
})
</script>

<template>
  <div class="group-participants-module">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      title="Sucursal no seleccionada"
      text="Para gestionar participantes debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert"
    />

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: TÍTULO Y BOTONES DE ACCIÓN                   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-9">
      <div class="d-flex align-center">
        <v-btn
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          class="mr-3"
          title="Volver a lista de grupos"
          data-testid="btn-back-to-groups"
          @click="router.push('/financing/groups')"
        />
        <div>
          <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
            {{ currentGroup?.name || `Grupo #${groupId}` }}
          </h1>
        </div>
      </div>

      <!-- Botones de Acción de Nivel de Grupo -->
      <div class="d-flex align-center ga-2 flex-wrap">
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-calculator"
          class="text-none font-weight-bold"
          :loading="isGeneratingQuotes"
          data-testid="btn-generate-group-quotes"
          @click="handleGenerateGroupReceivables"
        >
          Generar Cuotas
        </v-btn>

        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-create-participant"
          @click="openCreateParticipantDialog"
        >
          Nuevo Participante
        </v-btn>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA (SECCIÓN SOLA, 7 COLS)   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-3">
      <v-col cols="12" md="7">
        <v-text-field
          v-model="participantsQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar participante por nombre o turno..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="participant-search-input"
        />
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TERCERA SECCIÓN: FILTROS DE ESTADO Y BOTÓN DE RECARGA        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
      <!-- Chips alineados a la izquierda -->
      <div class="d-flex align-center flex-wrap ga-2">
        <AppChipFilter
          field="status"
          :items="statusOptions"
          all-text="Todos"
          color="primary"
          density="comfortable"
          @change="handleStatusFilterChange"
        />
      </div>

      <!-- Botón de recarga a la derecha con Tooltip -->
      <v-tooltip
        text="Recargar la tabla"
        location="top"
        color="#1E293B"
      >
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-refresh"
            variant="flat"
            color="white"
            size="small"
            class="border rounded-circle flex-shrink-0"
            :loading="participantsQuery.isLoading.value"
            data-testid="btn-refresh-participants"
            @click="participantsQuery.refresh()"
          />
        
  <!-- Modal: Datos del Beneficio -->
  <AppModal
    v-model="benefitDialogOpen"
    title="Datos del Beneficio"
    :subtitle="selectedBenefitParticipant ? `Especificaciones del beneficio para ${selectedBenefitParticipant.client_first_name} ${selectedBenefitParticipant.client_last_name || ''}` : 'Especificaciones del beneficio adjudicable'"
    max-width="580"
    persistent
    :loading="isSubmittingBenefit"
    submit-text="Guardar Beneficio"
    submit-icon="mdi-check"
    form-id="form-participant-benefit"
    @submit="handleSaveBenefit"
  >
    <v-form id="form-participant-benefit" @submit.prevent="handleSaveBenefit">
      <div v-if="isLoadingSchema" class="py-4 text-center">
        <v-progress-circular indeterminate color="primary" size="28" />
        <div class="text-caption text-medium-emphasis mt-2">Cargando campos del beneficio...</div>
      </div>
      <div v-else-if="contractMetadataSchema && Object.keys(contractMetadataSchema.fields || {}).length > 0">
        <AppMetadataRenderer
          :schema="contractMetadataSchema"
          v-model="benefitFormData"
          density="comfortable"
          display-mode="flat"
        />
      </div>
      <div v-else class="text-caption text-medium-emphasis py-4 text-center">
        Este tipo de contrato no tiene campos dinámicos de beneficio configurados.
      </div>
    </v-form>
  </AppModal>

</template>
      </v-tooltip>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CUARTA SECCIÓN: TABLA CON FONDO BLANCO Y ACCIONES            -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="participantsQuery.itemsPerPage.value"
        v-model:page="participantsQuery.page.value"
        v-model:sort-by="participantsQuery.sortBy.value"
        :headers="participantHeaders"
        :items="participantsQuery.items.value"
        :items-length="participantsQuery.totalItems.value"
        :loading="participantsQuery.isLoading.value"
        no-data-text="No hay datos disponibles"
        loading-text="Cargando participantes..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="participants-table"
        @update:options="participantsQuery.onUpdateOptions"
      >
        <template #[`item.position`]="{ item }">
          <v-chip size="small" color="primary" variant="tonal" label class="font-weight-bold">
            Turno #{{ item.position }}
          </v-chip>
        </template>

        <template #[`item.client`]="{ item }">
          <div class="d-flex align-center">
            <v-avatar color="primary" size="32" class="mr-2 text-caption text-white font-weight-bold elevation-1">
              {{ (item.client_first_name?.[0] || 'C').toUpperCase() }}
            </v-avatar>
            <div>
              <div class="font-weight-bold text-body-2 text-high-emphasis">
                {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || '' }}
              </div>
              <div class="text-caption text-medium-emphasis">
                ID: #{{ item.client_id }}
              </div>
            </div>
          </div>
        </template>

        <template #[`item.referrer`]="{ item }">
          <span v-if="item.referrer_first_name" class="text-body-2 text-high-emphasis font-weight-medium">
            {{ item.referrer_first_name }} {{ item.referrer_last_name || '' }}
          </span>
          <span v-else class="text-caption text-medium-emphasis">Sin asignar</span>
        </template>

        <template #[`item.status`]="{ item }">
          <v-chip
            size="small"
            :color="item.status === '1' ? 'success' : item.status === '2' ? 'grey' : 'info'"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ item.status === '1' ? 'Activo' : item.status === '2' ? 'Retirado' : 'Espera' }}
          </v-chip>
        </template>

        <template #[`item.is_overdue`]="{ item }">
          <v-chip
            size="small"
            :color="item.is_overdue === '1' || item.is_overdue === 1 ? 'error' : 'success'"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ item.is_overdue === '1' || item.is_overdue === 1 ? 'En Mora' : 'Al Día' }}
          </v-chip>
        </template>

        <template #[`item.awarded_at`]="{ item }">
          <span v-if="item.awarded_at" class="text-caption text-success font-weight-bold d-inline-flex align-center">
            <v-icon icon="mdi-check-decagram" size="small" color="success" class="mr-1" />
            {{ item.awarded_at }}
          </span>
          <span v-else class="text-caption text-medium-emphasis">Pendiente</span>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center justify-end">
            <v-menu location="bottom end">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="small"
                  color="medium-emphasis"
                  data-testid="btn-participant-actions-menu"
                />
              </template>
              <v-list density="compact" rounded="md" elevation="4" class="py-1 min-w-160">
                <!-- 1. Ver Detalles -->
                <v-list-item
                  prepend-icon="mdi-eye-outline"
                  title="Ver Detalles"
                  data-testid="menu-item-participant-details"
                  @click="openParticipantDetails(item)"
                />

                <!-- 2. Estado de Cuenta / Cartola -->
                <v-list-item
                  prepend-icon="mdi-file-document-outline"
                  title="Estado de Cuenta / Cartola"
                  data-testid="menu-item-view-quotes"
                  @click="openQuotesDialog(item)"
                />

                <!-- 3. Ver / Imprimir Contrato (PDF) -->
                <v-list-item
                  prepend-icon="mdi-file-pdf-box"
                  title="Ver Contrato (PDF)"
                  data-testid="menu-item-view-contract-pdf"
                  :loading="isLoadingContractPdf[item.id]"
                  @click="handleDownloadContractPdf(item)"
                />

                <!-- 4. Emitir Contrato Oficial -->
                <v-list-item
                  prepend-icon="mdi-file-certificate-outline"
                  title="Emitir Contrato"
                  data-testid="menu-item-emit-contract"
                  :loading="isEmittingContract"
                  @click="handleEmitContract(item)"
                />

                <v-divider class="my-1" />

                <!-- 4. Datos del Beneficio -->
                <v-list-item
                  prepend-icon="mdi-gift-outline"
                  title="Datos del Beneficio"
                  data-testid="menu-item-participant-benefit"
                  @click="openBenefitDialog(item)"
                />

                <!-- 5. Modificar Participante -->
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar Participante"
                  data-testid="menu-item-edit-participant"
                  @click="openEditParticipantDialog(item)"
                />

                <!-- 5. Eliminación / Retiro -->
                <v-list-item
                  prepend-icon="mdi-trash-can-outline"
                  title="Eliminar"
                  base-color="error"
                  data-testid="menu-item-delete-participant"
                  @click="promptDeleteParticipant(item)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table-server>
    </v-card>
  </div>

  <!-- Modal: Inscribir / Editar Participante -->
  <AppModal
    v-model="participantDialogOpen"
    :title="editingParticipantId ? 'Editar Participante' : 'Nuevo Participante'"
    :subtitle="editingParticipantId ? 'Modifica los parámetros y especificaciones del participante' : 'Asigna un cliente suscriptor y su número de turno en el grupo'"
    max-width="540"
    persistent
    :loading="isSubmittingParticipant"
    :submit-text="editingParticipantId ? 'Guardar Cambios' : 'Inscribir Participante'"
    :submit-icon="editingParticipantId ? 'mdi-check' : 'mdi-plus'"
    form-id="form-register-participant"
    @submit="handleSaveParticipant"
  >
    <v-form id="form-register-participant" @submit.prevent="handleSaveParticipant">
      <!-- 1. Cliente Suscriptor con AppPaginatedSelect -->
      <v-row density="compact" class="mb-1">
        <v-col cols="12">
          <AppPaginatedSelect
            v-model="participantFormData.client_id"
            :fetch-options="fetchPersonsOptions"
            :fetch-by-id="fetchPersonSingle"
            label="Cliente Suscriptor *"
            placeholder="Buscar por nombre, apellido o cédula..."
            value-key="id"
            label-key="name"
            :disabled="Boolean(editingParticipantId)"
            density="comfortable"
            data-testid="select-participant-client"
          />
        </v-col>
      </v-row>

      <!-- 2. Contacto Referente ($15) y Posición -->
      <v-row density="compact" class="mb-1">
        <v-col cols="12" sm="8">
          <AppPaginatedSelect
            v-model="participantFormData.referrer_id"
            :fetch-options="fetchPersonsOptions"
            :fetch-by-id="fetchPersonSingle"
            label="Contacto Referente"
            placeholder="Buscar persona referente..."
            value-key="id"
            label-key="name"
            clearable
            density="comfortable"
            data-testid="select-participant-referrer"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model.number="participantFormData.position"
            label="Turno Asignado"
            placeholder="Ej: 1"
            type="number"
            min="1"
            max="99"
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-position"
          />
        </v-col>
      </v-row>

      <!-- 3. Estado Inicial -->
      <v-row density="compact" class="mb-1">
        <v-col cols="12">
          <v-select
            v-model="participantFormData.status"
            :items="[
              { title: 'Activo', value: '1' },
              { title: 'En Espera', value: '0' },
              { title: 'Retirado', value: '2' }
            ]"
            item-title="title"
            item-value="value"
            label="Estado Inicial"
            variant="outlined"
            density="comfortable"
            data-testid="select-participant-status"
          />
        </v-col>
      </v-row>

      <!-- 4. Condiciones Financieras (Personalización Opcional) -->
      <v-divider class="my-3" />
      <div class="text-subtitle-2 font-weight-bold text-medium-emphasis mb-2">
        Condiciones Financieras (Opcional)
      </div>
      <v-row density="compact" class="mb-1">
        <v-col cols="12" sm="6">
          <AppPaginatedSelect
            v-model="participantFormData.frequency_id"
            :fetch-options="fetchFrequenciesOptions"
            :fetch-by-id="fetchFrequencySingle"
            label="Frecuencia de Pago"
            :placeholder="`Por defecto: ${currentGroup?.frequency_name ? formatLocalized(currentGroup.frequency_name) : 'Grupo'}`"
            :hint="`Hereda del grupo si se deja vacío (${currentGroup?.frequency_name ? formatLocalized(currentGroup.frequency_name) : 'N/A'})`"
            persistent-hint
            value-key="id"
            label-key="name"
            clearable
            density="comfortable"
            data-testid="select-participant-frequency"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="participantFormData.frequency_base_date"
            label="Fecha Base de Cobro"
            type="date"
            :hint="`Hereda del grupo: ${currentGroup?.frequency_base_date || 'N/A'}`"
            persistent-hint
            clearable
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-base-date"
          />
        </v-col>
      </v-row>
      <v-row density="compact" class="mb-1">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="participantFormData.installment_amount"
            label="Cuota Regular ($)"
            type="number"
            min="1"
            step="0.01"
            :placeholder="currentGroup?.installment_amount ? `${currentGroup.installment_amount}` : ''"
            :hint="`Hereda del grupo: ${Number(currentGroup?.installment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`"
            persistent-hint
            clearable
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-installment-amount"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="participantFormData.installment_count"
            label="Total de Cuotas"
            type="number"
            min="1"
            max="99"
            :placeholder="currentGroup?.installment_count ? `${currentGroup.installment_count}` : ''"
            :hint="`Hereda del grupo: ${currentGroup?.installment_count || 'N/A'} cuotas`"
            persistent-hint
            clearable
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-installment-count"
          />
        </v-col>
      </v-row>
    </v-form>
  </AppModal>

  <!-- Modal: Ver Detalles del Participante -->
  <AppModal
    v-model="detailsDialogOpen"
    title="Detalles del Participante"
    subtitle="Información completa de auditoría y condiciones del suscriptor"
    max-width="600"
    cancel-text="Cerrar"
    submit-text="Editar Participante"
    submit-icon="mdi-pencil"
    @submit="selectedParticipantDetails && (detailsDialogOpen = false, openEditParticipantDialog(selectedParticipantDetails))"
  >
    <div v-if="selectedParticipantDetails" class="d-flex flex-column ga-4">
      <!-- Identificación Principal -->
      <div class="pa-4 rounded-lg bg-surface-variant d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <div class="text-caption text-medium-emphasis">Suscriptor Titular</div>
          <div class="text-h6 font-weight-bold text-high-emphasis">
            {{ selectedParticipantDetails.client_first_name || 'Cliente' }} {{ selectedParticipantDetails.client_last_name || '' }}
          </div>
          <div class="text-caption text-medium-emphasis mt-0.5">
            ID Suscripción: #{{ selectedParticipantDetails.id }} &bull; Turno #{{ selectedParticipantDetails.position }}
          </div>
        </div>
        <v-chip
          size="small"
          :color="selectedParticipantDetails.status === '1' ? 'success' : selectedParticipantDetails.status === '2' ? 'grey' : 'info'"
          variant="flat"
          class="font-weight-bold"
        >
          {{ selectedParticipantDetails.status === '1' ? 'Activo' : selectedParticipantDetails.status === '2' ? 'Retirado' : 'En Espera' }}
        </v-chip>
      </div>

      <!-- Métricas del Participante -->
      <v-row density="compact">
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Turno Asignado</div>
            <div class="text-subtitle-1 font-weight-bold text-primary mt-1">
              #{{ selectedParticipantDetails.position }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Valor Cuota</div>
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mt-1">
              ${{ Number(selectedParticipantDetails.installment_amount || currentGroup?.installment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Solvencia</div>
            <div class="text-subtitle-1 font-weight-bold mt-1" :class="selectedParticipantDetails.is_overdue === '1' ? 'text-error' : 'text-success'">
              {{ selectedParticipantDetails.is_overdue === '1' ? 'En Mora' : 'Al Día' }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Adjudicación</div>
            <div class="text-subtitle-1 font-weight-bold text-info mt-1">
              {{ selectedParticipantDetails.awarded_at ? 'Adjudicado' : 'Pendiente' }}
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Parámetros Operativos -->
      <div class="border rounded-lg overflow-hidden">
        <v-table density="compact">
          <tbody>
            <tr>
              <td class="font-weight-medium text-medium-emphasis w-50">Grupo Perteneciente</td>
              <td class="font-weight-bold text-high-emphasis">
                {{ currentGroup?.name || `#${groupId}` }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-medium text-medium-emphasis">Contacto Referente</td>
              <td class="text-high-emphasis">
                {{ selectedParticipantDetails.referrer_first_name ? `${selectedParticipantDetails.referrer_first_name} ${selectedParticipantDetails.referrer_last_name || ''}` : 'Sin asignar' }}
              </td>
            </tr>
            <tr v-if="selectedParticipantDetails.installment_amount">
              <td class="font-weight-medium text-medium-emphasis">Cuota Regular</td>
              <td class="text-high-emphasis font-weight-bold">
                ${{ Number(selectedParticipantDetails.installment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
              </td>
            </tr>
            <tr v-if="selectedParticipantDetails.installment_count">
              <td class="font-weight-medium text-medium-emphasis">Total de Cuotas</td>
              <td class="text-high-emphasis">
                {{ selectedParticipantDetails.installment_count }}
              </td>
            </tr>
            <tr v-if="selectedParticipantDetails.frequency_base_date">
              <td class="font-weight-medium text-medium-emphasis">Fecha Base de Cobro</td>
              <td class="text-high-emphasis">
                {{ selectedParticipantDetails.frequency_base_date }}
              </td>
            </tr>
            <!-- Campos del Beneficio Dinámicos -->
            <template v-if="contractMetadataSchema?.fields && Object.keys(contractMetadataSchema.fields).length > 0">
              <tr v-for="(fieldDef, fieldKey) in contractMetadataSchema.fields" :key="fieldKey">
                <td class="font-weight-medium text-medium-emphasis">
                  {{ getFieldLabel(fieldDef) }}
                </td>
                <td class="text-high-emphasis">
                  {{ parsedParticipantMetadata[fieldDef.code] || '-' }}
                </td>
              </tr>
            </template>
            <template v-else-if="Object.keys(parsedParticipantMetadata).length > 0">
              <tr v-for="(val, key) in parsedParticipantMetadata" :key="key">
                <td class="font-weight-medium text-medium-emphasis text-capitalize">{{ key }}</td>
                <td class="text-high-emphasis">{{ val || '-' }}</td>
              </tr>
            </template>
          </tbody>
        </v-table>
      </div>

      <!-- Datos de Auditoría -->
      <div class="border rounded-lg pa-3 bg-surface-variant">
        <div class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase" style="letter-spacing: 0.05em;">
          Auditoría de Registro
        </div>
        <div class="d-flex flex-column ga-1 text-caption">
          <div class="d-flex justify-space-between">
            <span class="text-medium-emphasis">Fecha de Creación:</span>
            <span class="font-weight-medium text-high-emphasis">{{ selectedParticipantDetails.created_at || 'N/A' }}</span>
          </div>
          <div class="d-flex justify-space-between">
            <span class="text-medium-emphasis">Última Modificación:</span>
            <span class="font-weight-medium text-high-emphasis">{{ selectedParticipantDetails.updated_at || 'Sin modificaciones' }}</span>
          </div>
        </div>
      </div>
    </div>
    <template #prepend-actions>
      <v-btn
        v-if="selectedParticipantDetails"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-file-pdf-box"
        class="text-none font-weight-bold"
        :loading="isLoadingContractPdf[selectedParticipantDetails.id]"
        @click="handleDownloadContractPdf(selectedParticipantDetails)"
      >
        Ver Contrato (PDF)
      </v-btn>
    </template>
  </AppModal>

  <!-- Modal: Confirmar Eliminación del Participante -->
  <AppModal
    v-model="deleteDialogOpen"
    title="Eliminar Participante"
    subtitle="Esta acción retirará al suscriptor del grupo activo"
    max-width="460"
    :loading="isDeletingParticipant"
    submit-text="Sí, Eliminar"
    submit-color="error"
    submit-icon="mdi-trash-can"
    @submit="handleConfirmDeleteParticipant"
  >
    <div class="py-2">
      <p class="text-body-2 text-high-emphasis mb-3">
        ¿Estás seguro de que deseas retirar del grupo al participante
        <strong>{{ participantToDelete?.client_first_name }} {{ participantToDelete?.client_last_name }}</strong>
        (Turno #{{ participantToDelete?.position }})?
      </p>
      <v-alert
        type="warning"
        variant="tonal"
        density="compact"
        text="El cupo quedará libre o cancelado según las reglas de amortización del grupo."
        rounded="lg"
      />
    </div>
  </AppModal>

  <!-- Modal: Estado de Cuenta / Cartola (Amortización y Recaudación) -->
  <StatementModal
    v-model="statementDialogOpen"
    :participant-id="selectedParticipant?.id || null"
    :group-id="groupId"
  />

  <!-- Snackbar de Notificaciones -->
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    :timeout="3500"
    location="bottom right"
    data-testid="financing-snackbar"
  >
    {{ snackbar.text }}
  </v-snackbar>
</template>
