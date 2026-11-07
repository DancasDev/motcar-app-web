<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchReceipts } from '../api/accounting.api'
import type { ReceiptItem } from '../types'
import AppChipFilter from '@/components/common/AppChipFilter.vue'
import type { ChipFilterOption } from '@/components/common/AppChipFilter.vue'
import AppModal from '@/components/common/AppModal.vue'

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()
const accountingStore = useAccountingStore()

// ---------------------------------------------------------------------
// Notificaciones / Feedback
// ---------------------------------------------------------------------
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' | 'info' = 'success'): void {
  if (snackbar.value.show) {
    snackbar.value.show = false
    setTimeout(() => {
      snackbar.value = { show: true, text, color }
    }, 80)
  } else {
    snackbar.value = { show: true, text, color }
  }
}

// ---------------------------------------------------------------------
// Filtro de Estados (Chips)
// ---------------------------------------------------------------------
const statusFilterOptions: ChipFilterOption[] = [
  { label: 'Confirmados', value: '1' },
  { label: 'Borradores', value: '0' },
  { label: 'Anulados', value: '2' }
]

function handleStatusFilterChange(filters: any[] | null): void {
  if (!filters || filters.length === 0) {
    receiptsQuery.staticFilters.value = []
  } else {
    receiptsQuery.staticFilters.value = filters
  }
  receiptsQuery.refresh()
}

// ---------------------------------------------------------------------
// 1. Consulta Paginada de Recibos
// ---------------------------------------------------------------------
const rawSearch = ref('')

function normalizeSearchInput(input: string): string {
  const trimmed = (input || '').trim()
  const docMatch = trimmed.match(/^[VEJGPvejgp]?[-\s.]?(\d[\d.-]*)$/)
  if (docMatch && docMatch[1]) {
    return docMatch[1].replace(/[.-]/g, '')
  }
  return trimmed
}

const receiptsQuery = useDataQuery<ReceiptItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchReceipts(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: [
      'code',
      'client_identification_value'
    ],
    defaultOrder: { date: 'DESC' }
  }
)

watch(rawSearch, (val) => {
  receiptsQuery.search.value = normalizeSearchInput(val || '')
})

const receiptHeaders = [
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '220px' },
  { title: 'Fecha', key: 'date', align: 'center' as const, sortable: true, width: '160px' },
  { title: 'Cliente', key: 'client', align: 'start' as const, sortable: false },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '80px' }
]

