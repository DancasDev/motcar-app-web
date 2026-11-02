<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchReceipts,
  fetchAccountsReceivable
} from '../api/accounting.api'
import type {
  ReceiptItem,
  AccountReceivableItem,
  FullReceiptEmissionPayload
} from '../types'
import AppModal from '@/components/common/AppModal.vue'

const route = useRoute()
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

// ---------------------------------------------------------------------
// 1. Tabla de Recibos de Caja
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
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '150px' }
]

function getReceiptStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'grey-darken-1'
    case '1':
      return 'primary'
    case '2':
      return 'grey'
    default:
      return 'grey'
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al anular el recibo.'
    showMessage(msg, 'error')
  } finally {
    isVoidingReceipt.value = false
  }
}

// ---------------------------------------------------------------------
// 2. Diálogo de Emisión de Recibo de Cobro
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

// Cuentas por cobrar para el cliente actual
const availableReceivables = ref<AccountReceivableItem[]>([])
const isLoadingClientReceivables = ref(false)

async function loadClientReceivables(clientId: number | null): Promise<void> {
  if (!clientId || !branchesStore.activeBranchId) {
    availableReceivables.value = []
    return
  }
  isLoadingClientReceivables.value = true
  try {
    const res = await fetchAccountsReceivable(branchesStore.activeBranchId, {
      itemsPerPage: 50,
      filters: [['client_id', String(clientId), '=', 'AND']]
    })
    availableReceivables.value = (res.data || []).filter(
      (r) => String(r.status) === '0' || String(r.status) === '1'
    )
  } catch (err) {
    console.error('Error fetching client receivables:', err)
  } finally {
    isLoadingClientReceivables.value = false
  }
}

watch(
  () => receiptForm.value.client_id,
  (newId) => {
    if (newId) {
      loadClientReceivables(newId)
    } else {
      availableReceivables.value = []
    }
  }
)

const totalSelectedDebt = computed(() => {
  return availableReceivables.value
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

function openCreateReceiptDialog(): void {
  const defaultBank = accountingStore.bankAccounts[0]?.id
    ? Number(accountingStore.bankAccounts[0].id)
    : 1

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

  loadClientReceivables(1)
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al emitir el recibo de caja.'
    showMessage(msg, 'error')
  } finally {
    isSubmittingReceipt.value = false
  }
}

// Comprobación de query params (p. ej. redirigido desde Cuentas por Cobrar)
function checkQueryParamsForNewReceipt(): void {
  if (route.query.action === 'new') {
    const defaultBank = accountingStore.bankAccounts[0]?.id
      ? Number(accountingStore.bankAccounts[0].id)
      : 1
    const clientId = route.query.client_id ? Number(route.query.client_id) : 1
    const recId = route.query.receivable_id ? Number(route.query.receivable_id) : null
    const amount = route.query.amount ? Number(route.query.amount) : 50

    receiptForm.value = {
      client_id: clientId,
      client_name: (route.query.client_name as string) || '',
      date: new Date().toISOString().substring(0, 10),
      notes: recId ? `Recaudo cuota #${recId}` : 'Cobranza de cuota',
      selectedReceivableIds: recId ? [recId] : [],
      payments: [
        {
          origin_type: '0',
          origin_id: defaultBank,
          amount: amount,
          reference: '',
          notes: ''
        }
      ],
      confirmImmediately: true
    }

    loadClientReceivables(clientId)
    receiptDialogOpen.value = true
  }
}

onMounted(async () => {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadBankAccounts()
  ])
  if (branchesStore.activeBranchId) {
    receiptsQuery.refresh()
  }
  checkQueryParamsForNewReceipt()
})

watch(
  () => branchesStore.activeBranchId,
  (newBranchId) => {
    if (newBranchId) {
      receiptsQuery.refresh()
    }
  }
)
</script>

