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
  fetchPaymentFrequencies
} from '../api/financing.api'
import type {
  SamGroupItem,
  ParticipantItem,
  PaymentFrequencyItem,
  UpdateParticipantPayload
} from '../types'
import type { DqbFilterTuple } from '@/types/query'
import AppPaginatedSelect, { type PaginatedQueryParams } from '@/components/common/AppPaginatedSelect.vue'
import AppMetadataRenderer, { type MetadataSchemaPayload } from '@/components/common/AppMetadataRenderer.vue'
import { fetchMetadataSchemaRender } from '@/modules/system/api/system.api'
import { fetchPersons, fetchPersonById } from '@/modules/catalogs/api/catalogs.api'
import type { PersonItem } from '@/modules/catalogs/types'
import StatementModal from '../components/StatementModal.vue'
import ParticipantContractModal from '../components/ParticipantContractModal.vue'

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
  { title: 'Cliente', key: 'client', align: 'start' as const, sortable: false },
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
const benefitAwardedAt = ref<string>('')

const isBenefitUpdate = computed(() => {
  if (selectedBenefitParticipant.value?.awarded_at) return true
  const b = selectedBenefitParticipant.value?.benefit_metadata
  if (!b) return false
  if (typeof b === 'object' && Object.keys(b).length > 0) return true
  if (typeof b === 'string') {
    try {
      return Object.keys(JSON.parse(b)).length > 0
    } catch {
      return false
    }
  }
  return false
})

function openBenefitDialog(participant: ParticipantItem): void {
  selectedBenefitParticipant.value = participant
  benefitAwardedAt.value = participant.awarded_at || ''
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
    const payload: UpdateParticipantPayload = {
      benefit_metadata: { ...benefitFormData.value }
    }

    if (benefitAwardedAt.value && benefitAwardedAt.value.trim()) {
      payload.awarded_at = benefitAwardedAt.value.trim()
    } else if (selectedBenefitParticipant.value.awarded_at) {
      payload.awarded_at = null
    }

    await apiUpdateParticipant(
      branchesStore.activeBranchId,
      groupId.value,
      selectedBenefitParticipant.value.id,
      payload
    )

    if (payload.awarded_at) {
      showMessage('Adjudicación registrada y confirmada exitosamente.')
    } else if (payload.awarded_at === null) {
      showMessage('Adjudicación revocada exitosamente.')
    } else {
      showMessage('Datos de adjudicación guardados exitosamente.')
    }

    benefitDialogOpen.value = false
    selectedBenefitParticipant.value = null
    participantsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al guardar los datos de adjudicación.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingBenefit.value = false
  }
}

// Autocompletado paginado de personas (Clientes y Referentes)
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
    showMessage('Selecciona el cliente.', 'error')
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
      referrer_id: participantFormData.value.referrer_id ? Number(participantFormData.value.referrer_id) : (editingParticipantId.value ? null : undefined),
      position: participantFormData.value.position ? Number(participantFormData.value.position) : (editingParticipantId.value ? null : undefined),
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
// 4. Diálogo de Estado de Cuenta / Cartola por Participante
// ---------------------------------------------------------------------
const statementDialogOpen = ref(false)
const selectedParticipant = ref<ParticipantItem | null>(null)

function openQuotesDialog(participant: ParticipantItem): void {
  selectedParticipant.value = participant
  statementDialogOpen.value = true
}

// ---------------------------------------------------------------------
// 6. Gestión Unificada de Contrato para Participante
// ---------------------------------------------------------------------
const contractModalOpen = ref(false)
const selectedContractParticipant = ref<ParticipantItem | null>(null)

