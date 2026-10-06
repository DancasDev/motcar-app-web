<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useFinancingStore } from '../stores/financing.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchSamGroups,
  fetchParticipants,
  createParticipant as apiCreateParticipant,
  fetchReceivables
} from '../api/financing.api'
import type {
  SamGroupItem,
  ParticipantItem,
  ReceivableItem,
  CreateSamGroupPayload
} from '../types'

const branchesStore = useBranchesStore()
const financingStore = useFinancingStore()

type FinancingTab = 'groups' | 'contracts'
const activeTab = ref<FinancingTab>('groups')

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
// 1. Grupos SAM (Pestaña 1)
// ---------------------------------------------------------------------
const groupsQuery = useDataQuery<SamGroupItem>(
  async (params) => {
    const branchId = branchesStore.activeBranchId || 1
    return fetchSamGroups(branchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['name']
  }
)

const groupHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '70px' },
  { title: 'Nombre del Grupo', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Monto Total', key: 'amount', align: 'end' as const, sortable: true },
  { title: 'Cuota Recurrente', key: 'installment_amount', align: 'end' as const, sortable: true },
  { title: 'Total Cuotas', key: 'installment_count', align: 'center' as const, sortable: true, width: '110px' },
  { title: 'Participantes', key: 'participants', align: 'center' as const, sortable: false, width: '130px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '180px' }
]

// Diálogo de Creación de Grupo
const groupDialogOpen = ref(false)
const isSubmittingGroup = ref(false)

const groupFormData = ref<{
  name: string
  frequency_id: number | null
  contract_type_id: number | null
  amount: number
  installment_amount: number
  installment_count: number
  participant_max: number
  frequency_base_date: string
  status: string
  is_disabled: boolean
}>({
  name: '',
  frequency_id: null,
  contract_type_id: null,
  amount: 1200,
  installment_amount: 50,
  installment_count: 24,
  participant_max: 24,
  frequency_base_date: new Date().toISOString().substring(0, 10),
  status: '0',
  is_disabled: false
})

function openCreateGroupDialog(): void {
  groupFormData.value = {
    name: '',
    frequency_id: financingStore.frequencies[0]?.id ? Number(financingStore.frequencies[0].id) : 1,
    contract_type_id: financingStore.contractTypes[0]?.id
      ? Number(financingStore.contractTypes[0].id)
      : 1,
    amount: 1200,
    installment_amount: 50,
    installment_count: 24,
    participant_max: 24,
    frequency_base_date: new Date().toISOString().substring(0, 10),
    status: '0',
    is_disabled: false
  }
  groupDialogOpen.value = true
}

async function handleSaveGroup(): Promise<void> {
  if (!groupFormData.value.name.trim()) {
    showMessage('El nombre del grupo es obligatorio.', 'error')
    return
  }
  if (!branchesStore.activeBranchId) {
    showMessage('Debes seleccionar una sucursal activa.', 'error')
    return
  }

  isSubmittingGroup.value = true
  try {
    const payload: CreateSamGroupPayload = {
      name: groupFormData.value.name.trim(),
      frequency_id: groupFormData.value.frequency_id || 1,
      contract_type_id: groupFormData.value.contract_type_id || 1,
      amount: groupFormData.value.amount,
      installment_amount: groupFormData.value.installment_amount,
      installment_count: groupFormData.value.installment_count,
      participant_max: groupFormData.value.participant_max,
      frequency_base_date: groupFormData.value.frequency_base_date,
      status: groupFormData.value.status,
      is_disabled: groupFormData.value.is_disabled ? '1' : '0'
    }

    await financingStore.createGroup(branchesStore.activeBranchId, payload)
    showMessage('Grupo SAM creado exitosamente.')
    groupDialogOpen.value = false
    groupsQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al crear el grupo SAM.'
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
    const msg = err instanceof Error ? err.message : 'Error al generar cuotas del grupo.'
    showMessage(msg, 'error')
  }
}

// ---------------------------------------------------------------------
// 2. Contratos y Participantes (Pestaña 2)
// ---------------------------------------------------------------------
const selectedGroupIdForContracts = ref<string | number | null>(null)

const contractsQuery = useDataQuery<ParticipantItem>(
  async (params) => {
    const branchId = branchesStore.activeBranchId || 1
    const groupId = selectedGroupIdForContracts.value || financingStore.samGroups[0]?.id || 1
    return fetchParticipants(branchId, groupId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['client_first_name', 'client_last_name']
  }
)

const contractHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '70px' },
  { title: 'Cliente Suscriptor', key: 'client', align: 'start' as const, sortable: true },
  { title: 'Posición / Turno', key: 'position', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Estado Participante', key: 'status', align: 'center' as const, sortable: true, width: '150px' },
  { title: 'Adjudicación', key: 'awarded_at', align: 'center' as const, sortable: true, width: '140px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '180px' }
]

// Diálogo de Cuotas / Cronograma de Amortización
const quotesDialogOpen = ref(false)
const selectedParticipant = ref<ParticipantItem | null>(null)
const participantQuotes = ref<ReceivableItem[]>([])
const isLoadingQuotes = ref(false)

const quoteHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, width: '70px' },
  { title: 'Concepto / Glosa', key: 'concept_name', align: 'start' as const },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, width: '130px' },
  { title: 'Monto Total', key: 'total_amount', align: 'end' as const, width: '110px' },
  { title: 'Monto Cobrado', key: 'paid_amount', align: 'end' as const, width: '110px' },
  { title: 'Saldo Deudor', key: 'balance_amount', align: 'end' as const, width: '110px' },
  { title: 'Estado', key: 'status', align: 'center' as const, width: '120px' }
]

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
  } catch (err) {
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
      selectedParticipant.value.san_group_id || selectedGroupIdForContracts.value || 1,
      selectedParticipant.value.id
    )
    showMessage(`Cronograma de cuotas emitido. Cuotas generadas: ${res.generated || 0}`)
    await loadQuotesForParticipant(selectedParticipant.value)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al generar cuotas del participante.'
    showMessage(msg, 'error')
  } finally {
    isLoadingQuotes.value = false
  }
}

