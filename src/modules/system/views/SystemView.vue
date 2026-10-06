<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useSystemStore } from '../stores/system.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchSystemBinnacles } from '../api/system.api'
import type { SystemBinnacleItem, LockerFileItem } from '../types'

const systemStore = useSystemStore()

type SystemTab = 'binnacles' | 'storage' | 'invitations' | 'metadata'
const activeTab = ref<SystemTab>('binnacles')

// Feedback / Snackbars
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

function showMessage(message: string, color: 'success' | 'error' | 'info' = 'success'): void {
  snackbar.value = { show: true, message, color }
}

// ---------------------------------------------------------------------
// 1. Auditoría Global (Bitácoras)
// ---------------------------------------------------------------------
const actionFilter = ref<string>('all')

const binnaclesQuery = useDataQuery<SystemBinnacleItem>(
  async (params) => {
    return fetchSystemBinnacles(params)
  },
  {
    initialItemsPerPage: 15,
    searchFields: ['description', 'action', 'ip', 'to_entity_type']
  }
)

watch(actionFilter, (newAction) => {
  if (newAction === 'all') {
    binnaclesQuery.staticFilters.value = []
  } else {
    binnaclesQuery.staticFilters.value = [
      ['action', newAction, '=', 'AND']
    ]
  }
  binnaclesQuery.refresh()
})

const binnacleHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '70px' },
  { title: 'Fecha / Hora', key: 'date', align: 'start' as const, sortable: true, width: '170px' },
  { title: 'Acción', key: 'action', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Entidad Afectada', key: 'to_entity', align: 'start' as const, sortable: false, width: '160px' },
  { title: 'Descripción del Evento', key: 'description', align: 'start' as const, sortable: false },
  { title: 'Dirección IP', key: 'ip', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Detalle', key: 'actions', align: 'end' as const, sortable: false, width: '90px' }
]

function getActionColor(action: string): string {
  switch (action?.toLowerCase()) {
    case 'create':
      return 'success'
    case 'update':
      return 'info'
    case 'delete':
      return 'error'
    case 'login':
      return 'primary'
    case 'logout':
      return 'grey'
    default:
      return 'default'
  }
}

// Modal para inspeccionar payload JSON de bitácora
const binnacleDetailOpen = ref(false)
const selectedBinnacle = ref<SystemBinnacleItem | null>(null)

function openBinnacleDetail(item: SystemBinnacleItem): void {
  selectedBinnacle.value = item
  binnacleDetailOpen.value = true
}

async function handleExportBinnacles(): Promise<void> {
  try {
    await systemStore.exportBinnaclesToExcel({
      search: binnaclesQuery.search.value || undefined
    })
    showMessage('Exportación de bitácoras completada exitosamente.')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al exportar bitácoras.'
    showMessage(msg, 'error')
  }
}

// ---------------------------------------------------------------------
// 2. Almacenamiento y Archivos (Storage y Lockers)
// ---------------------------------------------------------------------
const selectedFileToUpload = ref<File | null>(null)

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

watch(
  () => systemStore.selectedLockerId,
  async (newLockerId) => {
    if (newLockerId) {
      await systemStore.loadLockerFiles(newLockerId)
    }
  }
)

async function handleUploadFile(): Promise<void> {
  if (!selectedFileToUpload.value) {
    showMessage('Selecciona un archivo antes de subir.', 'error')
    return
  }

  const currentLocker = systemStore.lockers.find(
    (l) => Number(l.id) === Number(systemStore.selectedLockerId)
  )
  if (!currentLocker) {
    showMessage('Selecciona un casillero válido.', 'error')
    return
  }

  try {
    const res = await systemStore.uploadFile(currentLocker.locker_key, selectedFileToUpload.value)
    showMessage(`Archivo subido exitosamente: ${res.filename || selectedFileToUpload.value.name}`)
    selectedFileToUpload.value = null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al subir el archivo.'
    showMessage(msg, 'error')
  }
}

async function handleDeleteFile(file: LockerFileItem): Promise<void> {
  if (!systemStore.selectedLockerId) return
  const filename = file.filename || file.path.split('/').pop() || ''
  if (!filename) return

  try {
    await systemStore.deleteFile(systemStore.selectedLockerId, filename)
    showMessage(`Archivo ${filename} eliminado del casillero.`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al eliminar el archivo.'
    showMessage(msg, 'error')
  }
}

// ---------------------------------------------------------------------
// 3. Invitaciones de Usuario
// ---------------------------------------------------------------------
const invitationDialogOpen = ref(false)
const invitationUserId = ref<number | null>(null)
const isSubmittingInvitation = ref(false)

function openInvitationDialog(): void {
  invitationUserId.value = null
  invitationDialogOpen.value = true
}

async function handleSendInvitation(): Promise<void> {
  if (!invitationUserId.value) {
    showMessage('Ingresa el ID del usuario a invitar.', 'error')
    return
  }

  isSubmittingInvitation.value = true
  try {
    const res = await systemStore.sendInvitation(invitationUserId.value)
    showMessage(`Invitación enviada exitosamente al usuario #${res.user_id}. Vence: ${res.expires_at}`)
    invitationDialogOpen.value = false
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al enviar la invitación.'
    showMessage(msg, 'error')
  } finally {
    isSubmittingInvitation.value = false
  }
}

// ---------------------------------------------------------------------
// Carga Inicial de Datos
// ---------------------------------------------------------------------
onMounted(async () => {
  await Promise.all([
    systemStore.loadAuditableEntities(),
    systemStore.loadLockers(),
    systemStore.loadMetadataSchemas(),
    systemStore.loadFieldTypes()
  ])
  if (systemStore.selectedLockerId) {
    await systemStore.loadLockerFiles(systemStore.selectedLockerId)
  }
})
</script>

<template>
  <div class="system-view">
    <!-- Encabezado de la Vista -->
    <v-card class="mb-4" elevation="1" rounded="lg">
      <v-card-text class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-3">
        <div>
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-cogs" color="primary" size="32" />
            <h1 class="text-h5 font-weight-bold text-grey-darken-3">
              Sistema y Auditoría
            </h1>
          </div>
          <p class="text-body-2 text-grey-darken-1 mb-0 mt-1">
            Auditoría de eventos, almacenamiento de archivos, metadatos dinámicos e invitaciones.
          </p>
        </div>

        <div class="d-flex flex-wrap align-center ga-2">
          <!-- Exportar Auditoría a Excel -->
          <v-btn
            v-if="activeTab === 'binnacles'"
            variant="outlined"
            color="success"
            prepend-icon="mdi-file-excel"
            :loading="systemStore.isExporting"
            class="text-none font-weight-medium"
            data-testid="btn-export-binnacles"
            @click="handleExportBinnacles"
          >
            Exportar Excel
          </v-btn>

          <!-- Enviar Invitación -->
          <v-btn
            color="primary"
            prepend-icon="mdi-email-plus-outline"
            class="text-none font-weight-medium"
            data-testid="btn-new-invitation"
            @click="openInvitationDialog"
          >
            Invitar Usuario
          </v-btn>
        </div>
      </v-card-text>

      <v-divider />

      <!-- Pestañas de Navegación -->
      <v-tabs
        v-model="activeTab"
        color="primary"
        align-tabs="start"
        density="compact"
        class="px-2"
      >
        <v-tab value="binnacles" prepend-icon="mdi-clipboard-text-clock-outline" data-testid="tab-binnacles">
          Auditoría Global
        </v-tab>
        <v-tab value="storage" prepend-icon="mdi-folder-upload-outline" data-testid="tab-storage">
          Gestor de Archivos (Storage)
        </v-tab>
        <v-tab value="invitations" prepend-icon="mdi-account-plus-outline" data-testid="tab-invitations">
          Invitaciones y Usuarios
        </v-tab>
        <v-tab value="metadata" prepend-icon="mdi-form-select" data-testid="tab-metadata">
          Metadatos Dinámicos (EAV)
        </v-tab>
      </v-tabs>
    </v-card>

    <!-- Contenido por Pestaña -->
    <v-window v-model="activeTab">
      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 1: AUDITORÍA GLOBAL (BITÁCORAS)                   -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="binnacles">
        <v-card elevation="1" rounded="lg">
          <!-- Barra de Búsqueda y Filtros -->
          <v-card-text class="pb-2">
            <v-row density="compact" align="center">
              <v-col cols="12" sm="6" md="5">
                <v-text-field
                  v-model="binnaclesQuery.search.value"
                  placeholder="Buscar por descripción, acción, IP o entidad..."
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  hide-details
                  clearable
                  data-testid="binnacle-search-input"
                />
              </v-col>
              <v-col cols="12" sm="6" md="4">
                <v-select
                  v-model="actionFilter"
                  :items="[
                    { title: 'Todas las acciones', value: 'all' },
                    { title: 'Creación (create)', value: 'create' },
                    { title: 'Actualización (update)', value: 'update' },
                    { title: 'Eliminación (delete)', value: 'delete' },
                    { title: 'Inicio de sesión (login)', value: 'login' },
                    { title: 'Cierre de sesión (logout)', value: 'logout' }
                  ]"
                  item-title="title"
                  item-value="value"
                  label="Tipo de Acción"
                  variant="outlined"
                  density="compact"
                  hide-details
                  data-testid="binnacle-action-filter"
                />
              </v-col>
              <v-col cols="12" md="3" class="text-right">
                <v-btn
                  variant="text"
                  color="primary"
                  prepend-icon="mdi-refresh"
                  size="small"
                  @click="binnaclesQuery.refresh()"
                >
                  Recargar Eventos
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>

          <v-divider />

          <!-- Tabla de Auditoría -->
          <v-data-table-server
            v-model:page="binnaclesQuery.page.value"
            v-model:items-per-page="binnaclesQuery.itemsPerPage.value"
            :headers="binnacleHeaders"
            :items="binnaclesQuery.items.value"
            :items-length="binnaclesQuery.totalItems.value"
            :loading="binnaclesQuery.isLoading.value"
            hover
            density="comfortable"
            data-testid="system-binnacles-table"
            @update:options="binnaclesQuery.onUpdateOptions"
          >
            <!-- Slot Fecha -->
            <template #[`item.date`]="{ item }">
              <span class="text-caption font-monospace text-grey-darken-3">
                {{ item.date }}
              </span>
            </template>

            <!-- Slot Acción -->
            <template #[`item.action`]="{ item }">
              <v-chip
                :color="getActionColor(item.action)"
                size="small"
                variant="tonal"
                class="font-weight-medium text-uppercase"
              >
                {{ item.action }}
              </v-chip>
            </template>

            <!-- Slot Entidad Afectada -->
            <template #[`item.to_entity`]="{ item }">
              <span v-if="item.to_entity_type" class="text-body-2 font-monospace">
                {{ item.to_entity_type }}
                <span v-if="item.to_entity_id" class="text-grey">#{{ item.to_entity_id }}</span>
              </span>
              <span v-else class="text-caption text-grey">-</span>
            </template>

            <!-- Slot Descripción -->
            <template #[`item.description`]="{ item }">
              <span class="text-body-2 text-grey-darken-3">
                {{ item.description || 'Sin descripción disponible' }}
              </span>
            </template>

            <!-- Slot IP -->
            <template #[`item.ip`]="{ item }">
              <v-chip size="x-small" variant="flat" color="grey-lighten-3">
                {{ item.ip || '-' }}
              </v-chip>
            </template>

            <!-- Slot Acciones -->
            <template #[`item.actions`]="{ item }">
              <v-btn
                icon="mdi-code-json"
                size="small"
                variant="text"
                color="primary"
                title="Ver JSON"
                @click="openBinnacleDetail(item)"
              />
            </template>

            <!-- Sin Datos -->
            <template #no-data>
              <div class="text-center py-8">
                <v-icon icon="mdi-file-clock-outline" size="48" color="grey" class="mb-2" />
                <div class="text-subtitle-1 text-grey font-weight-medium">
                  No se encontraron eventos de auditoría registrados
                </div>
              </div>
            </template>
          </v-data-table-server>
        </v-card>
      </v-window-item>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 2: GESTOR DE ARCHIVOS (STORAGE & LOCKERS)         -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="storage">
        <v-card elevation="1" rounded="lg">
          <v-card-text>
            <v-row align="center">
              <!-- Selector de Casillero (Locker) -->
              <v-col cols="12" md="4">
                <v-select
                  v-model="systemStore.selectedLockerId"
                  :items="systemStore.lockers"
                  item-title="name"
                  item-value="id"
                  label="Casillero de Almacenamiento (Locker)"
                  variant="outlined"
                  density="compact"
                  hide-details
                  prepend-inner-icon="mdi-locker"
                  data-testid="locker-select"
                />
              </v-col>

              <!-- Entrada de Subida de Archivos -->
              <v-col cols="12" md="6">
                <v-file-input
                  v-model="selectedFileToUpload"
                  label="Seleccionar archivo para subir..."
                  variant="outlined"
                  density="compact"
                  hide-details
                  prepend-icon=""
                  prepend-inner-icon="mdi-paperclip"
                  show-size
                  data-testid="file-upload-input"
                />
              </v-col>

              <v-col cols="12" md="2" class="text-right">
                <v-btn
                  color="primary"
                  block
                  prepend-icon="mdi-upload"
                  class="text-none font-weight-medium"
                  :loading="systemStore.isUploading"
                  :disabled="!selectedFileToUpload"
                  data-testid="btn-upload-file"
                  @click="handleUploadFile"
                >
                  Subir
                </v-btn>
              </v-col>
            </v-row>

            <!-- Barra de Progreso en Carga -->
            <v-progress-linear
              v-if="systemStore.isUploading"
              indeterminate
              color="primary"
              class="mt-3"
            />
          </v-card-text>

          <v-divider />

          <!-- Listado de Archivos en el Locker Seleccionado -->
          <v-card-item class="py-2 bg-grey-lighten-4">
            <div class="d-flex justify-space-between align-center">
              <span class="text-subtitle-2 font-weight-bold text-grey-darken-3">
                Archivos Almacenados en el Locker
              </span>
              <v-chip size="x-small" color="primary" variant="outlined">
                {{ systemStore.lockerFiles.length }} archivo(s)
              </v-chip>
            </div>
          </v-card-item>

          <v-table density="comfortable" class="text-body-2" data-testid="locker-files-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tipo MIME</th>
                <th>Tamaño</th>
                <th>URL Pública</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in systemStore.lockerFiles" :key="file.path">
                <td class="font-weight-medium">
                  <div class="d-flex align-center ga-2">
                    <v-icon
                      :icon="file.mime_type.startsWith('image/') ? 'mdi-file-image' : 'mdi-file-document-outline'"
                      color="primary"
                      size="small"
                    />
                    <span>{{ file.filename || file.path.split('/').pop() }}</span>
                  </div>
                </td>
                <td>
                  <v-chip size="x-small" variant="tonal" color="grey-darken-2">
                    {{ file.mime_type }}
                  </v-chip>
                </td>
                <td>{{ formatFileSize(file.size) }}</td>
                <td>
                  <a
                    :href="file.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-decoration-none text-primary font-monospace text-caption"
                  >
                    Ver archivo
                    <v-icon icon="mdi-open-in-new" size="x-small" />
                  </a>
                </td>
                <td class="text-end">
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    title="Eliminar archivo"
                    @click="handleDeleteFile(file)"
                  />
                </td>
              </tr>
              <tr v-if="systemStore.lockerFiles.length === 0">
                <td colspan="5" class="text-center py-6 text-grey">
                  No hay archivos almacenados en este casillero
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-window-item>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 3: INVITACIONES Y USUARIOS                        -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="invitations">
        <v-card elevation="1" rounded="lg">
          <v-card-item class="bg-primary text-white py-3">
            <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <v-icon icon="mdi-email-check" />
              Gestión de Invitaciones y Onboarding de Usuarios
            </v-card-title>
          </v-card-item>

          <v-card-text class="pa-4 pa-sm-6">
            <v-row>
              <v-col cols="12" md="7">
                <h3 class="text-h6 font-weight-bold text-grey-darken-3 mb-2">
                  Invitar a Nuevos Colaboradores
                </h3>
                <p class="text-body-2 text-grey-darken-1 mb-4">
                  El sistema genera un token seguro de un solo uso con caducidad para que el usuario complete su bienvenida, verifique su identidad y configure su contraseña inicial sin intervención de terceros.
                </p>

                <v-btn
                  color="primary"
                  prepend-icon="mdi-account-plus"
                  class="text-none font-weight-medium"
                  data-testid="btn-open-invitation-dialog"
                  @click="openInvitationDialog"
                >
                  Enviar Nueva Invitación
                </v-btn>
              </v-col>

              <v-col cols="12" md="5">
                <v-card variant="tonal" color="info" rounded="lg" class="pa-4">
                  <div class="d-flex align-center ga-2 mb-2">
                    <v-icon icon="mdi-shield-check" color="info" />
                    <span class="font-weight-bold text-subtitle-2">Políticas de Invitación</span>
                  </div>
                  <ul class="text-caption text-grey-darken-2 pl-4 mb-0">
                    <li>Los enlaces de invitación caducan a las 48 horas de su emisión.</li>
                    <li>El usuario debe contar previamente con registro de cuenta o perfil de persona.</li>
                    <li>Al completar el onboarding, se activa el acceso a la plataforma automáticamente.</li>
                  </ul>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-window-item>

      <!-- ═══════════════════════════════════════════════════════════ -->
      <!-- PESTAÑA 4: METADATOS DINÁMICOS (EAV)                       -->
      <!-- ═══════════════════════════════════════════════════════════ -->
      <v-window-item value="metadata">
        <v-card elevation="1" rounded="lg">
          <v-card-item class="bg-primary text-white py-3">
            <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
              <v-icon icon="mdi-database-cog" />
              Esquemas de Metadatos Configurables (EAV)
            </v-card-title>
          </v-card-item>

          <v-table density="comfortable" class="text-body-2">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código Técnico</th>
                <th>Tabla / Entidad Base</th>
                <th>Columna de Almacenamiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="schema in systemStore.metadataSchemas" :key="schema.id">
                <td>#{{ schema.id }}</td>
                <td class="font-weight-bold font-monospace text-primary">{{ schema.code }}</td>
                <td class="font-monospace">{{ schema.table_name }}</td>
                <td class="font-monospace text-grey-darken-1">{{ schema.storage_column }}</td>
                <td>
                  <v-chip
                    :color="String(schema.is_disabled) === '0' ? 'success' : 'grey'"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ String(schema.is_disabled) === '0' ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </td>
              </tr>
              <tr v-if="systemStore.metadataSchemas.length === 0">
                <td colspan="5" class="text-center py-4 text-grey">
                  No hay esquemas de metadatos registrados
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-window-item>
    </v-window>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DIÁLOGO: DETALLE JSON DE AUDITORÍA                        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-dialog v-model="binnacleDetailOpen" max-width="600">
      <v-card v-if="selectedBinnacle" rounded="lg">
        <v-card-item class="bg-primary text-white py-3">
          <div class="d-flex justify-space-between align-center">
            <v-card-title class="text-h6 font-weight-bold">
              Evento de Auditoría #{{ selectedBinnacle.id }}
            </v-card-title>
            <v-chip color="white" variant="outlined" size="small">
              {{ selectedBinnacle.action }}
            </v-chip>
          </div>
        </v-card-item>

        <v-card-text class="pa-4">
          <div class="text-subtitle-2 font-weight-bold mb-1">Descripción:</div>
          <p class="text-body-2 text-grey-darken-2 mb-3">
            {{ selectedBinnacle.description }}
          </p>

          <div class="text-subtitle-2 font-weight-bold mb-1">Carga Útil (Payload / Data):</div>
          <pre class="bg-grey-lighten-4 pa-3 rounded text-caption overflow-x-auto">{{ JSON.stringify(selectedBinnacle.data, null, 2) }}</pre>
        </v-card-text>

        <v-card-actions class="pa-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn variant="text" color="grey" @click="binnacleDetailOpen = false">
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DIÁLOGO: ENVIAR INVITACIÓN A USUARIO                       -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-dialog
      v-model="invitationDialogOpen"
      max-width="500"
      data-testid="invitation-form-dialog"
    >
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white py-3">
          <div class="d-flex justify-space-between align-center">
            <v-card-title class="text-h6 font-weight-bold d-flex align-center ga-2">
              <v-icon icon="mdi-email-send" />
              Enviar Invitación a Usuario
            </v-card-title>
            <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="invitationDialogOpen = false" />
          </div>
        </v-card-item>

        <v-card-text class="pa-4">
          <v-form @submit.prevent="handleSendInvitation">
            <p class="text-body-2 text-grey-darken-2 mb-3">
              Ingresa el identificador numérico (ID) del usuario registrado para generarle el correo de invitación.
            </p>

            <v-text-field
              v-model.number="invitationUserId"
              label="ID de Usuario *"
              type="number"
              variant="outlined"
              density="compact"
              required
              data-testid="input-invitation-user-id"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-3 bg-grey-lighten-4">
          <v-spacer />
          <v-btn variant="text" color="grey" @click="invitationDialogOpen = false">
            Cancelar
          </v-btn>
          <v-btn
            color="primary"
            class="text-none font-weight-bold"
            :loading="isSubmittingInvitation"
            data-testid="btn-submit-invitation"
            @click="handleSendInvitation"
          >
            Enviar Invitación
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar de Notificaciones -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="4000"
      location="top right"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn icon="mdi-close" size="small" variant="text" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.font-monospace {
  font-family: monospace;
}
</style>
