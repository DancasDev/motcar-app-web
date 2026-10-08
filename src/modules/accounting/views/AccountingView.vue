<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchAccountsReceivable,
  fetchReceipts,
  fetchClientCredits
} from '../api/accounting.api'
import type {
  AccountReceivableItem,
  ReceiptItem,
  FullReceiptEmissionPayload
} from '../types'

const branchesStore = useBranchesStore()
const accountingStore = useAccountingStore()

type AccountingTab = 'receivables' | 'receipts' | 'treasury'
const activeTab = ref<AccountingTab>('receivables')

// Feedback / Notificaciones
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

function showMessage(message: string, color: 'success' | 'error' | 'info' = 'success'): void {
  snackbar.value = { show: true, message, color }
}

// ---------------------------------------------------------------------
// 1. Cuentas por Cobrar (CxC / Receivables)
// ---------------------------------------------------------------------
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

// Filtro estático reactivo para estado de cuenta por cobrar
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
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '120px' }
]

function getReceivableStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'warning'
    case '1':
      return 'info'
    case '2':
      return 'success'
    case '3':
      return 'grey'
    default:
      return 'default'
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

// ---------------------------------------------------------------------
// 2. Recibos de Caja (Receipts)
// ---------------------------------------------------------------------
const receiptsQuery = useDataQuery<ReceiptItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchReceipts(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['code', 'client_first_name', 'client_last_name', 'collector_first_name']
  }
)

const receiptHeaders = [
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '180px' },
  { title: 'Fecha', key: 'date', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Cliente', key: 'client', align: 'start' as const, sortable: false },
  { title: 'Cajero', key: 'collector', align: 'start' as const, sortable: false },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '180px' }
]

function getReceiptStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'grey'
    case '1':
      return 'success'
    case '2':
      return 'error'
    default:
      return 'default'
  }
}

function getReceiptStatusLabel(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'Borrador'
    case '1':
      return 'Confirmado'
    case '2':
      return 'Anulado'
    default:
      return 'Desconocido'
  }
}

// Detalle de Recibo
const receiptDetailDialogOpen = ref(false)
async function handleViewReceiptDetail(receipt: ReceiptItem): Promise<void> {
  if (!branchesStore.activeBranchId) return
  try {
    await accountingStore.loadReceiptDetail(branchesStore.activeBranchId, receipt.id)
    receiptDetailDialogOpen.value = true
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al cargar detalle del recibo.'
    showMessage(msg, 'error')
  }
}

