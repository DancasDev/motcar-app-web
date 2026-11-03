<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchExchangeRates,
  createExchangeRate,
  updateExchangeRate,
  deleteExchangeRate
} from '../api/accounting.api'
import type { ExchangeRateItem } from '../types'
import AppModal from '@/components/common/AppModal.vue'

const { smAndDown } = useDisplay()
const accountingStore = useAccountingStore()

const vesCurrency = computed(() => {
  return (
    accountingStore.currencies.find((c) => c.code === 'VES') || {
      id: 2,
      name: 'Bolívar Digital',
      code: 'VES',
      symbol: 'Bs.'
    }
  )
})

const currentVesRate = computed(() => {
  const curId = String(vesCurrency.value.id)
  return accountingStore.currentRates[curId] || null
})

const ratesQuery = useDataQuery<ExchangeRateItem>(
  async (params) => {
    return fetchExchangeRates(vesCurrency.value.id, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['date'],
    defaultOrder: { date: 'DESC' }
  }
)

const rateHeaders = [
  { title: 'Fecha', key: 'date', align: 'start' as const, sortable: true, width: '180px' },
  { title: 'Tasa', key: 'value', align: 'start' as const, sortable: true },
  { title: 'Estado', key: 'status', align: 'center' as const, sortable: false, width: '130px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '80px' }
]

function formatRate(val: number | string | null | undefined): string {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })
}

function isCurrentRate(item: ExchangeRateItem): boolean {
  const today = getTodayString()
  if (item.date > today) return false
  if (currentVesRate.value?.date && currentVesRate.value.date <= today) {
    return currentVesRate.value.date === item.date
  }
  const validRates = ratesQuery.items.value
    .filter((r) => r.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))
  return validRates.length > 0 && validRates[0].id === item.id
}

function getRateStatus(item: ExchangeRateItem): { label: string; color: string } {
  const today = getTodayString()
  if (item.date > today) {
    return { label: 'Futura', color: 'warning' }
  }
  if (isCurrentRate(item)) {
    return { label: 'Vigente', color: 'success' }
  }
  return { label: 'Histórico', color: 'grey' }
}

async function refreshAll(): Promise<void> {
  await Promise.all([
    accountingStore.loadCurrentExchangeRate(vesCurrency.value.id),
    ratesQuery.refresh()
  ])
}

// ---------------------------------------------------------------------
// Crear / Editar Tasa
// ---------------------------------------------------------------------
const rateModalOpen = ref(false)
const isSubmittingRate = ref(false)
const editingRateId = ref<string | number | null>(null)
const rateForm = ref<{
  date: string
  value: number | null
}>({
  date: '',
  value: null
})

function getTodayString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const todayStr = computed(() => getTodayString())

function openCreateDialog(): void {
  editingRateId.value = null
  rateForm.value = {
    date: getTodayString(),
    value: null
  }
  rateModalOpen.value = true
}

function openEditDialog(item: ExchangeRateItem): void {
  editingRateId.value = item.id
  rateForm.value = {
    date: item.date,
    value: Number(item.value)
  }
  rateModalOpen.value = true
}

