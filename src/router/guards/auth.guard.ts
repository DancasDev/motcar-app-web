import type { Router } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/auth.store'

export function setupAuthGuard(router: Router): void {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()

    // Si hay un token persistido pero no se ha cargado el usuario, intentar resolverlo
    if (authStore.isAuthenticated && !authStore.user) {
      try {
        await authStore.fetchCurrentUser()
      } catch {
        // En caso de fallo (token revocado o expirado), continuar hacia la lógica de guardia
        authStore.clearSession()
      }
    }

    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const isGuestOnly = to.matched.some((record) => record.meta.guestOnly)
    const isForcedRoute = to.matched.some((record) => record.meta.isForced)

    if (requiresAuth && !authStore.isAuthenticated) {
      return next({
        path: '/login',
        query: { redirect: to.fullPath !== '/' ? to.fullPath : undefined }
      })
    }

    if (isGuestOnly && authStore.isAuthenticated) {
      return next({ path: '/' })
    }

    // Manejo de acciones forzadas (force_to: '0' cambio obligatorio de clave)
    if (authStore.isAuthenticated) {
      const forceToFlags = Array.isArray(authStore.forceTo)
        ? authStore.forceTo.map(String)
        : (typeof authStore.forceTo === 'string' ? (authStore.forceTo as string).split(',').map((s) => s.trim()) : [])

      const hasForcePassword = forceToFlags.includes('0')

      if (hasForcePassword && !isForcedRoute) {
        return next({ path: '/force-password-change' })
      }

      if (!hasForcePassword && isForcedRoute) {
        return next({ path: '/' })
      }
    }

    return next()
  })
}
