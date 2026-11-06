<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchAccountsReceivable, updateAccountReceivable } from '../api/accounting.api'
import type { AccountReceivableItem } from '../types'
import AppChipFilter from '@/components/common/AppChipFilter.vue'
import type { ChipFilterOption } from '@/components/common/AppChipFilter.vue'
import AppModal from '@/components/common/AppModal.vue'

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()
const accountingStore = useAccountingStore()

// Feedback / Notificaciones
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' | 'info' = 'success'): void {
  snackbar.value = { show: true, text, color }
}

// Opciones de filtro rápido por estado de obligación
const statusFilterOptions: ChipFilterOption[] = [
  { label: 'Pendientes', value: '0' },
  { label: 'Abonados', value: '1' },
  { label: 'Pagados', value: '2' },
  { label: 'Anulados', value: '3' }
]

const receivablesQuery = useDataQuery<AccountReceivableItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchAccountsReceivable(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: [
      'client_first_name',
      'client_last_name',
      'client_identification_value'
    ],
    defaultOrder: { due_date: 'DESC' }
  }
)

function handleStatusFilterChange(filters: any[] | null): void {
  if (!filters || filters.length === 0) {
    receivablesQuery.staticFilters.value = []
  } else {
    receivablesQuery.staticFilters.value = filters
  }
  receivablesQuery.refresh()
}

const receivableHeaders = [
  { title: 'Cliente', key: 'client', align: 'start' as const, sortable: false },
  { title: 'Concepto / Descripción', key: 'description', align: 'start' as const, sortable: true },
  { title: 'Monto Total', key: 'total_amount', align: 'end' as const, sortable: true, width: '120px' },
  { title: 'Pagado', key: 'paid_amount', align: 'end' as const, sortable: true, width: '110px' },
  { title: 'Saldo', key: 'balance', align: 'end' as const, sortable: false, width: '110px' },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '120px' }
]

function getReceivableStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'warning'
    case '1':
      return 'info'
    case '2':
      return 'primary'
    case '3':
      return 'grey'
    default:
      return 'grey'
  }
}

function getReceivableStatusLabel(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'Pendiente'
    case '1':
      return 'Abonado'
    case '2':
      return 'Pagado'
    case '3':
      return 'Anulado'
    default:
      return 'Desconocido'
  }
}

function formatClientDoc(item: AccountReceivableItem): string {
  if (!item.client_identification_value) return `ID: #${item.client_id}`
  const prefix = String(item.client_identification_type) === '1' ? 'E' : 'V'
  return `${prefix}-${item.client_identification_value}`
}

function canAdjustDueDate(item: AccountReceivableItem): boolean {
  return String(item.status) === '0' && Number(item.paid_amount || 0) === 0
}

// ---------------------------------------------------------------------
// Modal: Ajustar Fecha de Vencimiento
// ---------------------------------------------------------------------
const dueDateModalOpen = ref(false)
const selectedReceivable = ref<AccountReceivableItem | null>(null)
const newDueDate = ref('')
const isSubmittingDueDate = ref(false)

function openAdjustDueDateModal(item: AccountReceivableItem): void {
  selectedReceivable.value = item
  newDueDate.value = item.due_date ? String(item.due_date).substring(0, 10) : ''
  dueDateModalOpen.value = true
}

async function handleSaveDueDate(): Promise<void> {
  if (!selectedReceivable.value || !branchesStore.activeBranchId) return
  if (!newDueDate.value.trim()) {
    showMessage('Debes ingresar una fecha de vencimiento válida.', 'error')
    return
  }

  isSubmittingDueDate.value = true
  try {
    await updateAccountReceivable(
      branchesStore.activeBranchId,
      selectedReceivable.value.id,
      { due_date: newDueDate.value.trim() }
    )
    showMessage('Fecha de vencimiento actualizada exitosamente.')
    dueDateModalOpen.value = false
    selectedReceivable.value = null
    receivablesQuery.refresh()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { messages?: Record<string, string> | string } } }
    const serverMsg =
      typeof axiosErr.response?.data?.messages === 'string'
        ? axiosErr.response.data.messages
        : Object.values(axiosErr.response?.data?.messages || {})[0]
    const msg = serverMsg || (err instanceof Error ? err.message : 'Error al actualizar la fecha de vencimiento.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingDueDate.value = false
  }
}

