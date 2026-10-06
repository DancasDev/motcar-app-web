import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchCurrencies as apiFetchCurrencies,
  fetchCurrentExchangeRate as apiFetchCurrentExchangeRate,
  fetchPaymentAccounts as apiFetchPaymentAccounts,
  fetchAccountsReceivable as apiFetchAccountsReceivable,
  syncOverdueReceivables as apiSyncOverdueReceivables,
  fetchReceipts as apiFetchReceipts,
  getReceiptDetail as apiGetReceiptDetail,
  createReceipt as apiCreateReceipt,
  addReceiptItem as apiAddReceiptItem,
  addReceiptItemsBatch as apiAddReceiptItemsBatch,
  addReceiptPayment as apiAddReceiptPayment,
  addReceiptPaymentsBatch as apiAddReceiptPaymentsBatch,
  updateReceiptStatus as apiUpdateReceiptStatus,
  downloadReceiptPdf as apiDownloadReceiptPdf,
  fetchClientCredits as apiFetchClientCredits,
  voidClientCredit as apiVoidClientCredit
} from '../api/accounting.api'
import type {
  CurrencyItem,
  ExchangeRateItem,
  PaymentAccountItem,
  AccountReceivableItem,
  ReceiptItem,
  ReceiptDetailItem,
  ClientCreditItem,
  FullReceiptEmissionPayload,
  SyncOverdueSummary
} from '../types'
import type { DataQueryParams } from '@/types/query'

export const useAccountingStore = defineStore('accounting', () => {
  const currencies = ref<CurrencyItem[]>([])
  const currentRates = ref<Record<string, ExchangeRateItem>>({})
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
      if (res.data) {
        currentRates.value[String(currencyId)] = res.data
      }
      return res.data
    } catch (err) {
      console.error(`Error loading exchange rate for currency ${currencyId}:`, err)
      return null
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
   * Orquestación de emisión completa de un recibo de cobro
   */
  async function createFullReceipt(
    branchId: string | number,
    payload: FullReceiptEmissionPayload
  ): Promise<number> {
    isLoading.value = true
    try {
      // 1. Crear cabecera de recibo en estado Borrador
      const receiptRes = await apiCreateReceipt(branchId, {
        client_id: payload.client_id,
        date: payload.date,
        notes: payload.notes
      })
      const receiptId = receiptRes.data.id

      // 2. Asociar cuentas por cobrar (ítems)
      if (payload.items.length > 0) {
        try {
          await apiAddReceiptItemsBatch(
            branchId,
            receiptId,
            payload.items.map((id) => ({ receivable_id: id }))
          )
        } catch {
          // Fallback uno a uno si el endpoint batch no aplica
          for (const recId of payload.items) {
            await apiAddReceiptItem(branchId, receiptId, { receivable_id: recId })
          }
        }
      }

      // 3. Registrar medios de pago
      if (payload.payments.length > 0) {
        try {
          await apiAddReceiptPaymentsBatch(branchId, receiptId, payload.payments)
        } catch {
          // Fallback uno a uno
          for (const payment of payload.payments) {
            await apiAddReceiptPayment(branchId, receiptId, payment)
          }
        }
      }

      // 4. Confirmación inmediata (opcional según selección del usuario)
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
    bankAccounts,
    receivables,
    receipts,
    credits,
    selectedReceiptDetail,
    isLoading,
    loadCurrencies,
    loadCurrentExchangeRate,
    loadBankAccounts,
    loadReceivables,
    syncOverdue,
    loadReceipts,
    loadReceiptDetail,
    createFullReceipt,
    cancelReceipt,
    downloadPdf,
    loadCredits,
    voidCredit
  }
})
