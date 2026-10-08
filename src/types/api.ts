export interface ApiMessages {
  success?: string
  error?: string
  warning?: string
  info?: string
  [field: string]: string | undefined
}

export interface ApiResponse<T = unknown> {
  status: number
  data: T
  messages?: ApiMessages
  error?: string
}

export interface ApiErrorResponse {
  status: number
  error?: string
  messages?: ApiMessages
  errors?: Record<string, string[]>
}

export interface PaginatedList<T> {
  items: T[]
  total?: number
  page?: number
  itemsPerPage?: number
}