async function handleSaveRate(): Promise<void> {
  if (!rateForm.value.date) {
    showMessage('La fecha de vigencia es obligatoria.', 'error')
    return
  }
  if (rateForm.value.date > getTodayString()) {
    showMessage('La fecha de vigencia no puede ser mayor al día de hoy.', 'error')
    return
  }
  if (!rateForm.value.value || rateForm.value.value <= 0) {
    showMessage('Ingresa una tasa válida mayor a 0.', 'error')
    return
  }

  isSubmittingRate.value = true
  try {
    const curId = vesCurrency.value.id
    const targetId =
      editingRateId.value ??
      ratesQuery.items.value.find((r) => r.date === rateForm.value.date)?.id

    if (targetId) {
      await updateExchangeRate(curId, targetId, {
        date: rateForm.value.date,
        value: Number(rateForm.value.value)
      })
      showMessage('Tasa actualizada exitosamente.')
    } else {
      await createExchangeRate(curId, {
        date: rateForm.value.date,
        value: Number(rateForm.value.value)
      })
      showMessage('Tasa registrada exitosamente.')
    }

    rateModalOpen.value = false
    await refreshAll()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { messages?: Record<string, string> | string } } }
    let msg =
      typeof axiosErr.response?.data?.messages === 'string'
        ? axiosErr.response.data.messages
        : Object.values(axiosErr.response?.data?.messages || {})[0]
    if (msg === 'El campo debe contener un valor único.') {
      msg = 'Ya existe una tasa registrada para la fecha seleccionada.'
    }
    showMessage(msg || (err instanceof Error ? err.message : 'Error al guardar la tasa.'), 'error')
  } finally {
    isSubmittingRate.value = false
  }
}

// ---------------------------------------------------------------------
// Eliminar Tasa
// ---------------------------------------------------------------------
const deleteDialogOpen = ref(false)
const rateToDelete = ref<ExchangeRateItem | null>(null)
const isDeletingRate = ref(false)

function promptDeleteRate(item: ExchangeRateItem): void {
  rateToDelete.value = item
  deleteDialogOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  if (!rateToDelete.value) return
  isDeletingRate.value = true
  try {
    await deleteExchangeRate(vesCurrency.value.id, rateToDelete.value.id)
    showMessage('Tasa eliminada exitosamente.')
    deleteDialogOpen.value = false
    rateToDelete.value = null
    await refreshAll()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { messages?: Record<string, string> | string } } }
    const serverMsg =
      typeof axiosErr.response?.data?.messages === 'string'
        ? axiosErr.response.data.messages
        : Object.values(axiosErr.response?.data?.messages || {})[0]
    const msg = serverMsg || (err instanceof Error ? err.message : 'Error al eliminar la tasa.')
    showMessage(msg, 'error')
  } finally {
    isDeletingRate.value = false
  }
}

// ---------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

function showMessage(text: string, color: 'success' | 'error' = 'success'): void {
  if (snackbar.value.show) {
    snackbar.value.show = false
    setTimeout(() => {
      snackbar.value = { show: true, text, color }
    }, 80)
  } else {
    snackbar.value = { show: true, text, color }
  }
}

onMounted(async () => {
  await accountingStore.loadCurrencies()
  await accountingStore.loadCurrentExchangeRate(vesCurrency.value.id)
})
</script>

