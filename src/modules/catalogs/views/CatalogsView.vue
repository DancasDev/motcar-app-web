<script setup lang="ts">
import { ref } from 'vue'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchCountries,
  fetchLanguages,
  fetchDocumentTypes,
  fetchNotificationTypes,
  fetchCountryTimezones
} from '../api/catalogs.api'
import type {
  CountryItem,
  LanguageItem,
  DocumentTypeItem,
  NotificationTypeItem,
  CountryTimeZoneItem
} from '../types'

type CatalogTab = 'countries' | 'document-types' | 'languages' | 'notification-types'
const activeTab = ref<CatalogTab>('countries')

// Helper para parsear nombres localizados devueltos en formato JSON o string
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

// 1. Consulta Reactiva para Países
const countryQuery = useDataQuery<CountryItem>(fetchCountries, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name']
})

const countryHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código ISO', key: 'code', align: 'start' as const, sortable: true, width: '130px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Zonas Horarias', key: 'timezones', align: 'center' as const, sortable: false, width: '150px' },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]

// Diálogo de Zonas Horarias por País
const timezonesDialogOpen = ref(false)
const selectedCountry = ref<CountryItem | null>(null)
const countryTimezones = ref<CountryTimeZoneItem[]>([])
const isLoadingCountryTimezones = ref(false)

async function openTimezonesDialog(country: CountryItem): Promise<void> {
  selectedCountry.value = country
  timezonesDialogOpen.value = true
  isLoadingCountryTimezones.value = true
  countryTimezones.value = []
  try {
    const res = await fetchCountryTimezones(country.id, { itemsPerPage: 100 })
    countryTimezones.value = res.data
  } catch {
    countryTimezones.value = []
  } finally {
    isLoadingCountryTimezones.value = false
  }
}

// 2. Consulta Reactiva para Tipos de Documento
const documentTypeQuery = useDataQuery<DocumentTypeItem>(fetchDocumentTypes, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name']
})

const documentTypeHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '160px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Dimensiones', key: 'dimensions', align: 'center' as const, sortable: false, width: '160px' },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]

// 3. Consulta Reactiva para Idiomas
const languageQuery = useDataQuery<LanguageItem>(fetchLanguages, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name']
})

const languageHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código ISO', key: 'code', align: 'start' as const, sortable: true, width: '130px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]

// 4. Consulta Reactiva para Tipos de Notificación
const notificationTypeQuery = useDataQuery<NotificationTypeItem>(fetchNotificationTypes, {
  initialItemsPerPage: 10,
  searchFields: ['code', 'name']
})

