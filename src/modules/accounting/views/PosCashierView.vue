<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchPersons, fetchPersonById } from '@/modules/catalogs/api/catalogs.api'
import {
  fetchAccountsReceivable,
  fetchClientCredits,
  fetchReceipts,
  fetchReceiptItems,
  fetchReceiptPayments,
  getReceiptById
} from '../api/accounting.api'
import type {
  AccountReceivableItem,
  ClientCreditItem,
  PaymentAccountItem,
  PaymentCategoryItem,
  ReceiptPaymentPayload
} from '../types'
import type { PersonItem } from '@/modules/catalogs/types'
import type { DqbFilterTuple } from '@/types/query'
import AppModal from '@/components/common/AppModal.vue'
import AppChipFilter from '@/components/common/AppChipFilter.vue'

const route = useRoute()
const router = useRouter()
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

const vesTooltipOpen = ref(false)

// ---------------------------------------------------------------------
// 1. Monedas, Tasa y Utilidades de Formato
// ---------------------------------------------------------------------
const vesCurrency = computed(() => {
  return (
    accountingStore.currencies.find((c) => c.code === 'VES') || {
      id: 2,
      code: 'VES',
      symbol: 'Bs.'
    }
  )
})

const activeRateObj = computed(() => {
  const idStr = String(vesCurrency.value.id)
  return accountingStore.currentRates[idStr] || null
})

