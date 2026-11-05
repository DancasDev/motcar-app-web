<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { fetchPersons, fetchPersonById } from '@/modules/catalogs/api/catalogs.api'
import {
  fetchAccountsReceivable,
  getReceiptById
} from '../api/accounting.api'
import type {
  AccountReceivableItem,
  FullReceiptEmissionPayload
} from '../types'
import type { PersonItem } from '@/modules/catalogs/types'
import AppModal from '@/components/common/AppModal.vue'

const route = useRoute()
const branchesStore = useBranchesStore()
const accountingStore = useAccountingStore()

// ---------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function notify(text: string, color: 'success' | 'error' | 'warning' = 'success'): void {
  snackbar.value = { show: true, text, color }
}

// ---------------------------------------------------------------------
// 1. Tasa de Cambio y Formateo Monetario
// ---------------------------------------------------------------------
const vesCurrency = computed(() => {
  return (
    accountingStore.currencies.find((c) => c.code === 'VES') || {
      id: 2,
      name: 'Bolívar Digital',
      code: 'VES',
      symbol: 'Bs.'
    }
  )
})

const activeExchangeRate = computed(() => {
  const curId = String(vesCurrency.value.id)
  const rateItem = accountingStore.currentRates[curId]
  return rateItem ? Number(rateItem.value) : 0
})

const activeRateDateFormatted = computed(() => {
  const curId = String(vesCurrency.value.id)
  const raw = accountingStore.currentRates[curId]?.date
  if (!raw) return ''
  return formatShortDate(raw)
})