// Diálogo de Registro de Participante
const participantDialogOpen = ref(false)
const isSubmittingParticipant = ref(false)
const participantFormData = ref({
  client_id: 1,
  position: 1,
  status: '1'
})

function openCreateParticipantDialog(): void {
  participantFormData.value = {
    client_id: 1,
    position: (contractsQuery.items.value.length || 0) + 1,
    status: '1'
  }
  participantDialogOpen.value = true
}

async function handleSaveParticipant(): Promise<void> {
  if (!branchesStore.activeBranchId || !selectedGroupIdForContracts.value) {
    showMessage('Selecciona un grupo SAM válido.', 'error')
    return
  }
  isSubmittingParticipant.value = true
  try {
    await apiCreateParticipant(
      branchesStore.activeBranchId,
      selectedGroupIdForContracts.value,
      {
        client_id: participantFormData.value.client_id,
        position: participantFormData.value.position,
        status: participantFormData.value.status,
        is_disabled: '0'
      }
    )
    showMessage('Participante incorporado exitosamente al grupo SAM.')
    participantDialogOpen.value = false
    contractsQuery.refresh()
    groupsQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al inscribir participante.'
    showMessage(msg, 'error')
  } finally {
    isSubmittingParticipant.value = false
  }
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
  snackbar.value = { show: true, text, color }
}

// Observar cambio de sucursal activa
watch(
  () => branchesStore.activeBranchId,
  async (newBranchId) => {
    if (newBranchId) {
      await financingStore.loadSamGroups(newBranchId, true)
      if (financingStore.samGroups.length > 0) {
        selectedGroupIdForContracts.value = financingStore.samGroups[0].id
      }
      groupsQuery.refresh()
      contractsQuery.refresh()
    }
  }
)

