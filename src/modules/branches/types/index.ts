export interface BranchItem {
  id: string | number
  parent_id: string | number | null
  parent_name?: string | null
  name: string
  is_disabled: string | boolean | number
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface BranchTreeNode {
  parent_id: string | number | null
  scope: string
  name: string
  depth?: number
  is_disabled: boolean
  deleted_at?: string | null
  children_count_all: number
  children_count_available: number
  is_inherited_disabled: boolean
  is_inherited_deleted?: boolean
}

export type BranchTreeMap = Record<string, BranchTreeNode>

export interface CreateBranchPayload {
  name: string
  parent_id?: string | number | null
  is_disabled?: string | boolean | number
}

export interface UpdateBranchPayload {
  name?: string
  parent_id?: string | number | null
  is_disabled?: string | boolean | number
}