function formatShortDate(isoDate: string | undefined | null): string {
  if (!isoDate) return ''
  const clean = isoDate.substring(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return clean
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function toVes(usdAmount: number): number {
  if (!activeExchangeRate.value) return 0
  return usdAmount * activeExchangeRate.value
}

function formatMoney(val: number | string | null | undefined): string {
  const num = Number(val || 0)
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------
// 2. Búsqueda de Cliente y Control de Transacción
// ---------------------------------------------------------------------
const docPrefixes = [
  { prefix: 'V', title: 'Venezolano', value: '0' },
  { prefix: 'E', title: 'Extranjero', value: '1' },
  { prefix: 'J', title: 'Jurídico', value: '2' },
  { prefix: 'G', title: 'Gubernamental', value: '3' }
]

const searchPrefix = ref('0')
const searchValue = ref('')
const searchNotFoundMsg = ref('')
const isSearchingClient = ref(false)
const selectedClient = ref<PersonItem | null>(null)
const searchInputRef = ref<{ $el?: HTMLElement } | null>(null)

// Confirmación antes de descartar una transacción con selecciones o pagos
const confirmDiscardOpen = ref(false)
const pendingDiscardTarget = ref<'clear' | 'search' | null>(null)

const hasDirtyTransaction = computed(() => {
  return selectedReceivableIds.value.length > 0 || paymentLines.value.length > 0
})

function getDocPrefix(typeVal: string | number | undefined): string {
  const found = docPrefixes.find((p) => String(p.value) === String(typeVal))
  return found ? found.prefix : 'V'
}

function onSearchInputChange(): void {
  if (searchNotFoundMsg.value) {
    searchNotFoundMsg.value = ''
  }
}

function selectSearchPrefix(val: string): void {
  searchPrefix.value = val
  if (searchNotFoundMsg.value) {
    searchNotFoundMsg.value = ''
  }
}

function parseTypedSearch(): { cleanVal: string; detectedPrefix: string } {
  const raw = searchValue.value.trim()
  const prefixMatch = raw.match(/^([VEJGvejg])[\s.-]*(.+)$/)
  if (prefixMatch) {
    const letter = prefixMatch[1].toUpperCase()
    const found = docPrefixes.find((p) => p.prefix === letter)
    const stripped = prefixMatch[2].replace(/[.\s,]/g, '').trim()
    return {
      cleanVal: stripped,
      detectedPrefix: found ? found.value : searchPrefix.value
    }
  }
  return {
    cleanVal: raw.replace(/[.\s,]/g, '').trim(),
    detectedPrefix: searchPrefix.value
  }
}

function requestCustomerSearch(): void {
  if (isProcessingPayment.value || isSearchingClient.value) return
  const { cleanVal, detectedPrefix } = parseTypedSearch()
  if (!cleanVal) {
    focusSearchInput()
    return
  }

  // Si ya es el mismo cliente cargado, refrescar sus pagos pendientes sin descartar si no hay pagos
  const isSameLoadedClient =
    selectedClient.value &&
    (String(selectedClient.value.identification_value) === cleanVal ||
      String(selectedClient.value.identification_value) === cleanVal.padStart(8, '0')) &&
    String(selectedClient.value.identification_type ?? '0') === String(detectedPrefix)

  if (selectedClient.value && !isSameLoadedClient && hasDirtyTransaction.value) {
    pendingDiscardTarget.value = 'search'
    confirmDiscardOpen.value = true
    return
  }

  executeCustomerSearch()
}

async function executeCustomerSearch(): Promise<void> {
  const { cleanVal, detectedPrefix } = parseTypedSearch()
  if (!cleanVal) return

  searchPrefix.value = detectedPrefix
  searchValue.value = cleanVal
  searchNotFoundMsg.value = ''
  isSearchingClient.value = true

  try {
    const queryByCandidate = async (candidate: string) => {
      const filters = JSON.stringify([
        ['identification_type', String(detectedPrefix), '=', 'AND'],
        ['identification_value', candidate, '=', 'AND']
      ])
      return fetchPersons({ filters, itemsPerPage: 5 })
    }

    let res = await queryByCandidate(cleanVal)

    if ((!res.data || res.data.length === 0) && /^\d+$/.test(cleanVal)) {
      const paddedVal = cleanVal.padStart(8, '0')
      if (paddedVal !== cleanVal) {
        res = await queryByCandidate(paddedVal)
      }
    }

    if ((!res.data || res.data.length === 0) && cleanVal.includes('-')) {
      const unhyphenated = cleanVal.replace(/-/g, '')
      if (unhyphenated && unhyphenated !== cleanVal) {
        res = await queryByCandidate(unhyphenated)
      }
    }

    const match = res.data?.find(
      (p) => String(p.identification_type ?? '0') === String(detectedPrefix)
    )

    if (match) {
      if (String(match.is_disabled ?? '0') === '1') {
        resetTransactionState(false)
        searchNotFoundMsg.value = `El cliente ${getDocPrefix(detectedPrefix)}-${match.identification_value} se encuentra inactivo y no admite cobros.`
        return
      }
      selectCustomer(match)
    } else {
      resetTransactionState(false)
      searchNotFoundMsg.value = `No hay ningún cliente con la cédula ${getDocPrefix(searchPrefix.value)}-${cleanVal}.`
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al consultar el cliente.'
    notify(msg, 'error')
  } finally {
    isSearchingClient.value = false
  }
}

function selectCustomer(client: PersonItem): void {
  if (String(client.is_disabled ?? '0') === '1') {
    resetTransactionState(false)
    searchPrefix.value = String(client.identification_type ?? '0')
    searchValue.value = client.identification_value || ''
    searchNotFoundMsg.value = `El cliente ${getDocPrefix(client.identification_type)}-${client.identification_value} se encuentra inactivo y no admite cobros.`
    return
  }
  selectedClient.value = client
  searchPrefix.value = String(client.identification_type ?? '0')
  searchValue.value = client.identification_value || ''
  searchNotFoundMsg.value = ''
  loadReceivablesForClient(client.id)
}

function requestCancelTransaction(): void {
  if (!selectedClient.value) return
  if (hasDirtyTransaction.value) {
    pendingDiscardTarget.value = 'clear'
    confirmDiscardOpen.value = true
    return
  }
  resetTransactionState(true)
}

function handleConfirmDiscard(): void {
  if (!confirmDiscardOpen.value) return
  const target = pendingDiscardTarget.value
  confirmDiscardOpen.value = false
  pendingDiscardTarget.value = null

  if (target === 'search') {
    executeCustomerSearch()
  } else {
    resetTransactionState(true)
  }
}

function resetTransactionState(clearInput = true): void {
  selectedClient.value = null
  if (clearInput) {
    searchValue.value = ''
  }
  searchNotFoundMsg.value = ''
  clientReceivables.value = []
  selectedReceivableIds.value = []
  paymentLines.value = []
  receivablesFilter.value = 'all'
  nextTick(() => {
    focusSearchInput()
  })
}

function focusSearchInput(): void {
  const input = searchInputRef.value?.$el?.querySelector('input')
  if (input) input.focus()
}

// ---------------------------------------------------------------------
// 3. Pagos Pendientes (Cuentas por Cobrar del Cliente)
// ---------------------------------------------------------------------
const clientReceivables = ref<AccountReceivableItem[]>([])
const isLoadingReceivables = ref(false)
const receivablesFilter = ref<'all' | 'overdue' | 'upcoming'>('all')
const selectedReceivableIds = ref<number[]>([])

function getReceivablePriority(item: AccountReceivableItem): number {
  const conceptId = Number(item.receivable_concept_id || 0)
  const conceptCode = String((item as { concept_code?: string }).concept_code || '')
  if (conceptId === 2 || conceptId === 3 || conceptCode === 'admin_fee' || conceptCode === 'late_fee') {
    return 1
  }
  if (isOverdue(item.due_date)) {
    return 2
  }
  return 3
}

async function loadReceivablesForClient(clientId: string | number): Promise<void> {
  const branchId = branchesStore.activeBranchId
  if (!branchId || !clientId) return

  isLoadingReceivables.value = true
  selectedReceivableIds.value = []
  paymentLines.value = []
  receivablesFilter.value = 'all'

  try {
    const filters = JSON.stringify([
      ['client_id', String(clientId), '=', 'AND'],
      ['is_disabled', '0', '=', 'AND'],
      ['status', '2', '!=', 'AND'],
      ['status', '3', '!=', 'AND']
    ])
    const res = await fetchAccountsReceivable(branchId, {
      itemsPerPage: 100,
      filters
    })

    const items = (res.data || [])
      .filter((r) => String(r.is_disabled ?? '0') !== '1' && getReceivableBalance(r) > 0)
      .sort((a, b) => {
        const prioDiff = getReceivablePriority(a) - getReceivablePriority(b)
        if (prioDiff !== 0) return prioDiff
        const dateDiff = (a.due_date || '').localeCompare(b.due_date || '')
        if (dateDiff !== 0) return dateDiff
        return Number(a.id) - Number(b.id)
      })

    clientReceivables.value = items

    // Preseleccionar únicamente el pago pendiente prioritario más antiguo
    if (items.length > 0) {
      selectedReceivableIds.value = [Number(items[0].id)]
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al cargar los pagos pendientes.'
    notify(msg, 'error')
  } finally {
    isLoadingReceivables.value = false
  }
}

function getReceivableBalance(item: AccountReceivableItem): number {
  const total = Number(item.total_amount || 0)
  const paid = Number(item.paid_amount || 0)
  return Math.max(0, round2(total - paid))
}

const todayStr = computed(() => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

function isOverdue(dueDate: string): boolean {
  return Boolean(dueDate) && dueDate < todayStr.value
}

const overdueCount = computed(() => {
  return clientReceivables.value.filter((r) => isOverdue(r.due_date)).length
})

const upcomingCount = computed(() => {
  return clientReceivables.value.length - overdueCount.value
})

const showReceivablesFilter = computed(() => {
  return clientReceivables.value.length > 1 && overdueCount.value > 0 && upcomingCount.value > 0
})

const filteredReceivables = computed(() => {
  if (receivablesFilter.value === 'overdue') {
    return clientReceivables.value.filter((r) => isOverdue(r.due_date))
  }
  if (receivablesFilter.value === 'upcoming') {
    return clientReceivables.value.filter((r) => !isOverdue(r.due_date))
  }
  return clientReceivables.value
})

const allFilteredSelected = computed(() => {
  if (filteredReceivables.value.length === 0) return false
  return filteredReceivables.value.every((r) => selectedReceivableIds.value.includes(Number(r.id)))
})

const someFilteredSelected = computed(() => {
  return filteredReceivables.value.some((r) => selectedReceivableIds.value.includes(Number(r.id)))
})

const totalDebtBalance = computed(() => {
  return clientReceivables.value.reduce((sum, r) => sum + getReceivableBalance(r), 0)
})

const totalSelectedToPay = computed(() => {
  return Number(
    clientReceivables.value
      .filter((r) => selectedReceivableIds.value.includes(Number(r.id)))
      .reduce((sum, r) => sum + getReceivableBalance(r), 0)
      .toFixed(2)
  )
})

const totalSelectedVes = computed(() => {
  return toVes(totalSelectedToPay.value)
})

function toggleSelectAll(): void {
  const filteredIds = filteredReceivables.value.map((r) => Number(r.id))
  if (allFilteredSelected.value) {
    selectedReceivableIds.value = selectedReceivableIds.value.filter(
      (id) => !filteredIds.includes(id)
    )
  } else {
    const merged = new Set([...selectedReceivableIds.value, ...filteredIds])
    selectedReceivableIds.value = Array.from(merged)
  }
}

function toggleReceivable(id: number): void {
  const idx = selectedReceivableIds.value.indexOf(id)
  if (idx >= 0) {
    selectedReceivableIds.value.splice(idx, 1)
  } else {
    selectedReceivableIds.value.push(id)
  }
}

// ---------------------------------------------------------------------
// 4. Formas de Pago (Modal "Agregar" + Filas Compactas)
// ---------------------------------------------------------------------
type PaymentMethodKey = 'cash_usd' | 'cash_ves' | 'pago_movil' | 'transfer' | 'card'

interface PaymentMethodOption {
  key: PaymentMethodKey
  label: string
  shortSub: string
  icon: string
  currency: 'USD' | 'VES'
  isCash: boolean
  preferredCategoryId?: number
}

const paymentMethodOptions: PaymentMethodOption[] = [
  {
    key: 'cash_usd',
    label: 'Efectivo USD',
    shortSub: 'Dólares ($)',
    icon: 'mdi-cash',
    currency: 'USD',
    isCash: true,
    preferredCategoryId: 1
  },
  {
    key: 'cash_ves',
    label: 'Efectivo Bs.',
    shortSub: 'Bolívares',
    icon: 'mdi-cash-multiple',
    currency: 'VES',
    isCash: true,
    preferredCategoryId: 1
  },
  {
    key: 'pago_movil',
    label: 'Pago Móvil',
    shortSub: 'Bolívares',
    icon: 'mdi-cellphone-check',
    currency: 'VES',
    isCash: false,
    preferredCategoryId: 2
  },
  {
    key: 'transfer',
    label: 'Transferencia',
    shortSub: 'Bolívares',
    icon: 'mdi-bank-transfer',
    currency: 'VES',
    isCash: false,
    preferredCategoryId: 3
  },
  {
    key: 'card',
    label: 'Punto de venta',
    shortSub: 'Tarjeta (Bs.)',
    icon: 'mdi-credit-card-outline',
    currency: 'VES',
    isCash: false
  }
]

interface PosPaymentLine {
  id: string
  methodKey: PaymentMethodKey
  methodLabel: string
  methodIcon: string
  isCash: boolean
  accountId: number
  accountName: string
  accountCurrency: 'USD' | 'VES'
  currency: 'USD' | 'VES'
  amountInput: number
  amountUsd: number
  reference: string
}

const paymentLines = ref<PosPaymentLine[]>([])

// Estado del Modal "Agregar pago"
const paymentModalOpen = ref(false)
const paymentFormError = ref('')
const paymentAmountInputRef = ref<{ $el?: HTMLElement } | null>(null)
const paymentDraft = ref<{
  methodKey: PaymentMethodKey
  accountId: number | null
  amount: number | null
  reference: string
}>({
  methodKey: 'cash_usd',
  accountId: null,
  amount: null,
  reference: ''
})

const selectedDraftMethod = computed<PaymentMethodOption>(() => {
  return (
    paymentMethodOptions.find((m) => m.key === paymentDraft.value.methodKey) ||
    paymentMethodOptions[0]
  )
})

const activeAccounts = computed(() => {
  return (accountingStore.bankAccounts || []).filter((a) => String(a.is_disabled ?? '0') !== '1')
})

const matchingAccountsForDraft = computed(() => {
  const list = activeAccounts.value
  const method = selectedDraftMethod.value

  // 1. Coincidencia por categoría y moneda
  if (method.preferredCategoryId) {
    const byCatAndCur = list.filter(
      (a) =>
        Number(a.category_id) === method.preferredCategoryId &&
        (a.currency_code || 'USD').toUpperCase() === method.currency
    )
    if (byCatAndCur.length > 0) return byCatAndCur
  }

  // 2. Coincidencia por moneda
  const byCur = list.filter((a) => (a.currency_code || 'USD').toUpperCase() === method.currency)
  if (byCur.length > 0) return byCur

  // 3. Fallback a las cuentas activas configuradas en el sistema
  return list
})

const draftAccountItems = computed(() => {
  return matchingAccountsForDraft.value.map((a) => ({
    id: Number(a.id),
    name: `${a.name} (${(a.currency_code || 'USD').toUpperCase()})`
  }))
})

const remainingToCoverUsd = computed(() => {
  return Math.max(0, Number((totalSelectedToPay.value - totalPaidUsd.value).toFixed(2)))
})

const draftEquivalentHint = computed(() => {
  const val = Number(paymentDraft.value.amount || 0)
  if (val <= 0) return ''
  if (selectedDraftMethod.value.currency === 'USD') {
    if (!activeExchangeRate.value) return ''
    return `Equivale a Bs. ${formatMoney(toVes(val))}`
  }
  if (!activeExchangeRate.value) return 'No hay tasa VES configurada'
  const eqUsd = val / activeExchangeRate.value
  return `Equivale a $ ${formatMoney(eqUsd)} USD`
})

function computeSuggestedAmount(currency: 'USD' | 'VES'): number | null {
  const rem = remainingToCoverUsd.value
  if (rem <= 0) return null
  if (currency === 'USD') {
    return round2(rem)
  }
  if (!activeExchangeRate.value) return null
  return round2(toVes(rem))
}

function onAmountKeydown(e: KeyboardEvent): void {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault()
  }
}

function selectDraftMethod(key: PaymentMethodKey): void {
  paymentDraft.value.methodKey = key
  paymentFormError.value = ''
  const method = paymentMethodOptions.find((m) => m.key === key) || paymentMethodOptions[0]
  const accounts = matchingAccountsForDraft.value
  paymentDraft.value.accountId = accounts[0] ? Number(accounts[0].id) : null
  paymentDraft.value.amount = computeSuggestedAmount(method.currency)
  if (method.isCash) {
    paymentDraft.value.reference = ''
  }
}

function openAddPaymentModal(): void {
  if (selectedReceivableIds.value.length === 0) return
  paymentFormError.value = ''
  paymentDraft.value = {
    methodKey: 'cash_usd',
    accountId: matchingAccountsForDraft.value[0] ? Number(matchingAccountsForDraft.value[0].id) : null,
    amount: computeSuggestedAmount('USD'),
    reference: ''
  }
  // Asegurar cuenta tras fijar methodKey
  selectDraftMethod('cash_usd')
  paymentModalOpen.value = true
  nextTick(() => {
    setTimeout(() => {
      const input = paymentAmountInputRef.value?.$el?.querySelector('input')
      if (input) {
        input.focus()
        input.select()
      }
    }, 80)
  })
}

function handleConfirmAddPayment(): void {
  if (!paymentModalOpen.value) return
  paymentFormError.value = ''
  const method = selectedDraftMethod.value
  const rawAmount = Number(paymentDraft.value.amount || 0)

  if (!Number.isFinite(rawAmount) || round2(rawAmount) <= 0) {
    paymentFormError.value = 'Ingresa un monto válido mayor a 0.'
    return
  }

  if (method.currency === 'VES' && !activeExchangeRate.value) {
    paymentFormError.value = 'No hay una tasa de cambio VES vigente para convertir este pago.'
    return
  }

  const cleanRef = paymentDraft.value.reference.trim()
  if (!method.isCash) {
    if (!cleanRef) {
      paymentFormError.value = 'Ingresa el número de referencia del comprobante.'
      return
    }
    if (cleanRef.length > 60) {
      paymentFormError.value = 'La referencia no puede superar los 60 caracteres.'
      return
    }
  }

  const normalizedInput = round2(rawAmount)
  const computedUsd =
    method.currency === 'USD'
      ? normalizedInput
      : round2(normalizedInput / activeExchangeRate.value)

  if (computedUsd < 0.01) {
    paymentFormError.value = 'El monto equivale a menos de $ 0.01 USD al cambio actual.'
    return
  }

  if (computedUsd > 100000) {
    paymentFormError.value =
      'Monto fuera de rango. Verifica que no hayas ingresado el número de referencia o cédula.'
    return
  }

  // En métodos electrónicos no permitir exceder el saldo pendiente (Fase 2: saldo a favor)
  if (!method.isCash && computedUsd > remainingToCoverUsd.value + 0.01) {
    paymentFormError.value = `El monto supera el saldo pendiente por cubrir ($ ${formatMoney(remainingToCoverUsd.value)}).`
    return
  }

  const accObj =
    activeAccounts.value.find((a) => Number(a.id) === Number(paymentDraft.value.accountId)) ||
    activeAccounts.value[0]

  if (!accObj) {
    paymentFormError.value = 'No hay cuentas receptoras activas configuradas en el sistema.'
    return
  }

  const accountId = Number(accObj.id)
  const accountName = accObj.name || `Caja #${accountId}`
  const accountCurrency = ((accObj.currency_code || 'USD').toUpperCase() === 'VES' ? 'VES' : 'USD') as
    | 'USD'
    | 'VES'

  paymentLines.value.push({
    id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    methodKey: method.key,
    methodLabel: method.label,
    methodIcon: method.icon,
    isCash: method.isCash,
    accountId,
    accountName,
    accountCurrency,
    currency: method.currency,
    amountInput: normalizedInput,
    amountUsd: computedUsd,
    reference: cleanRef
  })

  paymentModalOpen.value = false
}

function removePaymentLine(index: number): void {
  paymentLines.value.splice(index, 1)
}

// ---------------------------------------------------------------------
// 5. Cálculos de Resumen Tipo Ticket y Vuelto Automático
// ---------------------------------------------------------------------
const totalPaidUsd = computed(() => {
  return Number(
    paymentLines.value.reduce((sum, l) => sum + (Number(l.amountUsd) || 0), 0).toFixed(2)
  )
})

const cashPaidUsd = computed(() => {
  return Number(
    paymentLines.value
      .filter((l) => l.isCash)
      .reduce((sum, l) => sum + (Number(l.amountUsd) || 0), 0)
      .toFixed(2)
  )
})

// Lo que falta por cubrir (>= 0)
const pendingDifferenceUsd = computed(() => {
  const diff = totalSelectedToPay.value - totalPaidUsd.value
  return diff > 0.01 ? Number(diff.toFixed(2)) : 0
})

// Excedente sobre el total a cobrar
const rawOverpaidUsd = computed(() => {
  const diff = totalPaidUsd.value - totalSelectedToPay.value
  return diff > 0.01 ? Number(diff.toFixed(2)) : 0
})

// Vuelto físico en efectivo
const changeUsd = computed(() => {
  if (rawOverpaidUsd.value <= 0) return 0
  return Number(Math.min(cashPaidUsd.value, rawOverpaidUsd.value).toFixed(2))
})

// Exceso no-efectivo (por ej. si desmarcó un ítem después de cargar una transferencia)
const nonCashExcessUsd = computed(() => {
  const excess = rawOverpaidUsd.value - changeUsd.value
  return excess > 0.01 ? Number(excess.toFixed(2)) : 0
})

const canProcessPayment = computed(() => {
  return (
    selectedClient.value !== null &&
    selectedReceivableIds.value.length > 0 &&
    totalSelectedToPay.value > 0 &&
    paymentLines.value.length > 0 &&
    pendingDifferenceUsd.value === 0 &&
    nonCashExcessUsd.value === 0 &&
    !isProcessingPayment.value
  )
})

const executeButtonLabel = computed(() => {
  if (selectedReceivableIds.value.length > 0 && totalSelectedToPay.value > 0) {
    return `Cobrar $ ${formatMoney(totalSelectedToPay.value)}`
  }
  return 'Cobrar'
})

// ---------------------------------------------------------------------
// 6. Procesamiento del Cobro y Comprobante
// ---------------------------------------------------------------------
const isProcessingPayment = ref(false)
const successReceiptModalOpen = ref(false)
const processedReceiptData = ref<{
  id: number
  code: string
  clientName: string
  clientDoc: string
  totalUsd: number
  totalVes: number
  changeUsd: number
  date: string
  itemsCount: number
} | null>(null)

async function handleProcessPayment(): Promise<void> {
  if (!canProcessPayment.value || !selectedClient.value) return
  const branchId = branchesStore.activeBranchId
  if (!branchId) {
    notify('Selecciona una sucursal activa para cobrar.', 'error')
    return
  }

  isProcessingPayment.value = true
  try {
    // Ajustar el neto en caja si hubo vuelto físico en efectivo para no generar saldo a favor involuntario
    let remainingChangeToDeduct = changeUsd.value
    const normalizedPayments = paymentLines.value
      .map((line) => {
        let netUsd = line.amountUsd
        let changeNote = ''

        if (line.isCash && remainingChangeToDeduct > 0) {
          const deduction = Math.min(netUsd, remainingChangeToDeduct)
          netUsd = round2(netUsd - deduction)
          remainingChangeToDeduct = round2(remainingChangeToDeduct - deduction)
          if (deduction > 0) {
            changeNote = ` · Recibido ${line.currency === 'USD' ? '$' : 'Bs.'} ${formatMoney(line.amountInput)} · Vuelto $ ${formatMoney(deduction)}`
          }
        }

        if (netUsd <= 0) return null

        // Enviar monto exacto en la moneda nativa de la cuenta destino (preservando Bs. exactos si no hubo vuelto)
        let payloadAmount: number
        if (line.accountCurrency === 'VES') {
          if (line.currency === 'VES' && !changeNote) {
            payloadAmount = round2(line.amountInput)
          } else {
            payloadAmount = round2(netUsd * activeExchangeRate.value)
          }
        } else {
          payloadAmount = round2(netUsd)
        }

        const baseNote =
          line.currency === 'VES'
            ? `${line.methodLabel} (Bs. ${formatMoney(line.amountInput)})`
            : `${line.methodLabel} ($ ${formatMoney(line.amountInput)})`

        return {
          origin_type: '0' as const,
          origin_id: Number(line.accountId),
          amount: payloadAmount,
          reference: line.reference || undefined,
          notes: `${baseNote}${changeNote}`.slice(0, 255)
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    const payload: FullReceiptEmissionPayload = {
      client_id: Number(selectedClient.value.id),
      date: todayStr.value,
      notes: 'Cobro por taquilla',
      items: selectedReceivableIds.value,
      payments: normalizedPayments,
      confirmImmediately: true
    }

    const receiptId = await accountingStore.createFullReceipt(branchId, payload)

    let receiptCode = `REC-${receiptId}`
    try {
      const receiptRes = await getReceiptById(branchId, receiptId)
      if (receiptRes.data?.code) {
        receiptCode = receiptRes.data.code
      }
    } catch {
      // Conservar código de respaldo
    }

    processedReceiptData.value = {
      id: receiptId,
      code: receiptCode,
      clientName: `${selectedClient.value.first_name} ${selectedClient.value.last_name}`.trim(),
      clientDoc: `${getDocPrefix(selectedClient.value.identification_type)}-${selectedClient.value.identification_value}`,
      totalUsd: totalSelectedToPay.value,
      totalVes: totalSelectedVes.value,
      changeUsd: changeUsd.value,
      date: formatShortDate(todayStr.value),
      itemsCount: selectedReceivableIds.value.length
    }

    successReceiptModalOpen.value = true
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: {
        status?: number
        data?: {
          error?: string
          message?: string
          messages?: Record<string, string> | string
          data?: Array<{
            status?: number
            error?: string
            messages?: Record<string, string> | string
          }>
        }
      }
    }
    const resData = axiosErr.response?.data
    const batchFailedItem = Array.isArray(resData?.data)
      ? resData.data.find((d) => (d.status ?? 200) >= 400)
      : undefined

    const rawMessages = resData?.messages ?? batchFailedItem?.messages
    const extractedMessages =
      typeof rawMessages === 'string'
        ? rawMessages
        : Object.values(rawMessages || {})[0]

    const errorCode = resData?.error || batchFailedItem?.error || ''
    const msg =
      resData?.message ||
      extractedMessages ||
      (err instanceof Error && !err.message.startsWith('Request failed')
        ? err.message
        : 'Error al procesar el cobro.')

    notify(msg, 'error')

    // Si algún pago pendiente ya fue cobrado en otra sesión, refrescar la lista del cliente
    if (
      selectedClient.value &&
      (axiosErr.response?.status === 409 ||
        errorCode === 'RECEIVABLE_NOT_PAYABLE' ||
        msg.toLowerCase().includes('pagable') ||
        msg.toLowerCase().includes('pendiente'))
    ) {
      await loadReceivablesForClient(selectedClient.value.id)
    }
  } finally {
    isProcessingPayment.value = false
  }
}

const isDownloadingPdf = ref(false)
async function handleDownloadReceiptPdf(): Promise<void> {
  if (!processedReceiptData.value || !branchesStore.activeBranchId || isDownloadingPdf.value) return
  isDownloadingPdf.value = true
  try {
    await accountingStore.downloadPdf(
      branchesStore.activeBranchId,
      processedReceiptData.value.id,
      processedReceiptData.value.code
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al descargar el PDF del recibo.'
    notify(msg, 'error')
  } finally {
    isDownloadingPdf.value = false
  }
}

function handleStartNextPayment(): void {
  if (!successReceiptModalOpen.value) return
  successReceiptModalOpen.value = false
  processedReceiptData.value = null
  resetTransactionState(true)
}

// Si cambia la sucursal activa, recargar las cuentas por cobrar del cliente en la nueva sucursal
watch(
  () => branchesStore.activeBranchId,
  (newBranchId, oldBranchId) => {
    if (newBranchId && newBranchId !== oldBranchId && selectedClient.value) {
      loadReceivablesForClient(selectedClient.value.id)
    }
  }
)

// ---------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------
onMounted(async () => {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadBankAccounts(),
    accountingStore.loadCurrentExchangeRate(vesCurrency.value.id)
  ])

  if (route.query.client_id) {
    try {
      const person = await fetchPersonById(String(route.query.client_id))
      if (person) {
        selectCustomer(person)
        return
      }
    } catch {
      // Continuar con foco en el buscador
    }
  } else if (route.query.cedula) {
    searchValue.value = String(route.query.cedula)
    executeCustomerSearch()
    return
  }

  focusSearchInput()
})
</script>

<template>
  <div class="pos-cashier-view">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CABECERA LIMPIA (SIN ICONOS NI PASTILLAS)                     -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-start justify-space-between flex-wrap ga-2 mb-3">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Punto de Cobro
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Recaudación de pagos pendientes por cédula del cliente
        </p>
      </div>

      <div v-if="activeExchangeRate > 0" class="text-body-2 text-medium-emphasis tabular-nums pt-1">
        Tasa BCV:
        <strong class="text-high-emphasis">Bs. {{ formatMoney(activeExchangeRate) }}</strong>
        <span v-if="activeRateDateFormatted"> · {{ activeRateDateFormatted }}</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- BARRA DE TRANSACCIÓN (CÉDULA + LUPA DERECHA + CANCELAR/COBRAR) -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="mb-3">
      <div class="d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3">
        <!-- Buscador de cédula con selector V/E/J/G a la izquierda y lupa a la derecha -->
        <div class="flex-grow-1 min-w-0">
          <v-text-field
            ref="searchInputRef"
            v-model="searchValue"
            placeholder="Ingrese cédula del cliente (ej: 30945964)..."
            maxlength="24"
            variant="solo"
            flat
            bg-color="white"
            density="comfortable"
            rounded="lg"
            hide-details
            :disabled="isProcessingPayment"
            class="border pos-search-field elevation-0"
            data-testid="input-pos-client-doc"
            @update:model-value="onSearchInputChange"
            @keyup.enter="requestCustomerSearch"
          >
            <template #prepend-inner>
              <v-menu location="bottom start">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    variant="text"
                    size="small"
                    class="font-weight-bold text-high-emphasis px-1 mr-1"
                    style="min-width: 44px; height: 32px;"
                    :disabled="isProcessingPayment"
                    data-testid="btn-pos-doc-prefix"
                  >
                    {{ getDocPrefix(searchPrefix) }}
                    <v-icon icon="mdi-menu-down" size="small" />
                  </v-btn>
                </template>
                <v-list density="compact" elevation="3" rounded="lg">
                  <v-list-item
                    v-for="p in docPrefixes"
                    :key="p.value"
                    :active="String(searchPrefix) === String(p.value)"
                    :data-testid="`prefix-option-${p.prefix}`"
                    @click="selectSearchPrefix(p.value)"
                  >
                    <v-list-item-title class="font-weight-medium">
                      <span class="font-weight-bold text-primary mr-1">{{ p.prefix }}</span>
                      <span class="text-caption text-medium-emphasis">({{ p.title }})</span>
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
              <v-divider vertical class="my-2 mr-2" />
            </template>

            <template #append-inner>
              <v-btn
                icon="mdi-magnify"
                variant="text"
                size="small"
                color="primary"
                :loading="isSearchingClient"
                :disabled="isProcessingPayment"
                title="Buscar cliente"
                data-testid="btn-pos-search-client"
                @click="requestCustomerSearch"
              />
            </template>
          </v-text-field>
        </div>

        <!-- Botones de control de la transacción: visibles solo con cliente cargado -->
        <div
          v-if="selectedClient"
          class="d-flex align-center ga-2 flex-shrink-0"
        >
          <v-btn
            variant="flat"
            color="white"
            height="48"
            class="border text-none font-weight-medium text-high-emphasis px-4 flex-grow-1 flex-sm-grow-0"
            :disabled="isProcessingPayment"
            data-testid="btn-pos-cancel-transaction"
            @click="requestCancelTransaction"
          >
            Cancelar
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            height="48"
            prepend-icon="mdi-check"
            class="text-none font-weight-bold px-5 tabular-nums flex-grow-1 flex-sm-grow-0"
            :disabled="!canProcessPayment"
            :loading="isProcessingPayment"
            data-testid="btn-pos-process-payment"
            @click="handleProcessPayment"
          >
            {{ executeButtonLabel }}
          </v-btn>
        </div>
      </div>

      <!-- Mensaje en línea cuando la cédula no existe (sin opción de crear cliente) -->
      <div
        v-if="searchNotFoundMsg"
        class="d-flex align-center ga-2 text-body-2 text-error mt-2 px-1"
        data-testid="pos-client-not-found"
      >
        <v-icon icon="mdi-alert-circle-outline" size="18" />
        <span>{{ searchNotFoundMsg }}</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- ESTADO CON CLIENTE SELECCIONADO                               -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <template v-if="selectedClient">
      <!-- Ficha del cliente (sin botón cancelar, deuda alineada a la derecha) -->
      <v-card
        elevation="0"
        rounded="lg"
        class="border bg-white px-4 py-3 mb-3"
        data-testid="pos-client-strip"
      >
        <div class="d-flex align-center justify-space-between ga-3">
          <div class="d-flex align-center ga-3 min-w-0 flex-grow-1">
            <v-avatar
              color="primary"
              variant="tonal"
              size="40"
              class="font-weight-bold flex-shrink-0"
            >
              {{ selectedClient.first_name?.[0] || 'C' }}{{ selectedClient.last_name?.[0] || '' }}
            </v-avatar>

            <div class="min-w-0 flex-grow-1">
              <div class="d-flex align-baseline flex-wrap ga-2">
                <span class="text-subtitle-1 font-weight-bold text-high-emphasis leading-tight">
                  {{ selectedClient.first_name }} {{ selectedClient.last_name }}
                </span>
                <span class="text-body-2 font-weight-medium text-medium-emphasis tabular-nums">
                  {{ getDocPrefix(selectedClient.identification_type) }}-{{ selectedClient.identification_value }}
                </span>
              </div>

              <div
                v-if="selectedClient.phone_primary || selectedClient.address"
                class="text-caption text-medium-emphasis text-truncate mt-1"
                :title="[selectedClient.phone_primary, selectedClient.address].filter(Boolean).join(' · ')"
              >
                <span v-if="selectedClient.phone_primary">{{ selectedClient.phone_primary }}</span>
                <span v-if="selectedClient.phone_primary && selectedClient.address"> · </span>
                <span v-if="selectedClient.address">{{ selectedClient.address }}</span>
              </div>
            </div>
          </div>

          <div class="text-right flex-shrink-0 tabular-nums">
            <div class="text-caption text-medium-emphasis leading-tight">
              Deuda pendiente
            </div>
            <div
              class="text-h6 font-weight-bold leading-tight"
              :class="totalDebtBalance > 0 ? 'text-error' : 'pos-text-covered'"
            >
              $ {{ formatMoney(totalDebtBalance) }}
            </div>
            <div class="text-caption text-medium-emphasis leading-tight">
              {{ clientReceivables.length }} {{ clientReceivables.length === 1 ? 'pago' : 'pagos' }}
            </div>
          </div>
        </div>
      </v-card>

      <!-- Espacio operativo en dos columnas -->
      <v-row dense>
        <!-- COLUMNA IZQUIERDA: PAGOS PENDIENTES -->
        <v-col cols="12" lg="7">
          <v-card elevation="0" rounded="lg" class="border bg-white h-100 d-flex flex-column">
            <div class="px-4 py-3 d-flex align-center justify-space-between flex-wrap ga-2 border-b">
              <div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis leading-tight">
                  Pagos pendientes
                </div>
                <div class="text-caption text-medium-emphasis">
                  Marca lo que el cliente pagará hoy. Se sugiere primero lo más antiguo.
                </div>
              </div>

              <v-btn-toggle
                v-if="showReceivablesFilter"
                v-model="receivablesFilter"
                mandatory
                density="compact"
                variant="outlined"
                color="primary"
                rounded="lg"
              >
                <v-btn value="all" class="text-none text-caption font-weight-medium px-2">
                  Todos ({{ clientReceivables.length }})
                </v-btn>
                <v-btn value="overdue" class="text-none text-caption font-weight-medium px-2">
                  Vencidos ({{ overdueCount }})
                </v-btn>
                <v-btn value="upcoming" class="text-none text-caption font-weight-medium px-2">
                  Por vencer ({{ upcomingCount }})
                </v-btn>
              </v-btn-toggle>
            </div>

            <div class="flex-grow-1 overflow-y-auto pos-scroll-area" style="max-height: 350px;">
              <div v-if="isLoadingReceivables" class="pa-4">
                <v-skeleton-loader type="table-row@4" />
              </div>

              <div v-else-if="filteredReceivables.length === 0" class="text-center py-10 px-4">
                <v-icon icon="mdi-check-circle-outline" color="success" size="44" class="mb-2" />
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
                  Sin pagos pendientes
                </div>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  El cliente se encuentra solvente en esta sucursal.
                </p>
              </div>

              <v-table v-else density="comfortable" hover class="pos-receivables-table">
                <thead>
                  <tr>
                    <th style="width: 44px;" class="text-center px-2">
                      <v-checkbox-btn
                        :model-value="allFilteredSelected"
                        :indeterminate="someFilteredSelected && !allFilteredSelected"
                        color="primary"
                        density="compact"
                        title="Seleccionar o deseleccionar todos"
                        data-testid="checkbox-pos-select-all"
                        @update:model-value="toggleSelectAll"
                      />
                    </th>
                    <th class="font-weight-bold text-body-2">Concepto</th>
                    <th class="font-weight-bold text-body-2 text-center d-none d-sm-table-cell" style="width: 126px;">
                      Vencimiento
                    </th>
                    <th class="font-weight-bold text-body-2 text-end" style="width: 144px;">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="rec in filteredReceivables"
                    :key="rec.id"
                    :class="{ 'pos-row-selected': selectedReceivableIds.includes(Number(rec.id)) }"
                    style="cursor: pointer;"
                    @click="toggleReceivable(Number(rec.id))"
                  >
                    <td class="text-center px-2" @click.stop>
                      <v-checkbox-btn
                        :model-value="selectedReceivableIds.includes(Number(rec.id))"
                        color="primary"
                        density="compact"
                        @update:model-value="toggleReceivable(Number(rec.id))"
                      />
                    </td>
                    <td class="py-2">
                      <div class="font-weight-bold text-high-emphasis text-body-2">
                        {{ rec.description || rec.concept_name || 'Cargo pendiente' }}
                      </div>
                      <div class="text-caption text-medium-emphasis tabular-nums">
                        <span v-if="rec.concept_name && rec.description && rec.concept_name !== rec.description">
                          {{ rec.concept_name }} ·
                        </span>
                        <span>Monto $ {{ formatMoney(rec.total_amount) }}</span>
                        <span v-if="Number(rec.paid_amount) > 0" class="pos-text-covered font-weight-medium">
                          · Abonado $ {{ formatMoney(rec.paid_amount) }}
                        </span>
                      </div>
                      <div class="d-sm-none mt-1 tabular-nums">
                        <v-chip
                          v-if="isOverdue(rec.due_date)"
                          size="x-small"
                          color="error"
                          variant="tonal"
                          label
                          class="font-weight-bold"
                        >
                          Vence {{ formatShortDate(rec.due_date) }}
                        </v-chip>
                        <span v-else class="text-caption text-medium-emphasis">
                          Vence {{ formatShortDate(rec.due_date) }}
                        </span>
                      </div>
                    </td>
                    <td class="text-center tabular-nums d-none d-sm-table-cell">
                      <v-chip
                        v-if="isOverdue(rec.due_date)"
                        size="x-small"
                        color="error"
                        variant="tonal"
                        label
                        class="font-weight-bold"
                      >
                        {{ formatShortDate(rec.due_date) }}
                      </v-chip>
                      <span v-else class="text-body-2 text-medium-emphasis">
                        {{ formatShortDate(rec.due_date) }}
                      </span>
                    </td>
                    <td class="text-end tabular-nums text-no-wrap">
                      <div class="font-weight-bold text-body-2 text-high-emphasis">
                        $ {{ formatMoney(getReceivableBalance(rec)) }}
                      </div>
                      <div v-if="activeExchangeRate > 0" class="text-caption text-medium-emphasis">
                        Bs. {{ formatMoney(toVes(getReceivableBalance(rec))) }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <div
              v-if="clientReceivables.length > 0"
              class="px-4 py-3 bg-surface-light border-t d-flex align-center justify-space-between flex-wrap ga-2 tabular-nums"
            >
              <span class="text-caption text-medium-emphasis">
                <strong class="text-high-emphasis">{{ selectedReceivableIds.length }}</strong>
                {{ selectedReceivableIds.length === 1 ? 'seleccionado' : 'seleccionados' }}
              </span>
              <div class="text-body-2">
                <span class="text-medium-emphasis mr-2">Total seleccionado:</span>
                <strong class="text-high-emphasis">$ {{ formatMoney(totalSelectedToPay) }}</strong>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- COLUMNA DERECHA: FORMAS DE PAGO + RESUMEN TIPO TICKET -->
        <v-col cols="12" lg="5">
          <v-card elevation="0" rounded="lg" class="border bg-white h-100 d-flex flex-column">
            <!-- Cabecera de Formas de pago con único botón "Agregar" -->
            <div class="px-4 py-3 d-flex align-center justify-space-between ga-2 border-b">
              <div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis leading-tight">
                  Formas de pago
                </div>
                <div class="text-caption text-medium-emphasis">
                  Métodos recibidos en esta transacción
                </div>
              </div>

              <v-btn
                color="primary"
                variant="tonal"
                size="small"
                prepend-icon="mdi-plus"
                class="text-none font-weight-bold"
                :disabled="selectedReceivableIds.length === 0 || pendingDifferenceUsd === 0"
                data-testid="btn-pos-open-add-payment"
                @click="openAddPaymentModal"
              >
                Agregar
              </v-btn>
            </div>

            <!-- Lista compacta de pagos registrados -->
            <div class="pa-4 flex-grow-1 overflow-y-auto pos-scroll-area" style="max-height: 220px;">
              <div
                v-if="paymentLines.length === 0"
                class="pos-empty-payments rounded-lg py-6 px-4 text-center"
              >
                <v-icon icon="mdi-wallet-plus-outline" size="32" class="text-disabled mb-2" />
                <div class="text-body-2 text-medium-emphasis">
                  <template v-if="clientReceivables.length === 0">
                    El cliente no tiene pagos pendientes por cobrar.
                  </template>
                  <template v-else-if="selectedReceivableIds.length === 0">
                    Marca al menos un pago pendiente a la izquierda.
                  </template>
                  <template v-else>
                    Sin pagos cargados. Pulsa <strong>Agregar</strong> para registrar cómo paga el cliente.
                  </template>
                </div>
              </div>

              <div v-else class="d-flex flex-column ga-2">
                <div
                  v-for="(line, idx) in paymentLines"
                  :key="line.id"
                  class="d-flex align-center justify-space-between ga-3 px-3 py-2 rounded-lg border bg-white"
                  data-testid="pos-payment-line"
                >
                  <div class="d-flex align-center ga-3 min-w-0">
                    <v-icon :icon="line.methodIcon" size="20" color="primary" class="flex-shrink-0" />
                    <div class="min-w-0">
                      <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                        {{ line.methodLabel }}
                      </div>
                      <div class="text-caption text-medium-emphasis text-truncate tabular-nums">
                        <span>{{ line.accountName }}</span>
                        <span v-if="line.reference"> · Ref {{ line.reference }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="d-flex align-center ga-1 flex-shrink-0 tabular-nums">
                    <div class="text-right">
                      <div class="text-body-2 font-weight-bold text-high-emphasis text-no-wrap">
                        {{ line.currency === 'USD' ? '$' : 'Bs.' }} {{ formatMoney(line.amountInput) }}
                      </div>
                      <div
                        v-if="line.currency === 'VES'"
                        class="text-caption text-medium-emphasis text-no-wrap"
                      >
                        ≈ $ {{ formatMoney(line.amountUsd) }}
                      </div>
                    </div>

                    <v-btn
                      icon="mdi-close"
                      size="x-small"
                      variant="text"
                      color="medium-emphasis"
                      title="Quitar pago"
                      data-testid="btn-pos-remove-payment"
                      @click="removePaymentLine(idx)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Resumen plano tipo ticket (con vuelto automático) -->
            <div class="pa-4 border-t pos-ticket-summary mt-auto tabular-nums">
              <div class="d-flex align-baseline justify-space-between">
                <span class="text-body-2 text-medium-emphasis">Total a cobrar</span>
                <span class="text-subtitle-1 font-weight-bold text-high-emphasis">
                  $ {{ formatMoney(totalSelectedToPay) }}
                </span>
              </div>
              <div
                v-if="activeExchangeRate > 0"
                class="text-caption text-medium-emphasis text-right mb-2"
              >
                Bs. {{ formatMoney(totalSelectedVes) }}
              </div>

              <div class="d-flex align-baseline justify-space-between text-body-2 mb-2">
                <span class="text-medium-emphasis">Pagado</span>
                <span class="font-weight-bold text-high-emphasis">
                  $ {{ formatMoney(totalPaidUsd) }}
                </span>
              </div>

              <v-divider class="my-3" />

              <!-- Estado dinámico: Falta / Vuelto / Exceso / Exacto -->
              <div
                v-if="clientReceivables.length === 0"
                class="d-flex justify-space-between text-body-2 text-disabled"
                data-testid="pos-summary-no-debt"
              >
                <span>Estado</span>
                <span>Sin deuda pendiente</span>
              </div>

              <div
                v-else-if="selectedReceivableIds.length === 0"
                class="d-flex justify-space-between text-body-2 text-disabled"
                data-testid="pos-summary-none-selected"
              >
                <span>Selecciona al menos un cargo</span>
                <span>$ 0.00</span>
              </div>

              <div
                v-else-if="pendingDifferenceUsd > 0"
                class="d-flex align-start justify-space-between"
                data-testid="pos-summary-pending"
              >
                <span class="text-body-2 font-weight-bold pos-text-pending">Falta</span>
                <div class="text-right">
                  <div class="text-subtitle-2 font-weight-bold pos-text-pending">
                    $ {{ formatMoney(pendingDifferenceUsd) }}
                  </div>
                  <div v-if="activeExchangeRate > 0" class="text-caption text-medium-emphasis">
                    Bs. {{ formatMoney(toVes(pendingDifferenceUsd)) }}
                  </div>
                </div>
              </div>

              <div
                v-else-if="nonCashExcessUsd > 0"
                class="d-flex align-start justify-space-between"
                data-testid="pos-summary-excess"
              >
                <div>
                  <div class="text-body-2 font-weight-bold text-error">Excede el total</div>
                  <div class="text-caption text-medium-emphasis">
                    Ajusta los pagos o marca más conceptos
                  </div>
                </div>
                <div class="text-subtitle-2 font-weight-bold text-error">
                  + $ {{ formatMoney(nonCashExcessUsd) }}
                </div>
              </div>

              <div
                v-else-if="changeUsd > 0"
                class="d-flex align-start justify-space-between"
                data-testid="pos-summary-change"
              >
                <span class="text-body-2 font-weight-bold pos-text-change">Vuelto</span>
                <div class="text-right">
                  <div class="text-subtitle-2 font-weight-bold pos-text-change">
                    $ {{ formatMoney(changeUsd) }}
                  </div>
                  <div v-if="activeExchangeRate > 0" class="text-caption text-medium-emphasis">
                    Bs. {{ formatMoney(toVes(changeUsd)) }}
                  </div>
                </div>
              </div>

              <div
                v-else
                class="d-flex align-center justify-space-between pos-text-covered"
                data-testid="pos-summary-exact"
              >
                <span class="text-body-2 font-weight-bold">Cubierto</span>
                <span class="text-subtitle-2 font-weight-bold d-flex align-center ga-1">
                  $ 0.00
                  <v-icon icon="mdi-check-circle" size="16" color="#047857" />
                </span>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- ESTADO VACÍO BREVE (ICONO + TÍTULO + DESCRIPCIÓN, SIN BOTONES) -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card
      v-else
      elevation="0"
      rounded="lg"
      class="border bg-white text-center py-16 px-4"
      data-testid="pos-empty-state"
    >
      <v-icon
        icon="mdi-card-account-details-outline"
        size="48"
        class="text-disabled mb-3"
      />
      <h2 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
        Busca al cliente por su cédula
      </h2>
      <p class="text-body-2 text-medium-emphasis mb-0 mx-auto" style="max-width: 380px;">
        Presiona Enter o el icono de búsqueda para ver sus pagos pendientes.
      </p>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: AGREGAR FORMA DE PAGO                                  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="paymentModalOpen"
      title="Agregar pago"
      subtitle="Selecciona el método e ingresa el monto recibido"
      max-width="500"
      submit-text="Agregar"
      submit-icon="mdi-check"
      submit-test-id="btn-confirm-add-payment"
      form-id="form-pos-add-payment"
      @submit="handleConfirmAddPayment"
    >
      <v-form id="form-pos-add-payment" @submit.prevent="handleConfirmAddPayment">
        <!-- 1. Selección de Método -->
        <div class="pos-methods-grid mb-4">
          <button
            v-for="m in paymentMethodOptions"
            :key="m.key"
            type="button"
            class="pos-method-card text-left pa-3 rounded-lg"
            :class="{ 'pos-method-card--active': paymentDraft.methodKey === m.key }"
            :data-testid="`method-option-${m.key}`"
            @click="selectDraftMethod(m.key)"
          >
            <v-icon
              :icon="m.icon"
              size="20"
              :color="paymentDraft.methodKey === m.key ? 'primary' : 'medium-emphasis'"
              class="mb-1"
            />
            <div class="text-body-2 font-weight-bold text-high-emphasis leading-tight">
              {{ m.label }}
            </div>
            <div class="text-caption text-medium-emphasis leading-tight mt-1">
              {{ m.shortSub }}
            </div>
          </button>
        </div>

        <!-- 2. Cuenta destino (oculta automáticamente cuando solo hay una) -->
        <v-select
          v-if="draftAccountItems.length > 1"
          v-model="paymentDraft.accountId"
          :items="draftAccountItems"
          item-title="name"
          item-value="id"
          label="Cuenta destino"
          variant="outlined"
          density="comfortable"
          hide-details
          class="mb-3"
          data-testid="select-pos-payment-account"
        />

        <!-- 3. Monto precargado con conversión visible debajo -->
        <div class="mb-3">
          <v-text-field
            ref="paymentAmountInputRef"
            v-model.number="paymentDraft.amount"
            :label="selectedDraftMethod.currency === 'USD' ? 'Monto en dólares *' : 'Monto en bolívares *'"
            type="number"
            step="0.01"
            min="0.01"
            :prefix="selectedDraftMethod.currency === 'USD' ? '$' : 'Bs.'"
            variant="outlined"
            density="comfortable"
            hide-details
            class="tabular-nums pos-amount-input"
            data-testid="input-pos-payment-amount"
            @keydown="onAmountKeydown"
          />
          <div
            v-if="draftEquivalentHint"
            class="text-caption text-medium-emphasis mt-1 px-1 tabular-nums"
          >
            {{ draftEquivalentHint }}
          </div>
        </div>

        <!-- 4. Referencia (solo para métodos no efectivo) -->
        <v-text-field
          v-if="!selectedDraftMethod.isCash"
          v-model="paymentDraft.reference"
          label="Referencia *"
          placeholder="Ej: 948210"
          maxlength="60"
          variant="outlined"
          density="comfortable"
          hide-details
          data-testid="input-pos-payment-reference"
        />

        <v-alert
          v-if="paymentFormError"
          type="error"
          variant="tonal"
          density="compact"
          rounded="lg"
          class="mt-3"
          :text="paymentFormError"
        />
      </v-form>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: CONFIRMAR DESCARTE DE TRANSACCIÓN EN CURSO             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="confirmDiscardOpen"
      title="Descartar transacción"
      subtitle="Hay pagos o conceptos seleccionados en curso"
      max-width="420"
      cancel-text="Seguir cobrando"
      submit-text="Descartar"
      submit-color="error"
      submit-test-id="btn-confirm-discard-pos"
      @submit="handleConfirmDiscard"
    >
      <p class="text-body-2 text-high-emphasis mb-0">
        Se perderán las selecciones y formas de pago cargadas para
        <strong>{{ selectedClient?.first_name }} {{ selectedClient?.last_name }}</strong>.
      </p>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: COMPROBANTE DE COBRO EXITOSO                           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="successReceiptModalOpen"
      title="Cobro registrado"
      subtitle="El recibo fue emitido e imputado correctamente"
      max-width="460"
      :persistent="true"
      :show-close="false"
      :hide-cancel="true"
      submit-text="Nuevo cobro"
      submit-icon="mdi-arrow-right"
      submit-test-id="btn-pos-next-payment"
      @submit="handleStartNextPayment"
    >
      <div v-if="processedReceiptData" class="py-1 text-center tabular-nums">
        <v-icon icon="mdi-check-circle" color="success" size="48" class="mb-2" />

        <div class="text-h6 font-weight-bold text-high-emphasis font-monospace">
          {{ processedReceiptData.code }}
        </div>
        <div class="text-caption text-medium-emphasis mb-4">
          {{ processedReceiptData.date }}
        </div>

        <div class="text-left rounded-lg border bg-surface-light pa-3 mb-4">
          <div class="d-flex justify-space-between mb-1 text-body-2">
            <span class="text-medium-emphasis">Cliente</span>
            <span class="font-weight-bold text-high-emphasis">{{ processedReceiptData.clientName }}</span>
          </div>
          <div class="d-flex justify-space-between mb-1 text-body-2">
            <span class="text-medium-emphasis">Cédula</span>
            <span class="font-weight-medium text-high-emphasis">{{ processedReceiptData.clientDoc }}</span>
          </div>
          <div class="d-flex justify-space-between mb-1 text-body-2">
            <span class="text-medium-emphasis">Conceptos pagados</span>
            <span class="font-weight-medium text-high-emphasis">{{ processedReceiptData.itemsCount }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="d-flex justify-space-between text-subtitle-1">
            <span class="font-weight-bold text-high-emphasis">Total cobrado</span>
            <span class="font-weight-bold text-primary">
              $ {{ formatMoney(processedReceiptData.totalUsd) }}
            </span>
          </div>
          <div
            v-if="activeExchangeRate > 0"
            class="text-caption text-right text-medium-emphasis"
          >
            Bs. {{ formatMoney(processedReceiptData.totalVes) }}
          </div>
          <div
            v-if="processedReceiptData.changeUsd > 0"
            class="d-flex justify-space-between text-body-2 pos-text-change font-weight-bold mt-2 pt-2 border-t"
          >
            <span>Vuelto entregado</span>
            <span>$ {{ formatMoney(processedReceiptData.changeUsd) }}</span>
          </div>
        </div>
      </div>

      <template #prepend-actions>
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-file-pdf-box"
          class="text-none font-weight-bold"
          :loading="isDownloadingPdf"
          data-testid="btn-pos-download-pdf"
          @click="handleDownloadReceiptPdf"
        >
          Descargar PDF
        </v-btn>
      </template>
    </AppModal>

    <!-- Snackbar de errores/advertencias puntuales -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="bottom right"
      data-testid="pos-snackbar"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.min-w-0 {
  min-width: 0;
}

.pos-amount-input :deep(input[type='number']::-webkit-outer-spin-button),
.pos-amount-input :deep(input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.pos-amount-input :deep(input[type='number']) {
  -moz-appearance: textfield;
}

.pos-receivables-table tbody tr {
  transition: background-color 150ms ease;
}

.pos-receivables-table tbody tr:hover {
  background-color: rgba(14, 84, 164, 0.04);
}

.pos-row-selected {
  background-color: rgba(14, 84, 164, 0.07) !important;
}

.bg-surface-light {
  background-color: #F8FAFC;
}

.pos-ticket-summary {
  background-color: #F8FAFC;
}

.pos-text-pending {
  color: #B45309;
}

.pos-text-covered {
  color: #047857;
}

.pos-text-change {
  color: #0E54A4;
}

.pos-empty-payments {
  border: 1px dashed rgba(30, 41, 59, 0.18);
  background-color: #F8FAFC;
}

.pos-methods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 8px;
}

.pos-method-card {
  border: 1px solid rgba(30, 41, 59, 0.14);
  background-color: #FFFFFF;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.pos-method-card:hover {
  border-color: rgba(14, 84, 164, 0.45);
  background-color: #F8FAFC;
}

.pos-method-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.pos-method-card--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(14, 84, 164, 0.06);
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}

.pos-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(30, 41, 59, 0.2) transparent;
}
</style>