// Observar cambio de grupo seleccionado en pestaña de contratos
watch(selectedGroupIdForContracts, () => {
  contractsQuery.refresh()
})

onMounted(async () => {
  await financingStore.loadCatalogs()
  if (branchesStore.activeBranchId) {
    await financingStore.loadSamGroups(branchesStore.activeBranchId)
    if (financingStore.samGroups.length > 0) {
      selectedGroupIdForContracts.value = financingStore.samGroups[0].id
    }
  }
})
</script>

<template>
  <v-row>
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-col v-if="!branchesStore.activeBranchId" cols="12">
      <v-alert
        type="warning"
        variant="tonal"
        title="Sucursal no seleccionada"
        text="Para gestionar Grupos SAM, Contratos y Cuotas de Financiamiento, debes seleccionar una Sucursal Activa en la barra superior."
        class="mb-2"
        data-testid="no-branch-alert"
      />
    </v-col>

    <v-col cols="12">
      <v-card elevation="2" rounded="lg">
        <!-- Encabezado del Módulo -->
        <v-card-item class="pb-2">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div>
              <v-card-title class="text-h5 font-weight-bold d-flex align-center">
                <v-icon icon="mdi-handshake" color="primary" class="mr-2" />
                Autofinanciamiento Colectivo (SAM)
              </v-card-title>
              <v-card-subtitle>
                Gestión de grupos de ahorro mutuo, participantes, contratos y cronogramas de amortización
              </v-card-subtitle>
            </div>

            <div class="d-flex align-center gap-2 mt-2 mt-sm-0">
              <v-chip
                v-if="branchesStore.activeBranch"
                color="primary"
                variant="tonal"
                class="font-weight-medium"
                data-testid="financing-active-branch-chip"
              >
                <v-icon start icon="mdi-office-building" />
                Sucursal: {{ branchesStore.activeBranch.name }}
              </v-chip>

              <v-btn
                v-if="activeTab === 'groups'"
                color="primary"
                prepend-icon="mdi-plus"
                class="text-none font-weight-bold"
                data-testid="btn-create-group"
                @click="openCreateGroupDialog"
              >
                Nuevo Grupo SAM
              </v-btn>

              <v-btn
                v-else
                color="primary"
                prepend-icon="mdi-account-plus"
                class="text-none font-weight-bold"
                data-testid="btn-create-participant"
                @click="openCreateParticipantDialog"
              >
                Inscribir Participante
              </v-btn>
            </div>
          </div>
        </v-card-item>

        <!-- Selector de Pestañas -->
        <v-tabs v-model="activeTab" color="primary" class="border-b px-4">
          <v-tab value="groups" class="text-none" data-testid="tab-sam-groups">
            <v-icon start icon="mdi-account-group" />
            Grupos SAM ({{ groupsQuery.totalItems.value }})
          </v-tab>
          <v-tab value="contracts" class="text-none" data-testid="tab-contracts">
            <v-icon start icon="mdi-file-document-edit" />
            Contratos y Participantes ({{ contractsQuery.totalItems.value }})
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <!-- ------------------------------------------------------------- -->
          <!-- Pestaña 1: Grupos SAM -->
          <!-- ------------------------------------------------------------- -->
          <v-window-item value="groups">
            <v-card-text class="pa-4">
              <!-- Barra de herramientas: Búsqueda y refresco -->
              <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
                <v-text-field
                  v-model="groupsQuery.search.value"
                  prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar grupo por nombre..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  max-width="360"
                  data-testid="group-search-input"
                />

                <v-btn
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="small"
                  :loading="groupsQuery.isLoading.value"
                  data-testid="btn-refresh-groups"
                  @click="groupsQuery.refresh()"
                >
                  Actualizar
                </v-btn>
              </div>

              <!-- Tabla de Grupos SAM -->
              <v-data-table-server
                :headers="groupHeaders"
                :items="groupsQuery.items.value"
                :items-length="groupsQuery.totalItems.value"
                :loading="groupsQuery.isLoading.value"
                density="comfortable"
                hover
                data-testid="sam-groups-table"
                @update:options="groupsQuery.onUpdateOptions"
              >
                <template #[`item.name`]="{ item }">
                  <div>
                    <div class="font-weight-bold text-body-2">{{ item.name }}</div>
                    <div class="text-caption text-grey">
                      {{ formatLocalized(item.frequency_name) || item.frequency_code }} •
                      {{ item.contract_type_name || 'SAM General' }}
                    </div>
                  </div>
                </template>

                <template #[`item.amount`]="{ item }">
                  <span class="font-weight-bold text-primary">
                    ${{ Number(item.amount).toFixed(2) }}
                  </span>
                </template>

                <template #[`item.installment_amount`]="{ item }">
                  <span>${{ Number(item.installment_amount).toFixed(2) }}</span>
                </template>

                <template #[`item.participants`]="{ item }">
                  <v-chip size="small" variant="tonal" color="info">
                    {{ item.participant_count ?? 0 }} / {{ item.participant_max ?? 24 }}
                  </v-chip>
                </template>

                <template #[`item.status`]="{ item }">
                  <v-chip
                    size="small"
                    :color="item.status === '1' ? 'success' : item.status === '2' ? 'grey' : 'info'"
                    variant="tonal"
                    label
                  >
                    {{ item.status === '1' ? 'Activo' : item.status === '2' ? 'Cerrado' : 'Formación' }}
                  </v-chip>
                </template>

                <template #[`item.actions`]="{ item }">
                  <div class="d-flex align-center justify-end">
                    <v-btn
                      icon="mdi-calculator"
                      size="small"
                      variant="text"
                      color="primary"
                      title="Generar Cuotas para el Grupo"
                      data-testid="btn-generate-group-receivables"
                      @click="handleGenerateGroupReceivables(item)"
                    />
                    <v-btn
                      icon="mdi-account-multiple-outline"
                      size="small"
                      variant="text"
                      color="primary"
                      title="Ver Participantes del Grupo"
                      data-testid="btn-view-group-participants"
                      @click="selectedGroupIdForContracts = item.id; activeTab = 'contracts'"
                    />
                  </div>
                </template>
              </v-data-table-server>
            </v-card-text>
          </v-window-item>

          <!-- ------------------------------------------------------------- -->
          <!-- Pestaña 2: Contratos y Participantes -->
          <!-- ------------------------------------------------------------- -->
          <v-window-item value="contracts">
            <v-card-text class="pa-4">
              <!-- Selector de Grupo SAM y Búsqueda -->
              <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
                <div class="d-flex align-center gap-3 flex-wrap">
                  <v-select
                    v-model="selectedGroupIdForContracts"
                    :items="financingStore.samGroups"
                    item-title="name"
                    item-value="id"
                    label="Grupo SAM"
                    density="compact"
                    variant="outlined"
                    hide-details
                    min-width="260"
                    data-testid="select-filter-group"
                  />

                  <v-text-field
                    v-model="contractsQuery.search.value"
                    prepend-inner-icon="mdi-magnify"
                    placeholder="Buscar participante..."
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    max-width="280"
                    data-testid="contract-search-input"
                  />
                </div>

                <v-btn
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="small"
                  :loading="contractsQuery.isLoading.value"
                  data-testid="btn-refresh-contracts"
                  @click="contractsQuery.refresh()"
                >
                  Actualizar
                </v-btn>
              </div>

              <!-- Tabla de Contratos y Participantes -->
              <v-data-table-server
                :headers="contractHeaders"
                :items="contractsQuery.items.value"
                :items-length="contractsQuery.totalItems.value"
                :loading="contractsQuery.isLoading.value"
                density="comfortable"
                hover
                data-testid="contracts-table"
                @update:options="contractsQuery.onUpdateOptions"
              >
                <template #[`item.client`]="{ item }">
                  <div class="d-flex align-center">
                    <v-avatar color="primary" size="28" class="mr-2 text-caption text-white">
                      {{ (item.client_first_name?.[0] || 'C').toUpperCase() }}
                    </v-avatar>
                    <div>
                      <div class="font-weight-medium text-body-2">
                        {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
                      </div>
                      <div class="text-caption text-grey">ID Cliente: {{ item.client_id }}</div>
                    </div>
                  </div>
                </template>

                <template #[`item.position`]="{ item }">
                  <v-chip size="small" color="primary" variant="tonal" label>
                    Turno #{{ item.position }}
                  </v-chip>
                </template>

                <template #[`item.status`]="{ item }">
                  <v-chip
                    size="small"
                    :color="item.status === '1' ? 'success' : item.status === '2' ? 'warning' : 'info'"
                    variant="tonal"
                    label
                  >
                    {{ item.status === '1' ? 'Activo' : item.status === '2' ? 'Retirado' : 'Espera' }}
                  </v-chip>
                </template>

                <template #[`item.awarded_at`]="{ item }">
                  <span v-if="item.awarded_at" class="text-caption text-success font-weight-medium">
                    {{ item.awarded_at }}
                  </span>
                  <span v-else class="text-caption text-grey">Pendiente</span>
                </template>

                <template #[`item.actions`]="{ item }">
                  <div class="d-flex align-center justify-end">
                    <v-btn
                      variant="tonal"
                      size="small"
                      color="primary"
                      prepend-icon="mdi-calendar-clock"
                      class="text-none font-weight-medium"
                      data-testid="btn-view-quotes"
                      @click="openQuotesDialog(item)"
                    >
                      Cuotas
                    </v-btn>
                  </div>
                </template>
              </v-data-table-server>
            </v-card-text>
          </v-window-item>
        </v-window>
      </v-card>
    </v-col>
  </v-row>

  <!-- ------------------------------------------------------------- -->
  <!-- Modal: Crear Grupo SAM -->
  <!-- ------------------------------------------------------------- -->
  <v-dialog v-model="groupDialogOpen" max-width="580" persistent>
    <v-card rounded="lg" data-testid="group-form-dialog">
      <v-card-title class="bg-primary text-white pa-4 d-flex align-center justify-space-between">
        <span class="text-h6 font-weight-bold">Nuevo Grupo SAM</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="groupDialogOpen = false" />
      </v-card-title>

      <v-card-text class="pa-4 pt-6">
        <v-form @submit.prevent="handleSaveGroup">
          <v-text-field
            v-model="groupFormData.name"
            label="Nombre del Grupo SAM *"
            placeholder="Ej. GRUPO SAM EK-EXPRESS #01"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-group-name"
          />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="groupFormData.frequency_id"
                :items="financingStore.frequencies"
                :item-title="(item: any) => formatLocalized(item.name) || item.code"
                item-value="id"
                label="Frecuencia de Pago *"
                variant="outlined"
                density="comfortable"
                data-testid="select-group-frequency"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="groupFormData.contract_type_id"
                :items="financingStore.contractTypes"
                item-title="name"
                item-value="id"
                label="Tipo de Contrato *"
                variant="outlined"
                density="comfortable"
                data-testid="select-group-contract-type"
              />
            </v-col>
          </v-row>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="groupFormData.amount"
                label="Monto Adjudicación ($) *"
                type="number"
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
                variant="outlined"
                density="comfortable"
                data-testid="input-group-installment-amount"
              />
            </v-col>
          </v-row>

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="groupFormData.installment_count"
                label="Total Cuotas (1-99) *"
                type="number"
                variant="outlined"
                density="comfortable"
                data-testid="input-group-installment-count"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="groupFormData.participant_max"
                label="Capacidad Máxima *"
                type="number"
                variant="outlined"
                density="comfortable"
                data-testid="input-group-participant-max"
              />
            </v-col>
          </v-row>

          <v-text-field
            v-model="groupFormData.frequency_base_date"
            label="Fecha Base de Cobros (YYYY-MM-DD) *"
            type="date"
            variant="outlined"
            density="comfortable"
            data-testid="input-group-base-date"
          />
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 justify-end">
        <v-btn
          variant="text"
          class="text-none"
          data-testid="btn-cancel-group"
          @click="groupDialogOpen = false"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="text-none font-weight-bold"
          :loading="isSubmittingGroup"
          data-testid="btn-save-group"
          @click="handleSaveGroup"
        >
          Crear Grupo
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ------------------------------------------------------------- -->
  <!-- Modal: Inscribir Participante -->
  <!-- ------------------------------------------------------------- -->
  <v-dialog v-model="participantDialogOpen" max-width="480" persistent>
    <v-card rounded="lg" data-testid="participant-form-dialog">
      <v-card-title class="bg-primary text-white pa-4 d-flex align-center justify-space-between">
        <span class="text-h6 font-weight-bold">Inscribir Participante</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="participantDialogOpen = false" />
      </v-card-title>

      <v-card-text class="pa-4 pt-6">
        <v-form @submit.prevent="handleSaveParticipant">
          <v-text-field
            v-model.number="participantFormData.client_id"
            label="ID del Cliente Suscriptor *"
            type="number"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-participant-client-id"
          />
          <v-text-field
            v-model.number="participantFormData.position"
            label="Posición / Turno en el Grupo *"
            type="number"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-participant-position"
          />
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 justify-end">
        <v-btn
          variant="text"
          class="text-none"
          data-testid="btn-cancel-participant"
          @click="participantDialogOpen = false"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="text-none font-weight-bold"
          :loading="isSubmittingParticipant"
          data-testid="btn-save-participant"
          @click="handleSaveParticipant"
        >
          Inscribir
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ------------------------------------------------------------- -->
  <!-- Modal: Cronograma de Cuotas (Amortización) -->
  <!-- ------------------------------------------------------------- -->
  <v-dialog v-model="quotesDialogOpen" max-width="850">
    <v-card rounded="lg" data-testid="quotes-dialog">
      <v-card-title class="bg-primary text-white pa-4 d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-icon icon="mdi-calendar-month" class="mr-2" />
          <span>
            Cronograma de Cuotas -
            {{ selectedParticipant?.client_first_name || 'Suscriptor' }}
            (Turno #{{ selectedParticipant?.position }})
          </span>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="quotesDialogOpen = false" />
      </v-card-title>

      <v-card-text class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <div class="text-caption text-grey">
            Listado oficial de cuentas por cobrar originadas para el participante
          </div>
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
          density="compact"
          hover
          data-testid="quotes-table"
        >
          <template #[`item.concept_name`]="{ item }">
            <span class="font-weight-medium">
              {{ item.concept_name || item.description || 'Cuota SAM' }}
            </span>
          </template>

          <template #[`item.total_amount`]="{ item }">
            <span>${{ Number(item.total_amount).toFixed(2) }}</span>
          </template>

          <template #[`item.paid_amount`]="{ item }">
            <span class="text-success">${{ Number(item.paid_amount).toFixed(2) }}</span>
          </template>

          <template #[`item.balance_amount`]="{ item }">
            <span class="text-error font-weight-medium">
              ${{ Number(item.balance_amount).toFixed(2) }}
            </span>
          </template>

          <template #[`item.status`]="{ item }">
            <v-chip
              size="x-small"
              :color="item.status === '1' ? 'success' : item.status === '2' ? 'error' : 'warning'"
              variant="flat"
              label
            >
              {{ item.status === '1' ? 'Pagada' : item.status === '2' ? 'En Mora' : 'Pendiente' }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>

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
