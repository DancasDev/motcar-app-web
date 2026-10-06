import { apiClient } from '@/api/client'
import { ENDPOINTS } from '@/api/endpoints'
import type {
  ApiResponse,
  LoginUserRequest,
  LoginClientRequest,
  AuthTokenData,
  AuthUserData,
  AuthClientData,
  UpdateUserSignatureRequest,
  UserSignatureResponse
} from '../types'

/**
 * Autentica un usuario y devuelve el token JWT
 */
export async function loginUser(payload: LoginUserRequest): Promise<ApiResponse<AuthTokenData>> {
  const response = await apiClient.post<ApiResponse<AuthTokenData>>(
    ENDPOINTS.AUTH.USER.LOGIN,
    payload
  )
  return response.data
}

/**
 * Consulta la información de sesión del usuario autenticado
 */
export async function getAuthUser(): Promise<ApiResponse<AuthUserData>> {
  const response = await apiClient.get<ApiResponse<AuthUserData>>(
    ENDPOINTS.AUTH.USER.GET_SESSION
  )
  return response.data
}

/**
 * Renueva el token JWT de la sesión del usuario actual
 */
export async function refreshToken(): Promise<ApiResponse<AuthTokenData>> {
  const response = await apiClient.put<ApiResponse<AuthTokenData>>(
    ENDPOINTS.AUTH.USER.REFRESH
  )
  return response.data
}

/**
 * Invalida el token JWT de la sesión del usuario
 */
export async function logoutUser(): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.AUTH.USER.LOGOUT
  )
  return response.data
}

/**
 * Autentica un cliente API
 */
export async function loginClient(payload: LoginClientRequest): Promise<ApiResponse<AuthTokenData>> {
  const response = await apiClient.post<ApiResponse<AuthTokenData>>(
    ENDPOINTS.AUTH.CLIENT.LOGIN,
    payload
  )
  return response.data
}

/**
 * Consulta la información de sesión del cliente API autenticado
 */
export async function getAuthClient(): Promise<ApiResponse<AuthClientData>> {
  const response = await apiClient.get<ApiResponse<AuthClientData>>(
    ENDPOINTS.AUTH.CLIENT.GET_SESSION
  )
  return response.data
}

/**
 * Renueva el token JWT del cliente API
 */
export async function refreshClientToken(): Promise<ApiResponse<AuthTokenData>> {
  const response = await apiClient.put<ApiResponse<AuthTokenData>>(
    ENDPOINTS.AUTH.CLIENT.REFRESH
  )
  return response.data
}

/**
 * Invalida el token JWT del cliente API
 */
export async function logoutClient(): Promise<ApiResponse<void>> {
  const response = await apiClient.delete<ApiResponse<void>>(
    ENDPOINTS.AUTH.CLIENT.LOGOUT
  )
  return response.data
}

/**
 * Registra o actualiza la firma digital del usuario autenticado
 */
export async function updateUserSignature(
  payload: UpdateUserSignatureRequest
): Promise<ApiResponse<UserSignatureResponse>> {
  const response = await apiClient.post<ApiResponse<UserSignatureResponse>>(
    ENDPOINTS.AUTH.USER.SIGNATURE,
    payload
  )
  return response.data
}
