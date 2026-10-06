<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDataQuery } from '@/composables/useDataQuery'
import { useAccessStore } from '../stores/access.store'
import {
  fetchRoles,
  fetchModules,
  fetchRolePermissions,
  fetchAccessUsers,
  fetchUserRoles,
  assignUserRole,
  removeUserRole
} from '../api/access.api'
import type {
  RoleItem,
  ModuleItem,
  RolePermissionItem,
  AccessUserItem,
  UserRoleItem
} from '../types'

const accessStore = useAccessStore()

type AccessTab = 'roles' | 'permissions' | 'assignments'
const activeTab = ref<AccessTab>('roles')

// Helper para parsear nombres localizados
function formatName(name: unknown): string {
  if (!name) return ''
  if (typeof name === 'object') {
    const loc = name as Record<string, string>
    return loc.es || loc.en || Object.values(loc)[0] || ''
  }
  if (typeof name === 'string') {
    try {
      const parsed = JSON.parse(name)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed.es || parsed.en || Object.values(parsed)[0] || name
      }
    } catch {
      return name
    }
  }
  return String(name)
}

// ---------------------------------------------------------------------
// 1. Pestaña: ROLES
// ---------------------------------------------------------------------
const rolesQuery = useDataQuery<RoleItem>(fetchRoles, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name', 'description']
})

const roleHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '140px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Descripción', key: 'description', align: 'start' as const, sortable: false },
  { title: 'Permisos', key: 'permissions_action', align: 'center' as const, sortable: false, width: '150px' },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]

// Modal Crear / Editar Rol
const roleDialog = ref(false)
const isSavingRole = ref(false)
const roleFormError = ref('')
const roleForm = ref({
  id: '' as string | number,
  name: '',
  description: '',
  is_disabled: false
})

function openCreateRoleDialog(): void {
  roleForm.value = { id: '', name: '', description: '', is_disabled: false }
  roleFormError.value = ''
  roleDialog.value = true
}

async function handleSaveRole(): Promise<void> {
  if (!roleForm.value.name.trim()) {
    roleFormError.value = 'El nombre del rol es obligatorio.'
    return
  }
  isSavingRole.value = true
  roleFormError.value = ''
  try {
    if (roleForm.value.id) {
      await accessStore.editExistingRole(roleForm.value.id, {
        name: roleForm.value.name,
        description: roleForm.value.description,
        is_disabled: roleForm.value.is_disabled ? '1' : '0'
      })
    } else {
      await accessStore.saveNewRole({
        name: roleForm.value.name,
        description: roleForm.value.description,
        is_disabled: roleForm.value.is_disabled ? '1' : '0'
      })
    }
    roleDialog.value = false
    await rolesQuery.refresh()
  } catch (err: unknown) {
    roleFormError.value = (err as Error).message || 'Error al guardar el rol.'
  } finally {
    isSavingRole.value = false
  }
}

// Modal Ver Permisos de Rol
const rolePermissionsDialog = ref(false)
const selectedRole = ref<RoleItem | null>(null)
const rolePermissionsList = ref<RolePermissionItem[]>([])
const isLoadingRolePermissions = ref(false)

async function openRolePermissionsDialog(role: RoleItem): Promise<void> {
  selectedRole.value = role
  rolePermissionsDialog.value = true
  isLoadingRolePermissions.value = true
  rolePermissionsList.value = []
  try {
    const res = await fetchRolePermissions(role.id, { itemsPerPage: 100 })
    rolePermissionsList.value = res.data
  } catch {
    rolePermissionsList.value = []
  } finally {
    isLoadingRolePermissions.value = false
  }
}

// ---------------------------------------------------------------------
// 2. Pestaña: PERMISOS Y MÓDULOS
// ---------------------------------------------------------------------
const modulesQuery = useDataQuery<ModuleItem>(fetchModules, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name', 'module_category_code']
})

const moduleHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '180px' },
  { title: 'Módulo', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Categoría', key: 'module_category_name', align: 'start' as const, sortable: false },
  { title: 'Alcance', key: 'scope', align: 'center' as const, sortable: false, width: '130px' },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]

