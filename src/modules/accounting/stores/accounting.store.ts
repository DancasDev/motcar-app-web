import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchCurrencies as apiFetchCurrencies,
  fetchCurrentExchangeRate as apiFetchCurrentExchangeRate,
  fetchPaymentCategories as apiFetchPaymentCategories,
  fetchPaymentAccounts as apiFetchPaymentAccounts,
  fetchAccountsReceivable as apiFetchAccountsReceivable,
  syncOverdueReceivables as apiSyncOverdueReceivables,
  fetchReceipts as apiFetchReceipts,
  getReceiptById as apiGetReceiptById,
  getReceiptDetail as apiGetReceiptDetail,
  createReceipt as apiCreateReceipt,
  fetchReceiptItems as apiFetchReceiptItems,
  addReceiptItemsBatch as apiAddReceiptItemsBatch,
  deleteReceiptItem as apiDeleteReceiptItem,
  fetchReceiptPayments as apiFetchReceiptPayments,
  addReceiptPaymentsBatch as apiAddReceiptPaymentsBatch,
  deleteReceiptPayment as apiDeleteReceiptPayment,
  updateReceiptStatus as apiUpdateReceiptStatus,
  downloadReceiptPdf as apiDownloadReceiptPdf,
  fetchClientCredits as apiFetchClientCredits,
  voidClientCredit as apiVoidClientCredit
} from '../api/accounting.api'
import type {
  CurrencyItem,
  ExchangeRateItem,
  PaymentCategoryItem,
  PaymentAccountItem,
  AccountReceivableItem,
  ReceiptItem,
  ReceiptDetailItem,
  ReceiptPaymentPayload,
  ClientCreditItem,
  FullReceiptEmissionPayload,
  SyncOverdueSummary
} from '../types'
import type { DataQueryParams } from '@/types/query'