function getReceiptStatusColor(status: string | number): string {
  switch (String(status)) {
    case '0':
      return 'warning'
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

function formatClientDoc(item: {
  client_identification_type?: string | number | null
  client_identification_value?: string | null
  client_id?: string | number
}): string {
  if (!item.client_identification_value) return `ID: #${item.client_id}`
  const t = String(item.client_identification_type ?? '0')
  const map: Record<string, string> = { '0': 'V', '1': 'E', '2': 'J', '3': 'G', '4': 'P' }
  const prefix = map[t] || 'V'
  return `${prefix}-${item.client_identification_value}`
}

// ---------------------------------------------------------------------
// 2. Detalle Consolidado de Recibo
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 3. Descarga de Comprobante PDF (Indicador individual por fila)
// ---------------------------------------------------------------------
const downloadingReceiptId = ref<string | number | null>(null)

async function handleDownloadPdf(receipt: ReceiptItem): Promise<void> {
  if (!branchesStore.activeBranchId) return
  downloadingReceiptId.value = receipt.id
  try {
    await accountingStore.downloadPdf(branchesStore.activeBranchId, receipt.id, receipt.code)
    showMessage(`Comprobante ${receipt.code} descargado exitosamente.`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al descargar el PDF del recibo.'
    showMessage(msg, 'error')
  } finally {
    downloadingReceiptId.value = null
  }
}

// ---------------------------------------------------------------------
// 4. Anulación de Recibo
// ---------------------------------------------------------------------
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
// Ciclo de Vida
// ---------------------------------------------------------------------
onMounted(() => {
  if (branchesStore.activeBranchId) {
    receiptsQuery.refresh()
  }
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

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: ENCABEZADO Y TÍTULO LIMPIO (SIN BOTONES)     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="mb-9">
      <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
        Recibos de Pago y Caja
      </h1>
      <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
        Historial de comprobantes de recaudación emitidos, auditoría de pagos y descargas en PDF
      </p>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA (SECCIÓN SOLA, 7 COLS)   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-3">
      <v-col cols="12" md="7">
        <v-text-field
          v-model="rawSearch"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por código de recibo o cédula del cliente..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="receipt-search-input"
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
          data-testid="receipt-chip-filter"
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
            :loading="receiptsQuery.isLoading.value"
            data-testid="btn-refresh-receipts"
            @click="receiptsQuery.refresh()"
          />
        </template>
      </v-tooltip>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CUARTA SECCIÓN: TABLA BLANCA ESTANDARIZADA                   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="receiptsQuery.itemsPerPage.value"
        v-model:page="receiptsQuery.page.value"
        v-model:sort-by="receiptsQuery.sortBy.value"
        :headers="receiptHeaders"
        :items="receiptsQuery.items.value"
        :items-length="receiptsQuery.totalItems.value"
        :loading="receiptsQuery.isLoading.value"
        :mobile="smAndDown"
        no-data-text="No hay comprobantes de pago registrados"
        loading-text="Cargando comprobantes de caja..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="receipts-table"
        @update:options="receiptsQuery.onUpdateOptions"
      >
        <!-- Slot Código (en una sola línea) -->
        <template #[`item.code`]="{ item }">
          <span class="font-weight-bold text-body-2 font-mono text-high-emphasis text-no-wrap">
            {{ item.code }}
          </span>
        </template>

        <!-- Slot Fecha -->
        <template #[`item.date`]="{ item }">
          <span class="text-caption text-medium-emphasis font-mono">
            {{ item.date }}
          </span>
        </template>

        <!-- Slot Cliente con Cédula / Documento -->
        <template #[`item.client`]="{ item }">
          <div class="py-1">
            <div class="font-weight-medium text-body-2 text-high-emphasis">
              {{ item.client_first_name || 'Cliente' }} {{ item.client_last_name || `#${item.client_id}` }}
            </div>
            <div class="text-caption text-medium-emphasis font-mono">
              {{ formatClientDoc(item) }}
            </div>
          </div>
        </template>

        <!-- Slot Estado -->
        <template #[`item.status`]="{ item }">
          <v-chip
            :color="getReceiptStatusColor(item.status)"
            size="small"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ getReceiptStatusLabel(item.status) }}
          </v-chip>
        </template>

        <!-- Slot Acciones (Kebab Menu) -->
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
                  :data-testid="`btn-receipt-actions-${item.id}`"
                />
              </template>
              <v-list density="compact" rounded="md" elevation="4" class="py-1 min-w-160">
                <v-list-item
                  prepend-icon="mdi-eye-outline"
                  title="Ver Detalle"
                  data-testid="menu-item-view-receipt-detail"
                  @click="handleViewReceiptDetail(item)"
                />
                <v-list-item
                  prepend-icon="mdi-file-pdf-box"
                  title="Descargar PDF"
                  data-testid="menu-item-download-receipt-pdf"
                  :disabled="downloadingReceiptId === item.id"
                  @click="handleDownloadPdf(item)"
                />
                <template v-if="String(item.status) === '1'">
                  <v-divider class="my-1" />
                  <v-list-item
                    prepend-icon="mdi-cancel"
                    title="Anular Recibo"
                    base-color="error"
                    data-testid="menu-item-void-receipt"
                    @click="openVoidDialog(item)"
                  />
                </template>
              </v-list>
            </v-menu>
          </div>
        </template>

        <!-- Estado Vacío -->
        <template #no-data>
          <div class="py-12 text-center text-medium-emphasis">
            <v-icon icon="mdi-receipt-text-remove" size="48" class="mb-3 text-disabled" />
            <div class="text-subtitle-1 font-weight-medium">No se encontraron comprobantes de pago</div>
            <div class="text-caption text-disabled">
              No hay recibos registrados o no coinciden con los criterios de búsqueda.
            </div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: DETALLE CONSOLIDADO DEL RECIBO (CON CAJERO)           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="receiptDetailDialogOpen"
      :title="`Comprobante de Caja: ${accountingStore.selectedReceiptDetail?.code || ''}`"
      subtitle="Desglose de obligaciones imputadas, recaudación y cajero responsable"
      :max-width="780"
      hide-submit
      cancel-text="Cerrar"
      data-testid="receipt-detail-modal"
      @cancel="receiptDetailDialogOpen = false"
    >
      <template v-if="accountingStore.selectedReceiptDetail">
        <!-- Tarjeta de Metadatos del Comprobante -->
        <div class="mb-4 pa-4 bg-grey-lighten-4 rounded-lg border">
          <v-row density="compact">
            <v-col cols="12" sm="3">
              <span class="text-caption text-medium-emphasis">Fecha:</span>
              <div class="font-weight-medium font-mono text-body-2">
                {{ accountingStore.selectedReceiptDetail.date }}
              </div>
            </v-col>
            <v-col cols="12" sm="3">
              <span class="text-caption text-medium-emphasis">Sucursal:</span>
              <div class="font-weight-medium text-body-2">
                {{ accountingStore.selectedReceiptDetail.branch_name || '—' }}
              </div>
            </v-col>
            <v-col cols="12" sm="3">
              <span class="text-caption text-medium-emphasis">Cliente:</span>
              <div class="font-weight-medium text-body-2">
                {{ accountingStore.selectedReceiptDetail.client_first_name }} {{ accountingStore.selectedReceiptDetail.client_last_name }}
              </div>
              <div class="text-caption text-medium-emphasis font-mono">
                {{ formatClientDoc(accountingStore.selectedReceiptDetail) }}
              </div>
            </v-col>
            <v-col cols="12" sm="3">
              <span class="text-caption text-medium-emphasis">Cajero responsable:</span>
              <div
                class="font-weight-medium text-body-2 d-flex align-center ga-1"
                data-testid="receipt-detail-collector"
              >
                <v-icon icon="mdi-account-cash-outline" size="16" color="primary" />
                <span>
                  {{ accountingStore.selectedReceiptDetail.collector_first_name || 'Cajero' }} {{ accountingStore.selectedReceiptDetail.collector_last_name || '' }}
                </span>
              </div>
            </v-col>
          </v-row>

          <v-divider
            v-if="accountingStore.selectedReceiptDetail.notes || String(accountingStore.selectedReceiptDetail.status) === '2'"
            class="my-2"
          />

          <div v-if="accountingStore.selectedReceiptDetail.notes" class="text-caption text-medium-emphasis mt-1">
            <strong>Notas:</strong> {{ accountingStore.selectedReceiptDetail.notes }}
          </div>
          <div
            v-if="String(accountingStore.selectedReceiptDetail.status) === '2'"
            class="text-caption text-error font-weight-medium mt-1"
          >
            <strong>Motivo de anulación:</strong> {{ accountingStore.selectedReceiptDetail.cancellation_reason || 'Sin motivo registrado' }}
          </div>
        </div>

        <!-- Cargos Imputados -->
        <div class="text-subtitle-2 font-weight-bold mb-2 text-high-emphasis">
          Cargos Imputados
        </div>
        <v-table density="compact" class="border rounded-lg mb-4">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="text-end" style="width: 140px">Monto Imputado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in accountingStore.selectedReceiptDetail.items" :key="item.id">
              <td class="font-weight-medium">
                {{ item.display_description || item.receivable_description || 'Cargo' }}
              </td>
              <td class="text-end font-weight-bold tabular-nums">
                ${{ Number(item.amount).toFixed(2) }}
              </td>
            </tr>
            <tr v-if="accountingStore.selectedReceiptDetail.items.length === 0">
              <td colspan="2" class="text-center py-3 text-medium-emphasis">
                Sin cargos imputados en este recibo
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Medios de Pago Registrados -->
        <div class="text-subtitle-2 font-weight-bold mb-2 text-high-emphasis">
          Medios de Pago Registrados
        </div>
        <v-table density="compact" class="border rounded-lg mb-4">
          <thead>
            <tr>
              <th>Cuenta / Medio</th>
              <th>Referencia</th>
              <th class="text-end" style="width: 160px">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pay in accountingStore.selectedReceiptDetail.payments" :key="pay.id">
              <td>
                <div class="font-weight-medium">
                  {{ pay.payment_account_name || 'Cuenta de Pago' }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ pay.payment_category_name || (pay.origin_type === '1' ? 'Crédito Interno' : 'Caja') }}
                </div>
              </td>
              <td class="text-caption font-mono">
                {{ pay.reference || '—' }}
              </td>
              <td class="text-end font-weight-bold tabular-nums">
                {{ pay.currency_symbol || '$' }} {{ Number(pay.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>
            <tr v-if="accountingStore.selectedReceiptDetail.payments.length === 0">
              <td colspan="3" class="text-center py-3 text-medium-emphasis">
                Sin pagos registrados
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Totales / Resumen -->
        <div
          v-if="accountingStore.selectedReceiptDetail.totals"
          class="border rounded-lg pa-3 bg-surface-light text-body-2 tabular-nums"
        >
          <div class="d-flex justify-space-between mb-1">
            <span class="text-medium-emphasis">Total imputado:</span>
            <span class="font-weight-bold text-high-emphasis">
              ${{ Number(accountingStore.selectedReceiptDetail.totals.items_usd).toFixed(2) }}
            </span>
          </div>
          <div class="d-flex justify-space-between mb-1">
            <span class="text-medium-emphasis">Total recibido:</span>
            <span class="font-weight-bold text-primary">
              ${{ Number(accountingStore.selectedReceiptDetail.totals.payments_usd).toFixed(2) }}
            </span>
          </div>
          <div
            v-if="Number(accountingStore.selectedReceiptDetail.totals.credit_usd) > 0"
            class="d-flex justify-space-between text-success font-weight-bold mt-1 pt-1 border-t"
          >
            <span>Saldo a favor generado:</span>
            <span>+${{ Number(accountingStore.selectedReceiptDetail.totals.credit_usd).toFixed(2) }}</span>
          </div>
        </div>
      </template>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: ANULACIÓN DE COMPROBANTE DE CAJA                      -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="voidDialogOpen"
      title="Anular Comprobante de Caja"
      subtitle="Reversión atómica de amortizaciones sobre cuentas por cobrar vinculadas"
      :max-width="500"
      submit-text="Anular Comprobante"
      submit-color="error"
      submit-test-id="btn-confirm-void"
      :loading="isVoidingReceipt"
      @submit="handleConfirmVoid"
      @cancel="voidDialogOpen = false"
    >
      <div v-if="voidReceiptTarget" class="mb-4 pa-3 bg-grey-lighten-4 rounded-lg border text-body-2">
        <div class="d-flex justify-space-between align-center mb-1">
          <span class="text-caption text-medium-emphasis">Código:</span>
          <span class="font-mono font-weight-bold text-high-emphasis">
            {{ voidReceiptTarget.code }}
          </span>
        </div>
        <div class="d-flex justify-space-between align-center mb-1">
          <span class="text-caption text-medium-emphasis">Cliente:</span>
          <span class="font-weight-medium text-high-emphasis">
            {{ voidReceiptTarget.client_first_name }} {{ voidReceiptTarget.client_last_name }}
          </span>
        </div>
        <div class="d-flex justify-space-between align-center">
          <span class="text-caption text-medium-emphasis">Fecha:</span>
          <span class="font-mono text-medium-emphasis">
            {{ voidReceiptTarget.date }}
          </span>
        </div>
      </div>

      <p class="text-body-2 text-medium-emphasis mb-3">
        Esta acción cancelará el recibo contable y restaurará el saldo original de las cuentas por cobrar vinculadas.
      </p>
      <v-textarea
        v-model="voidReason"
        label="Motivo o justificación de anulación *"
        placeholder="Indica el motivo de la anulación..."
        variant="outlined"
        density="comfortable"
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
      :timeout="3500"
      location="bottom right"
      data-testid="receipts-snackbar"
    >
      {{ snackbar.text }}
      <template #actions>
        <v-btn icon="mdi-close" size="small" variant="text" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.font-mono {
  font-family: monospace;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.bg-surface-light {
  background-color: #F8FAFC;
}

.min-w-160 {
  min-width: 160px;
}
</style>
