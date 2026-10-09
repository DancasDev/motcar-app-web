<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useFinancingStore } from '../stores/financing.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchSamGroups } from '../api/financing.api'
import type { SamGroupItem, CreateSamGroupPayload } from '../types'
import type { DqbFilterTuple } from '@/types/query'

const router = useRouter()
const branchesStore = useBranchesStore()
const financingStore = useFinancingStore()

// Helper para parsear nombres en formato JSON multilingüe
function formatLocalized(name: unknown): string {
  if (!name) return ''
  if (typeof name === 'object') {
    const loc = name as Record<string, string>
    return loc.es || loc.en || Object.values(loc)[0] || ''
  }
  if (typeof name === 'string') {
    try {
      const parsed = JSON.parse(name)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed.es || parsed.en || Object.values(parsed)[0] || name
      }
    } catch {
      return name
    }
  }
  return String(name)
}

// ---------------------------------------------------------------------
// 1. Data Query de Grupos SAM
// ---------------------------------------------------------------------
const groupsQuery = useDataQuery<SamGroupItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchSamGroups(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['name']
  }
)

const groupHeaders = [
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Monto', key: 'amount', align: 'end' as const, sortable: true, width: '130px' },
  { title: 'Cuotas', key: 'installments', align: 'center' as const, sortable: false, width: '170px' },
  { title: 'Participantes', key: 'participants', align: 'center' as const, sortable: false, width: '140px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '80px' }
]

const statusOptions = [
  { text: 'En Formación', value: '0' },
  { text: 'Activo', value: '1' },
  { text: 'Cerrado', value: '2' }
]

function handleStatusFilterChange(dqbFilter: DqbFilterTuple[] | null): void {
  if (dqbFilter && dqbFilter.length > 0) {
    groupsQuery.staticFilters.value = dqbFilter
  } else {
    groupsQuery.staticFilters.value = []
  }
  groupsQuery.page.value = 1
  groupsQuery.refresh()
}

// ---------------------------------------------------------------------
// 2. Diálogos de Grupo (Crear, Editar, Detalles, Eliminar)
// ---------------------------------------------------------------------
const groupDialogOpen = ref(false)
const isSubmittingGroup = ref(false)
const editingGroupId = ref<string | number | null>(null)

// Diálogo de detalles
const detailsDialogOpen = ref(false)
const selectedGroupDetails = ref<SamGroupItem | null>(null)

// Diálogo de confirmación para eliminar
const deleteDialogOpen = ref(false)
const groupToDelete = ref<SamGroupItem | null>(null)
const isDeletingGroup = ref(false)

const groupFormData = ref<{
  name: string
  frequency_id: number | string | null
  contract_type_id: number | string | null
  amount: number | null
  installment_amount: number | null
  installment_count: number | null
  participant_max: number | null
  frequency_base_date: string
  status: string
  is_disabled: boolean
}>({
  name: '',
  frequency_id: null,
  contract_type_id: null,
  amount: null,
  installment_amount: null,
  installment_count: null,
  participant_max: null,
  frequency_base_date: '',
  status: '0',
  is_disabled: false
})

function openCreateGroupDialog(): void {
  editingGroupId.value = null
  groupFormData.value = {
    name: '',
    frequency_id: null,
    contract_type_id: null,
    amount: null,
    installment_amount: null,
    installment_count: null,
    participant_max: null,
    frequency_base_date: '',
    status: '0',
    is_disabled: false
  }
  groupDialogOpen.value = true
}

function openEditGroupDialog(group: SamGroupItem): void {
  editingGroupId.value = group.id
  groupFormData.value = {
    name: group.name,
    frequency_id: group.frequency_id,
    contract_type_id: group.contract_type_id ?? null,
    amount: Number(group.amount),
    installment_amount: Number(group.installment_amount),
    installment_count: Number(group.installment_count),
    participant_max: group.participant_max ? Number(group.participant_max) : null,
    frequency_base_date: group.frequency_base_date ? group.frequency_base_date.substring(0, 10) : '',
    status: String(group.status ?? '0'),
    is_disabled: group.is_disabled === '1' || group.is_disabled === true
  }
  groupDialogOpen.value = true
}

function openGroupDetails(group: SamGroupItem): void {
  selectedGroupDetails.value = group
  detailsDialogOpen.value = true
}

function promptDeleteGroup(group: SamGroupItem): void {
  groupToDelete.value = group
  deleteDialogOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  if (!groupToDelete.value || !branchesStore.activeBranchId) return
  isDeletingGroup.value = true
  try {
    await financingStore.deleteGroup(branchesStore.activeBranchId, groupToDelete.value.id)
    showMessage('Grupo eliminado exitosamente.')
    deleteDialogOpen.value = false
    groupToDelete.value = null
    groupsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al eliminar el grupo.')
    showMessage(msg, 'error')
  } finally {
    isDeletingGroup.value = false
  }
}

async function handleSaveGroup(): Promise<void> {
  if (!groupFormData.value.name.trim()) {
    showMessage('El nombre del grupo es obligatorio.', 'error')
    return
  }
  if (!groupFormData.value.frequency_id) {
    showMessage('Selecciona una frecuencia de pago.', 'error')
    return
  }
  if (!groupFormData.value.amount || Number(groupFormData.value.amount) <= 0) {
    showMessage('Ingresa un monto de adjudicación válido.', 'error')
    return
  }
  if (!groupFormData.value.installment_amount || Number(groupFormData.value.installment_amount) <= 0) {
    showMessage('Ingresa el monto de cuota.', 'error')
    return
  }
  if (!groupFormData.value.installment_count || Number(groupFormData.value.installment_count) <= 0) {
    showMessage('Ingresa el total de cuotas.', 'error')
    return
  }
  if (!groupFormData.value.frequency_base_date) {
    showMessage('Ingresa la fecha base de cobros.', 'error')
    return
  }
  if (!branchesStore.activeBranchId) {
    showMessage('Debes seleccionar una sucursal activa.', 'error')
    return
  }

  isSubmittingGroup.value = true
  try {
    if (editingGroupId.value) {
      // Actualizar Grupo
      await financingStore.updateGroup(branchesStore.activeBranchId, editingGroupId.value, {
        name: groupFormData.value.name.trim(),
        frequency_id: Number(groupFormData.value.frequency_id),
        contract_type_id: groupFormData.value.contract_type_id ? Number(groupFormData.value.contract_type_id) : null,
        amount: Number(groupFormData.value.amount),
        installment_amount: Number(groupFormData.value.installment_amount),
        installment_count: Number(groupFormData.value.installment_count),
        participant_max: groupFormData.value.participant_max ? Number(groupFormData.value.participant_max) : undefined,
        status: groupFormData.value.status || '0',
        is_disabled: groupFormData.value.is_disabled ? '1' : '0'
      })
      showMessage('Grupo actualizado exitosamente.')
    } else {
      // Crear Grupo
      const payload: CreateSamGroupPayload = {
        name: groupFormData.value.name.trim(),
        frequency_id: Number(groupFormData.value.frequency_id),
        contract_type_id: groupFormData.value.contract_type_id ? Number(groupFormData.value.contract_type_id) : null,
        amount: Number(groupFormData.value.amount),
        installment_amount: Number(groupFormData.value.installment_amount),
        installment_count: Number(groupFormData.value.installment_count),
        participant_max: groupFormData.value.participant_max ? Number(groupFormData.value.participant_max) : undefined,
        frequency_base_date: groupFormData.value.frequency_base_date,
        status: groupFormData.value.status || '0',
        is_disabled: groupFormData.value.is_disabled ? '1' : '0'
      }
      await financingStore.createGroup(branchesStore.activeBranchId, payload)
      showMessage('Grupo creado exitosamente.')
    }

    groupDialogOpen.value = false
    groupsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.messages?.name ||
      (typeof errorObj?.response?.data?.messages === 'string' ? errorObj.response.data.messages : null) ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al guardar el grupo.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingGroup.value = false
  }
}

async function handleGenerateGroupReceivables(group: SamGroupItem): Promise<void> {
  if (!branchesStore.activeBranchId) return
  try {
    const res = await financingStore.generateGroupReceivables(branchesStore.activeBranchId, group.id)
    showMessage(`Cuotas generadas exitosamente. Total generadas: ${res.generated || 0}`)
    groupsQuery.refresh()
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al generar cuotas del grupo.')
    showMessage(msg, 'error')
  }
}

function navigateToParticipants(groupId: string | number): void {
  router.push(`/financing/groups/${groupId}/participants`)
}

// ---------------------------------------------------------------------
// 3. Feedback y Reactividad
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
      groupsQuery.refresh()
    }
  }
)