const activeExchangeRate = computed<number>(() => {
  const val = Number(activeRateObj.value?.value)
  return !isNaN(val) && val > 0 ? val : 0
})

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function formatUsd(val: number | string | null | undefined): string {
  const num = Number(val || 0)
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatVes(val: number | string | null | undefined): string {
  const num = Number(val || 0)
  const fixed = Math.abs(num).toFixed(2)
  const [intPart = '0', decPart = '00'] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${num < 0 ? '-' : ''}${grouped},${decPart}`
}

function formatByCurrency(val: number | string | null | undefined, currency: 'USD' | 'VES'): string {
  return currency === 'VES' ? formatVes(val) : formatUsd(val)
}

function toVes(usdAmount: number): number {
  if (activeExchangeRate.value <= 0) return 0
  return round2(usdAmount * activeExchangeRate.value)
}

function toUsd(vesAmount: number, customRate?: number): number {
  const rate = customRate && customRate > 0 ? customRate : activeExchangeRate.value
  if (rate <= 0) return 0
  return round2(vesAmount / rate)
}

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const clean = dateStr.split(' ')[0] ?? ''
  const [y, m, d] = clean.split('-')
  return y && m && d ? `${d}/${m}/${y}` : dateStr
}

function getLocalTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false
  const today = getLocalTodayIso()
  const cleanDue = dueDate.split(' ')[0] || ''
  return cleanDue < today
}

const DOC_PREFIX_MAP: Record<string, string> = {
  '0': 'V',
  '1': 'E',
  '2': 'J',
  '3': 'G',
  '4': 'P'
}

function formatPersonDoc(type?: string | number | null, value?: string | null): string {
  if (!value) return 'Sin documento'
  if (type === undefined || type === null || type === '') return value
  const raw = String(type).toUpperCase()
  if (['V', 'E', 'J', 'G', 'P'].includes(raw)) return `${raw}-${value}`
  const prefix = DOC_PREFIX_MAP[raw] || 'V'
  return `${prefix}-${value}`
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Devuelve únicamente datos operativos bancarios útiles (teléfono, RIF, nro. cuenta, correo)
 * sin repetir nombre de la cuenta, moneda ni descripciones internas redundantes.
 */
function formatAccountOperationalHint(account?: PaymentAccountItem | null): string {
  if (!account) return ''
  const meta = parseMetadata(account.metadata)
  const catId = Number(account.category_id)
  if (catId === 1) return ''

  const parts: string[] = []
  const bank = String(meta.bank_name || meta.bank || '').trim()
  const acc = String(meta.account_number || '').trim()
  const phone = String(meta.phone_number || meta.phone || '').trim()
  const email = String(meta.email || '').trim()
  const doc = String(meta.id_document || meta.identification_number || '').trim()

  if (bank) parts.push(bank)
  if (acc) parts.push(acc)
  if (phone) parts.push(phone)
  if (email) parts.push(email)
  if (doc) parts.push(doc)

  return parts.join(' · ')
}

function isCashCategory(cat?: PaymentCategoryItem | null): boolean {
  if (!cat) return false
  if (Number(cat.id) === 1) return true
  return /efectivo|caja|cash/i.test(cat.name || '')
}

function getCategoryIcon(cat?: PaymentCategoryItem | null): string {
  if (!cat) return 'mdi-wallet-outline'
  const id = Number(cat.id)
  if (id === 1 || /efectivo|caja/i.test(cat.name)) return 'mdi-cash-multiple'
  if (id === 2 || /m[oó]vil/i.test(cat.name)) return 'mdi-cellphone-check'
  if (id === 3 || /transfer/i.test(cat.name)) return 'mdi-bank-transfer'
  if (id === 4 || /zelle/i.test(cat.name)) return 'mdi-lightning-bolt-outline'
  return 'mdi-credit-card-outline'
}

// ---------------------------------------------------------------------
// 2. Sección Izquierda: Listado de Clientes con Buscador
// ---------------------------------------------------------------------
const rawClientSearch = ref('')

const clientsQuery = useDataQuery<PersonItem>(
  async (params) => fetchPersons(params),
  {
    initialItemsPerPage: 5,
    debounceMs: 250,
    searchFields: ['first_name', 'last_name', 'identification_value'],
    staticFilters: [['is_disabled', '0', '=']],
    defaultOrder: { id: 'DESC' }
  }
)

function normalizeClientSearchInput(input: string): string {
  const trimmed = (input || '').trim()
  const docMatch = trimmed.match(/^[VEJGPvejgp]?[-\s.]?(\d[\d.-]*)$/)
  if (docMatch && docMatch[1]) {
    return docMatch[1].replace(/[.-]/g, '')
  }
  return trimmed
}

watch(rawClientSearch, (val) => {
  clientsQuery.search.value = normalizeClientSearchInput(val || '')
})

function handleClientPageChange(nextPage: number): void {
  clientsQuery.page.value = nextPage
  clientsQuery.executeFetch()
}

const clientTotalPages = computed(() => {
  const total = clientsQuery.totalItems.value
  const perPage = clientsQuery.itemsPerPage.value || 5
  return Math.max(1, Math.ceil(total / perPage))
})

// ---------------------------------------------------------------------
// 3. Estado Principal de Transacción y Persistencia (Resiliencia)
// ---------------------------------------------------------------------
export interface PosPaymentLine {
  id: string
  originType: '0' | '1'
  originId: number
  categoryId: number | null
  categoryName: string
  accountName: string
  currency: 'USD' | 'VES'
  currencySymbol: string
  exchangeRate: number
  amountInput: number
  amountUsd: number
  isCash: boolean
  reference: string
}

interface PersistedPosSession {
  branchId: number
  clientId: number
  selectedReceivableIds: number[]
  paymentLines: PosPaymentLine[]
  paymentModalOpen: boolean
  draftReceiptId: number | null
  giveCashChange: boolean
  updatedAt: number
}

const selectedClient = ref<PersonItem | null>(null)
const clientReceivables = ref<AccountReceivableItem[]>([])
const clientCredits = ref<ClientCreditItem[]>([])
const isLoadingReceivables = ref(false)
const selectedReceivableIds = ref<number[]>([])
const receivablesScope = ref<'all' | 'overdue' | 'upcoming'>('all')
const scopeChipModel = ref<DqbFilterTuple[] | null>(null)

const paymentLines = ref<PosPaymentLine[]>([])
const paymentModalOpen = ref(false)
const draftReceiptId = ref<number | null>(null)
const giveCashChange = ref(true)
const isHydratingSession = ref(false)

const confirmDiscardOpen = ref(false)
const pendingNextClient = ref<PersonItem | null>(null)
const isDiscardingDraft = ref(false)

function getStorageKey(branchId?: string | number | null): string {
  return `motcar_pos_session_v2_${branchId || 'default'}`
}

function saveSessionToStorage(): void {
  if (isHydratingSession.value) return
  const branchId = branchesStore.activeBranchId
  if (!branchId) return
  const key = getStorageKey(branchId)

  if (!selectedClient.value) {
    localStorage.removeItem(key)
    return
  }

  const snapshot: PersistedPosSession = {
    branchId: Number(branchId),
    clientId: Number(selectedClient.value.id),
    selectedReceivableIds: [...selectedReceivableIds.value],
    paymentLines: [...paymentLines.value],
    paymentModalOpen: paymentModalOpen.value,
    draftReceiptId: draftReceiptId.value,
    giveCashChange: giveCashChange.value,
    updatedAt: Date.now()
  }

  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    // Ignorar cuotas de almacenamiento excedidas
  }
}

function clearSessionStorage(branchId?: string | number | null): void {
  const id = branchId ?? branchesStore.activeBranchId
  if (!id) return
  localStorage.removeItem(getStorageKey(id))
}

function syncUrlClientQuery(clientId: number | string | null): void {
  const nextQuery = { ...route.query }
  delete nextQuery.cedula
  if (clientId) {
    nextQuery.client_id = String(clientId)
  } else {
    delete nextQuery.client_id
  }
  router.replace({ query: nextQuery }).catch(() => {})
}

watch(
  [selectedReceivableIds, paymentLines, paymentModalOpen, draftReceiptId, giveCashChange],
  () => {
    saveSessionToStorage()
  },
  { deep: true }
)

const hasUnsavedPaymentWork = computed(() => {
  return paymentLines.value.length > 0 || draftReceiptId.value !== null
})

// ---------------------------------------------------------------------
// 4. Selección de Cliente, Carga de Cargos y Adopción de Borrador
// ---------------------------------------------------------------------
function getReceivableBalance(item: AccountReceivableItem): number {
  const total = Number(item.total_amount || 0)
  const paid = Number(item.paid_amount || 0)
  return Math.max(0, round2(total - paid))
}

function getReceivablePriority(item: AccountReceivableItem): number {
  const conceptId = Number(item.receivable_concept_id || 0)
  const conceptCode = String(item.concept_code || '')
  if (conceptId === 2 || conceptId === 3 || conceptCode === 'admin_fee' || conceptCode === 'late_fee') {
    return 1
  }
  if (isOverdue(item.due_date)) {
    return 2
  }
  return 3
}

function sortReceivablesByCascade(items: AccountReceivableItem[]): AccountReceivableItem[] {
  return [...items].sort((a, b) => {
    const prioDiff = getReceivablePriority(a) - getReceivablePriority(b)
    if (prioDiff !== 0) return prioDiff
    const dateDiff = (a.due_date || '').localeCompare(b.due_date || '')
    if (dateDiff !== 0) return dateDiff
    return Number(a.id) - Number(b.id)
  })
}

function handleClientClick(person: PersonItem): void {
  if (isProcessingPayment.value) return
  if (selectedClient.value && Number(selectedClient.value.id) === Number(person.id)) {
    return
  }

  if (selectedClient.value && hasUnsavedPaymentWork.value) {
    pendingNextClient.value = person
    confirmDiscardOpen.value = true
    return
  }

  selectClientAndLoad(person)
}

function requestClearClient(): void {
  if (!selectedClient.value || isProcessingPayment.value) return
  if (hasUnsavedPaymentWork.value) {
    pendingNextClient.value = null
    confirmDiscardOpen.value = true
    return
  }
  resetPosSession()
}

async function handleConfirmDiscard(): Promise<void> {
  if (isDiscardingDraft.value) return
  isDiscardingDraft.value = true
  try {
    if (draftReceiptId.value && branchesStore.activeBranchId) {
      await accountingStore.clearDraftReceiptContents(
        branchesStore.activeBranchId,
        draftReceiptId.value
      )
    }
    const next = pendingNextClient.value
    confirmDiscardOpen.value = false
    pendingNextClient.value = null

    if (next) {
      await selectClientAndLoad(next)
    } else {
      resetPosSession()
    }
  } finally {
    isDiscardingDraft.value = false
  }
}

function resetPosSession(): void {
  selectedClient.value = null
  clientReceivables.value = []
  clientCredits.value = []
  selectedReceivableIds.value = []
  paymentLines.value = []
  paymentModalOpen.value = false
  draftReceiptId.value = null
  giveCashChange.value = true
  receivablesScope.value = 'all'
  scopeChipModel.value = null
  clearSessionStorage()
  syncUrlClientQuery(null)
}

async function selectClientAndLoad(
  person: PersonItem,
  restored?: PersistedPosSession | null
): Promise<void> {
  if (String(person.is_disabled ?? '0') === '1') {
    notify('El cliente seleccionado se encuentra inactivo y no admite cobros.', 'warning')
    return
  }

  const branchId = branchesStore.activeBranchId
  if (!branchId) return

  isHydratingSession.value = true
  selectedClient.value = person
  receivablesScope.value = 'all'
  scopeChipModel.value = null
  isLoadingReceivables.value = true

  if (!restored) {
    selectedReceivableIds.value = []
    paymentLines.value = []
    paymentModalOpen.value = false
    draftReceiptId.value = null
    giveCashChange.value = true
  }

  syncUrlClientQuery(person.id)

  try {
    const recFilters = JSON.stringify([
      ['client_id', String(person.id), '=', 'AND'],
      ['is_disabled', '0', '=', 'AND'],
      ['status', '2', '!=', 'AND'],
      ['status', '3', '!=', 'AND']
    ])

    const creditFilters = JSON.stringify([
      ['client_id', String(person.id), '=', 'AND'],
      ['status', '0', '=', 'AND']
    ])

    const [recRes, credRes] = await Promise.all([
      fetchAccountsReceivable(branchId, { itemsPerPage: 100, filters: recFilters }),
      fetchClientCredits(branchId, { itemsPerPage: 50, filters: creditFilters }).catch(() => ({
        data: [] as ClientCreditItem[]
      }))
    ])

    const payableItems = sortReceivablesByCascade(
      (recRes.data || []).filter(
        (r) => String(r.is_disabled ?? '0') !== '1' && getReceivableBalance(r) > 0
      )
    )

    clientReceivables.value = payableItems
    clientCredits.value = (credRes.data || []).filter(
      (c) => String(c.status) === '0' && Number(c.available_amount) > 0
    )

    const validPayableSet = new Set(payableItems.map((r) => Number(r.id)))

    if (restored && Number(restored.clientId) === Number(person.id)) {
      const keptIds = (restored.selectedReceivableIds || []).filter((id) => validPayableSet.has(Number(id)))
      if (keptIds.length > 0) {
        selectedReceivableIds.value = keptIds
      } else if (payableItems[0]) {
        selectedReceivableIds.value = [Number(payableItems[0].id)]
      } else {
        selectedReceivableIds.value = []
      }

      paymentLines.value = Array.isArray(restored.paymentLines) ? restored.paymentLines : []
      draftReceiptId.value = restored.draftReceiptId ?? null
      giveCashChange.value = restored.giveCashChange ?? true
      paymentModalOpen.value = Boolean(restored.paymentModalOpen && selectedReceivableIds.value.length > 0)
    } else {
      const adopted = await tryAdoptServerDraft(branchId, Number(person.id), validPayableSet)
      if (!adopted) {
        selectedReceivableIds.value = payableItems[0] ? [Number(payableItems[0].id)] : []
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al consultar los cargos pendientes.'
    notify(msg, 'error')
  } finally {
    isLoadingReceivables.value = false
    isHydratingSession.value = false
    saveSessionToStorage()
  }
}

async function tryAdoptServerDraft(
  branchId: string | number,
  clientId: number,
  validPayableSet: Set<number>
): Promise<boolean> {
  try {
    const draftsRes = await fetchReceipts(branchId, {
      itemsPerPage: 1,
      filters: JSON.stringify([
        ['client_id', String(clientId), '=', 'AND'],
        ['status', '0', '=', 'AND']
      ])
    })

    const draft = draftsRes.data?.[0]
    if (!draft?.id) return false

    const rId = Number(draft.id)
    const [itemsRes, paymentsRes] = await Promise.all([
      fetchReceiptItems(branchId, rId, { itemsPerPage: 100 }),
      fetchReceiptPayments(branchId, rId, { itemsPerPage: 100 })
    ])

    const serverItems = (itemsRes.data || [])
      .map((it) => Number(it.receivable_id))
      .filter((id) => validPayableSet.has(id))

    const serverPayments = paymentsRes.data || []

    if (serverItems.length === 0 && serverPayments.length === 0) {
      draftReceiptId.value = rId
      return false
    }

    draftReceiptId.value = rId
    if (serverItems.length > 0) {
      selectedReceivableIds.value = serverItems
    }

    if (serverPayments.length > 0) {
      paymentLines.value = serverPayments.map((sp, idx) => {
        const originType = String(sp.origin_type ?? '0') === '1' ? '1' : '0'
        const originId = Number(sp.origin_id)
        const acc =
          originType === '0'
            ? accountingStore.bankAccounts.find((a) => Number(a.id) === originId)
            : undefined
        const cat = acc
          ? accountingStore.paymentCategories.find((c) => Number(c.id) === Number(acc.category_id))
          : undefined
        const currencyCode = (sp.currency_code || acc?.currency_code || 'USD').toUpperCase()
        const currency: 'USD' | 'VES' = currencyCode === 'VES' ? 'VES' : 'USD'
        const rate =
          Number(sp.exchange_rate) > 0
            ? Number(sp.exchange_rate)
            : currency === 'VES'
              ? activeExchangeRate.value
              : 1
        const amountInput = round2(Number(sp.amount || 0))
        const amountUsd = currency === 'USD' ? amountInput : toUsd(amountInput, rate)

        return {
          id: `srv-${sp.id}-${idx}`,
          originType,
          originId,
          categoryId: acc ? Number(acc.category_id) : null,
          categoryName:
            originType === '1'
              ? 'Saldo a favor'
              : cat?.name || sp.payment_category_name || acc?.category_name || 'Pago',
          accountName:
            originType === '1'
              ? `Saldo a favor #${originId}`
              : acc?.name || sp.payment_account_name || `Cuenta #${originId}`,
          currency,
          currencySymbol: currency === 'USD' ? '$' : 'Bs.',
          exchangeRate: rate,
          amountInput,
          amountUsd,
          isCash: originType === '0' && isCashCategory(cat),
          reference: sp.reference || ''
        }
      })
    }

    notify(`Se retomó el borrador pendiente ${draft.code}.`, 'warning')
    return serverItems.length > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------
// 5. Sección Derecha: Filtros de Cargos, Selección y Totales
// ---------------------------------------------------------------------
const overdueCount = computed(() => clientReceivables.value.filter((r) => isOverdue(r.due_date)).length)
const upcomingCount = computed(() => clientReceivables.value.filter((r) => !isOverdue(r.due_date)).length)

const receivablesChipItems = computed(() => [
  { text: `Vencidos (${overdueCount.value})`, value: 'overdue' },
  { text: `Por vencer (${upcomingCount.value})`, value: 'upcoming' }
])

