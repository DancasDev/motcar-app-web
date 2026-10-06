import axios, { type InternalAxiosRequestConfig, type AxiosError } from 'axios'
import { ENV } from '@/config/env'
import { APP_CONFIG } from '@/config/constants'
import { ENDPOINTS } from '@/api/endpoints'

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

// Response Interceptor: Capturar 401 y gestionar cierre de sesión
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

      // Si el 401 ocurre en login o refresh, propagar error sin bucle
      if (!isAuthEndpoint) {
        localStorage.removeItem(APP_CONFIG.TOKEN_KEY)
        // Redirigir a login si estamos en el navegador y no estamos ya en /login
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          const currentPath = window.location.pathname + window.location.search
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
        }
      }
    }

    return Promise.reject(error)
  }
)
