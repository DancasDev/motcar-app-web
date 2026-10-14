/**
 * Formatea un valor numérico como moneda en USD ($1,234.56).
 */
export function money(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '$0.00'
  }
  const num = typeof value === 'number' ? value : Number(value)
  if (isNaN(num)) {
    return '$0.00'
  }
  return '$' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Genera un enlace directo a WhatsApp (https://wa.me/<digits>?text=<encoded>).
 * Retorna null si el teléfono no es válido o está vacío.
 */
export function waLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null

  const base = `https://wa.me/${digits}`
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`
  }
  return base
}