const notificationTypeHeaders = [
  { title: 'ID', key: 'id', align: 'start' as const, sortable: true, width: '90px' },
  { title: 'Código', key: 'code', align: 'start' as const, sortable: true, width: '180px' },
  { title: 'Nombre', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Canales', key: 'channels', align: 'center' as const, sortable: true, width: '130px' },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '130px' }
]
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-card elevation="2" rounded="lg">
        <v-card-item class="pb-2">
          <div class="d-flex align-center justify-space-between flex-wrap">
            <div>
              <v-card-title class="text-h5 font-weight-bold d-flex align-center">
                <v-icon icon="mdi-book-open-page-variant" color="primary" class="mr-2" />
                Catálogos Maestros (DQB)
              </v-card-title>
              <v-card-subtitle>
                Gestión y consulta de catálogos globales con soporte de motor DQB
              </v-card-subtitle>
            </div>
            <v-chip color="primary" variant="tonal" class="mt-2 mt-sm-0">
              <v-icon start icon="mdi-database-search" />
              Motor DQB Activo
            </v-chip>
          </div>
        </v-card-item>

        <!-- Selector de Pestañas -->
        <v-tabs v-model="activeTab" color="primary" class="border-b px-4">
          <v-tab value="countries" class="text-none" data-testid="tab-countries">
            <v-icon start icon="mdi-earth" />
            Países ({{ countryQuery.totalItems.value }})
          </v-tab>
          <v-tab value="document-types" class="text-none" data-testid="tab-document-types">
            <v-icon start icon="mdi-file-document-outline" />
            Tipos de Documento ({{ documentTypeQuery.totalItems.value }})
          </v-tab>
          <v-tab value="languages" class="text-none" data-testid="tab-languages">
            <v-icon start icon="mdi-translate" />
            Idiomas ({{ languageQuery.totalItems.value }})
          </v-tab>
          <v-tab value="notification-types" class="text-none" data-testid="tab-notification-types">
            <v-icon start icon="mdi-bell-outline" />
            Tipos de Notificación ({{ notificationTypeQuery.totalItems.value }})
          </v-tab>
        </v-tabs>

        <v-card-text class="pt-4">
          <!-- 1. Vista de Países -->
          <div v-if="activeTab === 'countries'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="countryQuery.search.value"
                placeholder="Buscar país por código o nombre..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-input"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="countryQuery.isLoading.value"
                @click="countryQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="countryHeaders"
              :items="countryQuery.items.value"
              :items-length="countryQuery.totalItems.value"
              :loading="countryQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="catalogs-table"
              @update:options="countryQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <v-chip size="small" color="primary" variant="flat" label>
                  {{ item.code }}
                </v-chip>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
              </template>

              <template #[`item.timezones`]="{ item }">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="primary"
                  prepend-icon="mdi-clock-outline"
                  class="text-none font-weight-medium"
                  data-testid="btn-view-timezones"
                  @click="openTimezonesDialog(item)"
                >
                  Ver Zonas
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

          <!-- 2. Vista de Tipos de Documento -->
          <div v-else-if="activeTab === 'document-types'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="documentTypeQuery.search.value"
                placeholder="Buscar tipo de documento..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-input"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="documentTypeQuery.isLoading.value"
                @click="documentTypeQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="documentTypeHeaders"
              :items="documentTypeQuery.items.value"
              :items-length="documentTypeQuery.totalItems.value"
              :loading="documentTypeQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="catalogs-table"
              @update:options="documentTypeQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <v-chip size="small" color="info" variant="flat" label>
                  {{ item.code }}
                </v-chip>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
              </template>

              <template #[`item.dimensions`]="{ item }">
                <span v-if="item.width && item.height" class="text-caption text-grey-darken-1 font-mono">
                  {{ item.width }} × {{ item.height }}
                </span>
                <span v-else class="text-caption text-grey">N/A</span>
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

          <!-- 3. Vista de Idiomas -->
          <div v-else-if="activeTab === 'languages'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="languageQuery.search.value"
                placeholder="Buscar idioma..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-input"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="languageQuery.isLoading.value"
                @click="languageQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="languageHeaders"
              :items="languageQuery.items.value"
              :items-length="languageQuery.totalItems.value"
              :loading="languageQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="catalogs-table"
              @update:options="languageQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <v-chip size="small" color="secondary" variant="flat" label>
                  {{ item.code }}
                </v-chip>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
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

          <!-- 4. Vista de Tipos de Notificación -->
          <div v-else-if="activeTab === 'notification-types'">
            <div class="d-flex align-center justify-space-between flex-wrap mb-4 ga-3">
              <v-text-field
                v-model="notificationTypeQuery.search.value"
                placeholder="Buscar tipo de notificación..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                max-width="360"
                data-testid="search-input"
              />
              <v-btn
                prepend-icon="mdi-refresh"
                variant="outlined"
                size="small"
                :loading="notificationTypeQuery.isLoading.value"
                @click="notificationTypeQuery.refresh()"
              >
                Actualizar
              </v-btn>
            </div>

            <v-data-table-server
              :headers="notificationTypeHeaders"
              :items="notificationTypeQuery.items.value"
              :items-length="notificationTypeQuery.totalItems.value"
              :loading="notificationTypeQuery.isLoading.value"
              density="comfortable"
              hover
              data-testid="catalogs-table"
              @update:options="notificationTypeQuery.onUpdateOptions"
            >
              <template #[`item.code`]="{ item }">
                <v-chip size="small" color="warning" variant="flat" label>
                  {{ item.code }}
                </v-chip>
              </template>

              <template #[`item.name`]="{ item }">
                <span class="font-weight-medium">{{ formatName(item.name) }}</span>
              </template>

              <template #[`item.channels`]="{ item }">
                <v-chip size="small" variant="tonal" color="primary">
                  Canal {{ item.channels }}
                </v-chip>
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
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Diálogo de Zonas Horarias por País -->
    <v-dialog v-model="timezonesDialogOpen" max-width="560" data-testid="dialog-country-timezones">
      <v-card rounded="lg">
        <v-card-item class="bg-primary text-white">
          <v-card-title class="d-flex align-center">
            <v-icon icon="mdi-clock-outline" class="mr-2" />
            Zonas Horarias: {{ selectedCountry ? formatName(selectedCountry.name) : '' }}
          </v-card-title>
          <v-card-subtitle class="text-white-darken-1">
            Código ISO: {{ selectedCountry?.code?.toUpperCase() }}
          </v-card-subtitle>
        </v-card-item>

        <v-card-text class="pt-4">
          <div v-if="isLoadingCountryTimezones" class="text-center py-6">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-2 text-caption text-grey">Cargando zonas horarias...</div>
          </div>

          <div v-else-if="countryTimezones.length === 0" class="text-center py-6 text-grey">
            <v-icon icon="mdi-alert-circle-outline" size="large" class="mb-2" />
            <p>No se encontraron zonas horarias configuradas para este país.</p>
          </div>

          <v-list v-else lines="two">
            <v-list-item
              v-for="tz in countryTimezones"
              :key="tz.id"
              class="border-b"
            >
              <template #prepend>
                <v-icon icon="mdi-map-marker-radius" color="secondary" />
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ tz.time_zone_code }}
              </v-list-item-title>
              <v-list-item-subtitle>
                ID Zona: {{ tz.time_zone_id }}
              </v-list-item-subtitle>

              <template #append>
                <v-chip
                  v-if="tz.is_default === '1' || tz.is_default === 1"
                  size="small"
                  color="primary"
                  variant="flat"
                  label
                >
                  Principal
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4 justify-end">
          <v-btn
            variant="tonal"
            color="primary"
            data-testid="btn-close-timezones"
            @click="timezonesDialogOpen = false"
          >
            Cerrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>
