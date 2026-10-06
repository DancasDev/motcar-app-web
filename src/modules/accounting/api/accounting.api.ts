import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type { ApiResponse } from '@/types/api'
import type {
  CurrencyItem,
  CreateCurrencyPayload,
  UpdateCurrencyPayload,
  ExchangeRateItem,
  CreateExchangeRatePayload,
  PaymentCategoryItem,
  PaymentAccountItem,
  ReceivableConceptItem,
  AccountReceivableItem,
  SyncOverdueSummary,
  ReceiptItem,
  ReceiptDetailItem,
  CreateReceiptPayload,
  ReceiptItemPayload,
  ReceiptPaymentPayload,
  UpdateReceiptStatusPayload,
  ClientCreditItem
} from '../types'

// ---------------------------------------------------------------------
// 1. Maestros Globales: Monedas y Tasas de Cambio
// ---------------------------------------------------------------------

export async function fetchCurrencies(
  params?: DataQueryParams
): Promise<PaginatedResponse<CurrencyItem>> {
  const response = await apiClient.get<PaginatedResponse<CurrencyItem>>(
    ENDPOINTS.ACCOUNTING.CURRENCIES,
    { params }
  )
  return response.data
}

export async function fetchCurrencyById(
  id: string | number
): Promise<ApiResponse<CurrencyItem>> {
  const response = await apiClient.get<ApiResponse<CurrencyItem>>(
    ENDPOINTS.ACCOUNTING.CURRENCY_BY_ID(id)
  )
  return response.data
}

export async function createCurrency(
  payload: CreateCurrencyPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCOUNTING.CURRENCIES,
    payload
  )
  return response.data
}

export async function updateCurrency(
  id: string | number,
  payload: UpdateCurrencyPayload
): Promise<ApiResponse<void>> {
  const response = await apiClient.put<ApiResponse<void>>(
    ENDPOINTS.ACCOUNTING.CURRENCY_BY_ID(id),
    payload
  )
  return response.data
}

export async function deleteCurrency(
  id: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.ACCOUNTING.CURRENCY_BY_ID(id)
  )
  return response.data
}

export async function restoreCurrency(
  id: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.patch<ApiResponse<void>>(
    ENDPOINTS.ACCOUNTING.CURRENCY_BY_ID(id)
  )
  return response.data
}

export async function fetchExchangeRates(
  currencyId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ExchangeRateItem>> {
  const response = await apiClient.get<PaginatedResponse<ExchangeRateItem>>(
    ENDPOINTS.ACCOUNTING.EXCHANGE_RATES(currencyId),
    { params }
  )
  return response.data
}

export async function fetchCurrentExchangeRate(
  currencyId: string | number
): Promise<ApiResponse<ExchangeRateItem>> {
  const response = await apiClient.get<ApiResponse<ExchangeRateItem>>(
    ENDPOINTS.ACCOUNTING.CURRENT_EXCHANGE_RATE(currencyId)
  )
  return response.data
}

export async function createExchangeRate(
  currencyId: string | number,
  payload: CreateExchangeRatePayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCOUNTING.EXCHANGE_RATES(currencyId),
    payload
  )
  return response.data
}

// ---------------------------------------------------------------------
// 2. Canales de Pago: Categorías y Cuentas Receptoras
// ---------------------------------------------------------------------

export async function fetchPaymentCategories(
  params?: DataQueryParams
): Promise<PaginatedResponse<PaymentCategoryItem>> {
  const response = await apiClient.get<PaginatedResponse<PaymentCategoryItem>>(
    ENDPOINTS.ACCOUNTING.PAYMENT_CATEGORIES,
    { params }
  )
  return response.data
}

export async function fetchPaymentAccounts(
  params?: DataQueryParams
): Promise<PaginatedResponse<PaymentAccountItem>> {
  const response = await apiClient.get<PaginatedResponse<PaymentAccountItem>>(
    ENDPOINTS.ACCOUNTING.PAYMENT_ACCOUNTS,
    { params }
  )
  return response.data
}

