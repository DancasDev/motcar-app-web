import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchModules,
  fetchModuleCategories,
  fetchAccessUsers,
  fetchClients
} from '../api/access.api'
import type {
  RoleItem,
  RolePayload,
  ModuleItem,
  CategoryItem,
  AccessUserItem,
  ClientItem
} from '../types'

export const useAccessStore = defineStore('access', () => {
  const roles = ref<RoleItem[]>([])
  const modules = ref<ModuleItem[]>([])
  const categories = ref<CategoryItem[]>([])
  const users = ref<AccessUserItem[]>([])
  const clients = ref<ClientItem[]>([])
  const isLoading = ref(false)

  async function loadRolesList(force = false): Promise<RoleItem[]> {
    if (roles.value.length > 0 && !force) return roles.value
    isLoading.value = true
    try {
      const res = await fetchRoles({ itemsPerPage: 100 })
      roles.value = res.data
      return roles.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadModulesList(force = false): Promise<ModuleItem[]> {
    if (modules.value.length > 0 && !force) return modules.value
    isLoading.value = true
    try {
      const res = await fetchModules({ itemsPerPage: 100 })
      modules.value = res.data
      return modules.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadCategoriesList(force = false): Promise<CategoryItem[]> {
    if (categories.value.length > 0 && !force) return categories.value
    isLoading.value = true
    try {
      const res = await fetchModuleCategories({ itemsPerPage: 100 })
      categories.value = res.data
      return categories.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadUsersList(force = false): Promise<AccessUserItem[]> {
    if (users.value.length > 0 && !force) return users.value
    isLoading.value = true
    try {
      const res = await fetchAccessUsers({ itemsPerPage: 100 })
      users.value = res.data
      return users.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadClientsList(force = false): Promise<ClientItem[]> {
    if (clients.value.length > 0 && !force) return clients.value
    isLoading.value = true
    try {
      const res = await fetchClients({ itemsPerPage: 100 })
      clients.value = res.data
      return clients.value
    } finally {
      isLoading.value = false
    }
  }

  async function saveNewRole(payload: RolePayload): Promise<number> {
    const res = await createRole(payload)
    await loadRolesList(true)
    return res.data.id
  }

  async function editExistingRole(
    id: string | number,
    payload: Partial<RolePayload>
  ): Promise<void> {
    await updateRole(id, payload)
    await loadRolesList(true)
  }

  async function removeExistingRole(id: string | number): Promise<void> {
    await deleteRole(id)
    await loadRolesList(true)
  }

  return {
    roles,
    modules,
    categories,
    users,
    clients,
    isLoading,
    loadRolesList,
    loadModulesList,
    loadCategoriesList,
    loadUsersList,
    loadClientsList,
    saveNewRole,
    editExistingRole,
    removeExistingRole
  }
})