// Sincronizar morosidad masiva
const isSyncingOverdue = ref(false)
async function handleSyncOverdue(): Promise<void> {
  if (!branchesStore.activeBranchId) {
    showMessage('Selecciona una sucursal activa para sincronizar.', 'error')
    return
  }
  isSyncingOverdue.value = true
  try {
    const res = await accountingStore.syncOverdue(branchesStore.activeBranchId)
    showMessage(`Morosidad sincronizada: ${res.updated} clientes actualizados de ${res.processed} evaluados.`)
    receivablesQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al sincronizar morosidad.'
    showMessage(msg, 'error')
  } finally {
    isSyncingOverdue.value = false
  }
}

watch(
  () => branchesStore.activeBranchId,
  (newBranchId) => {
    if (newBranchId) {
      receivablesQuery.refresh()
    }
  }
)
</script>

<template>
  <div class="accounts-receivable-view">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      rounded="lg"
      title="Sucursal no seleccionada"
      text="Para gestionar Cuentas por Cobrar debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert-receivables"
    />

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: ENCABEZADO Y ACCIONES PRINCIPALES           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-9">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Cuentas por Cobrar
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Auditoría de obligaciones de pago, control de cuotas emitidas y seguimiento de cartera
        </p>
      </div>

      <!-- Acción Superior: Sincronizar Mora -->
      <div>
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-sync"
          :loading="isSyncingOverdue"
          class="text-none font-weight-medium"
          data-testid="btn-sync-overdue"
          @click="handleSyncOverdue"
        >
          Sincronizar Mora
        </v-btn>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA (SECCIÓN SOLA, 7 COLS)   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-3">
      <v-col cols="12" md="7">
        <v-text-field
          v-model="receivablesQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por nombre, apellido o cédula..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="receivable-search-input"
        />
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TERCERA SECCIÓN: FILTROS RÁPIDOS Y BOTÓN DE RECARGA          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
      <!-- Chips alineados a la izquierda -->
      <div class="d-flex align-center flex-wrap ga-2">
        <AppChipFilter
          field="status"
          :items="statusFilterOptions"
          all-text="Todos"
          color="primary"
          density="comfortable"
          data-testid="receivable-chip-filter"
          @change="handleStatusFilterChange"
        />
      </div>

      <!-- Botón de recarga a la derecha con tooltip -->
      <v-tooltip text="Recargar la tabla" location="top" color="#1E293B">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-refresh"
            variant="flat"
            color="white"
            size="small"
            class="border rounded-circle flex-shrink-0"
            :loading="receivablesQuery.isLoading.value"
            data-testid="btn-refresh-receivables"
            @click="receivablesQuery.refresh()"
          />
        </template>
      </v-tooltip>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CUARTA SECCIÓN: TABLA BLANCA ESTANDARIZADA                   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="receivablesQuery.itemsPerPage.value"
        v-model:page="receivablesQuery.page.value"
        v-model:sort-by="receivablesQuery.sortBy.value"
        :headers="receivableHeaders"
        :items="receivablesQuery.items.value"
        :items-length="receivablesQuery.totalItems.value"
        :loading="receivablesQuery.isLoading.value"
        :mobile="smAndDown"
        no-data-text="No hay cuentas por cobrar registradas"
        loading-text="Cargando cuentas por cobrar..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="receivables-table"
        @update:options="receivablesQuery.onUpdateOptions"
      >
        <!-- Slot Cliente con Cédula / Documento -->
        <template #[`item.client`]="{ item }">
          <div class="py-1">
            <div class="font-weight-medium text-body-2 text-high-emphasis">
              {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || '' }}
            </div>
            <div class="text-caption text-medium-emphasis font-mono">
              {{ formatClientDoc(item) }}
            </div>
          </div>
        </template>

        <!-- Slot Concepto / Descripción -->
        <template #[`item.description`]="{ item }">
          <div class="py-1">
            <div class="font-weight-medium text-body-2 text-high-emphasis">
              {{ item.concept_name || 'Cuota de Cobro' }}
            </div>
            <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 280px">
              {{ item.description || '—' }}
            </div>
          </div>
        </template>

        <!-- Slot Monto Total -->
        <template #[`item.total_amount`]="{ item }">
          <span class="font-weight-bold text-body-2 text-high-emphasis">
            ${{ Number(item.total_amount || 0).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Monto Pagado -->
        <template #[`item.paid_amount`]="{ item }">
          <span class="text-body-2 font-weight-medium text-medium-emphasis">
            ${{ Number(item.paid_amount || 0).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Saldo Pendiente -->
        <template #[`item.balance`]="{ item }">
          <span
            class="font-weight-bold text-body-2"
            :class="Number(item.total_amount || 0) - Number(item.paid_amount || 0) > 0 ? 'text-error' : 'text-success'"
          >
            ${{ Math.max(0, Number(item.total_amount || 0) - Number(item.paid_amount || 0)).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Vencimiento -->
        <template #[`item.due_date`]="{ item }">
          <span class="text-caption text-medium-emphasis font-mono">
            {{ item.due_date ? String(item.due_date).substring(0, 10) : '—' }}
          </span>
        </template>

        <!-- Slot Estado -->
        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getReceivableStatusColor(item.status)"
            size="small"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ getReceivableStatusLabel(item.status) }}
          </v-chip>
        </template>

        <!-- Slot Acciones: Ajustar Fecha de Vencimiento (Solo cuotas no tocadas) -->
        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center justify-end">
            <v-tooltip
              v-if="canAdjustDueDate(item)"
              text="Ajustar fecha de vencimiento"
              location="top"
              color="#1E293B"
            >
              <template #activator="{ props: ttProps }">
                <v-btn
                  v-bind="ttProps"
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="mdi-calendar-edit"
                  class="text-none font-weight-medium"
                  data-testid="btn-adjust-due-date"
                  @click="openAdjustDueDateModal(item)"
                >
                  Ajustar
                </v-btn>
              </template>
            </v-tooltip>
          </div>
        </template>

        <!-- Estado Vacío -->
        <template #no-data>
          <div class="py-12 text-center text-medium-emphasis">
            <v-icon icon="mdi-file-document-outline" size="48" class="mb-3 text-disabled" />
            <div class="text-subtitle-1 font-weight-medium">No se encontraron cuentas por cobrar</div>
            <div class="text-caption text-disabled">
              No hay obligaciones registradas o no coinciden con los criterios de búsqueda.
            </div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: AJUSTAR FECHA DE VENCIMIENTO                           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="dueDateModalOpen"
      title="Ajustar Fecha de Vencimiento"
      subtitle="Modifica la fecha de cobro de la obligación seleccionada"
      max-width="480"
      persistent
      :loading="isSubmittingDueDate"
      submit-text="Actualizar Fecha"
      submit-icon="mdi-check"
      submit-test-id="btn-save-due-date"
      form-id="form-adjust-due-date"
      data-testid="adjust-due-date-modal"
      @submit="handleSaveDueDate"
    >
      <v-form id="form-adjust-due-date" @submit.prevent="handleSaveDueDate">
        <div v-if="selectedReceivable" class="mb-4 pa-3 bg-grey-lighten-4 rounded-lg border">
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption text-medium-emphasis">Cliente:</span>
            <span class="text-caption font-weight-bold text-high-emphasis">
              {{ selectedReceivable.client_first_name }} {{ selectedReceivable.client_last_name }} ({{ formatClientDoc(selectedReceivable) }})
            </span>
          </div>
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption text-medium-emphasis">Concepto:</span>
            <span class="text-caption font-weight-medium text-high-emphasis">
              {{ selectedReceivable.concept_name || 'Cuota de Cobro' }}
            </span>
          </div>
          <div v-if="selectedReceivable.description" class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption text-medium-emphasis">Descripción:</span>
            <span class="text-caption font-weight-medium text-high-emphasis">
              {{ selectedReceivable.description }}
            </span>
          </div>
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption text-medium-emphasis">Monto Total:</span>
            <span class="text-caption font-weight-bold text-high-emphasis">
              ${{ Number(selectedReceivable.total_amount).toFixed(2) }}
            </span>
          </div>
          <div class="d-flex justify-space-between align-center">
            <span class="text-caption text-medium-emphasis">Vencimiento Actual:</span>
            <span class="text-caption font-mono font-weight-bold text-primary">
              {{ selectedReceivable.due_date ? String(selectedReceivable.due_date).substring(0, 10) : '—' }}
            </span>
          </div>
        </div>

        <v-text-field
          v-model="newDueDate"
          label="Nueva Fecha de Vencimiento *"
          type="date"
          variant="outlined"
          density="comfortable"
          data-testid="input-new-due-date"
        />
      </v-form>
    </AppModal>

    <!-- Snackbar de Notificación -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="bottom right"
      data-testid="receivables-snackbar"
    >
      {{ snackbar.text }}
      <template #actions>
        <v-btn icon="mdi-close" size="small" variant="text" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.min-w-160 {
  min-width: 160px;
}
</style>
