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
  fetchQualifiedParticipants,
  fetchReceivables,
  emitContract
} from '../api/financing.api'
import type {
  SamGroupItem,
  ParticipantItem,
  ReceivableItem,
  QualifiedParticipantItem
} from '../types'
import type { DqbFilterTuple } from '@/types/query'
import AppPaginatedSelect, { type PaginatedQueryParams } from '@/components/common/AppPaginatedSelect.vue'
import { fetchPersons, fetchPersonById } from '@/modules/catalogs/api/catalogs.api'
import type { PersonItem } from '@/modules/catalogs/types'

const route = useRoute()
const router = useRouter()
const branchesStore = useBranchesStore()
const financingStore = useFinancingStore()

const groupId = computed(() => String(route.params.groupId || ''))
const currentGroup = ref<SamGroupItem | null>(null)
const isLoadingGroup = ref(false)

async function loadGroupDetails(): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isLoadingGroup.value = true
  try {
    const res = await fetchSamGroupById(branchesStore.activeBranchId, groupId.value)
    currentGroup.value = res.data || null
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
  { title: 'Asesor', key: 'advisor', align: 'start' as const, sortable: false, width: '180px' },
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
  advisor_id: number | null
  position: number | null
  status: string
  vehicle_brand: string
  vehicle_model: string
  vehicle_year: number | null
  vehicle_reference_value: number | null
  color: string
  chassis: string
  plate: string
  is_disabled: boolean
}>({
  client_id: null,
  advisor_id: null,
  position: null,
  status: '1',
  vehicle_brand: '',
  vehicle_model: '',
  vehicle_year: null,
  vehicle_reference_value: null,
  color: '',
  chassis: '',
  plate: '',
  is_disabled: false
})

function openCreateParticipantDialog(): void {
  editingParticipantId.value = null
  participantFormData.value = {
    client_id: null,
    advisor_id: null,
    position: null,
    status: '1',
    vehicle_brand: '',
    vehicle_model: '',
    vehicle_year: new Date().getFullYear(),
    vehicle_reference_value: currentGroup.value ? Number(currentGroup.value.amount) : null,
    color: '',
    chassis: '',
    plate: '',
    is_disabled: false
  }
  participantDialogOpen.value = true
}

