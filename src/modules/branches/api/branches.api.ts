import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type { ApiResponse } from '@/types/api'
import type {
  BranchItem,
  BranchTreeMap,
  CreateBranchPayload,
  UpdateBranchPayload
} from '../types'

/**
 * Consulta el listado paginado y filtrado de sucursales vía DQB
 */
export async function fetchBranches(
  params?: DataQueryParams
): Promise<PaginatedResponse<BranchItem>> {
  const response = await apiClient.get<PaginatedResponse<BranchItem>>(
    ENDPOINTS.BRANCHES.BASE,
    { params }
  )
  return response.data
}

/**
 * Obtiene el detalle de una sucursal por su identificador
 */
export async function fetchBranchById(
  branchId: string | number
): Promise<ApiResponse<BranchItem>> {
  const response = await apiClient.get<ApiResponse<BranchItem>>(
    ENDPOINTS.BRANCHES.BY_ID(branchId)
  )
  return response.data
}

/**
 * Obtiene la estructura jerárquica indexada de sucursales (mapa del árbol)
 */
export async function fetchBranchTree(): Promise<ApiResponse<BranchTreeMap | []>> {
  const response = await apiClient.get<ApiResponse<BranchTreeMap | []>>(
    ENDPOINTS.BRANCHES.TREE
  )
  return response.data
}

/**
 * Registra una nueva sucursal en el árbol jerárquico
 */
export async function createBranch(
  payload: CreateBranchPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.BRANCHES.BASE,
    payload
  )
  return response.data
}

/**
 * Actualiza una sucursal existente
 */
export async function updateBranch(
  branchId: string | number,
  payload: UpdateBranchPayload
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.put<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.BRANCHES.BY_ID(branchId),
    payload
  )
  return response.data
}

/**
 * Mueve una sucursal a la papelera (soft delete)
 */
export async function deleteBranch(
  branchId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.delete<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.BRANCHES.BY_ID(branchId)
  )
  return response.data
}

/**
 * Restaura una sucursal eliminada
 */
export async function restoreBranch(
  branchId: string | number
): Promise<ApiResponse<{ id: number; affected: boolean }>> {
  const response = await apiClient.patch<ApiResponse<{ id: number; affected: boolean }>>(
    ENDPOINTS.BRANCHES.BY_ID(branchId)
  )
  return response.data
}
