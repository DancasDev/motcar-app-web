// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES - MÓDULO ACCOUNTING (CONTABILIDAD Y TESORERÍA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catálogo de Monedas
 */
export interface CurrencyItem {
  id: number | string
  name: string
  code: string
  symbol: string
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export interface CreateCurrencyPayload {
  name: string
  code: string
  symbol: string
  is_disabled?: string | number | boolean
}

export interface UpdateCurrencyPayload {
  name?: string
  code?: string
  symbol?: string
  is_disabled?: string | number | boolean
}

/**
 * Tasas de Cambio
 */
export interface ExchangeRateItem {
  id: number | string
  currency_id: number | string
  currency_code?: string
  date: string
  value: number | string
  created_at?: string
  updated_at?: string
}

export interface CreateExchangeRatePayload {
  date: string
  value: number
}

/**
 * Categorías de Cuentas de Pago
 */
export interface PaymentCategoryItem {
  id: number | string
  name: string
  code?: string
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Cuentas Receptoras de Pago / Cuentas Bancarias
 */
export interface PaymentAccountItem {
  id: number | string
  category_id: number | string
  category_name?: string
  currency_id: number | string
  currency_code?: string
  currency_symbol?: string
  name: string
  metadata?: {
    account_number?: string
    bank_name?: string
    holder_name?: string
    identification_number?: string
    email?: string
    phone?: string
    [key: string]: unknown
  } | null
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Conceptos de Cobro
 */
export interface ReceivableConceptItem {
  id: number | string
  code: string
  name: string
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

/**
 * Cuentas por Cobrar (CxC / Cartera de Cobros)
 */
export interface AccountReceivableItem {
  id: number | string
  branch_id: number | string
  branch_name?: string
  client_id: number | string
  client_first_name?: string
  client_last_name?: string
  receivable_concept_id?: number | string
  concept_code?: string
  concept_name?: string
  description?: string
  origin_type?: string | number
  origin_id?: string | number
  total_amount: number | string
  paid_amount: number | string
  issue_date?: string
  due_date: string
  status: string | number // 0: Pendiente, 1: Abonado, 2: Pagado, 3: Anulado
  is_disabled?: string | number | boolean
  created_at?: string
  updated_at?: string
}

export interface SyncOverdueSummary {
  processed: number
  updated: number
}

/**
 * Recibos de Caja (Cabecera en listados)
 */
export interface ReceiptItem {
  id: number | string
  branch_id?: number | string
  branch_name?: string
  code: string
  date: string
  client_id: number | string
  client_first_name?: string
  client_last_name?: string
  collector_id?: number | string
  collector_first_name?: string
  collector_last_name?: string
  notes?: string | null
  cancellation_reason?: string | null
  status: string | number // "0": Borrador, "1": Confirmado, "2": Anulado
  created_at?: string
  updated_at?: string
}

/**
 * Renglón de Recibo (Obligación / Cuota vinculada)
 */
export interface ReceiptItemEntity {
  id: number | string
  receipt_id: number | string
  receivable_id: number | string
  amount: number | string
  type?: string | number // 1: completo, 2: abono, 3: restante
  receivable_description?: string
  receivable_total_amount?: number | string
  receivable_paid_amount?: number | string
  receivable_status?: string | number
  display_description?: string
}

/**
 * Medio de Pago Registrado en Recibo
 */
export interface ReceiptPaymentEntity {
  id: number | string
  receipt_id: number | string
  origin_type: string | number // "0": Cuenta Bancaria/Caja, "1": Saldo a favor
  origin_id: number | string
  amount: number | string
  exchange_rate?: number | string
  reference?: string | null
  notes?: string | null
  payment_account_name?: string
  payment_category_name?: string
  currency_code?: string
  currency_symbol?: string
}

/**
 * Totales y Balances del Recibo
 */
export interface ReceiptTotals {
  payments_usd: number
  items_usd: number
  credit_usd: number
  balance_usd: number
}

/**
 * Detalle Consolidado de Recibo
 */
export interface ReceiptDetailItem {
  id: number | string
  branch_id: number | string
  branch_name?: string
  client_id: number | string
  client_first_name?: string
  client_last_name?: string
  client_identification_type?: string
  client_identification_value?: string
  client_phone?: string
  client_address?: string
  client_city?: string
  collector_id?: number | string
  collector_first_name?: string
  collector_last_name?: string
  code: string
  date: string
  notes?: string | null
  cancellation_reason?: string | null
  status: string | number
  created_at?: string
  updated_at?: string
  items: ReceiptItemEntity[]
  payments: ReceiptPaymentEntity[]
  credits?: unknown[]
  totals?: ReceiptTotals
}

/**
 * Saldos a Favor de Clientes (acc_client_credit)
 */
export interface ClientCreditItem {
  id: number | string
  branch_id: number | string
  branch_name?: string
  client_id: number | string
  client_first_name?: string
  client_last_name?: string
  receipt_id?: number | string
  receipt_code?: string
  payment_account_id?: number | string
  payment_account_name?: string
  currency_id: number | string
  currency_code?: string
  currency_symbol?: string
  amount: number | string
  exchange_rate?: number | string
  available_amount: number | string
  status: string | number // "0": Disponible, "1": Consumido, "2": Anulado
  created_at?: string
  updated_at?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOADS PARA PETICIONES
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateReceiptPayload {
  client_id: number
  date?: string
  notes?: string
}

export interface ReceiptItemPayload {
  receivable_id: number
}

export interface ReceiptPaymentPayload {
  origin_type?: '0' | '1'
  origin_id: number
  amount: number
  payment_date?: string
  reference?: string
  notes?: string
  file_url?: string
}

export interface UpdateReceiptStatusPayload {
  status: '1' | '2'
  cancellation_reason?: string
}

export interface FullReceiptEmissionPayload {
  client_id: number
  date?: string
  notes?: string
  items: number[] // IDs de cuentas por cobrar
  payments: ReceiptPaymentPayload[]
  confirmImmediately?: boolean
}