onMounted(async () => {
  await financingStore.loadCatalogs()
  if (branchesStore.activeBranchId) {
    await financingStore.loadSamGroups(branchesStore.activeBranchId)
  }
})
</script>

<template>
  <div class="sam-groups-module">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      title="Sucursal no seleccionada"
      text="Para gestionar el autofinanciamiento debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert"
    />

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: TÍTULO Y BOTÓN AGREGAR REGISTRO             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-9">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Autofinanciamiento Colectivo
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Administración del programa de ahorro colectivo y adjudicación de beneficios
        </p>
      </div>

      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        class="text-none font-weight-bold px-4"
        data-testid="btn-create-group"
        @click="openCreateGroupDialog"
      >
        Nuevo Grupo
      </v-btn>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA (SECCIÓN SOLA, 7 COLS)   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row dense class="mb-3">
      <v-col cols="12" md="7">
        <v-text-field
          v-model="groupsQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por nombre..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="group-search-input"
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

      <!-- Botón de recarga a la derecha -->
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
            :loading="groupsQuery.isLoading.value"
            data-testid="btn-refresh-groups"
            @click="groupsQuery.refresh()"
          />
        </template>
      </v-tooltip>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CUARTA SECCIÓN: TABLA CON FONDO BLANCO Y ACCIONES            -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="groupsQuery.itemsPerPage.value"
        v-model:page="groupsQuery.page.value"
        v-model:sort-by="groupsQuery.sortBy.value"
        :headers="groupHeaders"
        :items="groupsQuery.items.value"
        :items-length="groupsQuery.totalItems.value"
        :loading="groupsQuery.isLoading.value"
        no-data-text="No hay datos disponibles"
        loading-text="Cargando grupos..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="sam-groups-table"
        @update:options="groupsQuery.onUpdateOptions"
      >
        <template #[`item.name`]="{ item }">
          <div>
            <div class="font-weight-bold text-body-2 text-high-emphasis">{{ item.name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ formatLocalized(item.frequency_name) || item.frequency_code }} •
              {{ item.contract_type_name || 'General' }}
            </div>
          </div>
        </template>

        <!-- Columna: Monto -->
        <template #[`item.amount`]="{ item }">
          <div class="font-weight-bold text-body-2 text-high-emphasis">
            ${{ Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </div>
        </template>

        <!-- Columna: Cuotas (ej: 24 / $50.00) -->
        <template #[`item.installments`]="{ item }">
          <div class="d-flex align-center justify-center">
            <span class="font-weight-bold text-body-2 text-high-emphasis">
              {{ item.installment_count }}
            </span>
            <span class="text-medium-emphasis mx-1">/</span>
            <span class="text-body-2 text-medium-emphasis">
              ${{ Number(item.installment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </span>
          </div>
        </template>

        <template #[`item.participants`]="{ item }">
          <v-chip size="small" variant="tonal" color="info" class="font-weight-medium">
            {{ item.participant_count ?? 0 }} / {{ item.participant_max ?? 24 }}
          </v-chip>
        </template>

        <template #[`item.status`]="{ item }">
          <v-chip
            size="small"
            :color="item.status === '1' ? 'success' : item.status === '2' ? 'grey' : 'info'"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ item.status === '1' ? 'Activo' : item.status === '2' ? 'Cerrado' : 'Formación' }}
          </v-chip>
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
                  data-testid="btn-group-actions-menu"
                />
              </template>
              <v-list density="compact" rounded="md" elevation="4" class="py-1 min-w-160">
                <!-- 1. Acción Principal de Consulta -->
                <v-list-item
                  prepend-icon="mdi-eye-outline"
                  title="Ver Detalles"
                  data-testid="menu-item-details"
                  @click="openGroupDetails(item)"
                />

                <!-- 2. Navegación al subrecurso -->
                <v-list-item
                  prepend-icon="mdi-account-group-outline"
                  title="Ver Participantes"
                  data-testid="menu-item-participants"
                  @click="navigateToParticipants(item.id)"
                />

                <!-- 3. Operación de negocio -->
                <v-list-item
                  prepend-icon="mdi-calculator"
                  title="Generar Cuotas"
                  data-testid="menu-item-generate-receivables"
                  @click="handleGenerateGroupReceivables(item)"
                />

                <v-divider class="my-1" />

                <!-- 4. Modificación -->
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar Grupo"
                  data-testid="menu-item-edit"
                  @click="openEditGroupDialog(item)"
                />

                <!-- 5. Eliminación -->
                <v-list-item
                  prepend-icon="mdi-trash-can-outline"
                  title="Eliminar"
                  base-color="error"
                  data-testid="menu-item-delete"
                  @click="promptDeleteGroup(item)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table-server>
    </v-card>
  </div>

  <!-- Modal: Crear / Editar Grupo -->
  <AppModal
    v-model="groupDialogOpen"
    :title="editingGroupId ? 'Editar Grupo' : 'Nuevo Grupo'"
    :subtitle="editingGroupId ? 'Modifica los parámetros y condiciones del grupo' : 'Configuración financiera y cuotas del nuevo grupo'"
    max-width="580"
    persistent
    :loading="isSubmittingGroup"
    :submit-text="editingGroupId ? 'Guardar Cambios' : 'Crear Grupo'"
    :submit-icon="editingGroupId ? 'mdi-check' : 'mdi-plus'"
    form-id="form-create-group"
    @submit="handleSaveGroup"
  >
    <v-form id="form-create-group" @submit.prevent="handleSaveGroup">
      <v-text-field
        v-model="groupFormData.name"
        label="Nombre del Grupo *"
        variant="outlined"
        density="comfortable"
        class="mb-3"
        data-testid="input-group-name"
      />

      <v-row dense class="mb-1">
        <v-col cols="12" sm="6">
          <v-select
            v-model="groupFormData.frequency_id"
            :items="financingStore.frequencies"
            :item-title="(item: any) => formatLocalized(item.name) || item.code || item.id"
            :item-value="(item: any) => item.id"
            label="Frecuencia de Pago *"
            placeholder="Seleccionar frecuencia"
            variant="outlined"
            density="comfortable"
            data-testid="select-group-frequency"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-select
            v-model="groupFormData.contract_type_id"
            :items="financingStore.contractTypes"
            :item-title="(item: any) => item.name || item.code || item.id"
            :item-value="(item: any) => item.id"
            label="Tipo de Contrato"
            placeholder="Seleccionar tipo de contrato"
            clearable
            variant="outlined"
            density="comfortable"
            data-testid="select-group-contract-type"
          />
        </v-col>
      </v-row>

      <v-row dense class="mb-1">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="groupFormData.amount"
            label="Monto Adjudicación ($) *"
            type="number"
            min="1"
            step="0.01"
            variant="outlined"
            density="comfortable"
            data-testid="input-group-amount"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="groupFormData.installment_amount"
            label="Monto Cuota ($) *"
            type="number"
            min="1"
            step="0.01"
            variant="outlined"
            density="comfortable"
            data-testid="input-group-installment-amount"
          />
        </v-col>
      </v-row>

      <v-row dense class="mb-1">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="groupFormData.installment_count"
            label="Total Cuotas (1-99) *"
            type="number"
            min="1"
            max="99"
            variant="outlined"
            density="comfortable"
            data-testid="input-group-installment-count"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="groupFormData.participant_max"
            label="Capacidad Máxima"
            type="number"
            min="1"
            max="255"
            variant="outlined"
            density="comfortable"
            data-testid="input-group-participant-max"
          />
        </v-col>
      </v-row>

      <v-text-field
        v-if="!editingGroupId"
        v-model="groupFormData.frequency_base_date"
        label="Fecha Base de Cobros (YYYY-MM-DD) *"
        type="date"
        variant="outlined"
        density="comfortable"
        data-testid="input-group-base-date"
      />
    </v-form>
  </AppModal>

  <!-- Modal: Ver Detalles del Registro -->
  <AppModal
    v-model="detailsDialogOpen"
    title="Detalles del Grupo"
    subtitle="Información completa de auditoría y configuración del grupo"
    max-width="640"
    cancel-text="Cerrar"
    submit-text="Editar Grupo"
    submit-icon="mdi-pencil"
    @submit="selectedGroupDetails && (detailsDialogOpen = false, openEditGroupDialog(selectedGroupDetails))"
  >
    <div v-if="selectedGroupDetails" class="d-flex flex-column ga-4">
      <!-- Identificación Principal -->
      <div class="pa-4 rounded-lg bg-surface-variant d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <div class="text-caption text-medium-emphasis">Nombre del Grupo</div>
          <div class="text-h6 font-weight-bold text-high-emphasis">{{ selectedGroupDetails.name }}</div>
          <div class="text-caption text-medium-emphasis mt-0.5">
            ID: #{{ selectedGroupDetails.id }} &bull; Sucursal: {{ selectedGroupDetails.branch_name || branchesStore.activeBranch?.name || `#${selectedGroupDetails.branch_id}` }}
          </div>
        </div>
        <v-chip
          size="small"
          :color="selectedGroupDetails.status === '1' ? 'success' : selectedGroupDetails.status === '2' ? 'grey' : 'info'"
          variant="flat"
          class="font-weight-bold"
        >
          {{ selectedGroupDetails.status === '1' ? 'Activo' : selectedGroupDetails.status === '2' ? 'Cerrado' : 'En Formación' }}
        </v-chip>
      </div>

      <!-- Métricas Financieras y Ciclo -->
      <v-row dense>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Monto Adjudicación</div>
            <div class="text-subtitle-1 font-weight-bold text-primary mt-1">
              ${{ Number(selectedGroupDetails.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Valor Cuota</div>
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mt-1">
              ${{ Number(selectedGroupDetails.installment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Total Cuotas</div>
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mt-1">
              {{ selectedGroupDetails.installment_count }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="border rounded-lg pa-3 text-center">
            <div class="text-caption text-medium-emphasis">Participantes</div>
            <div class="text-subtitle-1 font-weight-bold text-info mt-1">
              {{ selectedGroupDetails.participant_count ?? 0 }} / {{ selectedGroupDetails.participant_max ?? 24 }}
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Parámetros Operativos -->
      <div class="border rounded-lg overflow-hidden">
        <v-table density="compact">
          <tbody>
            <tr>
              <td class="font-weight-medium text-medium-emphasis w-50">Frecuencia de Pago</td>
              <td class="font-weight-bold text-high-emphasis">
                {{ formatLocalized(selectedGroupDetails.frequency_name) || selectedGroupDetails.frequency_code || 'N/A' }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-medium text-medium-emphasis">Tipo de Contrato</td>
              <td class="text-high-emphasis">
                {{ selectedGroupDetails.contract_type_name || selectedGroupDetails.contract_type_code || 'General' }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-medium text-medium-emphasis">Fecha Base de Cobros</td>
              <td class="text-high-emphasis">
                {{ selectedGroupDetails.frequency_base_date ? selectedGroupDetails.frequency_base_date.substring(0, 10) : 'N/A' }}
              </td>
            </tr>
            <tr>
              <td class="font-weight-medium text-medium-emphasis">Visibilidad / Inhabilitado</td>
              <td>
                <v-chip size="x-small" :color="selectedGroupDetails.is_disabled === '1' ? 'error' : 'success'" variant="tonal">
                  {{ selectedGroupDetails.is_disabled === '1' ? 'Inhabilitado' : 'Habilitado' }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Datos de Auditoría del Sistema -->
      <div class="border rounded-lg pa-3 bg-surface-variant">
        <div class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase" style="letter-spacing: 0.05em;">
          Auditoría de Registro
        </div>
        <div class="d-flex flex-column ga-1 text-caption">
          <div class="d-flex justify-space-between">
            <span class="text-medium-emphasis">Fecha de Creación:</span>
            <span class="font-weight-medium text-high-emphasis">{{ selectedGroupDetails.created_at || 'N/A' }}</span>
          </div>
          <div class="d-flex justify-space-between">
            <span class="text-medium-emphasis">Última Modificación:</span>
            <span class="font-weight-medium text-high-emphasis">{{ selectedGroupDetails.updated_at || 'Sin modificaciones' }}</span>
          </div>
          <div v-if="selectedGroupDetails.deleted_at" class="d-flex justify-space-between">
            <span class="text-error font-weight-medium">En Papelera (Deleted At):</span>
            <span class="text-error font-weight-bold">{{ selectedGroupDetails.deleted_at }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppModal>

  <!-- Modal: Confirmar Eliminación -->
  <AppModal
    v-model="deleteDialogOpen"
    title="Eliminar Grupo"
    subtitle="Esta acción moverá el grupo a la papelera del sistema"
    max-width="460"
    :loading="isDeletingGroup"
    submit-text="Sí, Eliminar"
    submit-color="error"
    submit-icon="mdi-trash-can"
    @submit="handleConfirmDelete"
  >
    <div class="py-2">
      <p class="text-body-2 text-high-emphasis mb-3">
        ¿Estás seguro de que deseas eliminar el grupo
        <strong>{{ groupToDelete?.name }}</strong>?
      </p>
      <v-alert
        type="warning"
        variant="tonal"
        density="compact"
        text="El registro dejará de mostrarse en las listas operativas pero sus datos históricos y participantes se conservarán."
        rounded="lg"
      />
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
