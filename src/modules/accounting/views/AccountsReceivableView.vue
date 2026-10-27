<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchAccountsReceivable } from '../api/accounting.api'
import type { AccountReceivableItem } from '../types'

const router = useRouter()
const branchesStore = useBranchesStore()
const accountingStore = useAccountingStore()

// Feedback / Notificaciones
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

function showMessage(message: string, color: 'success' | 'error' | 'info' = 'success'): void {
  snackbar.value = { show: true, message, color }
}

// Filtro de estado
const statusFilter = ref<string>('all')

const receivablesQuery = useDataQuery<AccountReceivableItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchAccountsReceivable(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['description', 'client_first_name', 'client_last_name', 'concept_name']
  }
)

watch(statusFilter, (newStatus) => {
  if (newStatus === 'all') {
    receivablesQuery.staticFilters.value = []
  } else {
    receivablesQuery.staticFilters.value = [
      ['status', newStatus, '=', 'AND']
    ]
  }
  receivablesQuery.refresh()
})

const receivableHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '70px' },
  { title: 'Cliente', key: 'client', align: 'start' as const, sortable: false },
  { title: 'Concepto / Descripción', key: 'description', align: 'start' as const, sortable: true },
  { title: 'Monto Total', key: 'total_amount', align: 'end' as const, sortable: true, width: '120px' },
  { title: 'Pagado', key: 'paid_amount', align: 'end' as const, sortable: true, width: '110px' },
  { title: 'Saldo', key: 'balance', align: 'end' as const, sortable: false, width: '110px' },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '100px' }
]

function getReceivableStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'grey-darken-2'
    case '1':
      return 'secondary'
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

function goToCreateReceipt(receivable?: AccountReceivableItem): void {
  if (receivable) {
    router.push({
      path: '/accounting/receipts',
      query: {
        action: 'new',
        receivable_id: String(receivable.id),
        client_id: String(receivable.client_id),
        client_name: `${receivable.client_first_name || ''} ${receivable.client_last_name || ''}`.trim(),
        amount: String(Math.max(0, Number(receivable.total_amount) - Number(receivable.paid_amount)))
      }
    })
  } else {
    router.push({
      path: '/accounting/receipts',
      query: { action: 'new' }
    })
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

    <!-- Encabezado de la Vista (Estilo Estándar sin card y sin icono) -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Cuentas por Cobrar (CxC)
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Auditoría de obligaciones de pago, control de cuotas emitidas y seguimiento de cartera
        </p>
      </div>

      <!-- Acciones en Pantallas Medianas / Grandes -->
      <div class="d-none d-sm-flex align-center ga-2">
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

        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-go-to-receipt"
          @click="goToCreateReceipt()"
        >
          Emitir Recibo
        </v-btn>
      </div>

      <!-- Menú Desplegable en Pantallas Pequeñas (Mobile) -->
      <div class="d-flex d-sm-none">
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
              data-testid="btn-mobile-actions-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-plus"
              title="Emitir Recibo"
              @click="goToCreateReceipt()"
            />
            <v-list-item
              prepend-icon="mdi-sync"
              title="Sincronizar Mora"
              :disabled="isSyncingOverdue"
              @click="handleSyncOverdue"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Tabla de Cuentas por Cobrar -->
    <v-card elevation="0" rounded="lg" class="border bg-white">
      <!-- Barra de Búsqueda y Filtros -->
      <v-card-text class="pb-2">
        <v-row density="compact" align="center">
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="receivablesQuery.search.value"
              placeholder="Buscar por cliente, concepto o glosa..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              data-testid="receivable-search-input"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="statusFilter"
              :items="[
                { title: 'Todos los estados', value: 'all' },
                { title: 'Pendientes', value: '0' },
                { title: 'Abonados parcialmente', value: '1' },
                { title: 'Pagados', value: '2' },
                { title: 'Anulados', value: '3' }
              ]"
              item-title="title"
              item-value="value"
              label="Estado de la Obligación"
              variant="outlined"
              density="compact"
              hide-details
              data-testid="receivable-status-filter"
            />
          </v-col>
          <v-col cols="12" md="4" class="text-right">
            <v-btn
              variant="text"
              color="primary"
              prepend-icon="mdi-refresh"
              size="small"
              class="text-none"
              @click="receivablesQuery.refresh()"
            >
              Recargar Cartera
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider />

      <v-data-table-server
        v-model:page="receivablesQuery.page.value"
        v-model:items-per-page="receivablesQuery.itemsPerPage.value"
        :headers="receivableHeaders"
        :items="receivablesQuery.items.value"
        :items-length="receivablesQuery.totalItems.value"
        :loading="receivablesQuery.isLoading.value"
        hover
        density="comfortable"
        data-testid="receivables-table"
        @update:options="receivablesQuery.onUpdateOptions"
      >
        <!-- Slot Cliente -->
        <template #[`item.client`]="{ item }">
          <div class="py-1">
            <div class="font-weight-medium text-body-2 text-high-emphasis">
              {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
            </div>
            <div class="text-caption text-medium-emphasis">ID: {{ item.client_id }}</div>
          </div>
        </template>

        <!-- Slot Concepto / Descripción -->
        <template #[`item.description`]="{ item }">
          <div>
            <div class="font-weight-medium text-body-2 text-high-emphasis">{{ item.concept_name || 'Cuota de Cobro' }}</div>
            <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 280px">
              {{ item.description || '—' }}
            </div>
          </div>
        </template>

        <!-- Slot Monto Total -->
        <template #[`item.total_amount`]="{ item }">
          <span class="font-weight-bold text-body-2">
            ${{ Number(item.total_amount).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Monto Pagado -->
        <template #[`item.paid_amount`]="{ item }">
          <span class="text-body-2 font-weight-medium">
            ${{ Number(item.paid_amount).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Saldo Pendiente -->
        <template #[`item.balance`]="{ item }">
          <span class="font-weight-bold text-body-2">
            ${{ Math.max(0, Number(item.total_amount) - Number(item.paid_amount)).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Vencimiento -->
        <template #[`item.due_date`]="{ item }">
          <span class="text-caption text-medium-emphasis">
            {{ item.due_date }}
          </span>
        </template>

        <!-- Slot Estado -->
        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getReceivableStatusColor(item.status)"
            size="small"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ getReceivableStatusLabel(item.status) }}
          </v-chip>
        </template>

        <!-- Slot Acciones -->
        <template #[`item.actions`]="{ item }">
          <v-btn
            v-if="String(item.status) === '0' || String(item.status) === '1'"
            size="small"
            variant="tonal"
            color="primary"
            class="text-none font-weight-medium"
            data-testid="btn-pay-receivable"
            @click="goToCreateReceipt(item)"
          >
            Cobrar
          </v-btn>
          <span v-else class="text-caption text-medium-emphasis">Saldado</span>
        </template>

        <!-- Estado Vacío -->
        <template #no-data>
          <div class="text-center py-8">
            <v-icon icon="mdi-file-document-outline" size="48" color="grey" class="mb-2" />
            <div class="text-subtitle-1 text-grey font-weight-medium">
              No se encontraron cuentas por cobrar en esta sucursal
            </div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Snackbar de Notificación -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="4000"
      location="top right"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn icon="mdi-close" size="small" variant="text" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </div>
</template>