<template>
  <div class="receipts-view">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      rounded="lg"
      title="Sucursal no seleccionada"
      text="Para gestionar Recibos de Caja y Comprobantes debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert-receipts"
    />

    <!-- Encabezado de la Vista (Estilo Estándar sin card y sin icono) -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Recibos de Pago y Caja
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Emisión de comprobantes de recaudación, historial de recibos emitidos y descargas en PDF
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-create-receipt"
          @click="openCreateReceiptDialog()"
        >
          Emitir Recibo
        </v-btn>
      </div>

      <!-- Menú Mobile -->
      <div class="d-flex d-sm-none">
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
              data-testid="btn-mobile-receipts-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-plus"
              title="Emitir Recibo"
              @click="openCreateReceiptDialog()"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Tabla de Recibos -->
    <v-card elevation="0" rounded="lg" class="border bg-white">
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
              class="text-none"
              @click="receiptsQuery.refresh()"
            >
              Recargar Recibos
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider />

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
          <span class="font-weight-bold text-body-2 font-monospace text-high-emphasis">
            {{ item.code }}
          </span>
        </template>

        <!-- Slot Fecha -->
        <template #[`item.date`]="{ item }">
          <span class="text-caption text-medium-emphasis">{{ item.date }}</span>
        </template>

        <!-- Slot Cliente -->
        <template #[`item.client`]="{ item }">
          <span class="font-weight-medium text-body-2 text-high-emphasis">
            {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
          </span>
        </template>

        <!-- Slot Cajero -->
        <template #[`item.collector`]="{ item }">
          <span class="text-body-2 text-medium-emphasis">
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
              icon="mdi-eye-outline"
              size="small"
              variant="text"
              color="primary"
              title="Ver Detalle"
              data-testid="btn-view-receipt-detail"
              @click="handleViewReceiptDetail(item)"
            />
            <v-btn
              icon="mdi-file-pdf-box"
              size="small"
              variant="text"
              color="primary"
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
              color="grey"
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

    <!-- Modal Estándar: Emitir Recibo de Cobro -->
    <AppModal
      v-model="receiptDialogOpen"
      title="Emitir Recibo de Cobro"
      subtitle="Registra la recaudación e imputación sobre las cuotas del cliente"
      :max-width="840"
      :persistent="true"
      submit-text="Registrar"
      :loading="isSubmittingReceipt"
      data-testid="receipt-form-dialog"
      @submit="handleEmitReceipt"
      @cancel="receiptDialogOpen = false"
    >
      <v-form @submit.prevent="handleEmitReceipt">
        <!-- Sección 1: Datos de Cabecera -->
        <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-2">
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
          <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
            2. Obligaciones / Cuotas Pendientes del Cliente
          </div>
          <span class="text-caption text-medium-emphasis">
            {{ availableReceivables.length }} cuota(s) encontrada(s)
          </span>
        </div>

        <div v-if="availableReceivables.length > 0" class="border rounded pa-2 mb-4 bg-grey-lighten-5">
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
              <tr v-for="rec in availableReceivables" :key="rec.id">
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
                <td class="text-caption">{{ rec.due_date }}</td>
                <td class="text-end">${{ Number(rec.total_amount).toFixed(2) }}</td>
                <td class="text-end font-weight-bold">
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
          No se han encontrado cuotas pendientes automáticas para el cliente {{ receiptForm.client_id }}.
        </v-alert>

        <v-divider class="my-4" />

        <!-- Sección 3: Formas de Pago -->
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
            3. Medios de Pago Recibidos
          </div>
          <v-btn
            size="small"
            variant="outlined"
            color="primary"
            prepend-icon="mdi-plus"
            class="text-none font-weight-medium"
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

        <!-- Resumen Sobrio y Elegante (Sin fondos chillones) -->
        <div class="border rounded pa-3 mt-4 bg-grey-lighten-5">
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span class="text-medium-emphasis">Deuda Total Imputada:</span>
            <span class="font-weight-bold">${{ totalSelectedDebt.toFixed(2) }}</span>
          </div>
          <div class="d-flex justify-space-between text-body-2 mb-1">
            <span class="text-medium-emphasis">Total Medios de Pago:</span>
            <span class="font-weight-bold text-high-emphasis">${{ totalPaymentsAmount.toFixed(2) }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="d-flex justify-space-between text-body-2 font-weight-bold">
            <span>Diferencia / Excedente:</span>
            <span :class="paymentDifference >= 0 ? 'text-high-emphasis' : 'text-error'">
              ${{ paymentDifference.toFixed(2) }}
              <span v-if="paymentDifference > 0" class="text-caption font-weight-regular text-medium-emphasis">
                (Genera Saldo a Favor)
              </span>
            </span>
          </div>
        </div>

        <v-switch
          v-model="receiptForm.confirmImmediately"
          label="Confirmar inmediatamente y amortizar cuotas"
          color="primary"
          density="compact"
          class="mt-3"
          hide-details
        />
      </v-form>
    </AppModal>

    <!-- Modal Estándar: Detalle Consolidado del Recibo -->
    <AppModal
      v-model="receiptDetailDialogOpen"
      :title="`Comprobante de Caja: ${accountingStore.selectedReceiptDetail?.code || ''}`"
      subtitle="Desglose de obligaciones imputadas y recaudación registrada"
      :max-width="760"
      hide-submit
      cancel-text="Cerrar"
      @cancel="receiptDetailDialogOpen = false"
    >
      <template v-if="accountingStore.selectedReceiptDetail">
        <v-row density="compact" class="mb-3 text-body-2">
          <v-col cols="6" sm="3">
            <span class="text-caption text-medium-emphasis">Fecha:</span>
            <div class="font-weight-medium">{{ accountingStore.selectedReceiptDetail.date }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <span class="text-caption text-medium-emphasis">Sucursal:</span>
            <div class="font-weight-medium">{{ accountingStore.selectedReceiptDetail.branch_name || '—' }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <span class="text-caption text-medium-emphasis">Cliente:</span>
            <div class="font-weight-medium">
              {{ accountingStore.selectedReceiptDetail.client_first_name }} {{ accountingStore.selectedReceiptDetail.client_last_name }}
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <span class="text-caption text-medium-emphasis">Cajero:</span>
            <div class="font-weight-medium">
              {{ accountingStore.selectedReceiptDetail.collector_first_name || 'Admin' }}
            </div>
          </v-col>
        </v-row>

        <v-divider class="my-3" />

        <div class="text-subtitle-2 font-weight-bold mb-2">Cuotas Imputadas</div>
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
              <td colspan="2" class="text-center py-2 text-medium-emphasis">Sin renglones imputados</td>
            </tr>
          </tbody>
        </v-table>

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
              <td class="text-caption">{{ pay.reference || '—' }}</td>
              <td class="text-end font-weight-bold">${{ Number(pay.amount).toFixed(2) }}</td>
            </tr>
            <tr v-if="accountingStore.selectedReceiptDetail.payments.length === 0">
              <td colspan="3" class="text-center py-2 text-medium-emphasis">Sin pagos registrados</td>
            </tr>
          </tbody>
        </v-table>
      </template>

      <template #prepend-actions>
        <v-btn
          v-if="accountingStore.selectedReceiptDetail"
          variant="outlined"
          color="primary"
          prepend-icon="mdi-file-pdf-box"
          size="small"
          class="text-none ml-2"
          @click="handleDownloadPdf(accountingStore.selectedReceiptDetail as unknown as ReceiptItem)"
        >
          Descargar PDF
        </v-btn>
      </template>
    </AppModal>

    <!-- Modal Estándar: Anulación de Recibo -->
    <AppModal
      v-model="voidDialogOpen"
      title="Anular Comprobante de Caja"
      subtitle="Reversión atómica de amortizaciones sobre cuentas por cobrar vinculadas"
      :max-width="480"
      submit-text="Anular"
      submit-color="error"
      submit-test-id="btn-confirm-void"
      :loading="isVoidingReceipt"
      @submit="handleConfirmVoid"
      @cancel="voidDialogOpen = false"
    >
      <p class="text-body-2 text-medium-emphasis mb-3">
        Esta acción cancelará el recibo contable y restaurará el saldo original de las cuotas afectadas.
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
    </AppModal>

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
