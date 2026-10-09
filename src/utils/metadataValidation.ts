/**
 * Utilidades para compilación de reglas de validación y resolución i18n
 * compatibles con el motor de metadatos de motcar-api.
 */

export interface MetadataRuleItem {
  code: string
  params?: Record<string, any> | null
  [key: string]: any
}

export type LocalizedString = string | Record<string, string> | null | undefined

/**
 * Resuelve una cadena que puede estar en formato i18n objeto (ej: { es: "Nombre", en: "Name" })
 * o como cadena plana.
 */
export function resolveI18n(val: LocalizedString, locale: string = 'es'): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'object') {
    return val[locale] || val['es'] || val['en'] || Object.values(val)[0] || ''
  }
  return String(val)
}

export type VuetifyValidationRule = (value: any) => boolean | string

/**
 * Convierte un array de reglas de la API (glb_metadata_field_rule) a reglas de Vuetify
 */
export function compileMetadataRules(
  rawRules: MetadataRuleItem[] | string | Record<string, any> | null | undefined,
  fieldLabel: string
): VuetifyValidationRule[] {
  if (!rawRules) return []

  let rulesList: MetadataRuleItem[] = []

  if (Array.isArray(rawRules)) {
    rulesList = rawRules
  } else if (typeof rawRules === 'string') {
    try {
      const parsed = JSON.parse(rawRules)
      if (Array.isArray(parsed)) {
        rulesList = parsed
      }
    } catch {
      return []
    }
  } else if (typeof rawRules === 'object') {
    rulesList = Object.entries(rawRules).map(([code, params]) => ({
      code,
      params: typeof params === 'object' && params !== null ? params : { value: params }
    }))
  }

  const vuetifyRules: VuetifyValidationRule[] = []
  const label = fieldLabel || 'Este campo'

  for (const rule of rulesList) {
    if (!rule || !rule.code) continue
    const code = String(rule.code).toLowerCase()
    const params = rule.params || {}
    const ruleVal = params.value !== undefined ? params.value : params

    switch (code) {
      case 'required':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined) return `${label} es obligatorio.`
          if (typeof v === 'string' && v.trim() === '') return `${label} es obligatorio.`
          if (Array.isArray(v) && v.length === 0) return `${label} es obligatorio.`
          return true
        })
        break

      case 'min_length': {
        const min = Number(ruleVal)
        if (!isNaN(min)) {
          vuetifyRules.push((v: any) => {
            if (!v && v !== 0) return true
            if (Array.isArray(v)) {
              return v.length >= min || `${label} debe contener al menos ${min} elementos.`
            }
            return String(v).length >= min || `${label} debe tener al menos ${min} caracteres.`
          })
        }
        break
      }

      case 'max_length': {
        const max = Number(ruleVal)
        if (!isNaN(max)) {
          vuetifyRules.push((v: any) => {
            if (!v && v !== 0) return true
            if (Array.isArray(v)) {
              return v.length <= max || `${label} no puede contener más de ${max} elementos.`
            }
            return String(v).length <= max || `${label} no puede exceder ${max} caracteres.`
          })
        }
        break
      }

      case 'exact_length': {
        const exact = Number(ruleVal)
        if (!isNaN(exact)) {
          vuetifyRules.push((v: any) => {
            if (!v && v !== 0) return true
            if (Array.isArray(v)) {
              return v.length === exact || `${label} debe contener exactamente ${exact} elementos.`
            }
            return String(v).length === exact || `${label} debe tener exactamente ${exact} caracteres.`
          })
        }
        break
      }

      case 'greater_than': {
        const val = Number(ruleVal)
        if (!isNaN(val)) {
          vuetifyRules.push((v: any) => {
            if (v === null || v === undefined || v === '') return true
            return Number(v) > val || `${label} debe ser mayor que ${val}.`
          })
        }
        break
      }

      case 'greater_than_equal_to': {
        const val = Number(ruleVal)
        if (!isNaN(val)) {
          vuetifyRules.push((v: any) => {
            if (v === null || v === undefined || v === '') return true
            return Number(v) >= val || `${label} debe ser mayor o igual que ${val}.`
          })
        }
        break
      }

      case 'less_than': {
        const val = Number(ruleVal)
        if (!isNaN(val)) {
          vuetifyRules.push((v: any) => {
            if (v === null || v === undefined || v === '') return true
            return Number(v) < val || `${label} debe ser menor que ${val}.`
          })
        }
        break
      }

      case 'less_than_equal_to': {
        const val = Number(ruleVal)
        if (!isNaN(val)) {
          vuetifyRules.push((v: any) => {
            if (v === null || v === undefined || v === '') return true
            return Number(v) <= val || `${label} debe ser menor o igual que ${val}.`
          })
        }
        break
      }

      case 'numeric':
      case 'decimal':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined || v === '') return true
          return !isNaN(Number(v)) || `${label} debe ser un valor numérico.`
        })
        break

      case 'integer':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined || v === '') return true
          return Number.isInteger(Number(v)) || `${label} debe ser un número entero.`
        })
        break

      case 'is_natural':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined || v === '') return true
          const n = Number(v)
          return (Number.isInteger(n) && n >= 0) || `${label} debe ser un número entero no negativo.`
        })
        break

      case 'is_natural_no_zero':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined || v === '') return true
          const n = Number(v)
          return (Number.isInteger(n) && n > 0) || `${label} debe ser un entero mayor a cero.`
        })
        break

      case 'valid_email':
      case 'email':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
          return emailRegex.test(String(v).trim()) || 'El correo electrónico no es válido.'
        })
        break

      case 'valid_emails':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const emails = Array.isArray(v)
            ? v
            : String(v)
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean)
          const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
          const allValid = emails.every((e: any) => emailRegex.test(String(e).trim()))
          return allValid || 'Todos los correos electrónicos deben ser válidos.'
        })
        break

      case 'valid_url':
      case 'valid_url_strict':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const urls = Array.isArray(v) ? v : [v]
          if (urls.length === 0) return true

          for (const item of urls) {
            if (!item) continue
            try {
              const parsed = new URL(String(item))
              if (!['http:', 'https:'].includes(parsed.protocol)) {
                return Array.isArray(v)
                  ? 'Cada archivo debe ser una URL válida (http/https).'
                  : 'Debe ser una URL válida (http/https).'
              }
            } catch {
              return Array.isArray(v)
                ? 'Cada archivo debe ser una URL válida.'
                : 'Debe ser una URL válida.'
            }
          }
          return true
        })
        break

      case 'regex_match': {
        if (ruleVal) {
          try {
            const regex = new RegExp(String(ruleVal))
            vuetifyRules.push((v: any) => {
              if (!v) return true
              return regex.test(String(v)) || `${label} tiene un formato no válido.`
            })
          } catch {
            // regex inválida ignorada
          }
        }
        break
      }

      case 'in_list': {
        if (ruleVal) {
          const list = String(ruleVal).split(',').map((s) => s.trim())
          vuetifyRules.push((v: any) => {
            if (!v) return true
            if (Array.isArray(v)) {
              return v.every((val) => list.includes(String(val))) || `${label} contiene valores no permitidos.`
            }
            return list.includes(String(v)) || `${label} debe ser uno de: ${list.join(', ')}.`
          })
        }
        break
      }

      case 'not_in_list': {
        if (ruleVal) {
          const list = String(ruleVal).split(',').map((s) => s.trim())
          vuetifyRules.push((v: any) => {
            if (!v) return true
            if (Array.isArray(v)) {
              return !v.some((val) => list.includes(String(val))) || `${label} contiene valores restringidos.`
            }
            return !list.includes(String(v)) || `${label} no puede ser uno de: ${list.join(', ')}.`
          })
        }
        break
      }

      case 'alpha':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+$/.test(String(v)) || `${label} solo debe contener letras.`
        })
        break

      case 'alpha_space':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(String(v)) || `${label} solo debe contener letras y espacios.`
        })
        break

      case 'alpha_dash':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ_-]+$/.test(String(v)) || `${label} solo debe contener letras, números, guiones y guiones bajos.`
        })
        break

      case 'alpha_numeric':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]+$/.test(String(v)) || `${label} solo debe contener letras y números.`
        })
        break

      case 'alpha_numeric_space':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(String(v)) || `${label} solo debe contener letras, números y espacios.`
        })
        break

      case 'alpha_numeric_punct':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[\p{L}\p{N}\p{P}\p{Z}\s]+$/u.test(String(v)) || `${label} solo debe contener caracteres alfanuméricos y puntuación.`
        })
        break

      case 'string':
        vuetifyRules.push((v: any) => {
          if (v === null || v === undefined) return true
          return typeof v === 'string' || `${label} debe ser una cadena de texto.`
        })
        break

      case 'hex':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          return /^[0-9a-fA-F]+$/.test(String(v)) || `${label} debe ser un valor hexadecimal.`
        })
        break

      case 'valid_base64':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
          return base64Regex.test(String(v).trim()) || `${label} debe ser una cadena base64 válida.`
        })
        break

      case 'valid_json':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          try {
            JSON.parse(String(v))
            return true
          } catch {
            return `${label} debe ser un JSON válido.`
          }
        })
        break

      case 'valid_ip':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
          const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
          return ipv4Regex.test(String(v).trim()) || ipv6Regex.test(String(v).trim()) || `${label} debe ser una dirección IP válida.`
        })
        break

      case 'timezone':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          try {
            Intl.DateTimeFormat(undefined, { timeZone: String(v) })
            return true
          } catch {
            return `${label} debe ser una zona horaria válida.`
          }
        })
        break

      case 'valid_date':
        vuetifyRules.push((v: any) => {
          if (!v) return true
          const date = new Date(String(v))
          return !isNaN(date.getTime()) || `${label} debe ser una fecha válida.`
        })
        break

      case 'date_greater_than': {
        if (ruleVal) {
          vuetifyRules.push((v: any) => {
            if (!v) return true
            return new Date(String(v)) > new Date(String(ruleVal)) || `${label} debe ser posterior a ${ruleVal}.`
          })
        }
        break
      }

      case 'date_greater_than_equal_to': {
        if (ruleVal) {
          vuetifyRules.push((v: any) => {
            if (!v) return true
            return new Date(String(v)) >= new Date(String(ruleVal)) || `${label} debe ser posterior o igual a ${ruleVal}.`
          })
        }
        break
      }

      case 'date_less_than': {
        if (ruleVal) {
          vuetifyRules.push((v: any) => {
            if (!v) return true
            return new Date(String(v)) < new Date(String(ruleVal)) || `${label} debe ser anterior a ${ruleVal}.`
          })
        }
        break
      }

      case 'date_less_than_equal_to': {
        if (ruleVal) {
          vuetifyRules.push((v: any) => {
            if (!v) return true
            return new Date(String(v)) <= new Date(String(ruleVal)) || `${label} debe ser anterior o igual a ${ruleVal}.`
          })
        }
        break
      }

      default:
        break
    }
  }

  return vuetifyRules
}