// Descargar PDF
const isDownloadingPdf = ref(false)
async function handleDownloadPdf(receipt: ReceiptItem): Promise<void> {
  if (!branchesStore.activeBranchId) return
  isDownloadingPdf.value = true
  try {
    await accountingStore.downloadPdf(branchesStore.activeBranchId, receipt.id, receipt.code)
    showMessage(`Comprobante ${receipt.code} descargado exitosamente.`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al descargar el PDF del recibo.'
    showMessage(msg, 'error')
  } finally {
    isDownloadingPdf.value = false
  }
}

// Anular Recibo
const voidDialogOpen = ref(false)
const voidReceiptTarget = ref<ReceiptItem | null>(null)
const voidReason = ref('')
const isVoidingReceipt = ref(false)

function openVoidDialog(receipt: ReceiptItem): void {
  voidReceiptTarget.value = receipt
  voidReason.value = ''
  voidDialogOpen.value = true
}

async function handleConfirmVoid(): Promise<void> {
  if (!voidReceiptTarget.value || !branchesStore.activeBranchId) return
  if (!voidReason.value.trim()) {
    showMessage('Debe especificar un motivo para anular el comprobante.', 'error')
    return
  }

  isVoidingReceipt.value = true
  try {
    await accountingStore.cancelReceipt(
      branchesStore.activeBranchId,
      voidReceiptTarget.value.id,
      voidReason.value.trim()
    )
    showMessage('Recibo anulado exitosamente y efectos contables revertidos.')
    voidDialogOpen.value = false
    receiptsQuery.refresh()
    receivablesQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al anular el recibo.'
    showMessage(msg, 'error')
  } finally {
    isVoidingReceipt.value = false
  }
}

// ---------------------------------------------------------------------
// 3. Diálogo de Emisión de Recibo de Cobro (Nuevo Recibo)
// ---------------------------------------------------------------------
const receiptDialogOpen = ref(false)
const isSubmittingReceipt = ref(false)

interface PaymentFormItem {
  origin_type: '0' | '1'
  origin_id: number | null
  amount: number
  reference: string
  notes: string
}

const receiptForm = ref<{
  client_id: number | null
  client_name: string
  date: string
  notes: string
  selectedReceivableIds: number[]
  payments: PaymentFormItem[]
  confirmImmediately: boolean
}>({
  client_id: 1,
  client_name: '',
  date: new Date().toISOString().substring(0, 10),
  notes: '',
  selectedReceivableIds: [],
  payments: [],
  confirmImmediately: true
})

// Cuentas por cobrar filtradas para el cliente en el formulario
const clientReceivables = computed(() => {
  if (!receiptForm.value.client_id) return []
  return receivablesQuery.items.value.filter(
    (r) =>
      String(r.client_id) === String(receiptForm.value.client_id) &&
      (String(r.status) === '0' || String(r.status) === '1')
  )
})

// Sumatorias en vivo para el formulario de emisión
const totalSelectedDebt = computed(() => {
  return receivablesQuery.items.value
    .filter((r) => receiptForm.value.selectedReceivableIds.includes(Number(r.id)))
    .reduce((sum, r) => {
      const balance = Number(r.total_amount) - Number(r.paid_amount)
      return sum + (balance > 0 ? balance : 0)
    }, 0)
})

const totalPaymentsAmount = computed(() => {
  return receiptForm.value.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
})

const paymentDifference = computed(() => {
  return totalPaymentsAmount.value - totalSelectedDebt.value
})

function openCreateReceiptDialog(preselectedReceivable?: AccountReceivableItem): void {
  const defaultBank = accountingStore.bankAccounts[0]?.id
    ? Number(accountingStore.bankAccounts[0].id)
    : 1

  if (preselectedReceivable) {
    receiptForm.value = {
      client_id: Number(preselectedReceivable.client_id),
      client_name: `${preselectedReceivable.client_first_name || ''} ${preselectedReceivable.client_last_name || ''}`.trim(),
      date: new Date().toISOString().substring(0, 10),
      notes: `Recaudo cuota: ${preselectedReceivable.description || ''}`,
      selectedReceivableIds: [Number(preselectedReceivable.id)],
      payments: [
        {
          origin_type: '0',
          origin_id: defaultBank,
          amount: Math.max(0, Number(preselectedReceivable.total_amount) - Number(preselectedReceivable.paid_amount)),
          reference: '',
          notes: ''
        }
      ],
      confirmImmediately: true
    }
  } else {
    receiptForm.value = {
      client_id: 1,
      client_name: '',
      date: new Date().toISOString().substring(0, 10),
      notes: 'Recaudación de cuotas periódicas',
      selectedReceivableIds: [],
      payments: [
        {
          origin_type: '0',
          origin_id: defaultBank,
          amount: 50,
          reference: '',
          notes: ''
        }
      ],
      confirmImmediately: true
    }
  }

  receiptDialogOpen.value = true
}

function addPaymentRow(): void {
  const defaultBank = accountingStore.bankAccounts[0]?.id
    ? Number(accountingStore.bankAccounts[0].id)
    : 1
  receiptForm.value.payments.push({
    origin_type: '0',
    origin_id: defaultBank,
    amount: 0,
    reference: '',
    notes: ''
  })
}

function removePaymentRow(index: number): void {
  receiptForm.value.payments.splice(index, 1)
}

async function handleEmitReceipt(): Promise<void> {
  if (!branchesStore.activeBranchId) {
    showMessage('Debes seleccionar una sucursal activa.', 'error')
    return
  }
  if (!receiptForm.value.client_id) {
    showMessage('Debes ingresar el ID del cliente.', 'error')
    return
  }
  if (receiptForm.value.selectedReceivableIds.length === 0) {
    showMessage('Debes seleccionar al menos una cuenta por cobrar a imputar.', 'error')
    return
  }
  if (receiptForm.value.payments.length === 0 || totalPaymentsAmount.value <= 0) {
    showMessage('Debes ingresar al menos una forma de pago válida con importe mayor a 0.', 'error')
    return
  }

  isSubmittingReceipt.value = true
  try {
    const payload: FullReceiptEmissionPayload = {
      client_id: receiptForm.value.client_id,
      date: receiptForm.value.date,
      notes: receiptForm.value.notes.trim() || undefined,
      items: receiptForm.value.selectedReceivableIds,
      payments: receiptForm.value.payments.map((p) => ({
        origin_type: p.origin_type,
        origin_id: Number(p.origin_id),
        amount: Number(p.amount),
        reference: p.reference.trim() || undefined,
        notes: p.notes.trim() || undefined
      })),
      confirmImmediately: receiptForm.value.confirmImmediately
    }

    const receiptId = await accountingStore.createFullReceipt(branchesStore.activeBranchId, payload)
    showMessage(`Recibo #${receiptId} emitido exitosamente.`)
    receiptDialogOpen.value = false
    receiptsQuery.refresh()
    receivablesQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al emitir el recibo de caja.'
    showMessage(msg, 'error')
  } finally {
    isSubmittingReceipt.value = false
  }
}

// ---------------------------------------------------------------------
// 4. Tesorería, Cuentas Bancarias y Saldos a Favor (Pestaña 3)
// ---------------------------------------------------------------------
const creditsQuery = useDataQuery(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchClientCredits(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['client_first_name', 'client_last_name', 'receipt_code']
  }
)

async function handleVoidCredit(creditId: string | number): Promise<void> {
  if (!branchesStore.activeBranchId) return
  try {
    await accountingStore.voidCredit(branchesStore.activeBranchId, creditId)
    showMessage('Saldo a favor anulado administrativamente.')
    creditsQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al anular el saldo a favor.'
    showMessage(msg, 'error')
  }
}

// Inicialización de catálogos al montar
onMounted(async () => {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadBankAccounts()
  ])
})

