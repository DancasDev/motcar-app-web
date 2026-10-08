/**
 * Catálogo de códigos de error estándar de la API
 * Basado en la especificación opencollection.yml (Sección 8: Diccionario de Errores)
 */
export const API_ERROR_CODES = {
  // 1. Errores de Autenticación y Token (HTTP 401 / 400)
  AUTH_TOKEN_IS_REQUIRED: 'AUTH_TOKEN_IS_REQUIRED',
  AUTH_TOKEN_IS_INVALID: 'AUTH_TOKEN_IS_INVALID',
  AUTH_TOKEN_IS_EXPIRED: 'AUTH_TOKEN_IS_EXPIRED',
  AUTH_TOKEN_IS_DISABLED: 'AUTH_TOKEN_IS_DISABLED',
  AUTH_TOKEN_IS_REFUSED: 'AUTH_TOKEN_IS_REFUSED',
  AUTH_TOKEN_UPDATE_INVALID: 'AUTH_TOKEN_UPDATE_INVALID',
  AUTH_ONLY_USER: 'AUTH_ONLY_USER',
  AUTH_ONLY_CLIENT: 'AUTH_ONLY_CLIENT',
  AUTH_USER_COMBINATION_NOT_FOUND: 'AUTH_USER_COMBINATION_NOT_FOUND',
  AUTH_USER_ATTEMPTS_EXCEEDED: 'AUTH_USER_ATTEMPTS_EXCEEDED',
  AUTH_CLIENT_ATTEMPTS_EXCEEDED: 'AUTH_CLIENT_ATTEMPTS_EXCEEDED',

  // 2. Acciones Forzadas Pendientes (HTTP 401)
  AUTH_PASSWORD_CHANGE_REQUIRED: 'AUTH_PASSWORD_CHANGE_REQUIRED',
  AUTH_EMAIL_VERIFICATION_REQUIRED: 'AUTH_EMAIL_VERIFICATION_REQUIRED',

  // 3. Alcance de Sucursal y Autorización (HTTP 401 / 403)
  AUTH_BRANCH_NOT_AVAILABLE: 'AUTH_BRANCH_NOT_AVAILABLE',
  AUTH_PERMISSION_REFUSED: 'AUTH_PERMISSION_REFUSED',
  AUTH_PERMISSION_MODULE_IS_DEVELOPING: 'AUTH_PERMISSION_MODULE_IS_DEVELOPING',
  AUTH_PERMISSION_REFUSED_ACTION: 'AUTH_PERMISSION_REFUSED_ACTION',

  // 4. Validación y Consulta (HTTP 400 / 404)
  FAIL_VALIDATION: 'FAIL_VALIDATION',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  UPDATE_EMPTY_ITEM: 'UPDATE_EMPTY_ITEM',
  INPUT_INVALID: 'INPUT_INVALID'
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

const SESSION_EXPIRED_CODES: ReadonlySet<string> = new Set([
  API_ERROR_CODES.AUTH_TOKEN_IS_EXPIRED,
  API_ERROR_CODES.AUTH_TOKEN_IS_INVALID,
  API_ERROR_CODES.AUTH_TOKEN_IS_DISABLED,
  API_ERROR_CODES.AUTH_TOKEN_IS_REFUSED,
  API_ERROR_CODES.AUTH_TOKEN_IS_REQUIRED,
  API_ERROR_CODES.AUTH_ONLY_USER,
  API_ERROR_CODES.AUTH_ONLY_CLIENT
])

const FORCED_ACTION_CODES: ReadonlySet<string> = new Set([
  API_ERROR_CODES.AUTH_PASSWORD_CHANGE_REQUIRED,
  API_ERROR_CODES.AUTH_EMAIL_VERIFICATION_REQUIRED
])

/**
 * Determina si el código de error indica que el token de sesión ha expirado,
 * es inválido o fue revocado en el servidor.
 */
export function isSessionExpiredError(code?: string): boolean {
  if (!code) return false
  return SESSION_EXPIRED_CODES.has(code)
}

/**
 * Determina si el código de error indica una acción obligatoria del usuario
 * (el token es válido, pero el acceso general está condicionado a resolver la acción).
 */
export function isForcedActionError(code?: string): boolean {
  if (!code) return false
  return FORCED_ACTION_CODES.has(code)
}

/**
 * Determina si el código de error se refiere a la indisponibilidad de una sucursal en el scope.
 */
export function isBranchScopeError(code?: string): boolean {
  return code === API_ERROR_CODES.AUTH_BRANCH_NOT_AVAILABLE
}