<template>
  <div class="exchange-rates-module">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: TÍTULO Y BOTÓN AGREGAR REGISTRO             -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-9">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Tasas de Cambio
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Control de cotizaciones y vigencia cambiaria en bolívares (VES)
        </p>
      </div>

      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        class="text-none font-weight-bold px-4"
        data-testid="btn-open-rate-modal"
        @click="openCreateDialog"
      >
        Registrar
      </v-btn>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA Y BOTÓN DE RECARGA        -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" align="center" justify="space-between" class="mb-3">
      <v-col cols="10" sm="9" md="7">
        <v-text-field
          v-model="ratesQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por fecha (YYYY-MM-DD)..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="rate-search-input"
        />
      </v-col>

      <v-col cols="auto">
        <v-tooltip
          text="Recargar la tabla"
          location="top"
          color="#1E293B"
        >
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              icon="mdi-refresh"
              variant="flat"
              color="white"
              size="small"
              class="border rounded-circle flex-shrink-0"
              :loading="ratesQuery.isLoading.value"
              data-testid="btn-refresh-rates"
              @click="refreshAll"
            />
          </template>
        </v-tooltip>
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TERCERA SECCIÓN: TABLA CON FONDO BLANCO Y ACCIONES           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="ratesQuery.itemsPerPage.value"
        v-model:page="ratesQuery.page.value"
        v-model:sort-by="ratesQuery.sortBy.value"
        :headers="rateHeaders"
        :items="ratesQuery.items.value"
        :items-length="ratesQuery.totalItems.value"
        :loading="ratesQuery.isLoading.value"
        :mobile="smAndDown"
        no-data-text="No hay datos disponibles"
        loading-text="Cargando tasas..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="rates-table"
        @update:options="ratesQuery.onUpdateOptions"
      >
        <template #[`item.date`]="{ item }">
          <span class="font-weight-bold text-body-2 text-high-emphasis">
            {{ item.date }}
          </span>
        </template>

        <template #[`item.value`]="{ item }">
          <span class="font-weight-bold text-body-2 text-high-emphasis">
            Bs. {{ formatRate(item.value) }}
          </span>
        </template>

        <template #[`item.status`]="{ item }">
          <v-chip
            size="small"
            :color="getRateStatus(item).color"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ getRateStatus(item).label }}
          </v-chip>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center justify-end">
            <v-menu location="bottom end">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-dots-vertical"
                  variant="text"
                  size="small"
                  color="medium-emphasis"
                  data-testid="btn-rate-actions-menu"
                />
              </template>
              <v-list density="compact" rounded="md" elevation="4" class="py-1 min-w-160">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  data-testid="menu-item-edit-rate"
                  @click="openEditDialog(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  prepend-icon="mdi-trash-can-outline"
                  title="Eliminar"
                  base-color="error"
                  data-testid="menu-item-delete-rate"
                  @click="promptDeleteRate(item)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Modal: Registrar / Editar -->
    <AppModal
      v-model="rateModalOpen"
      :title="editingRateId ? 'Editar' : 'Registrar'"
      :subtitle="editingRateId ? 'Modifica los datos de la tasa seleccionada' : 'Ingresa la fecha de vigencia y el valor de la tasa'"
      max-width="460"
      persistent
      :loading="isSubmittingRate"
      :submit-text="editingRateId ? 'Actualizar' : 'Registrar'"
      :submit-icon="editingRateId ? 'mdi-check' : 'mdi-plus'"
      submit-test-id="btn-save-rate"
      form-id="form-exchange-rate"
      data-testid="rate-modal"
      @submit="handleSaveRate"
    >
      <v-form id="form-exchange-rate" @submit.prevent="handleSaveRate">
        <v-text-field
          v-model="rateForm.date"
          label="Fecha de Vigencia *"
          type="date"
          :max="todayStr"
          variant="outlined"
          density="comfortable"
          persistent-placeholder
          class="mb-3"
          data-testid="input-rate-date"
        />
        <v-text-field
          v-model.number="rateForm.value"
          label="Tasa (Bs. por USD) *"
          type="number"
          step="0.01"
          min="0.01"
          prefix="Bs."
          variant="outlined"
          density="comfortable"
          placeholder="Ej: 45.25"
          data-testid="input-rate-value"
        />
      </v-form>
    </AppModal>

    <!-- Modal: Confirmar Eliminación -->
    <AppModal
      v-model="deleteDialogOpen"
      title="Eliminar"
      subtitle="Esta acción eliminará la cotización de forma permanente"
      max-width="460"
      :loading="isDeletingRate"
      submit-text="Eliminar"
      submit-color="error"
      submit-icon="mdi-trash-can"
      @submit="handleConfirmDelete"
    >
      <div class="py-2">
        <p class="text-body-2 text-high-emphasis mb-3">
          ¿Estás seguro de que deseas eliminar la tasa del
          <strong>{{ rateToDelete?.date }}</strong>?
        </p>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
          text="El registro se eliminará y se recalculará la tasa vigente en el sistema."
          rounded="lg"
        />
      </div>
    </AppModal>

    <!-- Snackbar de Notificaciones -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3500"
      location="bottom right"
      data-testid="rates-snackbar"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>
