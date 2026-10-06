import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { APP_CONFIG } from '@/config/constants'
import { loginUser, getAuthUser, refreshToken, logoutUser } from '../api/auth.api'
import type {
  LoginUserRequest,
  AuthUser,
  AuthRole,
  AuthPermissionsMap,
  AuthTokenData,
  AuthUserData
} from '../types'
import type { AxiosError } from 'axios'
import type { ApiErrorResponse } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  // State
  const token = ref<string | null>(localStorage.getItem(APP_CONFIG.TOKEN_KEY))
  const user = ref<AuthUser | null>(null)
  const roles = ref<AuthRole[]>([])
  const permissions = ref<AuthPermissionsMap>({})
  const branches = ref<unknown>(null)
  const tokenExpiry = ref<number | null>(null)
  const tokenRefreshAt = ref<number | null>(null)
  const forceTo = ref<string[] | null>(null)

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed<boolean>(() => !!token.value)
  const fullName = computed<string>(() => {
    if (!user.value) return ''
    return [user.value.first_name, user.value.last_name].filter(Boolean).join(' ')
  })
  const userRoleCodes = computed<string[]>(() => roles.value.map((r) => r.code))

  // Helper para extraer mensaje de error de la API
  function extractErrorMessage(err: unknown, fallback: string): string {
    const axiosError = err as AxiosError<ApiErrorResponse>
    if (axiosError?.response?.data?.messages?.error) {
      return axiosError.response.data.messages.error
    }
    if (axiosError?.response?.data?.error) {
      return axiosError.response.data.error
    }
    if (axiosError?.message) {
      return axiosError.message
    }
    return fallback
  }

  // Actions
  async function login(credentials: LoginUserRequest): Promise<AuthTokenData> {
    isLoading.value = true
    error.value = null

    try {
      const response = await loginUser(credentials)
      const tokenData = response.data

      token.value = tokenData.token
      tokenExpiry.value = tokenData.expires_at
      tokenRefreshAt.value = tokenData.refresh_at
      forceTo.value = tokenData.force_to

      localStorage.setItem(APP_CONFIG.TOKEN_KEY, tokenData.token)

      // Cargar información de perfil y permisos inmediatamente
      await fetchCurrentUser()

      return tokenData
    } catch (err) {
      const message = extractErrorMessage(err, 'Error al iniciar sesión.')
      error.value = message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchCurrentUser(): Promise<AuthUserData | null> {
    if (!token.value) {
      return null
    }

    try {
      const response = await getAuthUser()
      const authData = response.data

      user.value = authData.user
      roles.value = authData.role || []
      permissions.value = authData.permission || {}
      branches.value = authData.branch || null

      return authData
    } catch (err) {
      // Si el token es inválido, limpiar sesión
      const axiosError = err as AxiosError
      if (axiosError?.response?.status === 401) {
        clearSession()
      }
      throw err
    }
  }

  async function refreshSession(): Promise<boolean> {
    if (!token.value) return false

    try {
      const response = await refreshToken()
      const tokenData = response.data

      token.value = tokenData.token
      tokenExpiry.value = tokenData.expires_at
      tokenRefreshAt.value = tokenData.refresh_at

      localStorage.setItem(APP_CONFIG.TOKEN_KEY, tokenData.token)
      return true
    } catch (err) {
      console.warn('No se pudo refrescar el token de sesión:', err)
      return false
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true
    try {
      if (token.value) {
        await logoutUser()
      }
    } catch (err) {
      // Registrar pero continuar con el vaciado del estado local
      console.warn('Error al revocar token en servidor durante logout:', err)
    } finally {
      clearSession()
      isLoading.value = false
    }
  }

  function clearSession(): void {
    token.value = null
    user.value = null
    roles.value = []
    permissions.value = {}
    branches.value = null
    tokenExpiry.value = null
    tokenRefreshAt.value = null
    forceTo.value = null
    error.value = null
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY)
  }

  return {
    // State
    token,
    user,
    roles,
    permissions,
    branches,
    tokenExpiry,
    tokenRefreshAt,
    forceTo,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    fullName,
    userRoleCodes,
    // Actions
    login,
    fetchCurrentUser,
    refreshSession,
    logout,
    clearSession
  }
})
