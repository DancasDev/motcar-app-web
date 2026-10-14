<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchPersons,
  fetchPersonById,
  createPerson,
  updatePerson,
  deletePerson
} from '@/modules/catalogs/api/catalogs.api'
import type { PersonItem } from '@/modules/catalogs/types'
import type { DqbFilterTuple } from '@/types/query'
import AppModal from '@/components/common/AppModal.vue'

// ---------------------------------------------------------------------
// 1. Data Query de Personas
// ---------------------------------------------------------------------
const personsQuery = useDataQuery<PersonItem>(
  async (params) => {
    return fetchPersons(params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['first_name', 'last_name', 'identification_value']
  }
)

const tableHeaders = [
  { title: 'Identificación', key: 'identification', align: 'start' as const, sortable: false, width: '150px' },
  { title: 'Nombre Completo', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Teléfono', key: 'phone_primary', align: 'start' as const, sortable: false, width: '150px' },
  { title: 'Ciudad', key: 'city', align: 'start' as const, sortable: true, width: '150px' },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: false, width: '120px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '90px' }
]

const idTypes = [
  { title: 'V - Venezolano', value: '0', prefix: 'V' },
  { title: 'E - Extranjero', value: '1', prefix: 'E' },
  { title: 'J - Jurídico', value: '2', prefix: 'J' },
  { title: 'G - Gubernamental', value: '3', prefix: 'G' }
]

function getDocPrefix(typeVal: string | number | undefined): string {
  if (typeVal === undefined || typeVal === null) return 'V'
  const found = idTypes.find((t) => String(t.value) === String(typeVal))
  return found ? found.prefix : String(typeVal)
}

// ---------------------------------------------------------------------
// 2. Filtros de Estado
// ---------------------------------------------------------------------
const currentStatusFilter = ref<'all' | '0' | '1'>('all')

function handleStatusFilter(val: 'all' | '0' | '1'): void {
  currentStatusFilter.value = val
  if (val === 'all') {
    personsQuery.staticFilters.value = []
  } else {
    const filterTuple: DqbFilterTuple = ['is_disabled', val === '1' ? '1' : '0', '=', 'AND']
    personsQuery.staticFilters.value = [filterTuple]
  }
  personsQuery.page.value = 1
  personsQuery.refresh()
}

// ---------------------------------------------------------------------
// 3. Modal de Formulario (Crear / Editar)
// ---------------------------------------------------------------------
const formDialogOpen = ref(false)
const isSubmitting = ref(false)
const editingPersonId = ref<string | number | null>(null)

const formData = reactive({
  identification_type: '0',
  identification_value: '',
  first_name: '',
  last_name: '',
  phone_primary: '',
  phone_secondary: '',
  city: '',
  address: '',
  is_disabled: '0'
})

const phoneRules = [
  (v: string) => !!v?.trim() || 'El teléfono es obligatorio',
  (v: string) => /^\+[1-9]\d{7,14}$/.test(v?.trim() || '') || 'Debe comenzar con el código de país (ej. +58)'
]

function openCreateDialog(): void {
  editingPersonId.value = null
  formData.identification_type = '0'
  formData.identification_value = ''
  formData.first_name = ''
  formData.last_name = ''
  formData.phone_primary = ''
  formData.phone_secondary = ''
  formData.city = ''
  formData.address = ''
  formData.is_disabled = '0'
  formDialogOpen.value = true
}

function openEditDialog(item: PersonItem): void {
  editingPersonId.value = item.id
  formData.identification_type = item.identification_type !== undefined ? String(item.identification_type) : '0'
  formData.identification_value = item.identification_value || ''
  formData.first_name = item.first_name || ''
  formData.last_name = item.last_name || ''
  formData.phone_primary = item.phone_primary || ''
  formData.phone_secondary = item.phone_secondary || ''
  formData.city = item.city || ''
  formData.address = item.address || ''
  formData.is_disabled = String(item.is_disabled ?? '0')
  formDialogOpen.value = true
}

async function handleSavePerson(): Promise<void> {
  if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.identification_value.trim()) {
    showNotification('Por favor complete los campos obligatorios.', 'warning')
    return
  }

  const phoneRegex = /^\+[1-9]\d{7,14}$/
  if (!formData.phone_primary.trim()) {
    showNotification('El teléfono principal es obligatorio.', 'warning')
    return
  }
  if (!phoneRegex.test(formData.phone_primary.trim())) {
    showNotification('El teléfono debe comenzar con el código de país (ej. +58) seguido de 7 a 14 dígitos.', 'warning')
    return
  }
  if (formData.phone_secondary && formData.phone_secondary.trim() && !phoneRegex.test(formData.phone_secondary.trim())) {
    showNotification('El teléfono secundario debe comenzar con el código de país (ej. +58).', 'warning')
    return
  }

  isSubmitting.value = true
  try {
    const payload: Partial<PersonItem> = {
      identification_type: formData.identification_type,
      identification_value: formData.identification_value.trim(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      phone_primary: formData.phone_primary.trim(),
      phone_secondary: formData.phone_secondary ? formData.phone_secondary.trim() : null,
      city: formData.city ? formData.city.trim() : null,
      address: formData.address ? formData.address.trim() : null,
      is_disabled: formData.is_disabled
    }

    if (editingPersonId.value) {
      await updatePerson(editingPersonId.value, payload)
      showNotification('Persona actualizada exitosamente.', 'success')
    } else {
      await createPerson(payload)
      showNotification('Persona registrada exitosamente.', 'success')
    }

    formDialogOpen.value = false
    personsQuery.refresh()
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.messages?.error ||
      err?.response?.data?.messages?.identification_value ||
      err?.response?.data?.message ||
      'Ocurrió un error al guardar la persona.'
    showNotification(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

// ---------------------------------------------------------------------
// 4. Modal de Detalles
// ---------------------------------------------------------------------
const detailsDialogOpen = ref(false)
const selectedPerson = ref<PersonItem | null>(null)

async function openDetailsDialog(item: PersonItem): Promise<void> {
  selectedPerson.value = item
  detailsDialogOpen.value = true
  try {
    const full = await fetchPersonById(item.id)
    if (full) {
      selectedPerson.value = full
    }
  } catch {
    // Mantener item de la tabla si falla la petición individual
  }
}

// ---------------------------------------------------------------------
// 5. Modal de Eliminación
// ---------------------------------------------------------------------
const deleteDialogOpen = ref(false)
const personToDelete = ref<PersonItem | null>(null)
const isDeleting = ref(false)

function openDeleteDialog(item: PersonItem): void {
  personToDelete.value = item
  deleteDialogOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  if (!personToDelete.value) return
  isDeleting.value = true
  try {
    await deletePerson(personToDelete.value.id)
    showNotification('Persona eliminada exitosamente.', 'success')
    deleteDialogOpen.value = false
    personsQuery.refresh()
  } catch (err: any) {
    const errorMsg = err?.response?.data?.messages?.error || 'No fue posible eliminar el registro.'
    showNotification(errorMsg, 'error')
  } finally {
    isDeleting.value = false
  }
}

// ---------------------------------------------------------------------
// 6. Snackbar de Notificaciones
// ---------------------------------------------------------------------
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success'
})

function showNotification(text: string, color: 'success' | 'error' | 'warning' = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}
</script>

<template>
  <div class="persons-view-container pa-4 pa-sm-6">
    <!-- Encabezado de Página -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Directorio de Personas
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Gestión centralizada de clientes, asesores y personas registradas en el sistema
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-create-person"
          @click="openCreateDialog"
        >
          Nueva Persona
        </v-btn>
      </div>

      <!-- Menú Mobile -->
      <div class="d-flex d-sm-none">
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
              data-testid="btn-mobile-persons-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-plus"
              title="Nueva Persona"
              @click="openCreateDialog"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Barra de Búsqueda y Filtros -->
    <v-card variant="flat" rounded="lg" class="border mb-4">
      <v-card-text class="py-3 px-4">
        <div class="d-flex align-center flex-wrap ga-3 justify-space-between">
          <!-- Input de Búsqueda -->
          <div style="min-width: 280px; max-width: 420px;" class="flex-grow-1">
            <v-text-field
              v-model="personsQuery.search.value"
              density="compact"
              variant="outlined"
              placeholder="Buscar por nombre, apellido o cédula..."
              prepend-inner-icon="mdi-magnify"
              hide-details
              clearable
              data-testid="input-search-persons"
            />
          </div>

          <!-- Filtros de Estado y Refrescar -->
          <div class="d-flex align-center ga-2 flex-wrap">
            <v-chip-group
              :model-value="currentStatusFilter"
              mandatory
              color="primary"
              @update:model-value="(val: any) => handleStatusFilter(val)"
            >
              <v-chip value="all" filter size="small" class="font-weight-medium">Todos</v-chip>
              <v-chip value="0" filter size="small" class="font-weight-medium">Activos</v-chip>
              <v-chip value="1" filter size="small" class="font-weight-medium">Inactivos</v-chip>
            </v-chip-group>

            <v-btn
              icon="mdi-refresh"
              variant="text"
              size="small"
              :loading="personsQuery.isLoading.value"
              data-testid="btn-refresh-persons"
              @click="personsQuery.refresh()"
            />
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Tabla Principal de Personas -->
    <v-card variant="flat" rounded="lg" class="border">
      <v-data-table-server
        :headers="tableHeaders"
        :items="personsQuery.items.value"
        :items-length="personsQuery.totalItems.value"
        :loading="personsQuery.isLoading.value"
        :page="personsQuery.page.value"
        :items-per-page="personsQuery.itemsPerPage.value"
        density="comfortable"
        hover
        data-testid="persons-table"
        @update:options="personsQuery.onUpdateOptions"
      >
        <!-- Columna Identificación -->
        <template #item.identification="{ item }">
          <span class="font-weight-bold text-high-emphasis">
            {{ getDocPrefix(item.identification_type) }}-{{ item.identification_value || 'N/A' }}
          </span>
        </template>

        <!-- Columna Nombre Completo -->
        <template #item.name="{ item }">
          <div class="d-flex flex-column">
            <span class="font-weight-medium text-high-emphasis">
              {{ item.first_name }} {{ item.last_name }}
            </span>
            <span v-if="item.address" class="text-caption text-medium-emphasis text-truncate" style="max-width: 250px;">
              {{ item.address }}
            </span>
          </div>
        </template>

        <!-- Columna Teléfono -->
        <template #item.phone_primary="{ item }">
          <span class="text-body-2 text-medium-emphasis">
            {{ item.phone_primary || 'Sin registrar' }}
          </span>
        </template>

        <!-- Columna Ciudad -->
        <template #item.city="{ item }">
          <span class="text-body-2 text-medium-emphasis">
            {{ item.city || 'N/A' }}
          </span>
        </template>

        <!-- Columna Estado -->
        <template #item.status="{ item }">
          <v-chip
            size="small"
            :color="String(item.is_disabled) === '1' ? 'error' : 'success'"
            variant="tonal"
            class="font-weight-medium"
          >
            {{ String(item.is_disabled) === '1' ? 'Inactivo' : 'Activo' }}
          </v-chip>
        </template>

        <!-- Columna Acciones -->
        <template #item.actions="{ item }">
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-dots-vertical"
                variant="text"
                size="small"
                data-testid="btn-person-actions"
              />
            </template>
            <v-list density="compact" min-width="150" class="elevation-2 rounded-lg">
              <v-list-item
                prepend-icon="mdi-eye-outline"
                title="Ver Detalles"
                data-testid="action-view-person-details"
                @click="openDetailsDialog(item)"
              />
              <v-list-item
                prepend-icon="mdi-pencil-outline"
                title="Editar"
                data-testid="action-edit-person"
                @click="openEditDialog(item)"
              />
              <v-divider class="my-1" />
              <v-list-item
                prepend-icon="mdi-trash-can-outline"
                title="Eliminar"
                color="error"
                class="text-error"
                data-testid="action-delete-person"
                @click="openDeleteDialog(item)"
              />
            </v-list>
          </v-menu>
        </template>

        <!-- Estado Vacío -->
        <template #no-data>
          <div class="py-12 text-center text-medium-emphasis">
            <v-icon icon="mdi-account-search-outline" size="48" class="mb-3 text-disabled" />
            <div class="text-subtitle-1 font-weight-medium">No se encontraron personas</div>
            <div class="text-caption text-disabled">
              Utilice el botón de "+ Nueva Persona" para agregar un registro al directorio.
            </div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Modal Formulario: Crear / Editar Persona -->
    <AppModal
      v-model="formDialogOpen"
      :title="editingPersonId ? 'Editar Persona' : 'Nueva Persona'"
      :subtitle="editingPersonId ? 'Actualice la información de la persona seleccionada' : 'Complete los datos para agregar una persona al directorio'"
      :submit-loading="isSubmitting"
      :submit-text="editingPersonId ? 'Guardar Cambios' : 'Registrar Persona'"
      :submit-icon="editingPersonId ? 'mdi-check' : 'mdi-plus'"
      form-id="form-person"
      max-width="640"
      @submit="handleSavePerson"
    >
      <v-form id="form-person" @submit.prevent="handleSavePerson">
        <!-- 1. Identificación: Tipo y Número -->
        <v-row dense class="mb-1">
          <v-col cols="12" sm="5">
            <v-select
              v-model="formData.identification_type"
              :items="idTypes"
              item-title="title"
              item-value="value"
              label="Tipo de Documento *"
              variant="outlined"
              density="comfortable"
              data-testid="select-person-id-type"
            />
          </v-col>
          <v-col cols="12" sm="7">
            <v-text-field
              v-model="formData.identification_value"
              label="Número de Identificación *"
              placeholder="Ej: 12345678"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-id-value"
            />
          </v-col>
        </v-row>

        <!-- 2. Nombres y Apellidos -->
        <v-row dense class="mb-1">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.first_name"
              label="Nombres *"
              placeholder="Ej: Carlos Eduardo"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-first-name"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.last_name"
              label="Apellidos *"
              placeholder="Ej: Pérez Rodríguez"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-last-name"
            />
          </v-col>
        </v-row>

        <!-- 3. Teléfonos -->
        <v-row dense class="mb-1">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.phone_primary"
              label="Teléfono Principal *"
              placeholder="Ej: +584141234567"
              :rules="phoneRules"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-phone-primary"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.phone_secondary"
              label="Teléfono Secundario (Opcional)"
              placeholder="Ej: +584249876543"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-phone-secondary"
            />
          </v-col>
        </v-row>

        <!-- 4. Ciudad y Dirección -->
        <v-row dense class="mb-1">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.city"
              label="Ciudad (Opcional)"
              placeholder="Ej: Maracaibo"
              variant="outlined"
              density="comfortable"
              data-testid="input-person-city"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="formData.is_disabled"
              :items="[
                { title: 'Activo', value: '0' },
                { title: 'Inactivo', value: '1' }
              ]"
              item-title="title"
              item-value="value"
              label="Estado"
              variant="outlined"
              density="comfortable"
              data-testid="select-person-status"
            />
          </v-col>
        </v-row>

        <v-row dense>
          <v-col cols="12">
            <v-textarea
              v-model="formData.address"
              label="Dirección de Habitación (Opcional)"
              placeholder="Ej: Av. 5 de Julio, Edif. Centro, Apto 4B"
              variant="outlined"
              density="comfortable"
              rows="2"
              auto-grow
              data-testid="input-person-address"
            />
          </v-col>
        </v-row>
      </v-form>
    </AppModal>

    <!-- Modal: Ver Detalles de la Persona -->
    <AppModal
      v-model="detailsDialogOpen"
      title="Detalles de la Persona"
      subtitle="Información completa registrada en el directorio"
      max-width="600"
      cancel-text="Cerrar"
      hide-submit
    >
      <div v-if="selectedPerson" class="pa-1">
        <div class="d-flex align-center ga-3 mb-4 pa-3 rounded-lg bg-surface-variant">
          <v-avatar color="primary" size="48">
            <span class="text-h6 text-white font-weight-bold">
              {{ (selectedPerson.first_name?.[0] || 'P').toUpperCase() }}
            </span>
          </v-avatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis">
              {{ selectedPerson.first_name }} {{ selectedPerson.last_name }}
            </div>
            <div class="text-caption text-medium-emphasis">
              ID Registro: #{{ selectedPerson.id }} &bull;
              {{ getDocPrefix(selectedPerson.identification_type) }}-{{ selectedPerson.identification_value || 'Sin identificación' }}
            </div>
          </div>
        </div>

        <v-list density="compact" class="bg-transparent pa-0">
          <v-list-item class="px-0">
            <template #prepend><v-icon icon="mdi-phone" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Teléfono Principal</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 font-weight-medium text-high-emphasis">
              {{ selectedPerson.phone_primary || 'No registrado' }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item class="px-0" v-if="selectedPerson.phone_secondary">
            <template #prepend><v-icon icon="mdi-phone-outline" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Teléfono Secundario</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 font-weight-medium text-high-emphasis">
              {{ selectedPerson.phone_secondary }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item class="px-0" v-if="selectedPerson.city">
            <template #prepend><v-icon icon="mdi-city-variant-outline" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Ciudad</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 font-weight-medium text-high-emphasis">
              {{ selectedPerson.city }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item class="px-0" v-if="selectedPerson.address">
            <template #prepend><v-icon icon="mdi-map-marker-outline" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Dirección</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 font-weight-medium text-high-emphasis">
              {{ selectedPerson.address }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item class="px-0">
            <template #prepend><v-icon icon="mdi-shield-check-outline" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Estado</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip
                size="x-small"
                :color="String(selectedPerson.is_disabled) === '1' ? 'error' : 'success'"
                variant="flat"
                class="font-weight-bold"
              >
                {{ String(selectedPerson.is_disabled) === '1' ? 'Inactivo' : 'Activo' }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item class="px-0" v-if="selectedPerson.created_at">
            <template #prepend><v-icon icon="mdi-clock-outline" class="mr-2 text-medium-emphasis" size="small" /></template>
            <v-list-item-title class="text-caption text-medium-emphasis">Fecha de Registro</v-list-item-title>
            <v-list-item-subtitle class="text-body-2 font-weight-medium text-high-emphasis">
              {{ selectedPerson.created_at }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>
    </AppModal>

    <!-- Modal: Confirmación de Eliminación -->
    <AppModal
      v-model="deleteDialogOpen"
      title="Confirmar Eliminación"
      subtitle="¿Está seguro de que desea eliminar a esta persona del directorio?"
      submit-text="Eliminar"
      submit-icon="mdi-trash-can-outline"
      submit-color="error"
      :submit-loading="isDeleting"
      max-width="480"
      @submit="handleConfirmDelete"
    >
      <div v-if="personToDelete" class="text-body-2 text-high-emphasis py-2">
        Se eliminará el registro de <strong>{{ personToDelete.first_name }} {{ personToDelete.last_name }}</strong>
        (Cédula: <strong>{{ getDocPrefix(personToDelete.identification_type) }}-{{ personToDelete.identification_value }}</strong>).
        Esta acción no se puede deshacer si tiene relaciones vinculadas.
      </div>
    </AppModal>

    <!-- Snackbar de Notificaciones -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="bottom right"
      data-testid="persons-snackbar"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.persons-view-container {
  max-width: 1440px;
  margin: 0 auto;
}
</style>
