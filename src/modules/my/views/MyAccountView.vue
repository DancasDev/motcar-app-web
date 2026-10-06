<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useMyStore } from '../stores/my.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchMyBinnacles } from '../api/my.api'
import type { BinnacleItem } from '../types'

const authStore = useAuthStore()
const myStore = useMyStore()

type AccountTab = 'channels' | 'binnacles'
const activeTab = ref<AccountTab>('channels')

// 1. Canales de Notificación
const selectedChannelIds = ref<string[]>([])
const saveSuccessMessage = ref('')
const saveErrorMessage = ref('')

onMounted(async () => {
  await myStore.loadChannels()
  // Inicializar switches con canales actualmente habilitados
  selectedChannelIds.value = myStore.channels
    .filter((c) => c.enabled)
    .map((c) => c.channel)
})

function getChannelTitle(channel: string): string {
  switch (channel) {
    case '1':
      return 'Correo Electrónico (Email)'
    case '2':
      return 'Notificaciones Push'
    default:
      return `Canal ${channel}`
  }
}

function getChannelIcon(channel: string): string {
  switch (channel) {
    case '1':
      return 'mdi-email-outline'
    case '2':
      return 'mdi-cellphone-wireless'
    default:
      return 'mdi-broadcast'
  }
}

async function handleSaveChannels(): Promise<void> {
  saveSuccessMessage.value = ''
  saveErrorMessage.value = ''
  try {
    // Solo enviamos los canales que el usuario seleccionó y están disponibles
    const validChannels = selectedChannelIds.value.filter((chId) => {
      const ch = myStore.channels.find((c) => c.channel === chId)
      return ch && ch.available
    })
    await myStore.saveChannels(validChannels)
    saveSuccessMessage.value = 'Canales de notificación actualizados correctamente.'
  } catch (err: unknown) {
    saveErrorMessage.value = (err as Error).message || 'Error al guardar los canales de notificación.'
  }
}

// 2. Bitácora de Actividad personal vía DQB
const binnacleQuery = useDataQuery<BinnacleItem>(fetchMyBinnacles, {
  initialItemsPerPage: 10,
  searchFields: ['action', 'description', 'ip']
})

const binnacleHeaders = [
  { title: 'Fecha y Hora', key: 'date', align: 'start' as const, sortable: true, width: '180px' },
  { title: 'Acción', key: 'action', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'IP', key: 'ip', align: 'start' as const, sortable: true, width: '130px' },
  { title: 'Descripción', key: 'description', align: 'start' as const, sortable: false }
]

function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'login':
    case 'create':
      return 'success'
    case 'update':
      return 'info'
    case 'delete':
      return 'error'
    default:
      return 'secondary'
  }
}
</script>

