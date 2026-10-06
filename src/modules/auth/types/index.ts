import type { ApiResponse } from '@/types/api'

export type { ApiResponse }

export interface LoginUserRequest {
  username: string
  password: string
}

export interface LoginClientRequest {
  client_id: string
  client_secret: string
}

export interface AuthTokenData {
  token: string
  expires_at: number
  refresh_at: number
  force_to: string[] | null
}

export interface AuthUser {
  id: string | number
  username: string
  first_name: string
  last_name: string | null
  sex: string | null
  email: string
  photo_url: string | null
  signature_url: string | null
  country_code: string | null
  country_name: string | null
  time_zone_code: string | null
  language_code: string
  language_name: string | null
}

export interface AuthRole {
  id: string | number
  code: string
  name: string
}

export interface GacPermissionRule {
  s: string // scope / wildcard
  i: number // index / priority
  d: string // disabled status
  f: number // flags (bitmask)
  l: number // level
  p: string | null // parameters / filters
}

export type AuthPermissionsMap = Record<string, GacPermissionRule[]>

export interface AuthBranchNode {
  parent_id: string | number | null
  scope: string
  name: string
  is_disabled: boolean
  deleted_at: string | null
  children_count_all: number
  children_count_available: number
  is_inherited_disabled: boolean
}

export interface AuthUserData {
  user: AuthUser
  role: AuthRole[]
  permission?: AuthPermissionsMap
  branch?: Record<string, AuthBranchNode> | AuthBranchNode[]
}

export interface AuthClient {
  id: string | number
  name: string
  description?: string | null
}

export interface AuthClientData {
  client: AuthClient
  role: AuthRole[]
  permission?: AuthPermissionsMap
}

export interface UpdateUserSignatureRequest {
  signature_url: string
}

export interface UserSignatureResponse {
  signature_url: string
}