function handleScopeChipChange(_dqb: DqbFilterTuple[] | null, rawValues: unknown[]): void {
  const val = rawValues?.[0]
  if (val === 'overdue' || val === 'upcoming') {
    receivablesScope.value = val
  } else {
    receivablesScope.value = 'all'
  }
}

const filteredReceivables = computed<AccountReceivableItem[]>(() => {
  if (receivablesScope.value === 'overdue') {
    return clientReceivables.value.filter((r) => isOverdue(r.due_date))
  }
  if (receivablesScope.value === 'upcoming') {
    return clientReceivables.value.filter((r) => !isOverdue(r.due_date))
  }
  return clientReceivables.value
})

const selectedReceivableItems = computed<AccountReceivableItem[]>(() => {
  const selectedSet = new Set(selectedReceivableIds.value)
  return sortReceivablesByCascade(
    clientReceivables.value.filter((r) => selectedSet.has(Number(r.id)))
  )
})

const allFilteredSelected = computed(() => {
  if (filteredReceivables.value.length === 0) return false
  return filteredReceivables.value.every((r) => selectedReceivableIds.value.includes(Number(r.id)))
})

const someFilteredSelected = computed(() => {
  return filteredReceivables.value.some((r) => selectedReceivableIds.value.includes(Number(r.id)))
})