export const useAccountingStore = defineStore('accounting', () => {
  const currencies = ref<CurrencyItem[]>([])
  const currentRates = ref<Record<string, ExchangeRateItem>>({})
  const paymentCategories = ref<PaymentCategoryItem[]>([])
  const bankAccounts = ref<PaymentAccountItem[]>([])
  const receivables = ref<AccountReceivableItem[]>([])
  const receipts = ref<ReceiptItem[]>([])
  const credits = ref<ClientCreditItem[]>([])
  const selectedReceiptDetail = ref<ReceiptDetailItem | null>(null)
  const isLoading = ref<boolean>(false)

  /**
   * Carga el catálogo global de monedas
   */
  async function loadCurrencies(force = false): Promise<CurrencyItem[]> {
    if (currencies.value.length > 0 && !force) return currencies.value
    try {
      const res = await apiFetchCurrencies({ itemsPerPage: 100 })
      currencies.value = res.data
      return currencies.value
    } catch (err) {
      console.error('Error loading currencies:', err)
      return []
    }
  }

  /**
   * Carga la tasa de cambio vigente para una moneda
   */
  async function loadCurrentExchangeRate(
    currencyId: string | number
  ): Promise<ExchangeRateItem | null> {
    try {
      const res = await apiFetchCurrentExchangeRate(currencyId)
      if (res.data && res.data.value !== null) {
        currentRates.value[String(currencyId)] = res.data
        return res.data
      }
      delete currentRates.value[String(currencyId)]
      return null
    } catch (err) {
      console.error(`Error loading exchange rate for currency ${currencyId}:`, err)
      return null
    }
  }

  /**
   * Carga el catálogo global de categorías de pago
   */
  async function loadPaymentCategories(force = false): Promise<PaymentCategoryItem[]> {
    if (paymentCategories.value.length > 0 && !force) return paymentCategories.value
    try {
      const res = await apiFetchPaymentCategories({ itemsPerPage: 100 })
      paymentCategories.value = res.data || []
      return paymentCategories.value
    } catch (err) {
      console.error('Error loading payment categories:', err)
      return []
    }
  }

  /**
   * Carga el directorio transversal de cuentas bancarias / de pago
   */
  async function loadBankAccounts(force = false): Promise<PaymentAccountItem[]> {
    if (bankAccounts.value.length > 0 && !force) return bankAccounts.value
    try {
      const res = await apiFetchPaymentAccounts({ itemsPerPage: 100 })
      bankAccounts.value = res.data
      return bankAccounts.value
    } catch (err) {
      console.error('Error loading bank accounts:', err)
      return []
    }
  }

  /**
   * Carga cuentas por cobrar de la sucursal activa
   */
  async function loadReceivables(
    branchId: string | number,
    params?: DataQueryParams
  ): Promise<AccountReceivableItem[]> {
    if (!branchId) {
      receivables.value = []
      return []
    }
    isLoading.value = true
    try {
      const res = await apiFetchAccountsReceivable(branchId, params)
      receivables.value = res.data
      return receivables.value
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sincroniza la morosidad masiva en la sucursal
   */
  async function syncOverdue(branchId: string | number): Promise<SyncOverdueSummary> {
    isLoading.value = true
    try {
      const res = await apiSyncOverdueReceivables(branchId)
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Carga los recibos de caja de la sucursal
   */
  async function loadReceipts(
    branchId: string | number,
    params?: DataQueryParams
  ): Promise<ReceiptItem[]> {
    if (!branchId) {
      receipts.value = []
      return []
    }
    isLoading.value = true
    try {
      const res = await apiFetchReceipts(branchId, params)
      receipts.value = res.data
      return receipts.value
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Carga el detalle completo de un recibo (ítems, pagos, totales)
   */
  async function loadReceiptDetail(
    branchId: string | number,
    receiptId: string | number
  ): Promise<ReceiptDetailItem | null> {
    isLoading.value = true
    try {
      const res = await apiGetReceiptDetail(branchId, receiptId)
      selectedReceiptDetail.value = res.data
      return res.data
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extrae mensaje de error si una operación batch devuelve 207 Multi-Status con ítems fallidos
   */
  function assertBatchSuccess(batchRes: unknown, fallbackMsg: string): void {
    const resObj = batchRes as {
      status?: number
      data?: Array<{ status?: number; messages?: Record<string, string> | string }>
    }
    if (resObj?.status === 207 && Array.isArray(resObj.data)) {
      const failed = resObj.data.find((item) => (item.status ?? 200) >= 400)
      if (failed) {
        const msg =
          typeof failed.messages === 'string'
            ? failed.messages
            : Object.values(failed.messages || {})[0] || fallbackMsg
        throw new Error(msg)
      }
    }
  }

  function paymentSignature(p: {
    origin_type?: string | number
    origin_id: string | number
    amount: string | number
    reference?: string | null
  }): string {
    return `${String(p.origin_type ?? '0')}:${Number(p.origin_id)}:${Number(p.amount).toFixed(2)}:${(p.reference || '').trim()}`
  }

  /**
   * Limpia ítems y pagos de un recibo en borrador ('0') para liberar referencias sin error 405
   */
  async function clearDraftReceiptContents(
    branchId: string | number,
    receiptId: string | number
  ): Promise<void> {
    try {
      const [itemsRes, paymentsRes] = await Promise.all([
        apiFetchReceiptItems(branchId, receiptId, { itemsPerPage: 100 }),
        apiFetchReceiptPayments(branchId, receiptId, { itemsPerPage: 100 })
      ])
      await Promise.all([
        ...(itemsRes.data || []).map((it) => apiDeleteReceiptItem(branchId, receiptId, it.id)),
        ...(paymentsRes.data || []).map((p) => apiDeleteReceiptPayment(branchId, receiptId, p.id))
      ])
    } catch {
      // Ignorar si el borrador ya no es editable o no tiene renglones
    }
  }

  /**
   * Orquestación idempotente de emisión/sincronización de un recibo de cobro.
   * Si se provee `draftReceiptId` (o existe un borrador '0' del cliente), lo reutiliza y sincroniza
   * diferencias en `items` y `payments` para evitar recibos huérfanos ante caídas de red o errores.
   */
  async function createFullReceipt(
    branchId: string | number,
    payload: FullReceiptEmissionPayload
  ): Promise<number> {
    isLoading.value = true
    try {
      let receiptId: number | null = payload.draftReceiptId ? Number(payload.draftReceiptId) : null

      // 1. Verificar borrador existente o reutilizar borrador '0' previo del cliente
      if (receiptId) {
        try {
          const checkRes = await apiGetReceiptById(branchId, receiptId)
          const existing = checkRes.data
          if (!existing || Number(existing.client_id) !== Number(payload.client_id)) {
            receiptId = null
          } else if (String(existing.status) === '1') {
            // Ya fue confirmado previamente (ej. corte de red justo después del commit)
            return Number(existing.id)
          } else if (String(existing.status) !== '0') {
            receiptId = null
          }
        } catch {
          receiptId = null
        }
      }

      if (!receiptId) {
        try {
          const draftsRes = await apiFetchReceipts(branchId, {
            itemsPerPage: 1,
            filters: JSON.stringify([
              ['client_id', String(payload.client_id), '=', 'AND'],
              ['status', '0', '=', 'AND']
            ])
          })
          const existingDraft = draftsRes.data?.[0]
          if (existingDraft?.id) {
            receiptId = Number(existingDraft.id)
          }
        } catch {
          // Si falla la búsqueda preventiva, proceder a crear uno nuevo
        }
      }

      if (!receiptId) {
        const receiptRes = await apiCreateReceipt(branchId, {
          client_id: payload.client_id,
          date: payload.date,
          notes: payload.notes
        })
        receiptId = Number(receiptRes.data.id)
      }

      payload.onDraftReady?.(receiptId)

      // 2. Sincronizar cuentas por cobrar (ítems) diferencialmente
      const existingItemsRes = await apiFetchReceiptItems(branchId, receiptId, { itemsPerPage: 100 })
      const existingItems = existingItemsRes.data || []
      const desiredItemSet = new Set(payload.items.map((id) => Number(id)))
      const existingItemSet = new Set(existingItems.map((it) => Number(it.receivable_id)))

      const itemsToRemove = existingItems.filter((it) => !desiredItemSet.has(Number(it.receivable_id)))
      if (itemsToRemove.length > 0) {
        await Promise.all(itemsToRemove.map((it) => apiDeleteReceiptItem(branchId, receiptId!, it.id)))
      }

      const itemsToAdd = payload.items.filter((id) => !existingItemSet.has(Number(id)))
      if (itemsToAdd.length > 0) {
        const itemsRes = await apiAddReceiptItemsBatch(
          branchId,
          receiptId,
          itemsToAdd.map((id) => ({ receivable_id: Number(id) }))
        )
        assertBatchSuccess(itemsRes, 'Error al asociar los conceptos por cobrar al recibo.')
      }

      // 3. Sincronizar medios de pago diferencialmente
      const existingPaymentsRes = await apiFetchReceiptPayments(branchId, receiptId, { itemsPerPage: 100 })
      const existingPayments = existingPaymentsRes.data || []

      // Emparejar 1 a 1 pagos deseados con pagos ya persistidos en el borrador
      const unmatchedExisting = [...existingPayments]
      const paymentsToAdd: ReceiptPaymentPayload[] = []

      for (const desired of payload.payments) {
        const sig = paymentSignature(desired)
        const matchIdx = unmatchedExisting.findIndex((ep) => paymentSignature(ep) === sig)
        if (matchIdx >= 0) {
          unmatchedExisting.splice(matchIdx, 1)
        } else {
          paymentsToAdd.push(desired)
        }
      }

      if (unmatchedExisting.length > 0) {
        await Promise.all(
          unmatchedExisting.map((ep) => apiDeleteReceiptPayment(branchId, receiptId!, ep.id))
        )
      }

      if (paymentsToAdd.length > 0) {
        const paymentsRes = await apiAddReceiptPaymentsBatch(branchId, receiptId, paymentsToAdd)
        assertBatchSuccess(paymentsRes, 'Error al registrar las formas de pago del recibo.')
      }

      // 4. Confirmación transaccional
      if (payload.confirmImmediately) {
        await apiUpdateReceiptStatus(branchId, receiptId, { status: '1' })
      }

      return receiptId
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Anula un recibo emitido revirtiendo sus efectos contables
   */
  async function cancelReceipt(
    branchId: string | number,
    receiptId: string | number,
    reason: string
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiUpdateReceiptStatus(branchId, receiptId, {
        status: '2',
        cancellation_reason: reason
      })
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Descarga el documento PDF del recibo
   */
  async function downloadPdf(
    branchId: string | number,
    receiptId: string | number,
    code?: string
  ): Promise<void> {
    const blob = await apiDownloadReceiptPdf(branchId, receiptId)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${code || `RECIBO-${receiptId}`}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Carga los saldos a favor (créditos) de clientes
   */
  async function loadCredits(
    branchId: string | number,
    params?: DataQueryParams
  ): Promise<ClientCreditItem[]> {
    if (!branchId) {
      credits.value = []
      return []
    }
    isLoading.value = true
    try {
      const res = await apiFetchClientCredits(branchId, params)
      credits.value = res.data
      return credits.value
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Anulación administrativa de un saldo a favor no consumido
   */
  async function voidCredit(
    branchId: string | number,
    creditId: string | number
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiVoidClientCredit(branchId, creditId)
    } finally {
      isLoading.value = false
    }
  }

  return {
    currencies,
    currentRates,
    paymentCategories,
    bankAccounts,
    receivables,
    receipts,
    credits,
    selectedReceiptDetail,
    isLoading,
    loadCurrencies,
    loadCurrentExchangeRate,
    loadPaymentCategories,
    loadBankAccounts,
    loadReceivables,
    syncOverdue,
    loadReceipts,
    loadReceiptDetail,
    createFullReceipt,
    clearDraftReceiptContents,
    cancelReceipt,
    downloadPdf,
    loadCredits,
    voidCredit
  }
})
