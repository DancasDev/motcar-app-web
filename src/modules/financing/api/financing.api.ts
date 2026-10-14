import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type { ApiResponse } from '@/types/api'
import type {
  PaymentFrequencyItem,
  ContractTypeItem,
  NoteCategoryItem,
  SamGroupItem,
  CreateSamGroupPayload,
  UpdateSamGroupPayload,
  ParticipantItem,
  CreateParticipantPayload,
  UpdateParticipantPayload,
  QualifiedParticipantItem,
  ContractDetailData,
  SignContractPayload,
  ReceivableItem,
  GenerateReceivablesSummary,
  BranchSummaryReport,
  DefaulterItem,
  CollectionCalendarReport,
  AwardedBenefitItem,
  ParticipantStatement
} from '../types'

// ---------------------------------------------------------------------
// 1. Catálogos Maestros de Financiamiento
// ---------------------------------------------------------------------

export async function fetchPaymentFrequencies(
  params?: DataQueryParams
): Promise<PaginatedResponse<PaymentFrequencyItem>> {
  const response = await apiClient.get<PaginatedResponse<PaymentFrequencyItem>>(
    ENDPOINTS.FINANCING.FREQUENCIES,
    { params }
  )
  return response.data
}

export async function fetchContractTypes(
  params?: DataQueryParams
): Promise<PaginatedResponse<ContractTypeItem>> {
  const response = await apiClient.get<PaginatedResponse<ContractTypeItem>>(
    ENDPOINTS.FINANCING.CONTRACT_TYPES,
    { params }
  )
  return response.data
}

export async function fetchNoteCategories(
  params?: DataQueryParams
): Promise<PaginatedResponse<NoteCategoryItem>> {
  const response = await apiClient.get<PaginatedResponse<NoteCategoryItem>>(
    ENDPOINTS.FINANCING.NOTE_CATEGORIES,
    { params }
  )
  return response.data
}

// ---------------------------------------------------------------------
// 2. Grupos SAM
// ---------------------------------------------------------------------

export async function fetchSamGroups(
  branchId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<SamGroupItem>> {
  const response = await apiClient.get<PaginatedResponse<SamGroupItem>>(
    ENDPOINTS.FINANCING.GROUPS(branchId),
    { params }
  )
  return response.data
}

export async function fetchSamGroupById(
  branchId: string | number,
  groupId: string | number
): Promise<ApiResponse<SamGroupItem>> {
  const response = await apiClient.get<ApiResponse<SamGroupItem>>(
    ENDPOINTS.FINANCING.GROUP_BY_ID(branchId, groupId)
  )
  return response.data
}

export async function createSamGroup(
  branchId: string | number,
  payload: CreateSamGroupPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.FINANCING.GROUPS(branchId),
    payload
  )
  return response.data
}

export async function updateSamGroup(
  branchId: string | number,
  groupId: string | number,
  payload: UpdateSamGroupPayload
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.put<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.GROUP_BY_ID(branchId, groupId),
    payload
  )
  return response.data
}

export async function deleteSamGroup(
  branchId: string | number,
  groupId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.delete<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.GROUP_BY_ID(branchId, groupId)
  )
  return response.data
}

export async function restoreSamGroup(
  branchId: string | number,
  groupId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.patch<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.GROUP_BY_ID(branchId, groupId)
  )
  return response.data
}

export async function fetchQualifiedParticipants(
  branchId: string | number,
  groupId: string | number,
  params?: DataQueryParams
): Promise<ApiResponse<QualifiedParticipantItem[]>> {
  const response = await apiClient.get<ApiResponse<QualifiedParticipantItem[]>>(
    ENDPOINTS.FINANCING.GROUP_QUALIFIED(branchId, groupId),
    { params }
  )
  return response.data
}

export async function generateGroupReceivables(
  branchId: string | number,
  groupId: string | number
): Promise<ApiResponse<GenerateReceivablesSummary>> {
  const response = await apiClient.post<ApiResponse<GenerateReceivablesSummary>>(
    ENDPOINTS.FINANCING.GROUP_GENERATE_RECEIVABLES(branchId, groupId),
    {}
  )
  return response.data
}

// ---------------------------------------------------------------------
// 3. Participantes del Grupo SAM
// ---------------------------------------------------------------------

export async function fetchParticipants(
  branchId: string | number,
  groupId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ParticipantItem>> {
  const response = await apiClient.get<PaginatedResponse<ParticipantItem>>(
    ENDPOINTS.FINANCING.PARTICIPANTS(branchId, groupId),
    { params }
  )
  return response.data
}

export async function createParticipant(
  branchId: string | number,
  groupId: string | number,
  payload: CreateParticipantPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.FINANCING.PARTICIPANTS(branchId, groupId),
    payload
  )
  return response.data
}

