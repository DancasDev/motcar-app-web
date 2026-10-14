export interface PaymentFrequencyItem {
  id: string | number
  code: string
  name: string | Record<string, string>
  is_disabled: string | boolean | number
  created_at?: string
  updated_at?: string | null
}

export interface ContractTypeItem {
  id: string | number
  code: string
  name: string
  scope?: string
  metadata_schema_id?: string | number
  metadata_schema_code?: string
  is_disabled: string | boolean | number
  created_at?: string
  updated_at?: string | null
}

export interface NoteCategoryItem {
  id: string | number
  name: string
  color?: string
  is_disabled?: string | boolean | number
}

export interface SamGroupItem {
  id: string | number
  branch_id: string | number
  branch_name?: string
  frequency_id: string | number
  frequency_code?: string
  frequency_name?: string | Record<string, string>
  contract_type_id?: string | number
  contract_type_code?: string
  contract_type_name?: string
  name: string
  amount: string | number
  installment_amount: string | number
  installment_count: string | number
  participant_max?: string | number
  participant_count?: string | number
  frequency_base_date: string
  status: string | number
  is_disabled: string | boolean | number
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface CreateSamGroupPayload {
  name: string
  frequency_id: number | string
  contract_type_id?: number | string | null
  amount: number | string
  installment_amount: number | string
  installment_count: number | string
  participant_max?: number | string
  frequency_base_date: string
  status?: string
  is_disabled?: string | boolean
}

export interface UpdateSamGroupPayload {
  name?: string
  frequency_id?: number | string
  contract_type_id?: number | string | null
  amount?: number | string
  installment_amount?: number | string
  installment_count?: number | string
  participant_max?: number | string
  status?: string
  is_disabled?: string | boolean
}

export interface ParticipantItem {
  id: string | number
  branch_id?: string | number
  san_group_id: string | number
  san_group_name?: string
  client_id: string | number
  client_first_name?: string
  client_last_name?: string
  referrer_id?: string | number
  referrer_first_name?: string
  referrer_last_name?: string
  position?: string | number
  status: string | number
  is_overdue?: string | number
  awarded_at?: string | null
  is_disabled?: string | boolean | number
  created_at?: string
  updated_at?: string | null
  benefit_metadata?: Record<string, unknown> | null
  installment_amount?: number | string
}

export interface CreateParticipantPayload {
  client_id: number | string
  referrer_id?: number | string
  position?: number | string
  status?: string
  benefit_metadata?: Record<string, unknown>
  is_disabled?: string
}

export interface UpdateParticipantPayload {
  referrer_id?: number | string
  position?: number | string
  status?: string
  benefit_metadata?: Record<string, unknown>
  awarded_at?: string | null
  is_disabled?: string
}

export interface QualifiedParticipantItem {
  id: string | number
  position: number
  status: string
  is_overdue: string
  awarded_at: string | null
  first_name?: string
  last_name?: string
  identification_type?: string
  identification_value?: string
}

export interface ContractDetailData {
  id: string | number
  branch_id: string | number
  branch_name?: string
  contract_type_id: string | number
  contract_type_code?: string
  contract_type_name?: string
  code: string
  issue_date: string
  signed_date?: string | null
  file_url?: string | null
  sign_status: string | number
  is_disabled: string | boolean | number
}

export interface SignContractPayload {
  file_url: string
  signed_date: string
}

export interface ReceivableItem {
  id: string | number
  branch_id: string | number
  branch_name?: string
  client_id: string | number
  client_first_name?: string
  client_last_name?: string
  receivable_concept_id?: string | number
  concept_name?: string
  description?: string
  origin_type: string | number
  origin_id: string | number
  total_amount: string | number
  paid_amount: string | number
  balance_amount: string | number
  due_date: string
  status: string | number
  created_at?: string
}

export interface GenerateReceivablesSummary {
  group_id?: number
  participants?: number
  installments?: number
  generated?: number
}

// ---------------------------------------------------------------------
// 6. DTOs de Reportería SAN
// ---------------------------------------------------------------------

export interface BranchSummaryFinancial {
  total_committed: number
  total_collected: number
  total_pending: number
  total_overdue: number
  collection_percentage: number
}

export interface BranchSummaryOperational {
  groups_total: number
  groups_active: number
  participants_total: number
  participants_max: number
  participants_up_to_date: number
  participants_overdue: number
  awarded_total: number
  pending_award_total: number
}

export interface BranchSummaryGroupItem {
  id: number
  name: string
  status: string
  participant_count: number
  participant_max: number
  total_committed: number
  total_collected: number
  total_pending: number
  total_overdue: number
  collection_percentage: number
  overdue_participants: number
  awarded_count: number
}

export interface BranchSummaryReport {
  branch_id: number
  financial: BranchSummaryFinancial
  operational: BranchSummaryOperational
  groups: BranchSummaryGroupItem[]
}

export interface DefaulterClient {
  id: number
  name: string
  identification_type: string
  identification_value: string
  phone_primary: string
  phone_secondary: string | null
}

export interface DefaulterReferrer {
  id?: number
  name: string
  phone?: string | null
}

export interface DefaulterItem {
  participant_id: number
  group_id: number
  group_name: string
  position: number
  overdue_installments: number
  overdue_amount: number
  oldest_due_date: string | null
  days_overdue: number
  is_awarded: boolean
  awarded_at: string | null
  benefit_summary: string | null
  client: DefaulterClient
  referrer: DefaulterReferrer | null
}

export interface CalendarClient {
  id: number
  name: string
  phone: string | null
}

export interface CalendarReferrer {
  name: string
  phone: string | null
}

export interface CalendarReceivableItem {
  receivable_id: number
  participant_id: number
  group_id: number
  group_name: string
  position: number
  description: string
  total_amount: number
  paid_amount: number
  pending_amount: number
  status: string
  client: CalendarClient
  referrer: CalendarReferrer | null
}

export interface CalendarDay {
  date: string
  count: number
  total_expected: number
  total_collected: number
  total_pending: number
  items: CalendarReceivableItem[]
}

export interface CalendarSummary {
  total_expected: number
  total_collected: number
  total_pending: number
  installments_total: number
  installments_paid: number
  installments_pending: number
}

export interface CollectionCalendarReport {
  range?: {
    start_date: string
    end_date: string
  }
  period?: {
    start_date: string
    end_date: string
  }
  summary: CalendarSummary
  days: Record<string, CalendarDay>
}

export interface AwardedBenefitItem {
  participant_id: number
  group_id: number
  group_name: string
  position: number
  awarded_at: string
  is_overdue: boolean
  overdue_count: number
  overdue_amount: number
  total_committed: number
  total_collected: number
  benefit_metadata: Record<string, any> | null
  client: {
    id: number
    name: string
    identification_type: string
    identification_value: string
    phone: string | null
  }
  referrer: {
    name: string
    phone: string | null
  } | null
}

export interface StatementReceiptPayment {
  receipt_code: string
  receipt_date: string
  applied_amount: number
  account_name: string
}

export interface StatementInstallment {
  id: number
  description: string
  due_date: string
  total_amount: number
  paid_amount: number
  pending_amount: number
  status: string
  is_overdue: boolean
  payments: StatementReceiptPayment[]
}

export interface ParticipantStatement {
  participant: {
    id: number
    group_id: number
    group_name: string
    position: number
    status: string
    is_overdue: boolean
    is_awarded: boolean
    awarded_at: string | null
    benefit_metadata: Record<string, any> | null
    installment_amount: number
    installment_count: number
  }
  client: {
    id: number
    name: string
    identification_type: string
    identification_value: string
    phone: string | null
  }
  referrer: {
    id: number
    name: string
    phone: string | null
  } | null
  summary: {
    total_committed: number
    total_collected: number
    total_pending: number
    installments_total: number
    installments_paid: number
    installments_pending: number
    installments_overdue: number
    overdue_amount: number
  }
  installments: StatementInstallment[]
}