function toggleSelectAll(): void {
  const visibleIds = filteredReceivables.value.map((r) => Number(r.id))
  if (allFilteredSelected.value) {
    selectedReceivableIds.value = selectedReceivableIds.value.filter((id) => !visibleIds.includes(id))
  } else {
    const merged = new Set([...selectedReceivableIds.value, ...visibleIds])
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

const totalSelectedToPay = computed<number>(() => {
  return round2(selectedReceivableItems.value.reduce((acc, r) => acc + getReceivableBalance(r), 0))
})

const totalSelectedVes = computed<number>(() => toVes(totalSelectedToPay.value))

// ---------------------------------------------------------------------
// 6. Modal Normalizado de Pagos (Categoría -> Cuenta Receptora Real)
// ---------------------------------------------------------------------
const activeCategories = computed<PaymentCategoryItem[]>(() => {
  const cats = (accountingStore.paymentCategories || []).filter(
    (c) => String(c.is_disabled ?? '0') !== '1'
  )
  if (cats.length > 0) return cats

  const map = new Map<number, PaymentCategoryItem>()
  for (const acc of accountingStore.bankAccounts) {
    const cId = Number(acc.category_id)
    if (cId && !map.has(cId)) {
      map.set(cId, {
        id: cId,
        name: acc.category_name || `Categoría ${cId}`
      })
    }
  }
  return Array.from(map.values())
})

const activeBankAccounts = computed<PaymentAccountItem[]>(() => {
  return (accountingStore.bankAccounts || []).filter(
    (a) => String(a.is_disabled ?? '0') !== '1'
  )
})

function countCategoryAccounts(categoryId: number | string): number {
  return activeBankAccounts.value.filter((a) => Number(a.category_id) === Number(categoryId)).length
}

const operableCategories = computed<PaymentCategoryItem[]>(() => {
  const withAccounts = activeCategories.value.filter(
    (cat) => countCategoryAccounts(cat.id) > 0
  )
  return withAccounts.length > 0 ? withAccounts : activeCategories.value
})

const availableCreditsForModal = computed<ClientCreditItem[]>(() => {
  const usedCreditIds = new Set(
    paymentLines.value.filter((l) => l.originType === '1').map((l) => Number(l.originId))
  )
  return clientCredits.value.filter((c) => !usedCreditIds.has(Number(c.id)) && Number(c.available_amount) > 0)
})

const totalAvailableCreditsUsd = computed<number>(() => {
  return round2(
    clientCredits.value.reduce((sum, c) => {
      const avail = Number(c.available_amount || 0)
      const code = String(c.currency_code || 'USD').toUpperCase()
      const rate = Number(c.exchange_rate) > 0 ? Number(c.exchange_rate) : 1
      return sum + (code === 'USD' ? avail : round2(avail / rate))
    }, 0)
  )
})

const draftMode = ref<'account' | 'credit'>('account')
const draftCategoryId = ref<number | null>(null)
const draftAccountId = ref<number | null>(null)
const draftCreditId = ref<number | null>(null)
const draftAmount = ref<number | null>(null)
const draftReference = ref('')
const draftAmountTouched = ref(false)
const paymentFormError = ref('')

const accountsForSelectedCategory = computed<PaymentAccountItem[]>(() => {
  if (!draftCategoryId.value) return []
  return activeBankAccounts.value.filter(
    (acc) => Number(acc.category_id) === Number(draftCategoryId.value)
  )
})

const accountSelectItems = computed(() => {
  return accountsForSelectedCategory.value.map((acc) => {
    const code = String(acc.currency_code || 'USD').toUpperCase()
    const sym = acc.currency_symbol || (code === 'VES' ? 'Bs.' : '$')
    const opHint = formatAccountOperationalHint(acc)
    return {
      value: Number(acc.id),
      title: `${acc.name} (${sym})`,
      ...(opHint ? { props: { subtitle: opHint } } : {})
    }
  })
})

const creditSelectItems = computed(() => {
  return availableCreditsForModal.value.map((cred) => {
    const code = String(cred.currency_code || 'USD').toUpperCase()
    const sym = cred.currency_symbol || (code === 'VES' ? 'Bs.' : '$')
    return {
      value: Number(cred.id),
      title: `${cred.receipt_code || `Crédito #${cred.id}`} — Disp: ${sym} ${formatByCurrency(cred.available_amount, code === 'VES' ? 'VES' : 'USD')}`
    }
  })
})

const selectedCategoryObj = computed<PaymentCategoryItem | null>(() => {
  if (draftMode.value !== 'account' || !draftCategoryId.value) return null
  return activeCategories.value.find((c) => Number(c.id) === Number(draftCategoryId.value)) || null
})

const selectedAccountObj = computed<PaymentAccountItem | null>(() => {
  if (draftMode.value !== 'account' || !draftAccountId.value) return null
  return activeBankAccounts.value.find((a) => Number(a.id) === Number(draftAccountId.value)) || null
})

const selectedAccountHint = computed<string>(() => {
  return formatAccountOperationalHint(selectedAccountObj.value)
})

const selectedCreditObj = computed<ClientCreditItem | null>(() => {
  if (draftMode.value !== 'credit' || !draftCreditId.value) return null
  return availableCreditsForModal.value.find((c) => Number(c.id) === Number(draftCreditId.value)) || null
})

const draftCurrency = computed<'USD' | 'VES'>(() => {
  if (draftMode.value === 'credit') {
    const code = String(selectedCreditObj.value?.currency_code || 'USD').toUpperCase()
    return code === 'VES' ? 'VES' : 'USD'
  }
  const code = String(selectedAccountObj.value?.currency_code || 'USD').toUpperCase()
  return code === 'VES' ? 'VES' : 'USD'
})

const draftRequiresReference = computed<boolean>(() => {
  if (draftMode.value === 'credit') return false
  if (!selectedCategoryObj.value) return false
  return !isCashCategory(selectedCategoryObj.value)
})

const draftEffectiveRate = computed<number>(() => {
  if (draftMode.value === 'credit') {
    const frozen = Number(selectedCreditObj.value?.exchange_rate || 1)
    return draftCurrency.value === 'USD' ? 1 : frozen > 0 ? frozen : activeExchangeRate.value
  }
  return draftCurrency.value === 'USD' ? 1 : activeExchangeRate.value
})

const draftEquivalentHint = computed<string>(() => {
  const amt = Number(draftAmount.value || 0)
  if (amt <= 0) return ''

  if (draftCurrency.value === 'VES') {
    const rate = draftEffectiveRate.value
    if (rate <= 0) return 'Sin tasa registrada para convertir bolívares.'
    return `≈ $ ${formatUsd(toUsd(amt, rate))}`
  }

  return ''
})

// Cálculos financieros del recibo
const totalPaidUsd = computed<number>(() => {
  return round2(paymentLines.value.reduce((acc, l) => acc + l.amountUsd, 0))
})

const pendingDifferenceUsd = computed<number>(() => {
  return Math.max(0, round2(totalSelectedToPay.value - totalPaidUsd.value))
})

const rawSurplusUsd = computed<number>(() => {
  return Math.max(0, round2(totalPaidUsd.value - totalSelectedToPay.value))
})

const totalCashPaidUsd = computed<number>(() => {
  return round2(
    paymentLines.value.filter((l) => l.isCash).reduce((acc, l) => acc + l.amountUsd, 0)
  )
})

const canGiveFullCashChange = computed<boolean>(() => {
  return rawSurplusUsd.value > 0 && totalCashPaidUsd.value >= rawSurplusUsd.value
})

const cashChangeUsd = computed<number>(() => {
  if (giveCashChange.value && canGiveFullCashChange.value) {
    return rawSurplusUsd.value
  }
  return 0
})

const generatedCreditUsd = computed<number>(() => {
  if (rawSurplusUsd.value <= 0) return 0
  if (cashChangeUsd.value > 0) return 0
  return rawSurplusUsd.value
})

// Simulación exacta de la cascada FIFO del backend para prevenir RECEIPT_ITEM_UNREACHED
const cascadePreview = computed(() => {
  let remaining = totalPaidUsd.value
  const reachedIds: number[] = []
  const unreachedIds: number[] = []

  for (const item of selectedReceivableItems.value) {
    const bal = getReceivableBalance(item)
    const id = Number(item.id)
    if (remaining > 0.004 && bal > 0) {
      const alloc = Math.min(remaining, bal)
      remaining = round2(remaining - alloc)
      reachedIds.push(id)
    } else {
      unreachedIds.push(id)
    }
  }

  return { reachedIds, unreachedIds }
})

const unreachedReceivableIds = computed<number[]>(() => {
  if (paymentLines.value.length === 0 || totalPaidUsd.value <= 0) return []
  return cascadePreview.value.unreachedIds
})

function adjustSelectionToPaidAmount(): void {
  if (cascadePreview.value.reachedIds.length > 0) {
    selectedReceivableIds.value = [...cascadePreview.value.reachedIds]
  }
}

function prefillSuggestedDraftAmount(): void {
  const remUsd = pendingDifferenceUsd.value
  if (remUsd <= 0) {
    draftAmount.value = null
    return
  }

  if (draftMode.value === 'credit') {
    const cred = selectedCreditObj.value
    if (!cred) {
      draftAmount.value = null
      return
    }
    const maxAvail = round2(Number(cred.available_amount || 0))
    const neededInCreditCurrency =
      draftCurrency.value === 'USD'
        ? remUsd
        : round2(remUsd * (draftEffectiveRate.value || 1))
    draftAmount.value = Math.min(maxAvail, neededInCreditCurrency)
    return
  }

  if (!selectedAccountObj.value) {
    draftAmount.value = null
    return
  }

  if (draftCurrency.value === 'USD') {
    draftAmount.value = remUsd
  } else {
    draftAmount.value = activeExchangeRate.value > 0 ? toVes(remUsd) : null
  }
}

function selectPaymentCategory(categoryId: number): void {
  draftMode.value = 'account'
  draftCategoryId.value = categoryId
  paymentFormError.value = ''
  draftReference.value = ''

  const matching = activeBankAccounts.value.filter((a) => Number(a.category_id) === Number(categoryId))
  draftAccountId.value = matching[0] ? Number(matching[0].id) : null
  draftAmountTouched.value = false
  prefillSuggestedDraftAmount()
}

function selectCreditMode(): void {
  draftMode.value = 'credit'
  draftCategoryId.value = null
  draftAccountId.value = null
  paymentFormError.value = ''
  draftCreditId.value = availableCreditsForModal.value[0]
    ? Number(availableCreditsForModal.value[0].id)
    : null
  draftReference.value = ''
  draftAmountTouched.value = false
  prefillSuggestedDraftAmount()
}

watch(draftAccountId, () => {
  paymentFormError.value = ''
  if (!draftAmountTouched.value) {
    prefillSuggestedDraftAmount()
  }
})

watch(draftCreditId, () => {
  paymentFormError.value = ''
  if (!draftAmountTouched.value) {
    prefillSuggestedDraftAmount()
  }
})

function initPaymentFormDefaults(): void {
  paymentFormError.value = ''
  draftReference.value = ''
  draftAmountTouched.value = false

  const firstCatWithAccounts =
    activeCategories.value.find((cat) =>
      activeBankAccounts.value.some((acc) => Number(acc.category_id) === Number(cat.id))
    ) || activeCategories.value[0]

  if (firstCatWithAccounts) {
    selectPaymentCategory(Number(firstCatWithAccounts.id))
  } else if (availableCreditsForModal.value.length > 0) {
    selectCreditMode()
  } else {
    draftCategoryId.value = null
    draftAccountId.value = null
    draftAmount.value = null
  }
}

function openPaymentModal(): void {
  if (selectedReceivableIds.value.length === 0 || totalSelectedToPay.value <= 0) return
  initPaymentFormDefaults()
  paymentModalOpen.value = true
}

function onAmountInput(): void {
  draftAmountTouched.value = true
  paymentFormError.value = ''
}

function onAmountKeydown(e: KeyboardEvent): void {
  if (['-', '+', 'e', 'E'].includes(e.key)) {
    e.preventDefault()
  }
}

function handleAddPaymentLine(): void {
  paymentFormError.value = ''
  const rawAmt = Number(draftAmount.value || 0)

  if (isNaN(rawAmt) || rawAmt <= 0) {
    paymentFormError.value = 'Ingresa un monto mayor a 0.00.'
    return
  }

  const inputAmount = round2(rawAmt)

  if (draftMode.value === 'credit') {
    const cred = selectedCreditObj.value
    if (!cred) {
      paymentFormError.value = 'Selecciona un saldo a favor disponible.'
      return
    }
    const maxAvail = round2(Number(cred.available_amount || 0))
    const currency = draftCurrency.value
    if (inputAmount > maxAvail) {
      paymentFormError.value = `Supera el saldo disponible (${cred.currency_symbol || '$'} ${formatByCurrency(maxAvail, currency)}).`
      return
    }

    const rate = draftEffectiveRate.value
    const amountUsd = currency === 'USD' ? inputAmount : toUsd(inputAmount, rate)
    if (amountUsd <= 0) {
      paymentFormError.value = 'El monto ingresado resulta menor a $ 0.01.'
      return
    }

    paymentLines.value.push({
      id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      originType: '1',
      originId: Number(cred.id),
      categoryId: null,
      categoryName: 'Saldo a favor',
      accountName: cred.receipt_code || `Crédito #${cred.id}`,
      currency,
      currencySymbol: currency === 'USD' ? '$' : 'Bs.',
      exchangeRate: rate,
      amountInput: inputAmount,
      amountUsd,
      isCash: false,
      reference: ''
    })

    draftAmountTouched.value = false
    initPaymentFormDefaults()
    return
  }

  const cat = selectedCategoryObj.value
  const acc = selectedAccountObj.value

  if (!cat) {
    paymentFormError.value = 'Selecciona un método de pago.'
    return
  }

  if (!acc) {
    paymentFormError.value = 'Selecciona la cuenta receptora.'
    return
  }

  const currency = draftCurrency.value
  if (currency === 'VES' && activeExchangeRate.value <= 0) {
    paymentFormError.value = 'No hay tasa de cambio activa para pagos en bolívares.'
    return
  }

  const cleanRef = draftRequiresReference.value ? draftReference.value.trim() : ''
  if (draftRequiresReference.value && !cleanRef) {
    paymentFormError.value = 'Ingresa el número de referencia.'
    return
  }

  if (cleanRef) {
    const duplicateInReceipt = paymentLines.value.some(
      (l) =>
        l.originType === '0' &&
        l.originId === Number(acc.id) &&
        l.reference.toLowerCase() === cleanRef.toLowerCase()
    )
    if (duplicateInReceipt) {
      paymentFormError.value = 'Esta referencia ya fue agregada en la misma cuenta.'
      return
    }
  }

  const rate = currency === 'USD' ? 1 : activeExchangeRate.value
  const amountUsd = currency === 'USD' ? inputAmount : toUsd(inputAmount, rate)
  if (amountUsd <= 0) {
    paymentFormError.value = 'El equivalente en dólares debe ser al menos $ 0.01.'
    return
  }

  paymentLines.value.push({
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    originType: '0',
    originId: Number(acc.id),
    categoryId: Number(cat.id),
    categoryName: cat.name,
    accountName: acc.name,
    currency,
    currencySymbol: acc.currency_symbol || (currency === 'USD' ? '$' : 'Bs.'),
    exchangeRate: rate,
    amountInput: inputAmount,
    amountUsd,
    isCash: isCashCategory(cat),
    reference: cleanRef
  })

  draftReference.value = ''
  draftAmountTouched.value = false
  prefillSuggestedDraftAmount()
}

function removePaymentLine(index: number): void {
  paymentLines.value.splice(index, 1)
  paymentFormError.value = ''
  draftAmountTouched.value = false
  prefillSuggestedDraftAmount()
}

// ---------------------------------------------------------------------
// 7. Emisión y Confirmación Idempotente del Recibo + PDF
// ---------------------------------------------------------------------
const isProcessingPayment = ref(false)
const isDownloadingPdf = ref(false)
const successReceiptModalOpen = ref(false)

interface ProcessedReceiptSummary {
  id: number
  code: string
  date: string
  totalAppliedUsd: number
  totalAppliedVes: number
  changeUsd: number
  creditGeneratedUsd: number
  itemsCount: number
}

const processedReceiptData = ref<ProcessedReceiptSummary | null>(null)

const canConfirmReceipt = computed<boolean>(() => {
  return (
    Boolean(selectedClient.value) &&
    selectedReceivableIds.value.length > 0 &&
    paymentLines.value.length > 0 &&
    totalPaidUsd.value > 0 &&
    unreachedReceivableIds.value.length === 0 &&
    !isProcessingPayment.value
  )
})

function buildPaymentsPayload(today: string): ReceiptPaymentPayload[] {
  let remainingChangeToDeductUsd = cashChangeUsd.value

  const adjustedLines = [...paymentLines.value]
  if (remainingChangeToDeductUsd > 0) {
    for (let i = adjustedLines.length - 1; i >= 0; i--) {
      const line = adjustedLines[i]
      if (!line || !line.isCash || remainingChangeToDeductUsd <= 0) continue

      const deductibleUsd = Math.min(line.amountUsd, remainingChangeToDeductUsd)
      const netUsd = round2(line.amountUsd - deductibleUsd)
      remainingChangeToDeductUsd = round2(remainingChangeToDeductUsd - deductibleUsd)

      if (netUsd <= 0) {
        adjustedLines.splice(i, 1)
      } else {
        const netNominal =
          line.currency === 'USD' ? netUsd : round2(netUsd * line.exchangeRate)
        adjustedLines[i] = {
          ...line,
          amountInput: netNominal,
          amountUsd: netUsd
        }
      }
    }
  }

  return adjustedLines.map((line) => ({
    origin_type: line.originType,
    origin_id: line.originId,
    amount: line.amountInput,
    payment_date: today,
    reference: line.reference || undefined
  }))
}

async function handleConfirmReceipt(): Promise<void> {
  if (!canConfirmReceipt.value || !selectedClient.value || !branchesStore.activeBranchId) return

  const branchId = branchesStore.activeBranchId
  const clientSnapshot = selectedClient.value
  const itemsSnapshot = selectedReceivableItems.value.map((r) => Number(r.id))
  const appliedUsd = Math.min(totalSelectedToPay.value, totalPaidUsd.value)
  const appliedVes = toVes(appliedUsd)
  const changeSnapshot = cashChangeUsd.value
  const creditSnapshot = generatedCreditUsd.value
  const today = getLocalTodayIso()

  isProcessingPayment.value = true
  paymentFormError.value = ''

  try {
    const paymentsPayload = buildPaymentsPayload(today)

    const receiptId = await accountingStore.createFullReceipt(branchId, {
      draftReceiptId: draftReceiptId.value,
      client_id: Number(clientSnapshot.id),
      date: today,
      items: itemsSnapshot,
      payments: paymentsPayload,
      confirmImmediately: true,
      onDraftReady: (id: number) => {
        draftReceiptId.value = id
        saveSessionToStorage()
      }
    })

    let receiptCode = `RECP-${receiptId}`
    try {
      const detailRes = await getReceiptById(branchId, receiptId)
      if (detailRes.data?.code) {
        receiptCode = detailRes.data.code
      }
    } catch {
      // Conservar código local de respaldo si la consulta falla
    }

    processedReceiptData.value = {
      id: receiptId,
      code: receiptCode,
      date: formatShortDate(today),
      totalAppliedUsd: appliedUsd,
      totalAppliedVes: appliedVes,
      changeUsd: changeSnapshot,
      creditGeneratedUsd: creditSnapshot,
      itemsCount: itemsSnapshot.length
    }

    paymentModalOpen.value = false
    paymentLines.value = []
    draftReceiptId.value = null
    clearSessionStorage(branchId)

    successReceiptModalOpen.value = true

    await selectClientAndLoad(clientSnapshot)
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: {
        data?: {
          message?: string
          messages?: Record<string, string>
          data?: Array<{ messages?: Record<string, string> | string; message?: string }>
        }
      }
    }
    const respData = axiosErr?.response?.data
    const batchItem = Array.isArray(respData?.data) ? respData?.data[0] : undefined
    const batchMsg =
      typeof batchItem?.messages === 'string'
        ? batchItem.messages
        : batchItem?.messages
          ? Object.values(batchItem.messages)[0]
          : batchItem?.message
    const apiMessages = respData?.messages
    const firstFieldMsg = apiMessages ? Object.values(apiMessages)[0] : ''
    const msg =
      batchMsg ||
      firstFieldMsg ||
      respData?.message ||
      (err instanceof Error ? err.message : 'No se pudo procesar el pago. Verifica tu conexión e intenta nuevamente.')

    paymentFormError.value = msg
    notify(msg, 'error')
  } finally {
    isProcessingPayment.value = false
  }
}

async function handleDownloadReceiptPdf(): Promise<void> {
  if (!processedReceiptData.value || !branchesStore.activeBranchId) return
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

function handleFinishSuccessModal(): void {
  successReceiptModalOpen.value = false
  processedReceiptData.value = null
}

// ---------------------------------------------------------------------
// 8. Restauración Inicial y Cambio de Sucursal
// ---------------------------------------------------------------------
async function restoreInitialSession(): Promise<void> {
  const branchId = branchesStore.activeBranchId
  if (!branchId) return

  let stored: PersistedPosSession | null = null
  try {
    const raw = localStorage.getItem(getStorageKey(branchId))
    if (raw) {
      stored = JSON.parse(raw) as PersistedPosSession
    }
  } catch {
    stored = null
  }

  const queryClientId = route.query.client_id ? Number(route.query.client_id) : null
  const targetClientId = queryClientId || stored?.clientId || null

  if (targetClientId) {
    try {
      const person = await fetchPersonById(targetClientId)
      if (person && String(person.is_disabled ?? '0') !== '1') {
        const matchingStored =
          stored && Number(stored.clientId) === Number(person.id) ? stored : null
        await selectClientAndLoad(person, matchingStored)
        if (matchingStored && matchingStored.paymentModalOpen && paymentModalOpen.value) {
          initPaymentFormDefaults()
        }
        return
      }
    } catch {
      clearSessionStorage(branchId)
    }
  }

  if (route.query.cedula) {
    const ced = String(route.query.cedula).trim()
    rawClientSearch.value = ced
    clientsQuery.search.value = normalizeClientSearchInput(ced)
  }
}

watch(
  () => branchesStore.activeBranchId,
  async (newBranchId, oldBranchId) => {
    if (newBranchId && newBranchId !== oldBranchId) {
      selectedClient.value = null
      clientReceivables.value = []
      clientCredits.value = []
      selectedReceivableIds.value = []
      paymentLines.value = []
      paymentModalOpen.value = false
      draftReceiptId.value = null
      await restoreInitialSession()
    }
  }
)

onMounted(async () => {
  clientsQuery.executeFetch()
  await accountingStore.loadCurrencies()
  await Promise.all([
    accountingStore.loadPaymentCategories(true),
    accountingStore.loadBankAccounts(true),
    accountingStore.loadCurrentExchangeRate(vesCurrency.value.id)
  ])
  await restoreInitialSession()
})
</script>

<template>
  <div class="pos-cashier-view">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CABECERA: TÍTULO + SUBTÍTULO (IZQ) | TASA (DER)             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-4 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mt-0 mb-1 leading-tight">
          Punto de Cobro
        </h1>
        <p class="text-body-2 text-medium-emphasis ma-0">
          Recaudación de pagos pendientes
        </p>
      </div>

      <div
        v-if="activeExchangeRate > 0"
        class="text-body-2 font-weight-bold text-high-emphasis tabular-nums"
        data-testid="pos-header-exchange-rate"
      >
        Tasa: Bs. {{ formatVes(activeExchangeRate) }}
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DISEÑO EN DOS SECCIONES (IZQUIERDA: CLIENTES | DERECHA: CARGOS) -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row class="pos-main-grid" align="stretch">
      <!-- ───────────────────────────────────────────────────────── -->
      <!-- SECCIÓN IZQUIERDA: LISTADO DE CLIENTES                    -->
      <!-- ───────────────────────────────────────────────────────── -->
      <v-col cols="12" md="4" lg="4" class="d-flex flex-column">
        <v-card
          elevation="0"
          rounded="lg"
          class="border bg-white flex-grow-1 d-flex flex-column pos-panel-card"
          data-testid="pos-clients-panel"
        >
          <div class="pa-5 border-b">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-3">
              Clientes
            </div>

            <v-text-field
              v-model="rawClientSearch"
              placeholder="Buscar por nombre o cédula..."
              prepend-inner-icon="mdi-magnify"
              clearable
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              data-testid="input-pos-client-search"
              @click:clear="rawClientSearch = ''"
            />
          </div>

          <div class="pa-4 flex-grow-1 overflow-y-auto pos-scroll-area">
            <div v-if="clientsQuery.isLoading.value && clientsQuery.items.value.length === 0" class="pa-2">
              <v-skeleton-loader type="list-item-two-line@5" bg-color="transparent" />
            </div>

            <div
              v-else-if="clientsQuery.items.value.length === 0"
              class="text-center py-12 px-4"
              data-testid="pos-clients-empty"
            >
              <v-icon icon="mdi-account-off-outline" size="36" class="text-disabled mb-2" />
              <div class="text-body-2 text-medium-emphasis">
                Sin resultados
              </div>
            </div>

            <div v-else class="d-flex flex-column ga-2">
              <div
                v-for="person in clientsQuery.items.value"
                :key="person.id"
                role="button"
                tabindex="0"
                class="pos-client-card px-4 py-3 rounded-lg d-flex align-center justify-space-between ga-3"
                :class="{
                  'pos-client-card--active':
                    selectedClient && Number(selectedClient.id) === Number(person.id)
                }"
                :data-testid="`pos-client-item-${person.id}`"
                @click="handleClientClick(person)"
                @keydown.enter.prevent="handleClientClick(person)"
                @keydown.space.prevent="handleClientClick(person)"
              >
                <div class="d-flex align-center ga-3 min-w-0">
                  <v-icon
                    :icon="
                      selectedClient && Number(selectedClient.id) === Number(person.id)
                        ? 'mdi-radiobox-marked'
                        : 'mdi-radiobox-blank'
                    "
                    :color="
                      selectedClient && Number(selectedClient.id) === Number(person.id)
                        ? 'primary'
                        : 'medium-emphasis'
                    "
                    size="20"
                    class="flex-shrink-0"
                  />

                  <div class="min-w-0">
                    <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate">
                      {{ person.first_name }} {{ person.last_name }}
                    </div>
                    <div class="text-caption text-medium-emphasis tabular-nums text-truncate mt-0.5">
                      {{ formatPersonDoc(person.identification_type, person.identification_value) }}
                    </div>
                  </div>
                </div>

                <v-btn
                  v-if="selectedClient && Number(selectedClient.id) === Number(person.id)"
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  color="medium-emphasis"
                  title="Quitar selección"
                  data-testid="btn-pos-clear-client"
                  @click.stop="requestClearClient"
                />
              </div>
            </div>
          </div>

          <div
            v-if="clientTotalPages > 1"
            class="px-4 py-3 border-t d-flex justify-center"
          >
            <v-pagination
              :model-value="clientsQuery.page.value"
              :length="clientTotalPages"
              :total-visible="4"
              density="compact"
              size="small"
              rounded="lg"
              active-color="primary"
              @update:model-value="handleClientPageChange"
            />
          </div>
        </v-card>
      </v-col>

      <!-- ───────────────────────────────────────────────────────── -->
      <!-- SECCIÓN DERECHA: CARGOS A PAGAR, TOTAL Y BOTÓN PAGAR      -->
      <!-- ───────────────────────────────────────────────────────── -->
      <v-col cols="12" md="8" lg="8" class="d-flex flex-column">
        <v-card
          elevation="0"
          rounded="lg"
          class="border bg-white flex-grow-1 d-flex flex-column pos-panel-card"
          data-testid="pos-items-panel"
        >
          <!-- Estado sin cliente seleccionado -->
          <div
            v-if="!selectedClient"
            class="flex-grow-1 d-flex flex-column align-center justify-center text-center py-16 px-8"
            data-testid="pos-empty-state"
          >
            <v-avatar color="grey-lighten-4" size="60" class="mb-4">
              <v-icon icon="mdi-receipt-text-outline" size="28" class="text-medium-emphasis" />
            </v-avatar>
            <h2 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
              Selecciona un cliente
            </h2>
            <p class="text-body-2 text-medium-emphasis mb-0" style="max-width: 340px;">
              Elige un cliente en el listado izquierdo para consultar sus cargos pendientes.
            </p>
          </div>

          <!-- Estado con cliente seleccionado -->
          <template v-else>
            <div v-if="isLoadingReceivables" class="pa-6 flex-grow-1">
              <v-skeleton-loader type="table-row@6" />
            </div>

            <div
              v-else-if="clientReceivables.length === 0"
              class="flex-grow-1 d-flex flex-column align-center justify-center text-center py-16 px-8"
              data-testid="pos-solvent-state"
            >
              <v-icon icon="mdi-check-circle-outline" color="success" size="46" class="mb-3" />
              <div class="text-subtitle-1 font-weight-bold text-high-emphasis mb-1">
                Sin cargos pendientes
              </div>
              <p class="text-body-2 text-medium-emphasis mb-0">
                El cliente está solvente en esta sucursal.
              </p>
            </div>

            <template v-else>
              <!-- Barra limpia de filtro de cargos (sin repetir datos del cliente) -->
              <div class="px-6 py-4 border-b d-flex align-center justify-space-between flex-wrap ga-3">
                <AppChipFilter
                  v-model="scopeChipModel"
                  :all-text="`Todos (${clientReceivables.length})`"
                  :items="receivablesChipItems"
                  size="small"
                  density="comfortable"
                  @change="handleScopeChipChange"
                />

                <v-chip
                  v-if="totalAvailableCreditsUsd > 0"
                  size="small"
                  variant="tonal"
                  color="success"
                  label
                  class="font-weight-bold tabular-nums"
                  data-testid="pos-client-credit-badge"
                >
                  Saldo a favor: $ {{ formatUsd(totalAvailableCreditsUsd) }}
                </v-chip>
              </div>

              <!-- Lista seleccionable de cargos -->
              <div class="flex-grow-1">
                <div
                  v-if="filteredReceivables.length === 0"
                  class="text-center py-14 px-6 text-medium-emphasis text-body-2"
                >
                  No hay cargos dentro de este filtro.
                </div>

                <v-table
                  v-else
                  fixed-header
                  height="388"
                  hover
                  class="pos-receivables-table"
                >
                  <thead>
                    <tr>
                      <th style="width: 54px;" class="text-center pl-4 pr-2">
                        <v-checkbox-btn
                          :model-value="allFilteredSelected"
                          :indeterminate="someFilteredSelected && !allFilteredSelected"
                          color="primary"
                          density="compact"
                          title="Seleccionar todos los cargos visibles"
                          data-testid="checkbox-pos-select-all"
                          @update:model-value="toggleSelectAll"
                        />
                      </th>
                      <th class="font-weight-bold text-body-2">Concepto</th>
                      <th class="font-weight-bold text-body-2 text-center d-none d-sm-table-cell" style="width: 140px;">
                        Vencimiento
                      </th>
                      <th class="font-weight-bold text-body-2 text-end pr-6" style="width: 130px;">
                        Saldo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="rec in filteredReceivables"
                      :key="rec.id"
                      :class="{ 'pos-row-selected': selectedReceivableIds.includes(Number(rec.id)) }"
                      :data-testid="`pos-receivable-row-${rec.id}`"
                      style="cursor: pointer;"
                      @click="toggleReceivable(Number(rec.id))"
                    >
                      <td class="text-center pl-4 pr-2" @click.stop>
                        <v-checkbox-btn
                          :model-value="selectedReceivableIds.includes(Number(rec.id))"
                          color="primary"
                          density="compact"
                          :data-testid="`checkbox-receivable-${rec.id}`"
                          @update:model-value="toggleReceivable(Number(rec.id))"
                        />
                      </td>
                      <td class="py-3">
                        <div class="font-weight-medium text-high-emphasis text-body-2">
                          {{ rec.description || rec.concept_name || 'Cargo pendiente' }}
                        </div>
                        <div
                          v-if="Number(rec.paid_amount) > 0"
                          class="text-caption pos-text-covered font-weight-medium tabular-nums mt-0.5"
                        >
                          Abonado: $ {{ formatUsd(rec.paid_amount) }}
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
                            {{ formatShortDate(rec.due_date) }}
                          </v-chip>
                          <span v-else class="text-caption text-medium-emphasis">
                            {{ formatShortDate(rec.due_date) }}
                          </span>
                        </div>
                      </td>
                      <td class="text-center tabular-nums d-none d-sm-table-cell">
                        <v-chip
                          v-if="isOverdue(rec.due_date)"
                          size="small"
                          color="error"
                          variant="tonal"
                          label
                          class="font-weight-medium"
                        >
                          {{ formatShortDate(rec.due_date) }}
                        </v-chip>
                        <span v-else class="text-body-2 text-medium-emphasis">
                          {{ formatShortDate(rec.due_date) }}
                        </span>
                      </td>
                      <td class="text-end pr-6 tabular-nums text-no-wrap">
                        <span class="font-weight-bold text-body-2 text-high-emphasis">
                          $ {{ formatUsd(getReceivableBalance(rec)) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>

              <!-- Pie limpio: Etiqueta a la izquierda, monto USD a la derecha (clic -> tooltip Bs.) + Botón Pagar -->
              <div
                class="px-6 py-5 border-t bg-surface-light mt-auto"
                data-testid="pos-checkout-footer"
              >
                <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-4 tabular-nums">
                  <div class="d-flex align-center flex-wrap ga-2">
                    <span class="text-body-2 font-weight-semibold text-medium-emphasis">
                      Total a pagar
                    </span>
                    <span class="pos-count-pill">
                      {{ selectedReceivableIds.length }}
                      {{ selectedReceivableIds.length === 1 ? 'cargo' : 'cargos' }}
                    </span>
                    <span
                      v-if="paymentLines.length > 0"
                      class="d-inline-flex align-center ga-1 text-caption font-weight-bold text-primary"
                      data-testid="pos-draft-payments-indicator"
                    >
                      <v-icon icon="mdi-progress-clock" size="13" />
                      <span>
                        {{ paymentLines.length }} {{ paymentLines.length === 1 ? 'pago en borrador' : 'pagos en borrador' }}
                      </span>
                    </span>
                  </div>

                  <v-tooltip
                    v-model="vesTooltipOpen"
                    location="top"
                    :open-on-click="false"
                    :open-on-hover="false"
                    :open-on-focus="false"
                  >
                    <template #activator="{ props: tooltipProps }">
                      <button
                        v-bind="tooltipProps"
                        type="button"
                        class="pos-usd-total-trigger d-inline-flex align-baseline ga-1 tabular-nums"
                        aria-label="Ver total equivalente en bolívares"
                        data-testid="pos-selected-total-usd"
                        @click.stop="vesTooltipOpen = !vesTooltipOpen"
                        @blur="vesTooltipOpen = false"
                      >
                        <span class="pos-currency-symbol">$</span>
                        <span class="pos-total-amount text-high-emphasis">
                          {{ formatUsd(totalSelectedToPay) }}
                        </span>
                      </button>
                    </template>
                    <span class="tabular-nums font-weight-bold" data-testid="pos-total-ves-tooltip">
                      Bs. {{ formatVes(totalSelectedVes) }}
                    </span>
                  </v-tooltip>
                </div>

                <v-btn
                  block
                  color="primary"
                  variant="flat"
                  size="large"
                  height="48"
                  rounded="lg"
                  class="text-none font-weight-bold text-body-1"
                  :disabled="selectedReceivableIds.length === 0 || totalSelectedToPay <= 0"
                  data-testid="btn-pos-open-pay-modal"
                  @click="openPaymentModal"
                >
                  Pagar
                </v-btn>
              </div>
            </template>
          </template>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL DE PAGOS ESTÁNDAR POS (2 COLUMNAS COMPACTAS)          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="paymentModalOpen"
      title="Registrar pago"
      max-width="860"
      :loading="isProcessingPayment"
      :persistent="isProcessingPayment"
      cancel-text="Cancelar"
      submit-text="Confirmar pago"
      :submit-disabled="!canConfirmReceipt"
      submit-test-id="btn-pos-confirm-receipt"
      @submit="handleConfirmReceipt"
    >
      <v-row class="pos-payment-modal-grid" align="stretch">
        <!-- ─────────────────────────────────────────────────────── -->
        <!-- COLUMNA IZQUIERDA: MÉTODO, CUENTA Y MONTO (COMPACTO)    -->
        <!-- ─────────────────────────────────────────────────────── -->
        <v-col cols="12" md="6" class="d-flex flex-column">
          <div class="text-caption font-weight-bold text-medium-emphasis mb-2">
            Método de pago
          </div>

          <div class="pos-method-grid mb-3">
            <button
              v-for="cat in operableCategories"
              :key="cat.id"
              type="button"
              class="pos-method-pill px-3 rounded-lg d-inline-flex align-center ga-2 text-caption font-weight-semibold"
              :class="{
                'pos-method-pill--active':
                  draftMode === 'account' && Number(draftCategoryId) === Number(cat.id)
              }"
              :data-testid="`payment-cat-${cat.id}`"
              @click="selectPaymentCategory(Number(cat.id))"
            >
              <v-icon
                :icon="getCategoryIcon(cat)"
                size="16"
                :color="
                  draftMode === 'account' && Number(draftCategoryId) === Number(cat.id)
                    ? 'primary'
                    : 'medium-emphasis'
                "
              />
              <span class="text-truncate">{{ cat.name }}</span>
            </button>

            <button
              v-if="availableCreditsForModal.length > 0"
              type="button"
              class="pos-method-pill px-3 rounded-lg d-inline-flex align-center ga-2 text-caption font-weight-semibold"
              :class="{ 'pos-method-pill--active': draftMode === 'credit' }"
              data-testid="payment-cat-credit"
              @click="selectCreditMode"
            >
              <v-icon
                icon="mdi-star-circle-outline"
                size="16"
                :color="draftMode === 'credit' ? 'primary' : 'success'"
              />
              <span class="text-truncate">Saldo a favor</span>
            </button>
          </div>

          <!-- Selección de cuenta destino o crédito -->
          <div class="pt-1 mb-3">
            <template v-if="draftMode === 'account'">
              <v-alert
                v-if="accountSelectItems.length === 0"
                type="warning"
                variant="tonal"
                density="compact"
                rounded="lg"
                text="No hay cuentas activas configuradas en esta categoría."
                data-testid="pos-empty-category-accounts"
              />

              <template v-else>
                <v-select
                  v-model="draftAccountId"
                  :items="accountSelectItems"
                  item-title="title"
                  item-value="value"
                  label="Cuenta destino"
                  variant="outlined"
                  density="compact"
                  hide-details
                  data-testid="select-pos-payment-account"
                />

                <div
                  v-if="selectedAccountHint"
                  class="pos-line-submeta text-medium-emphasis tabular-nums mt-1 px-1 text-truncate"
                  data-testid="pos-selected-account-details"
                >
                  {{ selectedAccountHint }}
                </div>
              </template>
            </template>

            <template v-else>
              <v-select
                v-model="draftCreditId"
                :items="creditSelectItems"
                item-title="title"
                item-value="value"
                label="Saldo a favor disponible"
                variant="outlined"
                density="compact"
                hide-details
                data-testid="select-pos-client-credit"
              />
            </template>
          </div>

          <!-- Monto y Referencia (en una sola fila cuando requiere referencia para no crecer en alto) -->
          <template v-if="draftMode === 'credit' || accountSelectItems.length > 0">
            <v-row dense class="pt-1 mb-2">
              <v-col :cols="draftRequiresReference ? 6 : 12">
                <v-text-field
                  v-model.number="draftAmount"
                  :label="draftCurrency === 'USD' ? 'Monto en dólares' : 'Monto en bolívares'"
                  type="number"
                  step="0.01"
                  min="0.01"
                  :prefix="draftCurrency === 'USD' ? '$' : 'Bs.'"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="tabular-nums pos-amount-input"
                  data-testid="input-pos-payment-amount"
                  @update:model-value="onAmountInput"
                  @keydown="onAmountKeydown"
                  @keyup.enter="handleAddPaymentLine"
                >
                  <template v-if="pendingDifferenceUsd > 0 && draftAmountTouched" #append-inner>
                    <v-btn
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      class="text-none font-weight-bold"
                      @click="
                        draftAmountTouched = false;
                        prefillSuggestedDraftAmount()
                      "
                    >
                      Restante
                    </v-btn>
                  </template>
                </v-text-field>

                <div
                  v-if="draftEquivalentHint"
                  class="pos-line-submeta text-medium-emphasis mt-1 px-1 tabular-nums"
                  data-testid="pos-draft-equivalent-hint"
                >
                  {{ draftEquivalentHint }}
                </div>
              </v-col>

              <v-col v-if="draftRequiresReference" cols="6">
                <v-text-field
                  v-model="draftReference"
                  label="Nro. de referencia"
                  placeholder="Ej: 948210"
                  maxlength="60"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="tabular-nums"
                  data-testid="input-pos-payment-reference"
                  @update:model-value="paymentFormError = ''"
                  @keyup.enter="handleAddPaymentLine"
                />
              </v-col>
            </v-row>

            <v-alert
              v-if="paymentFormError"
              type="error"
              variant="tonal"
              density="compact"
              rounded="lg"
              class="mb-2 text-caption"
              data-testid="pos-payment-form-error"
              :text="paymentFormError"
            />

            <div class="mt-auto pt-2">
              <v-btn
                color="primary"
                variant="tonal"
                block
                height="40"
                prepend-icon="mdi-plus"
                class="text-none font-weight-bold"
                :disabled="draftMode === 'account' && accountSelectItems.length === 0"
                data-testid="btn-pos-add-payment-line"
                @click="handleAddPaymentLine"
              >
                Agregar al recibo
              </v-btn>
            </div>
          </template>
        </v-col>

        <!-- ─────────────────────────────────────────────────────── -->
        <!-- COLUMNA DERECHA: PAGOS APLICADOS (SCROLL) + PIE CÁLCULO -->
        <!-- ─────────────────────────────────────────────────────── -->
        <v-col cols="12" md="6" class="d-flex flex-column">
          <div
            class="pos-receipt-summary-card rounded-lg border bg-surface-light d-flex flex-column overflow-hidden tabular-nums"
            data-testid="pos-modal-balance-strip"
          >
            <!-- Encabezado de lista de pagos aplicados -->
            <div class="px-4 pt-3 pb-2 d-flex align-center justify-space-between flex-shrink-0">
              <span class="text-caption font-weight-bold text-high-emphasis">
                Pagos aplicados
              </span>
              <span class="pos-count-pill">
                {{ paymentLines.length }}
              </span>
            </div>

            <!-- Cuerpo superior con scroll interno cuando hay varios pagos -->
            <div
              class="px-3 pb-2 flex-grow-1 min-h-0 overflow-y-auto pos-scroll-area d-flex flex-column"
              data-testid="pos-payment-scroll-box"
            >
              <div
                v-if="paymentLines.length === 0"
                class="pos-empty-payments rounded-lg px-3 py-4 text-center text-caption text-medium-emphasis flex-grow-1 d-flex align-center justify-center"
                data-testid="pos-modal-empty-payments"
              >
                Sin pagos agregados al recibo.
              </div>

              <div
                v-else
                class="d-flex flex-column ga-2"
                data-testid="pos-payment-lines-list"
              >
                <div
                  v-for="(line, idx) in paymentLines"
                  :key="line.id"
                  class="pos-payment-line-item d-flex align-center justify-space-between ga-2 px-3 rounded-lg border bg-white"
                  data-testid="pos-payment-line"
                >
                  <div class="min-w-0">
                    <div class="text-caption font-weight-bold text-high-emphasis text-truncate">
                      {{ line.accountName }}
                    </div>
                    <div class="pos-line-submeta text-medium-emphasis text-truncate tabular-nums">
                      <span>{{ line.categoryName }}</span>
                      <span v-if="line.reference"> · Ref. {{ line.reference }}</span>
                    </div>
                  </div>

                  <div class="d-flex align-center ga-2 flex-shrink-0 tabular-nums">
                    <div class="text-right">
                      <div class="text-caption font-weight-bold text-high-emphasis text-no-wrap">
                        {{ line.currencySymbol }} {{ formatByCurrency(line.amountInput, line.currency) }}
                      </div>
                      <div
                        v-if="line.currency === 'VES'"
                        class="pos-line-submeta text-medium-emphasis text-no-wrap"
                      >
                        ≈ $ {{ formatUsd(line.amountUsd) }}
                      </div>
                    </div>

                    <v-btn
                      icon="mdi-close"
                      size="x-small"
                      density="compact"
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

            <!-- Guardia preventiva RECEIPT_ITEM_UNREACHED (barra compacta sobre el pie) -->
            <div
              v-if="unreachedReceivableIds.length > 0"
              class="px-3 py-2 border-t pos-unreached-bar d-flex align-center justify-space-between ga-2 flex-shrink-0"
              data-testid="pos-unreached-warning"
            >
              <span class="pos-line-submeta font-weight-medium">
                No cubre
                <strong>{{ unreachedReceivableIds.length }}</strong>
                {{ unreachedReceivableIds.length === 1 ? 'cargo seleccionado' : 'cargos seleccionados' }}.
              </span>
              <v-btn
                size="x-small"
                color="warning"
                variant="flat"
                class="text-none font-weight-bold flex-shrink-0"
                data-testid="btn-pos-adjust-unreached"
                @click="adjustSelectionToPaidAmount"
              >
                Ajustar selección
              </v-btn>
            </div>

            <!-- Pie fijo de la sección: Cálculos ordenados -->
            <div
              class="mt-auto border-t bg-white px-4 py-3 flex-shrink-0"
              data-testid="pos-modal-calculations-footer"
            >
              <div class="d-flex justify-space-between align-center mb-1">
                <span class="text-caption text-medium-emphasis">Total a cobrar</span>
                <v-tooltip
                  location="top"
                  :text="`Bs. ${formatVes(totalSelectedVes)}`"
                >
                  <template #activator="{ props: totalTipProps }">
                    <span
                      v-bind="totalTipProps"
                      class="text-body-2 font-weight-bold text-high-emphasis pos-calc-amount-tip"
                    >
                      $ {{ formatUsd(totalSelectedToPay) }}
                    </span>
                  </template>
                </v-tooltip>
              </div>

              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-caption text-medium-emphasis">Total recibido</span>
                <span class="text-body-2 font-weight-bold text-primary">
                  $ {{ formatUsd(totalPaidUsd) }}
                </span>
              </div>

              <v-divider class="mb-2" />

              <!-- Estado: Falta por cubrir / Cubierto / Excedente -->
              <div
                v-if="pendingDifferenceUsd > 0"
                class="d-flex justify-space-between align-baseline"
              >
                <span class="text-caption font-weight-bold pos-text-pending">
                  {{ totalPaidUsd > 0 ? 'Falta por cubrir' : 'Pendiente por cubrir' }}
                </span>
                <v-tooltip
                  location="top"
                  :text="`Bs. ${formatVes(toVes(pendingDifferenceUsd))}`"
                >
                  <template #activator="{ props: pendingTipProps }">
                    <span
                      v-bind="pendingTipProps"
                      class="text-subtitle-1 font-weight-bold pos-text-pending leading-tight pos-calc-amount-tip"
                    >
                      $ {{ formatUsd(pendingDifferenceUsd) }}
                    </span>
                  </template>
                </v-tooltip>
              </div>

              <div v-else-if="rawSurplusUsd > 0">
                <div class="d-flex justify-space-between align-baseline">
                  <span
                    class="text-caption font-weight-bold"
                    :class="cashChangeUsd > 0 ? 'pos-text-change' : 'pos-text-covered'"
                  >
                    {{ cashChangeUsd > 0 ? 'Vuelto en efectivo' : 'Saldo a favor' }}
                  </span>
                  <span
                    class="text-subtitle-1 font-weight-bold leading-tight"
                    :class="cashChangeUsd > 0 ? 'pos-text-change' : 'pos-text-covered'"
                  >
                    {{ cashChangeUsd > 0 ? `$ ${formatUsd(cashChangeUsd)}` : `+ $ ${formatUsd(generatedCreditUsd)}` }}
                  </span>
                </div>

                <!-- Selector compacto de destino del excedente cuando hay efectivo -->
                <div
                  v-if="canGiveFullCashChange"
                  class="pos-surplus-segmented mt-2"
                  data-testid="checkbox-pos-give-change"
                >
                  <button
                    type="button"
                    class="pos-surplus-option"
                    :class="{ 'pos-surplus-option--active': giveCashChange }"
                    data-testid="btn-surplus-give-change"
                    @click="giveCashChange = true"
                  >
                    Dar vuelto
                  </button>
                  <button
                    type="button"
                    class="pos-surplus-option"
                    :class="{ 'pos-surplus-option--active': !giveCashChange }"
                    data-testid="btn-surplus-save-credit"
                    @click="giveCashChange = false"
                  >
                    Saldo a favor
                  </button>
                </div>
              </div>

              <div v-else class="d-flex justify-space-between align-center">
                <span class="text-caption font-weight-bold pos-text-covered">Balance</span>
                <div class="text-body-2 font-weight-bold pos-text-covered d-flex align-center ga-1">
                  <v-icon icon="mdi-check-circle" size="16" color="#047857" />
                  <span>Cubierto exacto</span>
                </div>
              </div>
            </div>
          </div>
        </v-col>
      </v-row>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: CONFIRMAR DESCARTE AL CAMBIAR DE CLIENTE             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="confirmDiscardOpen"
      title="Pagos sin confirmar"
      max-width="420"
      :loading="isDiscardingDraft"
      cancel-text="Seguir aquí"
      submit-text="Descartar"
      submit-color="error"
      submit-test-id="btn-confirm-discard-pos"
      @submit="handleConfirmDiscard"
    >
      <p class="text-body-2 text-high-emphasis mb-0">
        Tienes pagos cargados sin confirmar. Si cambias de cliente ahora, se descartarán.
      </p>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: COMPROBANTE DE PAGO EXITOSO                          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="successReceiptModalOpen"
      title="Pago registrado"
      max-width="440"
      :persistent="true"
      :show-close="false"
      :hide-cancel="true"
      submit-text="Listo"
      submit-icon="mdi-check"
      submit-test-id="btn-pos-next-payment"
      @submit="handleFinishSuccessModal"
    >
      <div v-if="processedReceiptData" class="py-2 text-center tabular-nums">
        <v-icon icon="mdi-check-circle" color="success" size="48" class="mb-2" />

        <div class="text-h6 font-weight-bold text-high-emphasis font-monospace">
          {{ processedReceiptData.code }}
        </div>
        <div class="text-caption text-medium-emphasis mb-5">
          {{ processedReceiptData.date }}
        </div>

        <div class="text-left rounded-lg border bg-surface-light pa-4">
          <div class="d-flex justify-space-between mb-2 text-body-2">
            <span class="text-medium-emphasis">Cargos pagados</span>
            <span class="font-weight-bold text-high-emphasis">{{ processedReceiptData.itemsCount }}</span>
          </div>
          <v-divider class="my-3" />
          <div class="d-flex justify-space-between text-subtitle-1">
            <span class="font-weight-bold text-high-emphasis">Total aplicado</span>
            <span class="font-weight-bold text-primary">
              $ {{ formatUsd(processedReceiptData.totalAppliedUsd) }}
            </span>
          </div>
          <div
            v-if="activeExchangeRate > 0"
            class="text-caption text-right text-medium-emphasis mt-0.5"
          >
            Bs. {{ formatVes(processedReceiptData.totalAppliedVes) }}
          </div>
          <div
            v-if="processedReceiptData.changeUsd > 0"
            class="d-flex justify-space-between text-body-2 pos-text-change font-weight-bold mt-3 pt-3 border-t"
          >
            <span>Vuelto entregado</span>
            <span>$ {{ formatUsd(processedReceiptData.changeUsd) }}</span>
          </div>
          <div
            v-if="processedReceiptData.creditGeneratedUsd > 0"
            class="d-flex justify-space-between text-body-2 pos-text-covered font-weight-bold mt-3 pt-3 border-t"
          >
            <span>Saldo a favor generado</span>
            <span>+ $ {{ formatUsd(processedReceiptData.creditGeneratedUsd) }}</span>
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

    <!-- Snackbar de notificaciones -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="top right"
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

.min-h-0 {
  min-height: 0;
}

.pos-panel-card {
  min-height: 580px;
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
  background-color: rgba(14, 84, 164, 0.06) !important;
}

.bg-surface-light {
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

.pos-client-card {
  border: 1px solid rgba(30, 41, 59, 0.12);
  background-color: #FFFFFF;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}

.pos-client-card:hover {
  border-color: rgba(14, 84, 164, 0.45);
}

.pos-client-card--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(14, 84, 164, 0.06);
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}

.pos-method-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.pos-method-pill {
  border: 1px solid rgba(30, 41, 59, 0.16);
  background-color: #FFFFFF;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  min-height: 36px;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease;
}

.pos-method-pill:hover {
  border-color: rgba(14, 84, 164, 0.45);
  background-color: #F8FAFC;
}

.pos-method-pill--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(14, 84, 164, 0.07);
  color: rgb(var(--v-theme-primary));
  font-weight: 600 !important;
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}

.pos-receipt-summary-card {
  height: 330px;
}

@media (max-width: 959px) {
  .pos-receipt-summary-card {
    height: auto;
    max-height: 320px;
  }
}

.pos-line-submeta {
  font-size: 0.72rem;
  line-height: 1.3;
}

.pos-payment-line-item {
  padding-top: 7px;
  padding-bottom: 7px;
}

.pos-calc-amount-tip {
  border-bottom: 1px dashed rgba(30, 41, 59, 0.26);
  cursor: help;
}

.pos-unreached-bar {
  background-color: #FFFBEB;
  color: #92400E;
}

.pos-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(30, 41, 59, 0.2) transparent;
}

.pos-count-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: rgba(15, 23, 42, 0.06);
  color: #334155;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.3;
}

.pos-usd-total-trigger {
  background: none;
  border: none;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 6px;
  cursor: pointer;
  border-bottom: 1px dashed rgba(30, 41, 59, 0.28);
  transition: background-color 150ms ease, border-color 150ms ease;
}

.pos-usd-total-trigger:hover {
  background-color: rgba(14, 84, 164, 0.05);
  border-bottom-color: rgb(var(--v-theme-primary));
}

.pos-currency-symbol {
  font-size: 1rem;
  font-weight: 600;
  color: #64748B;
  line-height: 1;
}

.pos-total-amount {
  font-size: 1.65rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.pos-empty-payments {
  border: 1px dashed rgba(30, 41, 59, 0.16);
  background-color: #FFFFFF;
}

.pos-surplus-segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  background-color: rgba(15, 23, 42, 0.05);
  border-radius: 8px;
}

.pos-surplus-option {
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
}

.pos-surplus-option--active {
  background-color: #FFFFFF;
  color: rgb(var(--v-theme-primary));
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}
</style>