export async function updateParticipant(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number,
  payload: UpdateParticipantPayload
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.put<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.PARTICIPANT_BY_ID(branchId, groupId, participantId),
    payload
  )
  return response.data
}

export async function deleteParticipant(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.delete<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.PARTICIPANT_BY_ID(branchId, groupId, participantId)
  )
  return response.data
}

export async function restoreParticipant(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.patch<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.PARTICIPANT_BY_ID(branchId, groupId, participantId)
  )
  return response.data
}

export async function generateParticipantReceivables(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number
): Promise<ApiResponse<GenerateReceivablesSummary>> {
  const response = await apiClient.post<ApiResponse<GenerateReceivablesSummary>>(
    ENDPOINTS.FINANCING.PARTICIPANT_GENERATE_RECEIVABLES(branchId, groupId, participantId),
    {}
  )
  return response.data
}

// ---------------------------------------------------------------------
// 4. Contrato del Participante
// ---------------------------------------------------------------------

export async function fetchParticipantContract(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number
): Promise<ApiResponse<ContractDetailData>> {
  const response = await apiClient.get<ApiResponse<ContractDetailData>>(
    ENDPOINTS.FINANCING.CONTRACT(branchId, groupId, participantId)
  )
  return response.data
}

export async function emitContract(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.FINANCING.CONTRACT(branchId, groupId, participantId),
    {}
  )
  return response.data
}

export async function signContract(
  branchId: string | number,
  groupId: string | number,
  participantId: string | number,
  payload: SignContractPayload
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.put<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.FINANCING.CONTRACT_SIGN(branchId, groupId, participantId),
    payload
  )
  return response.data
}

// ---------------------------------------------------------------------
// 5. Cuentas por Cobrar (Receivables / Cuotas)
// ---------------------------------------------------------------------

export async function fetchReceivables(
  branchId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ReceivableItem>> {
  const response = await apiClient.get<PaginatedResponse<ReceivableItem>>(
    ENDPOINTS.ACCOUNTING.RECEIVABLES(branchId),
    { params }
  )
  return response.data
}

// ---------------------------------------------------------------------
// 6. Reportes Analíticos de Financiamiento
// ---------------------------------------------------------------------

export async function fetchBranchSummary(
  branchId: string | number
): Promise<ApiResponse<BranchSummaryReport>> {
  const response = await apiClient.get<ApiResponse<BranchSummaryReport>>(
    ENDPOINTS.FINANCING.REPORTS_SUMMARY(branchId)
  )
  return response.data
}

export async function fetchDefaulters(
  branchId: string | number,
  groupId?: string | number | null
): Promise<ApiResponse<DefaulterItem[]>> {
  const params: Record<string, any> = {}
  if (groupId) params.group_id = groupId
  const response = await apiClient.get<ApiResponse<DefaulterItem[]>>(
    ENDPOINTS.FINANCING.REPORTS_DEFAULTERS(branchId),
    { params }
  )
  return response.data
}
export const fetchBranchDefaulters = fetchDefaulters

export async function fetchCollectionCalendar(
  branchId: string | number,
  startDate?: string,
  endDate?: string,
  groupId?: string | number | null
): Promise<ApiResponse<CollectionCalendarReport>> {
  const params: Record<string, any> = {}
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate
  if (groupId) params.group_id = groupId
  const response = await apiClient.get<ApiResponse<CollectionCalendarReport>>(
    ENDPOINTS.FINANCING.REPORTS_CALENDAR(branchId),
    { params }
  )
  return response.data
}

export async function fetchAwardedBenefits(
  branchId: string | number,
  groupId?: string | number | null
): Promise<ApiResponse<AwardedBenefitItem[]>> {
  const params: Record<string, any> = {}
  if (groupId) params.group_id = groupId
  const response = await apiClient.get<ApiResponse<AwardedBenefitItem[]>>(
    ENDPOINTS.FINANCING.REPORTS_AWARDED(branchId),
    { params }
  )
  return response.data
}

export async function fetchParticipantStatement(
  branchId: string | number,
  participantId: string | number,
  groupId?: string | number | null
): Promise<ApiResponse<ParticipantStatement>> {
  if (groupId) {
    const response = await apiClient.get<ApiResponse<ParticipantStatement>>(
      ENDPOINTS.FINANCING.PARTICIPANT_STATEMENT(branchId, groupId, participantId)
    )
    return response.data
  }
  const response = await apiClient.get<ApiResponse<ParticipantStatement>>(
    ENDPOINTS.FINANCING.REPORTS_PARTICIPANT_STATEMENT(branchId),
    { params: { participant_id: participantId } }
  )
  return response.data
}