<template>
  <v-row>
    <!-- Tarjeta de Identidad del Usuario -->
    <v-col cols="12">
      <v-card elevation="2" rounded="lg" class="mb-4">
        <v-card-item class="pa-4 pa-sm-6">
          <div class="d-flex align-center flex-wrap ga-4">
            <v-avatar color="primary" size="64">
              <v-icon icon="mdi-account" size="36" color="white" />
            </v-avatar>

            <div class="flex-grow-1">
              <div class="d-flex align-center flex-wrap ga-2">
                <h1 class="text-h5 font-weight-bold mb-0">
                  {{ authStore.fullName || authStore.user?.username }}
                </h1>
                <v-chip color="primary" variant="flat" size="small">
                  {{ authStore.userRoleCodes[0] || 'Usuario' }}
                </v-chip>
              </div>

              <div class="text-body-2 text-grey-darken-1 mt-1 d-flex align-center flex-wrap ga-4">
                <span>
                  <v-icon icon="mdi-account-circle-outline" size="small" class="mr-1" />
                  @{{ authStore.user?.username }}
                </span>
                <span v-if="authStore.user?.email">
                  <v-icon icon="mdi-email-outline" size="small" class="mr-1" />
                  {{ authStore.user.email }}
                </span>
              </div>
            </div>
          </div>
        </v-card-item>
      </v-card>
    </v-col>

    <!-- Contenido con Pestañas -->
    <v-col cols="12">
      <v-card elevation="2" rounded="lg">
        <v-tabs v-model="activeTab" color="primary" class="border-b px-4">
          <v-tab value="channels" class="text-none" data-testid="tab-channels">
            <v-icon start icon="mdi-bell-cog-outline" />
            Canales de Notificación
          </v-tab>
          <v-tab value="binnacles" class="text-none" data-testid="tab-binnacles">
            <v-icon start icon="mdi-history" />
            Mi Bitácora de Actividad ({{ binnacleQuery.totalItems.value }})
          </v-tab>
        </v-tabs>

        <v-card-text class="pa-4 pa-sm-6">
          <!-- 1. Pestaña de Canales de Notificación -->
          <div v-if="activeTab === 'channels'">
            <div class="mb-4">
              <h2 class="text-subtitle-1 font-weight-bold mb-1">
                Preferencias de Notificaciones Externas
              </h2>
              <p class="text-body-2 text-grey-darken-1">
                Configura los canales externos por los cuales deseas recibir alertas y avisos del sistema. Las notificaciones dentro de la plataforma (in-app) están siempre activas.
              </p>
            </div>

            <v-alert
              v-if="saveSuccessMessage"
              type="success"
              variant="tonal"
              closable
              class="mb-4"
              data-testid="alert-success-channels"
            >
              {{ saveSuccessMessage }}
            </v-alert>

            <v-alert
              v-if="saveErrorMessage"
              type="error"
              variant="tonal"
              closable
              class="mb-4"
              data-testid="alert-error-channels"
            >
              {{ saveErrorMessage }}
            </v-alert>

            <div v-if="myStore.isLoading" class="text-center py-6">
              <v-progress-circular indeterminate color="primary" />
              <div class="mt-2 text-caption text-grey">Cargando canales configurables...</div>
            </div>

            <div v-else class="channels-list">
              <v-card
                v-for="ch in myStore.channels"
                :key="ch.channel"
                variant="outlined"
                class="mb-3 pa-4"
              >
                <div class="d-flex align-center justify-space-between flex-wrap ga-3">
                  <div class="d-flex align-center ga-3">
                    <v-avatar :color="ch.available ? 'primary' : 'grey-lighten-2'" size="40">
                      <v-icon
                        :icon="getChannelIcon(ch.channel)"
                        :color="ch.available ? 'white' : 'grey'"
                      />
                    </v-avatar>

                    <div>
                      <div class="font-weight-medium">
                        {{ getChannelTitle(ch.channel) }}
                      </div>
                      <div class="text-caption text-grey-darken-1">
                        Destino: {{ ch.channel_key || 'No configurado' }}
                      </div>
                      <div v-if="!ch.available" class="text-caption text-warning mt-1">
                        <v-icon icon="mdi-alert-circle-outline" size="x-small" class="mr-1" />
                        Canal no disponible para habilitar (verificación pendiente o sin dispositivos).
                      </div>
                    </div>
                  </div>

                  <v-switch
                    v-model="selectedChannelIds"
                    :value="ch.channel"
                    :disabled="!ch.available"
                    color="primary"
                    hide-details
                    density="compact"
                    :data-testid="`channel-switch-${ch.channel}`"
                  />
                </div>
              </v-card>

              <div class="mt-6 d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-content-save"
                  :loading="myStore.isUpdatingChannels"
                  data-testid="btn-save-channels"
                  @click="handleSaveChannels"
                >
                  Guardar Preferencias
                </v-btn>
              </div>
            </div>
          </div>

          <!-- 2. Pestaña de Bitácora de Actividad -->
          <div v-else-if="activeTab === 'binnacles'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="binnacleQuery.search.value"
                placeholder="Buscar por acción, descripción o IP..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-binnacles"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="binnacleQuery.isLoading.value"
                @click="binnacleQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="binnacleHeaders"
              :items="binnacleQuery.items.value"
              :items-length="binnacleQuery.totalItems.value"
              :loading="binnacleQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="binnacles-table"
              @update:options="binnacleQuery.onUpdateOptions"
            >
              <template #[`item.action`]="{ item }">
                <v-chip size="small" :color="getActionColor(item.action)" variant="tonal" label>
                  {{ item.action }}
                </v-chip>
              </template>

              <template #[`item.ip`]="{ item }">
                <span class="font-mono text-caption">{{ item.ip }}</span>
              </template>

              <template #[`item.description`]="{ item }">
                <span class="text-body-2">{{ item.description }}</span>
              </template>
            </v-data-table-server>
          </div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