// Auto recarga reactiva cuando cambia la sucursal activa
watch(
  () => branchesStore.activeBranchId,
  (newBranchId) => {
    if (newBranchId) {
      receivablesQuery.refresh()
      receiptsQuery.refresh()
      creditsQuery.refresh()
    }
  }
)
</script>

<template>
  <div class="accounting-view">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      rounded="lg"
      title="Sucursal no seleccionada"
      text="Para gestionar Cuentas por Cobrar, Recibos de Caja y Conciliación Bancaria, debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert-accounting"
    />

    <!-- Encabezado de la Vista -->
    <v-card class="mb-4" elevation="1" rounded="lg">
      <v-card-text class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-3">
        <div>
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-cash-register" color="primary" size="32" />
            <h1 class="text-h5 font-weight-bold text-grey-darken-3">
              Contabilidad, Tesorería y Cobranzas
            </h1>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-0 mt-1">
            Gestión integral de cartera de cobranzas, emisión de recibos y conciliación bancaria.
          </p>
        </div>

        <div class="d-flex flex-wrap align-center ga-2">
          <!-- Chip de Sucursal Activa -->
          <v-chip
            v-if="branchesStore.activeBranch"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-office-building"
            class="font-weight-medium"
          >
            {{ branchesStore.activeBranch.name }}
          </v-chip>

          <!-- Sincronizar Morosidad -->
          <v-btn
            variant="outlined"
            color="warning"
            prepend-icon="mdi-sync-alert"
            :loading="isSyncingOverdue"
            class="text-none"
            data-testid="btn-sync-overdue"
            @click="handleSyncOverdue"
          >
            Sincronizar Mora
          </v-btn>

          <!-- Emitir Recibo de Cobro -->
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            class="text-none font-weight-medium"
            data-testid="btn-create-receipt"
            @click="openCreateReceiptDialog()"
          >
            Emitir Recibo
          </v-btn>
        </div>
      </v-card-text>

      <v-divider />

      <!-- Pestañas de Navegación -->
      <v-tabs
        v-model="activeTab"
        color="primary"
        align-tabs="start"
        density="compact"
        class="px-2"
      >
        <v-tab value="receivables" prepend-icon="mdi-cash-clock" data-testid="tab-receivables">
          Cuentas por Cobrar (CxC)
        </v-tab>
        <v-tab value="receipts" prepend-icon="mdi-receipt-text-outline" data-testid="tab-receipts">
          Recibos de Caja
        </v-tab>
        <v-tab value="treasury" prepend-icon="mdi-bank-outline" data-testid="tab-treasury">
          Tesorería y Bancos
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Contenido por Pestaña -->
    <v-window v-model="activeTab">
      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 1: CUENTAS POR COBRAR (CxC)                       -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="receivables">
        <v-card elevation="1" rounded="lg">
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
                  @click="receivablesQuery.refresh()"
                >
                  Recargar Cartera
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <!-- Tabla de Cuentas por Cobrar -->
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
              <div class="d-flex align-center ga-2 py-1">
                <v-avatar color="primary" size="30" class="text-caption font-weight-bold text-white">
                  {{ (item.client_first_name?.[0] || 'C').toUpperCase() }}
                </v-avatar>
                <div>
                  <div class="font-weight-medium text-body-2">
                    {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
                  </div>
                  <div class="text-caption text-grey">ID: {{ item.client_id }}</div>
                </div>
              </div>
            </template>

            <!-- Slot Concepto / Descripción -->
            <template #[`item.description`]="{ item }">
              <div>
                <div class="font-weight-medium text-body-2">{{ item.concept_name || 'Cuota de Cobro' }}</div>
                <div class="text-caption text-grey text-truncate" style="max-width: 280px">
                  {{ item.description || '-' }}
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
              <span class="text-body-2 text-success">
                ${{ Number(item.paid_amount).toFixed(2) }}
              </span>
            </template>

            <!-- Slot Saldo Pendiente -->
            <template #[`item.balance`]="{ item }">
              <span class="font-weight-bold text-body-2 text-error">
                ${{ Math.max(0, Number(item.total_amount) - Number(item.paid_amount)).toFixed(2) }}
              </span>
            </template>

            <!-- Slot Vencimiento -->
            <template #[`item.due_date`]="{ item }">
              <v-chip size="x-small" variant="flat" color="grey-lighten-3">
                <v-icon start icon="mdi-calendar" size="x-small" />
                {{ item.due_date }}
              </v-chip>
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
                prepend-icon="mdi-cash"
                class="text-none"
                data-testid="btn-pay-receivable"
                @click="openCreateReceiptDialog(item)"
              >
                Cobrar
              </v-btn>
              <span v-else class="text-caption text-grey">Saldado</span>
            </template>

            <!-- Estado Vacío -->
            <template #no-data>
              <div class="text-center py-8">
                <v-icon icon="mdi-cash-remove" size="48" color="grey" class="mb-2" />
                <div class="text-subtitle-1 text-grey font-weight-medium">
                  No se encontraron cuentas por cobrar en esta sucursal
                </div>
              </div>
            </template>
          </v-data-table-server>
        </v-card>
      </v-window-item>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 2: RECIBOS DE CAJA (RECEIPTS)                     -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="receipts">
        <v-card elevation="1" rounded="lg">
          <!-- Búsqueda de Recibos -->
          <v-card-text class="pb-2">
            <v-row density="compact" align="center">
              <v-col cols="12" sm="6" md="5">
                <v-text-field
                  v-model="receiptsQuery.search.value"
                  placeholder="Buscar por código de recibo, cliente o cajero..."
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  data-testid="receipt-search-input"
                />
              </v-col>
              <v-col cols="12" sm="6" md="7" class="text-right">
                <v-btn
                  variant="text"
                  color="primary"
                  prepend-icon="mdi-refresh"
                  size="small"
                  @click="receiptsQuery.refresh()"
                >
                  Recargar Recibos
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <!-- Tabla de Recibos -->
          <v-data-table-server
            v-model:page="receiptsQuery.page.value"
            v-model:items-per-page="receiptsQuery.itemsPerPage.value"
            :headers="receiptHeaders"
            :items="receiptsQuery.items.value"
            :items-length="receiptsQuery.totalItems.value"
            :loading="receiptsQuery.isLoading.value"
            hover
            density="comfortable"
            data-testid="receipts-table"
            @update:options="receiptsQuery.onUpdateOptions"
          >
            <!-- Slot Código -->
            <template #[`item.code`]="{ item }">
              <span class="font-weight-bold text-body-2 font-monospace text-primary">
                {{ item.code }}
              </span>
            </template>

            <!-- Slot Fecha -->
            <template #[`item.date`]="{ item }">
              <span class="text-body-2">{{ item.date }}</span>
            </template>

            <!-- Slot Cliente -->
            <template #[`item.client`]="{ item }">
              <span class="font-weight-medium text-body-2">
                {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
              </span>
            </template>

            <!-- Slot Cajero -->
            <template #[`item.collector`]="{ item }">
              <span class="text-body-2 text-grey-darken-1">
                {{ item.collector_first_name || 'Cajero' }} {{ item.collector_last_name || '' }}
              </span>
            </template>

            <!-- Slot Estado -->
            <template #[`item.status`]="{ item }">
              <v-chip
                :color="getReceiptStatusColor(item.status)"
                size="small"
                variant="tonal"
                class="font-weight-medium"
              >
                {{ getReceiptStatusLabel(item.status) }}
              </v-chip>
            </template>

            <!-- Slot Acciones -->
            <template #[`item.actions`]="{ item }">
              <div class="d-flex justify-end ga-1">
                <v-btn
                  icon="mdi-eye"
                  size="small"
                  variant="text"
                  color="info"
                  title="Ver Detalle"
                  data-testid="btn-view-receipt-detail"
                  @click="handleViewReceiptDetail(item)"
                />
                <v-btn
                  icon="mdi-file-pdf-box"
                  size="small"
                  variant="text"
                  color="error"
                  title="Descargar PDF"
                  data-testid="btn-download-receipt-pdf"
                  :loading="isDownloadingPdf"
                  @click="handleDownloadPdf(item)"
                />
                <v-btn
                  v-if="String(item.status) === '1'"
                  icon="mdi-cancel"
                  size="small"
                  variant="text"
                  color="warning"
                  title="Anular Recibo"
                  data-testid="btn-void-receipt"
                  @click="openVoidDialog(item)"
                />
              </div>
            </template>

            <!-- Estado Vacío -->
            <template #no-data>
              <div class="text-center py-8">
                <v-icon icon="mdi-receipt-text-remove" size="48" color="grey" class="mb-2" />
                <div class="text-subtitle-1 text-grey font-weight-medium">
                  No hay recibos emitidos en esta sucursal
                </div>
              </div>
            </template>
          </v-data-table-server>
        </v-card>
      </v-window-item>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 3: TESORERÍA, BANCOS Y CRÉDITOS                   -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="treasury">
        <v-row>
          <!-- Cuentas Receptoras / Bancos -->
          <v-col cols="12" md="6">
            <v-card elevation="1" rounded="lg" class="fill-height">
              <v-card-item class="bg-primary text-white py-3">
                <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
                  <v-icon icon="mdi-bank" />
                  Cuentas Receptoras de Pago
                </v-card-title>
              </v-card-item>

              <v-table density="compact" class="text-body-2">
                <thead>
                  <tr>
                    <th>Nombre de la Cuenta</th>
                    <th>Categoría</th>
                    <th>Moneda</th>
                    <th>Detalles / Número</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="acc in accountingStore.bankAccounts" :key="acc.id">
                    <td class="font-weight-medium">{{ acc.name }}</td>
                    <td>{{ acc.category_name || 'Bancaria' }}</td>
                    <td>
                      <v-chip size="x-small" color="primary" variant="outlined">
                        {{ acc.currency_code || 'USD' }}
                      </v-chip>
                    </td>
                    <td class="text-caption text-grey-darken-1">
                      {{ acc.metadata?.account_number || 'Cuenta de cobro' }}
                    </td>
                  </tr>
                  <tr v-if="accountingStore.bankAccounts.length === 0">
                    <td colspan="4" class="text-center py-4 text-grey">
                      No hay cuentas bancarias configuradas
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>

          <!-- Monedas y Cotizaciones -->
          <v-col cols="12" md="6">
            <v-card elevation="1" rounded="lg" class="fill-height">
              <v-card-item class="bg-primary text-white py-3">
                <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
                  <v-icon icon="mdi-currency-usd" />
                  Monedas y Tasas de Cambio
                </v-card-title>
              </v-card-item>

              <v-table density="compact" class="text-body-2">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre de la Moneda</th>
                    <th>Símbolo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cur in accountingStore.currencies" :key="cur.id">
                    <td class="font-weight-bold">{{ cur.code }}</td>
                    <td>{{ cur.name }}</td>
                    <td>{{ cur.symbol }}</td>
                    <td>
                      <v-chip
                        :color="String(cur.is_disabled) === '0' ? 'success' : 'grey'"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ String(cur.is_disabled) === '0' ? 'Activa' : 'Inactiva' }}
                      </v-chip>
                    </td>
                  </tr>
                  <tr v-if="accountingStore.currencies.length === 0">
                    <td colspan="4" class="text-center py-4 text-grey">
                      No hay monedas registradas
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>

          <!-- Saldos a Favor de Clientes -->
          <v-col cols="12">
            <v-card elevation="1" rounded="lg">
              <v-card-item class="py-3">
                <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2 text-grey-darken-3">
                  <v-icon icon="mdi-cash-refund" color="success" />
                  Saldos a Favor de Clientes (Créditos Disponibles)
                </v-card-title>
              </v-card-item>

              <v-divider />

              <v-table density="compact" class="text-body-2">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Recibo Origen</th>
                    <th>Monto Inicial</th>
                    <th>Saldo Disponible</th>
                    <th>Estado</th>
                    <th class="text-end">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in creditsQuery.items.value" :key="c.id">
                    <td>#{{ c.id }}</td>
                    <td class="font-weight-medium">
                      {{ c.client_first_name }} {{ c.client_last_name }}
                    </td>
                    <td>
                      <span class="font-monospace text-primary">{{ c.receipt_code || `#${c.receipt_id}` }}</span>
                    </td>
                    <td>${{ Number(c.amount).toFixed(2) }}</td>
                    <td class="font-weight-bold text-success">
                      ${{ Number(c.available_amount).toFixed(2) }}
                    </td>
                    <td>
                      <v-chip
                        :color="String(c.status) === '0' ? 'success' : String(c.status) === '1' ? 'grey' : 'error'"
                        size="x-small"
                        variant="tonal"
                      >
                        {{ String(c.status) === '0' ? 'Disponible' : String(c.status) === '1' ? 'Consumido' : 'Anulado' }}
                      </v-chip>
                    </td>
                    <td class="text-end">
                      <v-btn
                        v-if="String(c.status) === '0' && Number(c.available_amount) === Number(c.amount)"
                        size="x-small"
                        color="error"
                        variant="text"
                        @click="handleVoidCredit(c.id)"
                      >
                        Anular
                      </v-btn>
                    </td>
                  </tr>
                  <tr v-if="creditsQuery.items.value.length === 0">
                    <td colspan="7" class="text-center py-4 text-grey">
                      No hay saldos a favor pendientes en esta sucursal
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DIÁLOGO: EMITIR RECIBO DE COBRO                            -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-dialog
      v-model="receiptDialogOpen"
      max-width="900"
      persistent
      data-testid="receipt-form-dialog"
    >
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white py-3">
          <div class="d-flex align-center justify-space-between">
            <v-card-title class="text-h6 font-weight-bold d-flex align-center ga-2">
              <v-icon icon="mdi-receipt-text-plus" />
              Emitir Recibo de Cobro
            </v-card-title>
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              color="white"
              @click="receiptDialogOpen = false"
            />
          </div>
        </v-card-item>

        <v-card-text class="pa-4 pa-sm-6">
          <v-form @submit.prevent="handleEmitReceipt">
            <!-- Sección 1: Datos de Cabecera -->
            <div class="text-subtitle-2 font-weight-bold text-grey-darken-3 mb-2">
              1. Cabecera del Comprobante
            </div>
            <v-row density="compact">
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model.number="receiptForm.client_id"
                  label="ID de Cliente Titular *"
                  type="number"
                  variant="outlined"
                  density="compact"
                  data-testid="input-receipt-client-id"
                  required
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="receiptForm.date"
                  label="Fecha del Recibo *"
                  type="date"
                  variant="outlined"
                  density="compact"
                  data-testid="input-receipt-date"
                  required
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="receiptForm.notes"
                  label="Notas / Observaciones"
                  variant="outlined"
                  density="compact"
                  data-testid="input-receipt-notes"
                />
              </v-col>
            </v-row>

            <v-divider class="my-4" />

            <!-- Sección 2: Selección de Obligaciones a Imputar -->
            <div class="d-flex justify-space-between align-center mb-2">
              <div class="text-subtitle-2 font-weight-bold text-grey-darken-3">
                2. Obligaciones / Cuotas Pendientes del Cliente
              </div>
              <v-chip size="small" color="primary" variant="tonal">
                {{ clientReceivables.length }} cuota(s) encontrada(s)
              </v-chip>
            </div>

            <div v-if="clientReceivables.length > 0" class="border rounded pa-2 mb-4 bg-grey-lighten-5">
              <v-table density="compact">
                <thead>
                  <tr>
                    <th style="width: 50px"></th>
                    <th>Cuota / Concepto</th>
                    <th>Vencimiento</th>
                    <th class="text-end">Monto Total</th>
                    <th class="text-end">Saldo Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in clientReceivables" :key="rec.id">
                    <td>
                      <v-checkbox
                        v-model="receiptForm.selectedReceivableIds"
                        :value="Number(rec.id)"
                        density="compact"
                        hide-details
                      />
                    </td>
                    <td class="font-weight-medium">
                      {{ rec.concept_name || 'Cuota' }} - {{ rec.description }}
                    </td>
                    <td>{{ rec.due_date }}</td>
                    <td class="text-end">${{ Number(rec.total_amount).toFixed(2) }}</td>
                    <td class="text-end font-weight-bold text-error">
                      ${{ (Number(rec.total_amount) - Number(rec.paid_amount)).toFixed(2) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
            <v-alert
              v-else
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4 text-caption"
            >
              No se han cargado cuotas pendientes automáticas para el cliente {{ receiptForm.client_id }}. Puedes seleccionar las cuentas directamente desde la tabla de CxC usando el botón "Cobrar".
            </v-alert>

            <v-divider class="my-4" />

            <!-- Sección 3: Formas de Pago -->
            <div class="d-flex justify-space-between align-center mb-2">
              <div class="text-subtitle-2 font-weight-bold text-grey-darken-3">
                3. Medios de Pago Recibidos
              </div>
              <v-btn
                size="small"
                variant="outlined"
                color="primary"
                prepend-icon="mdi-plus"
                class="text-none"
                data-testid="btn-add-payment-method"
                @click="addPaymentRow"
              >
                Agregar Pago
              </v-btn>
            </div>

            <div
              v-for="(payment, index) in receiptForm.payments"
              :key="index"
              class="border rounded pa-3 mb-2 bg-grey-lighten-5"
            >
              <v-row density="compact" align="center">
                <v-col cols="12" sm="4">
                  <v-select
                    v-model="payment.origin_id"
                    :items="accountingStore.bankAccounts"
                    item-title="name"
                    item-value="id"
                    label="Cuenta Receptora / Caja *"
                    variant="outlined"
                    density="compact"
                    hide-details
                    required
                  />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field
                    v-model.number="payment.amount"
                    label="Monto Recibido ($) *"
                    type="number"
                    step="0.01"
                    variant="outlined"
                    density="compact"
                    hide-details
                    required
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="payment.reference"
                    label="Referencia / Nro Transacción"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="1" class="text-right">
                  <v-btn
                    icon="mdi-delete-outline"
                    variant="text"
                    color="error"
                    size="small"
                    :disabled="receiptForm.payments.length === 1"
                    @click="removePaymentRow(index)"
                  />
                </v-col>
              </v-row>
            </div>

            <!-- Resumen y Balances -->
            <v-card variant="tonal" color="primary" class="mt-4 pa-3">
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span>Deuda Total Imputada:</span>
                <span class="font-weight-bold">${{ totalSelectedDebt.toFixed(2) }}</span>
              </div>
              <div class="d-flex justify-space-between text-body-2 mb-1">
                <span>Total Medios de Pago:</span>
                <span class="font-weight-bold text-success">${{ totalPaymentsAmount.toFixed(2) }}</span>
              </div>
              <v-divider class="my-1" />
              <div class="d-flex justify-space-between text-subtitle-2 font-weight-bold">
                <span>Diferencia / Excedente a Favor:</span>
                <span :class="paymentDifference >= 0 ? 'text-primary' : 'text-error'">
                  ${{ paymentDifference.toFixed(2) }}
                  <span v-if="paymentDifference > 0" class="text-caption font-weight-regular">
                    (Se generará Saldo a Favor)
                  </span>
                </span>
              </div>
            </v-card>

            <v-switch
              v-model="receiptForm.confirmImmediately"
              label="Confirmar inmediatamente y ejecutar cascada FIFO sobre las cuotas"
              color="primary"
              density="compact"
              class="mt-3"
              hide-details
            />
          </v-form>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            variant="text"
            color="grey-darken-1"
            class="text-none"
            @click="receiptDialogOpen = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold px-4"
            prepend-icon="mdi-check"
            :loading="isSubmittingReceipt"
            data-testid="btn-submit-receipt"
            @click="handleEmitReceipt"
          >
            Emitir Recibo
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DIÁLOGO: DETALLE CONSOLIDADO DEL RECIBO                    -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-dialog v-model="receiptDetailDialogOpen" max-width="800">
      <v-card v-if="accountingStore.selectedReceiptDetail" rounded="lg">
        <v-card-item class="bg-primary text-white py-3">
          <div class="d-flex justify-space-between align-center">
            <v-card-title class="text-h6 font-weight-bold">
              Comprobante de Caja: {{ accountingStore.selectedReceiptDetail.code }}
            </v-card-title>
            <v-chip color="white" variant="outlined" size="small">
              {{ getReceiptStatusLabel(accountingStore.selectedReceiptDetail.status) }}
            </v-chip>
          </div>
        </v-card-item>

        <v-card-text class="pa-4">
          <v-row density="compact" class="mb-3 text-body-2">
            <v-col cols="6" sm="3">
              <span class="text-grey">Fecha:</span>
              <div class="font-weight-medium">{{ accountingStore.selectedReceiptDetail.date }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <span class="text-grey">Sucursal:</span>
              <div class="font-weight-medium">{{ accountingStore.selectedReceiptDetail.branch_name || '-' }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <span class="text-grey">Cliente:</span>
              <div class="font-weight-medium">
                {{ accountingStore.selectedReceiptDetail.client_first_name }} {{ accountingStore.selectedReceiptDetail.client_last_name }}
              </div>
            </v-col>
            <v-col cols="6" sm="3">
              <span class="text-grey">Cajero:</span>
              <div class="font-weight-medium">
                {{ accountingStore.selectedReceiptDetail.collector_first_name || 'Admin' }}
              </div>
            </v-col>
          </v-row>

          <v-divider class="my-3" />

          <!-- Obligaciones Imputadas -->
          <div class="text-subtitle-2 font-weight-bold mb-2">Cuotas / Renglones Imputados</div>
          <v-table density="compact" class="border rounded mb-3">
            <thead>
              <tr>
                <th>Descripción</th>
                <th class="text-end">Monto Cobrado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in accountingStore.selectedReceiptDetail.items" :key="item.id">
                <td>{{ item.display_description || item.receivable_description || 'Cuota' }}</td>
                <td class="text-end font-weight-bold">${{ Number(item.amount).toFixed(2) }}</td>
              </tr>
              <tr v-if="accountingStore.selectedReceiptDetail.items.length === 0">
                <td colspan="2" class="text-center py-2 text-grey">Sin renglones imputados</td>
              </tr>
            </tbody>
          </v-table>

          <!-- Formas de Pago -->
          <div class="text-subtitle-2 font-weight-bold mb-2">Medios de Pago Registrados</div>
          <v-table density="compact" class="border rounded mb-3">
            <thead>
              <tr>
                <th>Cuenta / Medio</th>
                <th>Referencia</th>
                <th class="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pay in accountingStore.selectedReceiptDetail.payments" :key="pay.id">
                <td>{{ pay.payment_account_name || 'Cuenta Bancaria' }}</td>
                <td>{{ pay.reference || '-' }}</td>
                <td class="text-end font-weight-bold text-success">${{ Number(pay.amount).toFixed(2) }}</td>
              </tr>
              <tr v-if="accountingStore.selectedReceiptDetail.payments.length === 0">
                <td colspan="3" class="text-center py-2 text-grey">Sin pagos registrados</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn
            variant="text"
            color="primary"
            prepend-icon="mdi-file-pdf-box"
            @click="handleDownloadPdf(accountingStore.selectedReceiptDetail as unknown as ReceiptItem)"
          >
            Descargar PDF
          </v-btn>
          <v-btn variant="text" color="grey" @click="receiptDetailDialogOpen = false">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DIÁLOGO: ANULACIÓN DE RECIBO                               -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-dialog v-model="voidDialogOpen" max-width="500">
      <v-card rounded="lg">
        <v-card-item class="bg-warning text-white py-3">
          <v-card-title class="text-h6 font-weight-bold d-flex align-center ga-2">
            <v-icon icon="mdi-alert-circle" />
            Anular Comprobante de Caja
          </v-card-title>
        </v-card-item>

        <v-card-text class="pa-4">
          <p class="text-body-2 text-grey-darken-2 mb-3">
            Esta acción revertirá atómicamente la amortización sobre las cuentas por cobrar vinculadas y restaurará cualquier saldo a favor utilizado.
          </p>
          <v-textarea
            v-model="voidReason"
            label="Motivo o justificación de anulación *"
            variant="outlined"
            density="compact"
            rows="3"
            counter="255"
            required
            data-testid="input-void-reason"
          />
        </v-card-text>

        <v-card-actions class="pa-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn variant="text" color="grey" @click="voidDialogOpen = false">Cancelar</v-btn>
          <v-btn
            color="error"
            class="text-none font-weight-bold"
            :loading="isVoidingReceipt"
            data-testid="btn-confirm-void"
            @click="handleConfirmVoid"
          >
            Confirmar Anulación
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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

<style scoped>
.font-monospace {
  font-family: monospace;
}
</style>
