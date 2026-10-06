import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { GacClient, FEATURES, type FeatureName, type RawPermissions } from '@dancasdev/gac-client'

export function usePermission() {
  const authStore = useAuthStore()

  // GacClient reactivo indexado según los permisos del usuario autenticado
  const gacClient = computed(() => {
    return GacClient.create({
      permissions: (authStore.permissions || {}) as RawPermissions
    })
  })

  /**
   * Evalúa si el usuario autenticado tiene autorizada una o varias acciones sobre un módulo.
   * Admite nombres de acción ('create', 'read', 'update', 'delete', 'trash', 'dev') o bitmask.
   */
  function can(
    module: string,
    feature: FeatureName | FeatureName[] | number,
    scope?: string
  ): boolean {
    // El rol superadministrador ('admin') posee autorización irrestricta
    if (authStore.userRoleCodes.includes('admin')) {
      return true
    }
    return gacClient.value.can(module, feature, scope)
  }

  /**
   * Verifica si el usuario cuenta con uno o varios de los roles especificados
   */
  function hasRole(roleCode: string | string[]): boolean {
    const roles = Array.isArray(roleCode) ? roleCode : [roleCode]
    return roles.some((r) => authStore.userRoleCodes.includes(r))
  }

  /**
   * Verifica si el usuario tiene acceso general habilitado a un módulo
   */
  function hasModule(module: string, scope?: string): boolean {
    if (authStore.userRoleCodes.includes('admin')) {
      return true
    }
    return gacClient.value.hasModule(module, scope)
  }

  return {
    gacClient,
    can,
    hasRole,
    hasModule,
    FEATURES
  }
}
