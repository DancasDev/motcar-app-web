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
  advisor_id?: string | number
  advisor_first_name?: string
  advisor_last_name?: string
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
  advisor_id?: number | string
  position?: number | string
  status?: string
  benefit_metadata?: Record<string, unknown>
  is_disabled?: string
}

export interface UpdateParticipantPayload {
  advisor_id?: number | string
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