function openEditParticipantDialog(participant: ParticipantItem): void {
  editingParticipantId.value = participant.id
  let metadata: Record<string, any> = {}
  if (typeof participant.benefit_metadata === 'string') {
    try {
      metadata = JSON.parse(participant.benefit_metadata)
    } catch {
      metadata = {}
    }
  } else if (participant.benefit_metadata) {
    metadata = participant.benefit_metadata as Record<string, any>
  }

  participantFormData.value = {
    client_id: Number(participant.client_id),
    advisor_id: participant.advisor_id ? Number(participant.advisor_id) : null,
    position: participant.position ? Number(participant.position) : null,
    status: String(participant.status ?? '1'),
    vehicle_brand: metadata.brand || '',
    vehicle_model: metadata.model || metadata.vehicle_model || '',
    vehicle_year: metadata.year ? Number(metadata.year) : null,
    vehicle_reference_value: metadata.reference_value ? Number(metadata.reference_value) : null,
    color: metadata.color || '',
    chassis: metadata.chassis_serial || metadata.chassis || '',
    plate: metadata.plate || '',
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
  if (!participantFormData.value.vehicle_brand?.trim()) {
    showMessage('Ingresa la marca del vehículo adjudicable.', 'error')
    return
  }
  if (!participantFormData.value.vehicle_model?.trim()) {
    showMessage('Ingresa el modelo del vehículo adjudicable.', 'error')
    return
  }

  isSubmittingParticipant.value = true
  try {
    const metadata: Record<string, any> = {
      brand: participantFormData.value.vehicle_brand.trim(),
      model: participantFormData.value.vehicle_model.trim(),
      year: Number(participantFormData.value.vehicle_year || new Date().getFullYear()),
      reference_value: participantFormData.value.vehicle_reference_value
        ? Number(participantFormData.value.vehicle_reference_value)
        : Number(currentGroup.value?.amount || 1000)
    }
    if (participantFormData.value.color?.trim()) {
      metadata.color = participantFormData.value.color.trim()
    }
    if (participantFormData.value.chassis?.trim()) {
      metadata.chassis_serial = participantFormData.value.chassis.trim()
    }
    if (participantFormData.value.plate?.trim()) {
      metadata.plate = participantFormData.value.plate.trim()
    }

    if (editingParticipantId.value) {
      await apiUpdateParticipant(
        branchesStore.activeBranchId,
        groupId.value,
        editingParticipantId.value,
        {
          advisor_id: participantFormData.value.advisor_id ? Number(participantFormData.value.advisor_id) : undefined,
          position: participantFormData.value.position ? Number(participantFormData.value.position) : undefined,
          status: participantFormData.value.status,
          benefit_metadata: metadata,
          is_disabled: participantFormData.value.is_disabled ? '1' : '0'
        }
      )
      showMessage('Participante actualizado exitosamente.')
    } else {
      await apiCreateParticipant(
        branchesStore.activeBranchId,
        groupId.value,
        {
          client_id: Number(participantFormData.value.client_id),
          advisor_id: participantFormData.value.advisor_id ? Number(participantFormData.value.advisor_id) : undefined,
          position: participantFormData.value.position ? Number(participantFormData.value.position) : undefined,
          status: participantFormData.value.status,
          benefit_metadata: metadata,
          is_disabled: participantFormData.value.is_disabled ? '1' : '0'
        }
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
// 4. Diálogo de Calificados para Adjudicación
// ---------------------------------------------------------------------
const qualifiedDialogOpen = ref(false)
const isLoadingQualified = ref(false)
const qualifiedList = ref<QualifiedParticipantItem[]>([])

async function openQualifiedDialog(): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  qualifiedDialogOpen.value = true
  isLoadingQualified.value = true
  try {
    const res = await fetchQualifiedParticipants(branchesStore.activeBranchId, groupId.value)
    qualifiedList.value = res.data || []
  } catch (err: unknown) {
    console.error('Error al cargar calificados:', err)
    qualifiedList.value = []
  } finally {
    isLoadingQualified.value = false
  }
}

// ---------------------------------------------------------------------
// 5. Diálogo de Cronograma de Cuotas por Participante
// ---------------------------------------------------------------------
const quotesDialogOpen = ref(false)
const selectedParticipant = ref<ParticipantItem | null>(null)
const participantQuotes = ref<ReceivableItem[]>([])
const isLoadingQuotes = ref(false)

const quoteHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, width: '70px' },
  { title: 'Concepto / Glosa', key: 'concept_name', align: 'start' as const },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, width: '130px' },
  { title: 'Monto Total', key: 'total_amount', align: 'end' as const, width: '120px' },
  { title: 'Monto Cobrado', key: 'paid_amount', align: 'end' as const, width: '120px' },
  { title: 'Saldo Deudor', key: 'balance_amount', align: 'end' as const, width: '120px' },
  { title: 'Estado', key: 'status', align: 'center' as const, width: '120px' }
]

const quotesSummary = computed(() => {
  const total = participantQuotes.value.reduce((acc, q) => acc + Number(q.total_amount || 0), 0)
  const paid = participantQuotes.value.reduce((acc, q) => acc + Number(q.paid_amount || 0), 0)
  const balance = participantQuotes.value.reduce((acc, q) => acc + Number(q.balance_amount || 0), 0)
  return { total, paid, balance }
})

async function openQuotesDialog(participant: ParticipantItem): Promise<void> {
  selectedParticipant.value = participant
  quotesDialogOpen.value = true
  await loadQuotesForParticipant(participant)
}

async function loadQuotesForParticipant(participant: ParticipantItem): Promise<void> {
  if (!branchesStore.activeBranchId) return
  isLoadingQuotes.value = true
  try {
    const res = await fetchReceivables(branchesStore.activeBranchId, {
      itemsPerPage: 100,
      filters: [
        ['origin_type', 0, '=', 'AND'],
        ['origin_id', participant.id, '=', 'AND']
      ]
    })
    participantQuotes.value = res.data || []
  } catch (err: unknown) {
    console.error('Error al cargar cuotas:', err)
    participantQuotes.value = []
  } finally {
    isLoadingQuotes.value = false
  }
}

async function handleGenerateParticipantQuotes(): Promise<void> {
  if (!branchesStore.activeBranchId || !selectedParticipant.value) return
  isLoadingQuotes.value = true
  try {
    const res = await financingStore.generateParticipantReceivables(
      branchesStore.activeBranchId,
      groupId.value,
      selectedParticipant.value.id
    )
    showMessage(`Cronograma de cuotas emitido. Cuotas generadas: ${res.generated || 0}`)
    await loadQuotesForParticipant(selectedParticipant.value)
    participantsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al generar cuotas del participante.')
    showMessage(msg, 'error')
  } finally {
    isLoadingQuotes.value = false
  }
}

// ---------------------------------------------------------------------
// 6. Emisión de Contrato para Participante
// ---------------------------------------------------------------------
const isEmittingContract = ref(false)

async function handleEmitContract(participant: ParticipantItem): Promise<void> {
  if (!branchesStore.activeBranchId || !groupId.value) return
  isEmittingContract.value = true
  try {
    await emitContract(branchesStore.activeBranchId, groupId.value, participant.id)
    showMessage(`Contrato emitido exitosamente para el suscriptor turno #${participant.position}.`)
    participantsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al emitir contrato.')
    showMessage(msg, 'error')
  } finally {
    isEmittingContract.value = false
  }
}

// ---------------------------------------------------------------------
// 7. Feedback y Reactividad
// ---------------------------------------------------------------------
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' = 'success'): void {
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
          <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
            Monto: <strong>${{ Number(currentGroup?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong> &bull;
            Cuota: <strong>${{ Number(currentGroup?.installment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</strong> &bull;
            Cuotas: <strong>{{ currentGroup?.installment_count || 0 }}</strong> &bull;
            Participantes: <strong>{{ participantsQuery.totalItems.value }} / {{ currentGroup?.participant_max || 24 }}</strong>
          </p>
        </div>
      </div>

      <!-- Botones de Acción de Nivel de Grupo -->
      <div class="d-flex align-center ga-2 flex-wrap">
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-trophy-outline"
          class="text-none font-weight-bold"
          data-testid="btn-view-qualified"
          @click="openQualifiedDialog"
        >
          Ver Calificados
        </v-btn>

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
    <v-row dense class="mb-3">
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

        <template #[`item.advisor`]="{ item }">
          <span v-if="item.advisor_first_name" class="text-body-2 text-high-emphasis font-weight-medium">
            {{ item.advisor_first_name }} {{ item.advisor_last_name || '' }}
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

                <!-- 2. Cronograma de Cuotas -->
                <v-list-item
                  prepend-icon="mdi-calendar-clock"
                  title="Cronograma de Cuotas"
                  data-testid="menu-item-view-quotes"
                  @click="openQuotesDialog(item)"
                />

                <!-- 3. Emitir Contrato Oficial -->
                <v-list-item
                  prepend-icon="mdi-file-certificate-outline"
                  title="Emitir Contrato"
                  data-testid="menu-item-emit-contract"
                  @click="handleEmitContract(item)"
                />

                <v-divider class="my-1" />

                <!-- 4. Modificar Participante -->
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
      <v-row dense class="mb-1">
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

      <!-- 2. Asesor de Ventas y Posición -->
      <v-row dense class="mb-1">
        <v-col cols="12" sm="8">
          <AppPaginatedSelect
            v-model="participantFormData.advisor_id"
            :fetch-options="fetchPersonsOptions"
            :fetch-by-id="fetchPersonSingle"
            label="Asesor de Ventas (Opcional)"
            placeholder="Buscar asesor..."
            value-key="id"
            label-key="name"
            clearable
            density="comfortable"
            data-testid="select-participant-advisor"
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

      <!-- 3. Estado Inicial y Marca -->
      <v-row dense class="mb-1">
        <v-col cols="12" sm="6">
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
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="participantFormData.vehicle_brand"
            label="Marca del Vehículo *"
            placeholder="Ej: Bera, Empire, etc."
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-brand"
          />
        </v-col>
      </v-row>

      <!-- 4. Modelo y Año -->
      <v-row dense class="mb-1">
        <v-col cols="12" sm="8">
          <v-text-field
            v-model="participantFormData.vehicle_model"
            label="Modelo del Vehículo *"
            placeholder="Ej: SBR 150cc, Express 150..."
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-model"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model.number="participantFormData.vehicle_year"
            label="Año *"
            placeholder="Ej: 2024"
            type="number"
            min="1900"
            max="2100"
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-year"
          />
        </v-col>
      </v-row>

      <!-- 5. Color y Serial de Chasis -->
      <v-row dense class="mb-1">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="participantFormData.color"
            label="Color Seleccionado"
            placeholder="Ej: Azul, Rojo, Negro..."
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-color"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="participantFormData.chassis"
            label="Serial de Chasis"
            placeholder="Ej: 8X1234567890ABCD"
            variant="outlined"
            density="comfortable"
            data-testid="input-participant-chassis"
          />
        </v-col>
      </v-row>

      <!-- 6. Placa (Opcional) -->
      <v-text-field
        v-model="participantFormData.plate"
        label="Placa de Rodaje (Opcional)"
        placeholder="Ej: AB1C23D"
        variant="outlined"
        density="comfortable"
        data-testid="input-participant-plate"
      />
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
      <v-row dense>
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
              <td class="font-weight-medium text-medium-emphasis">Asesor Responsable</td>
              <td class="text-high-emphasis">
                {{ selectedParticipantDetails.advisor_first_name ? `${selectedParticipantDetails.advisor_first_name} ${selectedParticipantDetails.advisor_last_name || ''}` : 'Sin asignar' }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-medium text-medium-emphasis">Vehículo Adjudicable</td>
              <td class="text-high-emphasis">
                {{ parsedParticipantMetadata.brand ? `${parsedParticipantMetadata.brand} ${parsedParticipantMetadata.model || ''}` : parsedParticipantMetadata.vehicle_model || 'No especificado' }}
                {{ parsedParticipantMetadata.year ? `(${parsedParticipantMetadata.year})` : '' }}
              </td>
            </tr>
            <tr v-if="parsedParticipantMetadata.color">
              <td class="font-weight-medium text-medium-emphasis">Color</td>
              <td class="text-high-emphasis">
                {{ parsedParticipantMetadata.color }}
              </td>
            </tr>
            <tr v-if="parsedParticipantMetadata.chassis_serial || parsedParticipantMetadata.chassis">
              <td class="font-weight-medium text-medium-emphasis">Serial de Chasis</td>
              <td class="text-high-emphasis font-family-monospace">
                {{ parsedParticipantMetadata.chassis_serial || parsedParticipantMetadata.chassis }}
              </td>
            </tr>
            <tr v-if="parsedParticipantMetadata.plate">
              <td class="font-weight-medium text-medium-emphasis">Placa</td>
              <td class="text-high-emphasis font-weight-bold">
                {{ parsedParticipantMetadata.plate }}
              </td>
            </tr>
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

  <!-- Modal: Cronograma de Cuotas (Amortización) -->
  <AppModal
    v-model="quotesDialogOpen"
    :title="`Cronograma de Cuotas - ${selectedParticipant?.client_first_name || 'Suscriptor'} (Turno #${selectedParticipant?.position || ''})`"
    subtitle="Listado oficial de cuentas por cobrar originadas para el participante"
    max-width="850"
    cancel-text="Cerrar"
    hide-submit
  >
    <!-- Tarjetas de Resumen Financiero -->
    <v-row dense class="mb-3">
      <v-col cols="12" sm="4">
        <div class="border rounded-lg pa-3 bg-surface-variant text-center">
          <div class="text-caption text-medium-emphasis">Total Cronograma</div>
          <div class="text-h6 font-weight-bold text-high-emphasis mt-0.5">
            ${{ quotesSummary.total.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
          </div>
        </div>
      </v-col>
      <v-col cols="12" sm="4">
        <div class="border rounded-lg pa-3 bg-surface-variant text-center">
          <div class="text-caption text-medium-emphasis">Total Cobrado</div>
          <div class="text-h6 font-weight-bold text-success mt-0.5">
            ${{ quotesSummary.paid.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
          </div>
        </div>
      </v-col>
      <v-col cols="12" sm="4">
        <div class="border rounded-lg pa-3 bg-surface-variant text-center">
          <div class="text-caption text-medium-emphasis">Saldo Pendiente</div>
          <div class="text-h6 font-weight-bold text-error mt-0.5">
            ${{ quotesSummary.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
          </div>
        </div>
      </v-col>
    </v-row>

    <div class="d-flex align-center justify-end mb-3">
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-calculator"
        class="text-none font-weight-medium"
        :loading="isLoadingQuotes"
        data-testid="btn-generate-quotes"
        @click="handleGenerateParticipantQuotes"
      >
        Generar Cronograma de Cuotas
      </v-btn>
    </div>

    <v-data-table
      :headers="quoteHeaders"
      :items="participantQuotes"
      :loading="isLoadingQuotes"
      no-data-text="No hay cuotas generadas para este participante"
      density="comfortable"
      hover
      class="border rounded-lg"
      data-testid="quotes-table"
    >
      <template #[`item.concept_name`]="{ item }">
        <span class="font-weight-medium text-body-2 text-high-emphasis">
          {{ item.concept_name || item.description || 'Cuota Periódica' }}
        </span>
      </template>

      <template #[`item.due_date`]="{ item }">
        <span class="text-body-2 text-medium-emphasis">
          {{ item.due_date ? item.due_date.substring(0, 10) : 'N/A' }}
        </span>
      </template>

      <template #[`item.total_amount`]="{ item }">
        <span class="font-weight-bold text-body-2 text-high-emphasis">
          ${{ Number(item.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
        </span>
      </template>

      <template #[`item.paid_amount`]="{ item }">
        <span class="text-success font-weight-medium text-body-2">
          ${{ Number(item.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
        </span>
      </template>

      <template #[`item.balance_amount`]="{ item }">
        <span class="text-error font-weight-bold text-body-2">
          ${{ Number(item.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
        </span>
      </template>

      <template #[`item.status`]="{ item }">
        <v-chip
          size="small"
          :color="item.status === '1' ? 'success' : item.status === '2' ? 'error' : 'info'"
          variant="tonal"
          label
          class="font-weight-medium"
        >
          {{ item.status === '1' ? 'Pagada' : item.status === '2' ? 'En Mora' : 'Pendiente' }}
        </v-chip>
      </template>
    </v-data-table>
  </AppModal>

  <!-- Modal: Participantes Calificados para Adjudicación -->
  <AppModal
    v-model="qualifiedDialogOpen"
    title="Participantes Calificados"
    subtitle="Suscriptores que cumplen con los requisitos de solvencia para adjudicación"
    max-width="640"
    cancel-text="Cerrar"
    hide-submit
  >
    <div v-if="isLoadingQualified" class="d-flex justify-center py-6">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="qualifiedList.length === 0" class="text-center py-8 text-medium-emphasis text-body-2">
      No hay participantes calificados en este momento (deben estar al día sin mora).
    </div>

    <div v-else class="border rounded-lg overflow-hidden">
      <v-table density="comfortable">
        <thead>
          <tr>
            <th class="text-center">Turno</th>
            <th>Suscriptor</th>
            <th>Identificación</th>
            <th class="text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in qualifiedList" :key="q.id">
            <td class="font-weight-bold text-primary text-center">#{{ q.position }}</td>
            <td class="font-weight-medium text-high-emphasis">{{ q.first_name }} {{ q.last_name || '' }}</td>
            <td class="text-medium-emphasis">{{ q.identification_type ? `${q.identification_type}-${q.identification_value}` : 'N/A' }}</td>
            <td class="text-center">
              <v-chip size="x-small" color="success" variant="flat" class="font-weight-bold">Al Día</v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </AppModal>

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
