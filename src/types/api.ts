export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

export interface ApiErrorResponse {
  message: string
  errors?: Record<string, string[]>
  statusCode: number
}
