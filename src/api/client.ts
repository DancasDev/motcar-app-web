import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { ENV } from '@/config/env'
import { APP_CONFIG } from '@/config/constants'
import { ENDPOINTS } from '@/api/endpoints'
import type { ApiErrorResponse } from '@/types/api'
import {
  API_ERROR_CODES,
  isSessionExpiredError,
  isBranchScopeError
} from '@/api/errors'
import { router } from '@/router'

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'es'
  },
  timeout: 15000
})

// Request Interceptor: Inyectar token de autorización si está disponible
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(APP_CONFIG.TOKEN_KEY)
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Response Interceptor: Tratamiento semántico de respuestas según opencollection.yml
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    if (error.response?.status === 401) {
      const requestUrl = originalRequest?.url || ''
      const isAuthEndpoint =
        requestUrl.includes(ENDPOINTS.AUTH.USER.LOGIN) ||
        requestUrl.includes(ENDPOINTS.AUTH.USER.REFRESH) ||
        requestUrl.includes(ENDPOINTS.AUTH.CLIENT.LOGIN)

      // 1. En endpoints de autenticación directa, propagar para manejo en el formulario
      if (isAuthEndpoint) {
        return Promise.reject(error)
      }

      const errorData = error.response.data as ApiErrorResponse | undefined
      const errorCode = errorData?.error

      // 2. Acción forzada de cambio de contraseña: el token es válido, dirigir a la vista forzada
      if (errorCode === API_ERROR_CODES.AUTH_PASSWORD_CHANGE_REQUIRED) {
        if (router.currentRoute.value.path !== '/force-password-change') {
          router.push('/force-password-change')
        }
        return Promise.reject(error)
      }

      // 3. Error de sucursal no disponible: no destruir sesión, es un error de contexto/recurso
      if (isBranchScopeError(errorCode)) {
        return Promise.reject(error)
      }

      // 4. Token caducado o revocado: limpiar sesión y dirigir a login
      if (!errorCode || isSessionExpiredError(errorCode)) {
        localStorage.removeItem(APP_CONFIG.TOKEN_KEY)
        if (router.currentRoute.value.path !== '/login') {
          const currentPath = router.currentRoute.value.fullPath
          router.push({
            path: '/login',
            query: currentPath && currentPath !== '/' ? { redirect: currentPath } : undefined
          })
        }
      }
    }

    return Promise.reject(error)
  }
)