export async function fetchCategoryPaymentAccounts(
  categoryId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<PaymentAccountItem>> {
  const response = await apiClient.get<PaginatedResponse<PaymentAccountItem>>(
    ENDPOINTS.ACCOUNTING.CATEGORY_PAYMENT_ACCOUNTS(categoryId),
    { params }
  )
  return response.data
}

export async function fetchReceivableConcepts(
  params?: DataQueryParams
): Promise<PaginatedResponse<ReceivableConceptItem>> {
  const response = await apiClient.get<PaginatedResponse<ReceivableConceptItem>>(
    ENDPOINTS.ACCOUNTING.RECEIVABLE_CONCEPTS,
    { params }
  )
  return response.data
}

// ---------------------------------------------------------------------
// 3. Cuentas por Cobrar de Sucursal
// ---------------------------------------------------------------------

export async function fetchAccountsReceivable(
  branchId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<AccountReceivableItem>> {
  const response = await apiClient.get<PaginatedResponse<AccountReceivableItem>>(
    ENDPOINTS.ACCOUNTING.RECEIVABLES(branchId),
    { params }
  )
  return response.data
}

export async function getAccountReceivableById(
  branchId: string | number,
  receivableId: string | number
): Promise<ApiResponse<AccountReceivableItem>> {
  const response = await apiClient.get<ApiResponse<AccountReceivableItem>>(
    ENDPOINTS.ACCOUNTING.RECEIVABLE_BY_ID(branchId, receivableId)
  )
  return response.data
}

export async function syncOverdueReceivables(
  branchId: string | number
): Promise<ApiResponse<SyncOverdueSummary>> {
  const response = await apiClient.post<ApiResponse<SyncOverdueSummary>>(
    ENDPOINTS.ACCOUNTING.RECEIVABLES_OVERDUE_SYNC(branchId),
    {}
  )
  return response.data
}

// ---------------------------------------------------------------------
// 4. Recibos de Caja (Receipts)
// ---------------------------------------------------------------------

export async function fetchReceipts(
  branchId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ReceiptItem>> {
  const response = await apiClient.get<PaginatedResponse<ReceiptItem>>(
    ENDPOINTS.ACCOUNTING.RECEIPTS(branchId),
    { params }
  )
  return response.data
}

export async function getReceiptById(
  branchId: string | number,
  receiptId: string | number
): Promise<ApiResponse<ReceiptItem>> {
  const response = await apiClient.get<ApiResponse<ReceiptItem>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_BY_ID(branchId, receiptId)
  )
  return response.data
}

export async function getReceiptDetail(
  branchId: string | number,
  receiptId: string | number
): Promise<ApiResponse<ReceiptDetailItem>> {
  const response = await apiClient.get<ApiResponse<ReceiptDetailItem>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_DETAIL(branchId, receiptId)
  )
  return response.data
}

export async function createReceipt(
  branchId: string | number,
  payload: CreateReceiptPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCOUNTING.RECEIPTS(branchId),
    payload
  )
  return response.data
}

export async function addReceiptItem(
  branchId: string | number,
  receiptId: string | number,
  payload: ReceiptItemPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_ITEMS(branchId, receiptId),
    payload
  )
  return response.data
}

export async function addReceiptItemsBatch(
  branchId: string | number,
  receiptId: string | number,
  items: ReceiptItemPayload[]
): Promise<ApiResponse<unknown>> {
  const response = await apiClient.post<ApiResponse<unknown>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_ITEMS(branchId, receiptId),
    items,
    { params: { is_batch: true } }
  )
  return response.data
}

export async function addReceiptPayment(
  branchId: string | number,
  receiptId: string | number,
  payload: ReceiptPaymentPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_PAYMENTS(branchId, receiptId),
    payload
  )
  return response.data
}

export async function addReceiptPaymentsBatch(
  branchId: string | number,
  receiptId: string | number,
  payments: ReceiptPaymentPayload[]
): Promise<ApiResponse<unknown>> {
  const response = await apiClient.post<ApiResponse<unknown>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_PAYMENTS(branchId, receiptId),
    payments,
    { params: { is_batch: true } }
  )
  return response.data
}

export async function updateReceiptStatus(
  branchId: string | number,
  receiptId: string | number,
  payload: UpdateReceiptStatusPayload
): Promise<ApiResponse<unknown>> {
  const response = await apiClient.put<ApiResponse<unknown>>(
    ENDPOINTS.ACCOUNTING.RECEIPT_STATUS(branchId, receiptId),
    payload
  )
  return response.data
}

export async function downloadReceiptPdf(
  branchId: string | number,
  receiptId: string | number,
  template = 'formal'
): Promise<Blob> {
  const response = await apiClient.get<Blob>(
    ENDPOINTS.ACCOUNTING.RECEIPT_PDF(branchId, receiptId),
    {
      params: { template },
      responseType: 'blob'
    }
  )
  return response.data
}

// ---------------------------------------------------------------------
// 5. Saldos a Favor de Clientes (Credits)
// ---------------------------------------------------------------------

export async function fetchClientCredits(
  branchId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ClientCreditItem>> {
  const response = await apiClient.get<PaginatedResponse<ClientCreditItem>>(
    ENDPOINTS.ACCOUNTING.CREDITS(branchId),
    { params }
  )
  return response.data
}

export async function voidClientCredit(
  branchId: string | number,
  creditId: string | number
): Promise<ApiResponse<ClientCreditItem>> {
  const response = await apiClient.put<ApiResponse<ClientCreditItem>>(
    ENDPOINTS.ACCOUNTING.CREDIT_VOID(branchId, creditId),
    {}
  )
  return response.data
}