// ---------------------------------------------------------------------
// 3. Pestaña: ASIGNACIONES DE USUARIOS
// ---------------------------------------------------------------------
const usersList = ref<AccessUserItem[]>([])
const selectedUserId = ref<string | number | null>(null)
const userRoles = ref<UserRoleItem[]>([])
const isLoadingUserRoles = ref(false)
const assignRoleDialog = ref(false)
const selectedRoleIdToAssign = ref<string | number | null>(null)
const isAssigningRole = ref(false)

onMounted(async () => {
  await accessStore.loadRolesList()
  const usersRes = await fetchAccessUsers({ itemsPerPage: 100 })
  usersList.value = usersRes.data
  if (usersList.value.length > 0) {
    selectedUserId.value = usersList.value[0].id
    await loadSelectedUserRoles()
  }
})

async function loadSelectedUserRoles(): Promise<void> {
  if (!selectedUserId.value) return
  isLoadingUserRoles.value = true
  try {
    const res = await fetchUserRoles(selectedUserId.value, { itemsPerPage: 50 })
    userRoles.value = res.data
  } catch {
    userRoles.value = []
  } finally {
    isLoadingUserRoles.value = false
  }
}

async function handleAssignRole(): Promise<void> {
  if (!selectedUserId.value || !selectedRoleIdToAssign.value) return
  isAssigningRole.value = true
  try {
    await assignUserRole(selectedUserId.value, {
      role_id: selectedRoleIdToAssign.value,
      priority: userRoles.value.length + 1
    })
    assignRoleDialog.value = false
    selectedRoleIdToAssign.value = null
    await loadSelectedUserRoles()
  } finally {
    isAssigningRole.value = false
  }
}

