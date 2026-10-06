<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchBranches } from '../api/branches.api'
import { useBranchesStore } from '../stores/branches.store'
import type { BranchItem, CreateBranchPayload, UpdateBranchPayload } from '../types'

const branchesStore = useBranchesStore()

type BranchTab = 'table' | 'tree'
const activeTab = ref<BranchTab>('table')

// ---------------------------------------------------------------------
// 1. Consulta DQB de Sucursales
// ---------------------------------------------------------------------
const branchesQuery = useDataQuery<BranchItem>(fetchBranches, {
  initialItemsPerPage: 10,
  searchFields: ['name']
})

const tableHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '80px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Sucursal Padre', key: 'parent_name', align: 'start' as const, sortable: true },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Sucursal Activa', key: 'active_status', align: 'center' as const, sortable: false, width: '170px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '140px' }
]

// ---------------------------------------------------------------------
// 2. Diálogo de Crear / Editar Sucursal
// ---------------------------------------------------------------------
const formDialogOpen = ref(false)
const isEditing = ref(false)
const editingBranchId = ref<string | number | null>(null)
const isSubmitting = ref(false)

const formData = ref<{
  name: string
  parent_id: string | number | null
  is_disabled: boolean
}>({
  name: '',
  parent_id: null,
  is_disabled: false
})

const parentBranchOptions = computed(() => {
  return branchesStore.branchesList
    .filter((b) => !isEditing.value || String(b.id) !== String(editingBranchId.value))
    .map((b) => ({
      title: `${b.name} (ID: ${b.id})`,
      value: b.id
    }))
})

function openCreateDialog(): void {
  isEditing.value = false
  editingBranchId.value = null
  formData.value = {
    name: '',
    parent_id: null,
    is_disabled: false
  }
  formDialogOpen.value = true
}

function openEditDialog(branch: BranchItem): void {
  isEditing.value = true
  editingBranchId.value = branch.id
  formData.value = {
    name: branch.name,
    parent_id: branch.parent_id,
    is_disabled: branch.is_disabled === '1' || branch.is_disabled === true || branch.is_disabled === 1
  }
  formDialogOpen.value = true
}

// ---------------------------------------------------------------------
// 3. Diálogo de Eliminación
// ---------------------------------------------------------------------
const deleteDialogOpen = ref(false)
const branchToDelete = ref<BranchItem | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(branch: BranchItem): void {
  branchToDelete.value = branch
  deleteDialogOpen.value = true
}

// ---------------------------------------------------------------------
// 4. Feedback Snackbar
// ---------------------------------------------------------------------
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' = 'success'): void {
  snackbar.value = {
    show: true,
    text,
    color
  }
}

