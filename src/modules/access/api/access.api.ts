import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type { ApiResponse } from '@/types/api'
import type { DataQueryParams, PaginatedResponse } from '@/types/query'
import type {
  RoleItem,
  RolePayload,
  RolePermissionItem,
  CreateRolePermissionPayload,
  ModuleItem,
  CategoryItem,
  AccessUserItem,
  UserRoleItem,
  AssignUserRolePayload,
  ClientItem,
  ClientRoleItem
} from '../types'

// 1. Roles
export async function fetchRoles(
  params?: DataQueryParams
): Promise<PaginatedResponse<RoleItem>> {
  const response = await apiClient.get<PaginatedResponse<RoleItem>>(
    ENDPOINTS.ACCESS.ROLES,
    { params }
  )
  return response.data
}

export async function createRole(
  payload: RolePayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCESS.ROLES,
    payload
  )
  return response.data
}

export async function updateRole(
  roleId: string | number,
  payload: Partial<RolePayload>
): Promise<ApiResponse<void>> {
  const response = await apiClient.put<ApiResponse<void>>(
    ENDPOINTS.ACCESS.ROLE_BY_ID(roleId),
    payload
  )
  return response.data
}

export async function deleteRole(
  roleId: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.ACCESS.ROLE_BY_ID(roleId)
  )
  return response.data
}

// 2. Permisos de Rol
export async function fetchRolePermissions(
  roleId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<RolePermissionItem>> {
  const response = await apiClient.get<PaginatedResponse<RolePermissionItem>>(
    ENDPOINTS.ACCESS.ROLE_PERMISSIONS(roleId),
    { params }
  )
  return response.data
}

export async function createRolePermission(
  roleId: string | number,
  payload: CreateRolePermissionPayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCESS.ROLE_PERMISSIONS(roleId),
    payload
  )
  return response.data
}

export async function deleteRolePermission(
  roleId: string | number,
  permissionId: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.ACCESS.ROLE_PERMISSION_BY_ID(roleId, permissionId)
  )
  return response.data
}

// 3. Módulos y Categorías
export async function fetchModules(
  params?: DataQueryParams
): Promise<PaginatedResponse<ModuleItem>> {
  const response = await apiClient.get<PaginatedResponse<ModuleItem>>(
    ENDPOINTS.ACCESS.MODULES,
    { params }
  )
  return response.data
}

export async function fetchModuleCategories(
  params?: DataQueryParams
): Promise<PaginatedResponse<CategoryItem>> {
  const response = await apiClient.get<PaginatedResponse<CategoryItem>>(
    ENDPOINTS.ACCESS.MODULE_CATEGORIES,
    { params }
  )
  return response.data
}

// 4. Usuarios y Asignación de Roles
export async function fetchAccessUsers(
  params?: DataQueryParams
): Promise<PaginatedResponse<AccessUserItem>> {
  const response = await apiClient.get<PaginatedResponse<AccessUserItem>>(
    ENDPOINTS.ACCESS.USERS,
    { params }
  )
  return response.data
}

export async function fetchUserRoles(
  userId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<UserRoleItem>> {
  const response = await apiClient.get<PaginatedResponse<UserRoleItem>>(
    ENDPOINTS.ACCESS.USER_ROLES(userId),
    { params }
  )
  return response.data
}

export async function assignUserRole(
  userId: string | number,
  payload: AssignUserRolePayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCESS.USER_ROLES(userId),
    payload
  )
  return response.data
}

export async function removeUserRole(
  userId: string | number,
  roleEntityId: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.ACCESS.USER_ROLE_BY_ID(userId, roleEntityId)
  )
  return response.data
}

// 5. Clientes API y Roles
export async function fetchClients(
  params?: DataQueryParams
): Promise<PaginatedResponse<ClientItem>> {
  const response = await apiClient.get<PaginatedResponse<ClientItem>>(
    ENDPOINTS.ACCESS.CLIENTS,
    { params }
  )
  return response.data
}

export async function fetchClientRoles(
  clientId: string | number,
  params?: DataQueryParams
): Promise<PaginatedResponse<ClientRoleItem>> {
  const response = await apiClient.get<PaginatedResponse<ClientRoleItem>>(
    ENDPOINTS.ACCESS.CLIENT_ROLES(clientId),
    { params }
  )
  return response.data
}

export async function assignClientRole(
  clientId: string | number,
  payload: AssignUserRolePayload
): Promise<ApiResponse<{ id: number }>> {
  const response = await apiClient.post<ApiResponse<{ id: number }>>(
    ENDPOINTS.ACCESS.CLIENT_ROLES(clientId),
    payload
  )
  return response.data
}

export async function removeClientRole(
  clientId: string | number,
  roleEntityId: string | number
): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.ACCESS.CLIENT_ROLE_BY_ID(clientId, roleEntityId)
  )
  return response.data
}