async function handleRemoveUserRole(roleEntityId: string | number): Promise<void> {
  if (!selectedUserId.value) return
  isLoadingUserRoles.value = true
  try {
    await removeUserRole(selectedUserId.value, roleEntityId)
    await loadSelectedUserRoles()
  } finally {
    isLoadingUserRoles.value = false
  }
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-card elevation="2" rounded="lg">
        <v-card-item class="pb-2">
          <div class="d-flex align-center justify-space-between flex-wrap ga-3">
            <div>
              <v-card-title class="text-h5 font-weight-bold d-flex align-center">
                <v-icon icon="mdi-shield-lock-outline" color="primary" class="mr-2" />
                Control de Acceso y RBAC (GAC)
              </v-card-title>
              <v-card-subtitle>
                Gestión granular de roles, permisos, módulos y asignaciones de usuario
              </v-card-subtitle>
            </div>
            <v-chip color="primary" variant="tonal">
              <v-icon start icon="mdi-security" />
              @dancasdev/gac-client
            </v-chip>
          </div>
        </v-card-item>

        <!-- Selector de Pestañas -->
        <v-tabs v-model="activeTab" color="primary" class="border-b px-4">
          <v-tab value="roles" class="text-none" data-testid="tab-roles">
            <v-icon start icon="mdi-account-key-outline" />
            Roles ({{ rolesQuery.totalItems.value }})
          </v-tab>
          <v-tab value="permissions" class="text-none" data-testid="tab-permissions">
            <v-icon start icon="mdi-view-module-outline" />
            Módulos y Permisos ({{ modulesQuery.totalItems.value }})
          </v-tab>
          <v-tab value="assignments" class="text-none" data-testid="tab-assignments">
            <v-icon start icon="mdi-account-switch-outline" />
            Asignaciones de Usuarios
          </v-tab>
        </v-tabs>

        <v-card-text class="pt-4">
          <!-- 1. Pestaña de ROLES -->
          <div v-if="activeTab === 'roles'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="rolesQuery.search.value"
                placeholder="Buscar rol por nombre o código..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-roles"
              />

              <div class="d-flex align-center ga-2">
                <v-btn
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="small"
                  :loading="rolesQuery.isLoading.value"
                  @click="rolesQuery.refresh()"
                >
                  Actualizar
                </v-btn>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  size="small"
                  data-testid="btn-create-role"
                  @click="openCreateRoleDialog"
                >
                  Nuevo Rol
                </v-btn>
              </div>
            </div>

            <v-data-table-server
              :headers="roleHeaders"
              :items="rolesQuery.items.value"
              :items-length="rolesQuery.totalItems.value"
              :loading="rolesQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="roles-table"
              @update:options="rolesQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <v-chip size="small" color="primary" variant="flat" label>
                  {{ item.code || 'custom' }}
                </v-chip>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
              </template>

              <template #[`item.description`]="{ item }">
                <span class="text-body-2">{{ formatName(item.description) }}</span>
              </template>

              <template #[`item.permissions_action`]="{ item }">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="mdi-lock-open-outline"
                  class="text-none font-weight-medium"
                  data-testid="btn-view-role-permissions"
                  @click="openRolePermissionsDialog(item)"
                >
                  Ver Permisos
                </v-btn>
              </template>

              <template #[`item.is_disabled`]="{ item }">
                <v-chip
                  size="small"
                  :color="item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled ? 'success' : 'error'"
                  variant="tonal"
                >
                  {{ item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled ? 'Activo' : 'Inactivo' }}
                </v-chip>
              </template>
            </v-data-table-server>
          </div>

          <!-- 2. Pestaña de MÓDULOS Y PERMISOS -->
          <div v-else-if="activeTab === 'permissions'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="modulesQuery.search.value"
                placeholder="Buscar módulo por código o nombre..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-modules"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="modulesQuery.isLoading.value"
                @click="modulesQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="moduleHeaders"
              :items="modulesQuery.items.value"
              :items-length="modulesQuery.totalItems.value"
              :loading="modulesQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="modules-table"
              @update:options="modulesQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <span class="font-mono text-body-2 font-weight-bold">{{ item.code }}</span>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
              </template>

              <template #[`item.module_category_name`]="{ item }">
                <v-chip size="small" variant="tonal" color="info">
                  {{ formatName(item.module_category_name) }}
                </v-chip>
              </template>

              <template #[`item.scope`]="{ item }">
                <span class="text-caption text-grey-darken-1">{{ item.scope || '*' }}</span>
              </template>

              <template #[`item.is_disabled`]="{ item }">
                <v-chip
                  size="small"
                  :color="item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled ? 'success' : 'error'"
                  variant="tonal"
                >
                  {{ item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled ? 'Activo' : 'Inactivo' }}
                </v-chip>
              </template>
            </v-data-table-server>
          </div>

          <!-- 3. Pestaña de ASIGNACIONES -->
          <div v-else-if="activeTab === 'assignments'">
            <v-row class="mb-4">
              <v-col cols="12" sm="6" md="4">
                <v-select
                  v-model="selectedUserId"
                  :items="usersList"
                  item-title="username"
                  item-value="id"
                  label="Seleccionar Usuario"
                  variant="outlined"
                  density="compact"
                  prepend-inner-icon="mdi-account"
                  data-testid="select-user-assignment"
                  @update:model-value="loadSelectedUserRoles"
                />
              </v-col>
              <v-col cols="12" sm="6" md="8" class="d-flex align-center justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  size="small"
                  :disabled="!selectedUserId"
                  data-testid="btn-open-assign-role"
                  @click="assignRoleDialog = true"
                >
                  Asignar Rol al Usuario
                </v-btn>
              </v-col>
            </v-row>

            <v-card variant="outlined" rounded="lg">
              <v-card-item class="bg-grey-lighten-4 py-2">
                <v-card-title class="text-subtitle-2 font-weight-bold">
                  Roles Asignados al Usuario Seleccionado
                </v-card-title>
              </v-card-item>

              <div v-if="isLoadingUserRoles" class="text-center py-6">
                <v-progress-circular indeterminate color="primary" />
              </div>

              <div v-else-if="userRoles.length === 0" class="text-center py-6 text-grey text-caption">
                No hay roles asignados para este usuario.
              </div>

              <v-list v-else lines="two">
                <v-list-item
                  v-for="ur in userRoles"
                  :key="ur.id"
                  class="border-b"
                >
                  <template #prepend>
                    <v-icon icon="mdi-shield-check" color="primary" />
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ formatName(ur.role_name) }}
                    <v-chip size="x-small" color="primary" variant="flat" class="ml-2" label>
                      {{ ur.role_code }}
                    </v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    Prioridad: {{ ur.priority || '0' }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-btn
                      icon="mdi-delete-outline"
                      color="error"
                      variant="text"
                      size="small"
                      title="Quitar rol"
                      data-testid="btn-remove-user-role"
                      @click="handleRemoveUserRole(ur.id)"
                    />
                  </template>
                </v-list-item>
              </v-list>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Diálogo Crear / Editar Rol -->
    <v-dialog v-model="roleDialog" max-width="500" data-testid="role-form-dialog">
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white">
          <v-card-title class="text-h6 font-weight-bold">
            {{ roleForm.id ? 'Editar Rol' : 'Crear Nuevo Rol' }}
          </v-card-title>
        </v-card-item>

        <v-card-text class="pt-4">
          <v-alert
            v-if="roleFormError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            {{ roleFormError }}
          </v-alert>

          <v-text-field
            v-model="roleForm.name"
            label="Nombre del Rol *"
            placeholder="ej. Auditor"
            variant="outlined"
            density="comfortable"
            class="mb-2"
            data-testid="input-role-name"
          />

          <v-textarea
            v-model="roleForm.description"
            label="Descripción"
            placeholder="Descripción de las responsabilidades del rol"
            variant="outlined"
            density="comfortable"
            rows="3"
            class="mb-2"
            data-testid="input-role-desc"
          />

          <v-switch
            v-model="roleForm.is_disabled"
            label="Inhabilitar Rol"
            color="error"
            hide-details
            density="compact"
          />
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4 justify-end ga-2">
          <v-btn
            variant="outlined"
            @click="roleDialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="isSavingRole"
            data-testid="btn-save-role"
            @click="handleSaveRole"
          >
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo Ver Permisos de Rol -->
    <v-dialog v-model="rolePermissionsDialog" max-width="640" data-testid="role-permissions-dialog">
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-lock-open-outline" class="mr-2" />
            Permisos de Rol: {{ selectedRole ? formatName(selectedRole.name) : '' }}
          </v-card-title>
        </v-card-item>

        <v-card-text class="pt-4">
          <div v-if="isLoadingRolePermissions" class="text-center py-6">
            <v-progress-circular indeterminate color="primary" />
          </div>

          <div v-else-if="rolePermissionsList.length === 0" class="text-center py-6 text-grey text-caption">
            No se encontraron permisos explícitos para este rol.
          </div>

          <v-list v-else lines="two" max-height="400" class="overflow-y-auto">
            <v-list-item
              v-for="rp in rolePermissionsList"
              :key="rp.id"
              class="border-b"
            >
              <v-list-item-title class="font-weight-medium">
                {{ formatName(rp.module_name) }}
                <v-chip size="x-small" color="secondary" variant="flat" class="ml-2 font-mono">
                  {{ rp.module_code }}
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                Feature Bitmask: {{ rp.feature }} | Alcance: {{ rp.scope_path || '*' }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4 justify-end">
          <v-btn
            variant="tonal"
            color="primary"
            @click="rolePermissionsDialog = false"
          >
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Diálogo Asignar Rol a Usuario -->
    <v-dialog v-model="assignRoleDialog" max-width="480">
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white">
          <v-card-title>Asignar Rol</v-card-title>
        </v-card-item>
        <v-card-text class="pt-4">
          <v-select
            v-model="selectedRoleIdToAssign"
            :items="accessStore.roles"
            :item-title="(r) => formatName(r.name)"
            item-value="id"
            label="Selecciona un Rol *"
            variant="outlined"
            density="comfortable"
          />
        </v-card-text>
        <v-card-actions class="pa-4 justify-end ga-2">
          <v-btn variant="outlined" @click="assignRoleDialog = false">Cancelar</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="isAssigningRole"
            :disabled="!selectedRoleIdToAssign"
            @click="handleAssignRole"
          >
            Asignar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>
