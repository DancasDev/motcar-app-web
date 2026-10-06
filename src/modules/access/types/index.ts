export interface RoleItem {
  id: string | number
  code?: string
  name: string | Record<string, string>
  description?: string | null
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface RolePayload {
  name: string
  description?: string | null
  is_disabled?: string | number
}

export interface RolePermissionItem {
  id: string | number
  module_id: string | number
  module_code?: string
  module_name?: string | Record<string, string>
  scope_path?: string | null
  feature: string | number
  level?: string | number
  payload?: Record<string, unknown> | null
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface CreateRolePermissionPayload {
  module_id: string | number
  scope_path?: string
  feature: number
  level?: string
  payload?: Record<string, unknown> | null
  is_disabled?: string
}

export interface ModuleItem {
  id: string | number
  module_category_id: string | number
  module_category_code?: string
  module_category_name?: string | Record<string, string>
  code: string
  name: string | Record<string, string>
  description?: string | Record<string, string> | null
  scope?: string
  is_developing?: string | number
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface CategoryItem {
  id: string | number
  code: string
  name: string | Record<string, string>
  description?: string | Record<string, string> | null
  scope?: string
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface AccessUserItem {
  id: string | number
  username: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  is_disabled: string | number | boolean
  created_at?: string
  updated_at?: string | null
}

export interface UserRoleItem {
  id: string | number
  role_id: string | number
  role_code?: string
  role_name?: string | Record<string, string>
  priority?: string | number
  is_disabled: string | number | boolean
  created_at?: string
}

export interface AssignUserRolePayload {
  role_id: string | number
  priority?: number
  is_disabled?: string
}

export interface ClientItem {
  id: string | number
  name: string
  description?: string | null
  is_disabled: string | number | boolean
  created_at?: string
}

export interface ClientRoleItem {
  id: string | number
  role_id: string | number
  role_code?: string
  role_name?: string | Record<string, string>
  priority?: string | number
  is_disabled: string | number | boolean
  created_at?: string
}