// ---------------------------------------------------------------------
// 5. Handlers de Guardar, Eliminar y Selección Activa
// ---------------------------------------------------------------------
async function handleSaveBranch(): Promise<void> {
  if (!formData.value.name.trim()) {
    showMessage('El nombre de la sucursal es obligatorio.', 'error')
    return
  }

  isSubmitting.value = true
  try {
    if (isEditing.value && editingBranchId.value) {
      const payload: UpdateBranchPayload = {
        name: formData.value.name.trim(),
        parent_id: formData.value.parent_id || null,
        is_disabled: formData.value.is_disabled ? '1' : '0'
      }
      await branchesStore.updateBranch(editingBranchId.value, payload)
      showMessage('Sucursal actualizada exitosamente.')
    } else {
      const payload: CreateBranchPayload = {
        name: formData.value.name.trim(),
        parent_id: formData.value.parent_id || null,
        is_disabled: formData.value.is_disabled ? '1' : '0'
      }
      await branchesStore.createBranch(payload)
      showMessage('Sucursal creada exitosamente.')
    }

    formDialogOpen.value = false
    branchesQuery.refresh()
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al procesar la sucursal.'
    showMessage(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

async function handleConfirmDelete(): Promise<void> {
  if (!branchToDelete.value) return
  isDeleting.value = true
  try {
    await branchesStore.deleteBranch(branchToDelete.value.id)
    showMessage('Sucursal eliminada exitosamente.')
    deleteDialogOpen.value = false
    branchToDelete.value = null
    branchesQuery.refresh()
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error al eliminar la sucursal.'
    showMessage(errorMsg, 'error')
  } finally {
    isDeleting.value = false
  }
}

function handleSelectActive(branchId: string | number): void {
  branchesStore.setActiveBranch(branchId)
  showMessage('Sucursal activa actualizada.')
}

async function handleTabChange(tab: unknown): Promise<void> {
  if (tab === 'tree') {
    await branchesStore.loadBranchTree()
  }
}

onMounted(async () => {
  await branchesStore.loadBranches()
})
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-card elevation="2" rounded="lg">
        <!-- Encabezado de Gestión de Sucursales -->
        <v-card-item class="pb-2">
          <div class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div>
              <v-card-title class="text-h5 font-weight-bold d-flex align-center">
                <v-icon icon="mdi-office-building-marker" color="primary" class="mr-2" />
                Gestión de Sucursales
              </v-card-title>
              <v-card-subtitle>
                Administración de la estructura de sucursales, jerarquía y asignación de sucursal activa
              </v-card-subtitle>
            </div>

            <div class="d-flex align-center gap-2 mt-2 mt-sm-0">
              <v-chip
                v-if="branchesStore.activeBranch"
                color="primary"
                variant="tonal"
                class="font-weight-medium"
                data-testid="current-active-branch-chip"
              >
                <v-icon start icon="mdi-check-circle" />
                Sucursal Activa: {{ branchesStore.activeBranch.name }}
              </v-chip>

              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                class="text-none font-weight-bold"
                data-testid="btn-create-branch"
                @click="openCreateDialog"
              >
                Nueva Sucursal
              </v-btn>
            </div>
          </div>
        </v-card-item>

        <!-- Selector de Pestañas: Tabla vs Árbol -->
        <v-tabs
          v-model="activeTab"
          color="primary"
          class="border-b px-4"
          @update:model-value="handleTabChange"
        >
          <v-tab value="table" class="text-none" data-testid="tab-branches-table">
            <v-icon start icon="mdi-format-list-bulleted" />
            Listado de Sucursales ({{ branchesQuery.totalItems.value }})
          </v-tab>
          <v-tab value="tree" class="text-none" data-testid="tab-branches-tree">
            <v-icon start icon="mdi-file-tree" />
            Estructura Jerárquica (Árbol)
          </v-tab>
        </v-tabs>

        <!-- Vista 1: Tabla Paginada con DQB -->
        <v-window v-model="activeTab">
          <v-window-item value="table">
            <v-card-text class="pa-4">
              <!-- Barra de herramientas: Búsqueda y refresco -->
              <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
                <v-text-field
                  v-model="branchesQuery.search.value"
                  prepend-inner-icon="mdi-magnify"
                  placeholder="Buscar sucursal por nombre..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  max-width="360"
                  data-testid="branch-search-input"
                />

                <v-btn
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="small"
                  :loading="branchesQuery.isLoading.value"
                  data-testid="btn-refresh-branches"
                  @click="branchesQuery.refresh()"
                >
                  Actualizar
                </v-btn>
              </div>

              <!-- Tabla de Sucursales -->
              <v-data-table-server
                :headers="tableHeaders"
                :items="branchesQuery.items.value"
                :items-length="branchesQuery.totalItems.value"
                :loading="branchesQuery.isLoading.value"
                density="comfortable"
                hover
                data-testid="branches-table"
                @update:options="branchesQuery.onUpdateOptions"
              >
                <!-- Nombre -->
                <template #[`item.name`]="{ item }">
                  <div class="d-flex align-center">
                    <v-icon
                      :icon="item.parent_id ? 'mdi-office-building' : 'mdi-office-building-cog'"
                      color="primary"
                      size="small"
                      class="mr-2"
                    />
                    <span class="font-weight-medium">{{ item.name }}</span>
                  </div>
                </template>

                <!-- Sucursal Padre -->
                <template #[`item.parent_name`]="{ item }">
                  <span v-if="item.parent_name" class="text-body-2 text-grey-darken-2">
                    {{ item.parent_name }}
                  </span>
                  <v-chip v-else size="x-small" color="blue-grey" variant="tonal" label>
                    Raíz (Principal)
                  </v-chip>
                </template>

                <!-- Estado Activo / Inactivo -->
                <template #[`item.is_disabled`]="{ item }">
                  <v-chip
                    size="small"
                    :color="item.is_disabled === '0' || item.is_disabled === false || item.is_disabled === 0 ? 'success' : 'grey'"
                    variant="tonal"
                    label
                  >
                    {{ item.is_disabled === '0' || item.is_disabled === false || item.is_disabled === 0 ? 'Activa' : 'Inhabilitada' }}
                  </v-chip>
                </template>

                <!-- Sucursal Activa Global -->
                <template #[`item.active_status`]="{ item }">
                  <v-chip
                    v-if="String(branchesStore.activeBranchId) === String(item.id)"
                    color="primary"
                    variant="flat"
                    size="small"
                    prepend-icon="mdi-check-decagram"
                    data-testid="active-branch-chip"
                  >
                    Activa
                  </v-chip>
                  <v-btn
                    v-else
                    size="small"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-cursor-default-click"
                    class="text-none font-weight-medium"
                    data-testid="btn-set-active-branch"
                    @click="handleSelectActive(item.id)"
                  >
                    Seleccionar
                  </v-btn>
                </template>

                <!-- Acciones -->
                <template #[`item.actions`]="{ item }">
                  <div class="d-flex align-center justify-end">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      color="primary"
                      title="Editar"
                      data-testid="btn-edit-branch"
                      @click="openEditDialog(item)"
                    />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      title="Eliminar"
                      data-testid="btn-delete-branch"
                      @click="openDeleteDialog(item)"
                    />
                  </div>
                </template>
              </v-data-table-server>
            </v-card-text>
          </v-window-item>

          <!-- Vista 2: Árbol Jerárquico -->
          <v-window-item value="tree">
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between mb-4">
                <div class="text-subtitle-1 font-weight-bold">
                  Mapa Jerárquico de Sucursales
                </div>
                <v-btn
                  prepend-icon="mdi-refresh"
                  variant="outlined"
                  size="small"
                  :loading="branchesStore.isLoading"
                  data-testid="btn-refresh-tree"
                  @click="branchesStore.loadBranchTree()"
                >
                  Actualizar Árbol
                </v-btn>
              </div>

              <div v-if="branchesStore.isLoading" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" />
              </div>

              <div
                v-else-if="Object.keys(branchesStore.branchTree).length === 0"
                class="text-center py-8 text-grey"
              >
                <v-icon icon="mdi-file-tree-outline" size="large" class="mb-2" />
                <div>No hay sucursales registradas en el árbol.</div>
              </div>

              <v-list v-else lines="two" rounded="lg" class="border">
                <v-list-item
                  v-for="(node, nodeId) in branchesStore.branchTree"
                  :key="nodeId"
                  class="border-b"
                  :style="{ paddingLeft: `${((node.depth ?? 0) * 24) + 16}px` }"
                  data-testid="branch-tree-node"
                >
                  <template #prepend>
                    <v-icon
                      :icon="node.parent_id ? 'mdi-subdirectory-arrow-right' : 'mdi-home-city'"
                      :color="node.parent_id ? 'grey-darken-1' : 'primary'"
                      size="small"
                      class="mr-2"
                    />
                  </template>

                  <v-list-item-title class="font-weight-medium">
                    {{ node.name }}
                    <v-chip
                      size="x-small"
                      class="ml-2"
                      color="info"
                      variant="outlined"
                    >
                      Alcance: {{ node.scope }}
                    </v-chip>
                  </v-list-item-title>

                  <v-list-item-subtitle class="text-caption">
                    Hijas totales: {{ node.children_count_all }} |
                    Hijas activas: {{ node.children_count_available }} |
                    Estado: {{ node.is_disabled ? 'Deshabilitada' : 'Activa' }}
                  </v-list-item-subtitle>

                  <template #append>
                    <v-chip
                      v-if="String(branchesStore.activeBranchId) === String(nodeId)"
                      color="primary"
                      size="x-small"
                      variant="flat"
                    >
                      Activa
                    </v-chip>
                    <v-btn
                      v-else
                      size="x-small"
                      variant="tonal"
                      color="primary"
                      class="text-none ml-2"
                      @click="handleSelectActive(nodeId)"
                    >
                      Activar
                    </v-btn>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-window-item>
        </v-window>
      </v-card>
    </v-col>
  </v-row>

  <!-- Diálogo: Crear / Editar Sucursal -->
  <v-dialog v-model="formDialogOpen" max-width="500" persistent>
    <v-card rounded="lg" data-testid="branch-form-dialog">
      <v-card-title class="bg-primary text-white pa-4 d-flex align-center justify-space-between">
        <span class="text-h6 font-weight-bold">
          {{ isEditing ? 'Editar Sucursal' : 'Nueva Sucursal' }}
        </span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="formDialogOpen = false"
        />
      </v-card-title>

      <v-card-text class="pa-4 pt-6">
        <v-form @submit.prevent="handleSaveBranch">
          <v-text-field
            v-model="formData.name"
            label="Nombre de la Sucursal *"
            placeholder="Ej. Sucursal Central, Sucursal Norte"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            required
            data-testid="branch-name-input"
          />

          <v-select
            v-model="formData.parent_id"
            :items="parentBranchOptions"
            label="Sucursal Padre (Opcional)"
            placeholder="Dejar vacío para sucursal principal / raíz"
            variant="outlined"
            density="comfortable"
            clearable
            class="mb-3"
            hint="Si se omite, se registra como nodo raíz"
            persistent-hint
            data-testid="branch-parent-select"
          />

          <v-switch
            v-model="formData.is_disabled"
            label="Inhabilitar sucursal"
            color="error"
            density="compact"
            hide-details
            class="mt-2"
            data-testid="branch-status-select"
          />
        </v-form>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4 justify-end">
        <v-btn
          variant="text"
          class="text-none"
          data-testid="btn-cancel-branch"
          @click="formDialogOpen = false"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="text-none font-weight-bold"
          :loading="isSubmitting"
          data-testid="btn-save-branch"
          @click="handleSaveBranch"
        >
          {{ isEditing ? 'Actualizar' : 'Crear' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Diálogo: Confirmar Eliminación -->
  <v-dialog v-model="deleteDialogOpen" max-width="420">
    <v-card rounded="lg" data-testid="branch-delete-dialog">
      <v-card-title class="text-h6 font-weight-bold pa-4 pb-2">
        ¿Eliminar sucursal?
      </v-card-title>
      <v-card-text class="pa-4 pt-0 text-body-2 text-grey-darken-1">
        ¿Estás seguro de que deseas eliminar la sucursal
        <strong>{{ branchToDelete?.name }}</strong>? Esta acción la moverá a la papelera.
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 justify-end">
        <v-btn
          variant="text"
          class="text-none"
          data-testid="btn-cancel-delete"
          @click="deleteDialogOpen = false"
        >
          Cancelar
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          class="text-none font-weight-bold"
          :loading="isDeleting"
          data-testid="btn-confirm-delete"
          @click="handleConfirmDelete"
        >
          Eliminar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Snackbar de Notificaciones -->
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    :timeout="3500"
    location="bottom right"
    data-testid="branches-snackbar"
  >
    {{ snackbar.text }}
  </v-snackbar>
</template>