function openContractModal(participant: ParticipantItem): void {
  selectedContractParticipant.value = participant
  contractModalOpen.value = true
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
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-create-participant"
          @click="openCreateParticipantDialog"
        >
          Registrar
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
        
  <!-- Modal: Adjudicación -->
  <AppModal
    v-model="benefitDialogOpen"
    title="Adjudicación"
    :subtitle="selectedBenefitParticipant ? `Especificaciones de la adjudicación para ${selectedBenefitParticipant.client_first_name} ${selectedBenefitParticipant.client_last_name || ''}` : 'Especificaciones de la adjudicación'"
    max-width="580"
    persistent
    :loading="isSubmittingBenefit"
    :submit-text="isBenefitUpdate ? 'Actualizar' : 'Registrar'"
    submit-icon="mdi-check"
    form-id="form-participant-benefit"
    @submit="handleSaveBenefit"
  >
    <v-form id="form-participant-benefit" @submit.prevent="handleSaveBenefit">
      <div class="mb-4">
        <v-text-field
          v-model="benefitAwardedAt"
          label="Fecha de Adjudicación / Entrega"
          type="date"
          variant="outlined"
          density="comfortable"
          persistent-placeholder
          clearable
          hint="Opcional. Define una fecha para confirmar formalmente la adjudicación y entrega"
          persistent-hint
          data-testid="input-participant-awarded-at"
        />
      </div>

      <div v-if="isLoadingSchema" class="py-4 text-center">
        <v-progress-circular indeterminate color="primary" size="28" />
        <div class="text-caption text-medium-emphasis mt-2">Cargando campos de la adjudicación...</div>
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
        Este tipo de contrato no tiene campos dinámicos de adjudicación configurados.
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
          <v-chip
            v-if="item.position"
            size="small"
            color="primary"
            variant="tonal"
            label
            class="font-weight-bold"
          >
            Turno #{{ item.position }}
          </v-chip>
          <span v-else class="text-caption text-medium-emphasis font-weight-medium">
            N/A
          </span>
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
              <div v-if="item.client_identification_value" class="text-caption text-medium-emphasis">
                CI: {{ item.client_identification_value }}
              </div>
            </div>
          </div>
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
          <!-- Si el participante no está activo, no aplica morosidad -->
          <span v-if="item.status === '0' || item.status === '2'" class="text-caption text-medium-emphasis font-weight-medium">
            N/A
          </span>
          <v-chip
            v-else
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
          <!-- Si no tiene número asignado o está en espera/retirado, no aplica adjudicación -->
          <span v-else-if="!item.position || item.status === '0' || item.status === '2'" class="text-caption text-medium-emphasis font-weight-medium">
            N/A
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
                <!-- 1. Estado de cuenta -->
                <v-list-item
                  prepend-icon="mdi-file-document-outline"
                  title="Estado de cuenta"
                  data-testid="menu-item-view-quotes"
                  @click="openQuotesDialog(item)"
                />

                <!-- 3. Contrato (Unificado: Descarga y Subida) -->
                <v-list-item
                  prepend-icon="mdi-file-certificate-outline"
                  title="Contrato"
                  data-testid="menu-item-contract"
                  @click="openContractModal(item)"
                />

                <v-divider class="my-1" />

                <!-- 4. Adjudicación -->
                <v-list-item
                  prepend-icon="mdi-gift-outline"
                  title="Adjudicación"
                  data-testid="menu-item-participant-benefit"
                  @click="openBenefitDialog(item)"
                />

                <!-- 4. Modificar -->
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
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

  <!-- Modal: Registrar / Editar -->
  <AppModal
    v-model="participantDialogOpen"
    :title="editingParticipantId ? 'Editar' : 'Registrar'"
    :subtitle="editingParticipantId ? 'Modifica los parámetros y especificaciones en el grupo' : 'Asigna un cliente y su número de turno en el grupo'"
    max-width="540"
    persistent
    :loading="isSubmittingParticipant"
    :submit-text="editingParticipantId ? 'Actualizar' : 'Registrar'"
    :submit-icon="editingParticipantId ? 'mdi-check' : 'mdi-plus'"
    form-id="form-register-participant"
    @submit="handleSaveParticipant"
  >
    <v-form id="form-register-participant" @submit.prevent="handleSaveParticipant">
      <!-- 1. Cliente con AppPaginatedSelect -->
      <v-row density="compact" class="mb-1">
        <v-col cols="12">
          <AppPaginatedSelect
            v-model="participantFormData.client_id"
            :fetch-options="fetchPersonsOptions"
            :fetch-by-id="fetchPersonSingle"
            label="Cliente *"
            placeholder="Buscar por nombre, apellido o cédula..."
            value-key="id"
            label-key="name"
            :disabled="Boolean(editingParticipantId)"
            density="comfortable"
            data-testid="select-participant-client"
          />
        </v-col>
      </v-row>

      <!-- 2. Referente ($15) y Posición -->
      <v-row density="compact" class="mb-1">
        <v-col cols="12" sm="8">
          <AppPaginatedSelect
            v-model="participantFormData.referrer_id"
            :fetch-options="fetchPersonsOptions"
            :fetch-by-id="fetchPersonSingle"
            label="Referente"
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

      <!-- 3. Estado -->
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
            label="Estado"
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

  <!-- Modal: Confirmar Eliminación -->
  <AppModal
    v-model="deleteDialogOpen"
    title="Eliminar"
    subtitle="Esta acción retirará al suscriptor del grupo activo"
    max-width="460"
    :loading="isDeletingParticipant"
    submit-text="Eliminar"
    submit-color="error"
    submit-icon="mdi-trash-can"
    @submit="handleConfirmDeleteParticipant"
  >
    <div class="py-2">
      <p class="text-body-2 text-high-emphasis mb-3">
        ¿Estás seguro de que deseas retirar del grupo al participante
        <strong>{{ participantToDelete?.client_first_name }} {{ participantToDelete?.client_last_name }}</strong><span v-if="participantToDelete?.position"> (Turno #{{ participantToDelete.position }})</span>?
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

  <!-- Modal: Estado de Cuenta (Amortización y Recaudación) -->
  <StatementModal
    v-model="statementDialogOpen"
    :participant-id="selectedParticipant?.id || null"
    :group-id="groupId"
    @quotes-generated="participantsQuery.refresh"
    @message="showMessage"
  />

  <!-- Modal: Gestión Unificada de Contrato (Descarga y Subida) -->
  <ParticipantContractModal
    v-model="contractModalOpen"
    :participant="selectedContractParticipant"
    :group-id="groupId"
    :group-name="currentGroup?.name"
    @contract-updated="participantsQuery.refresh"
    @message="showMessage"
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
