<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchExchangeRates, createExchangeRate, updateExchangeRate } from '../api/accounting.api'
import type { ExchangeRateItem } from '../types'
import AppModal from '@/components/common/AppModal.vue'

const accountingStore = useAccountingStore()

// Feedback / Notificaciones
const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

function showMessage(message: string, color: 'success' | 'error' | 'info' = 'success'): void {
  snackbar.value = { show: true, message, color }
}

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
    const curId = vesCurrency.value.id
    return fetchExchangeRates(curId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['date']
  }
)

const rateHeaders = [
  { title: 'Fecha de Vigencia', key: 'date', align: 'start' as const, sortable: true, width: '160px' },
  { title: 'Tasa de Cambio', key: 'value', align: 'end' as const, sortable: true, width: '180px' },
  { title: 'Fecha de Registro', key: 'created_at', align: 'center' as const, sortable: true, width: '200px' },
  { title: 'Moneda', key: 'currency', align: 'center' as const, sortable: false, width: '140px' }
]

const rateModalOpen = ref(false)
const isSubmittingRate = ref(false)
const rateForm = ref<{
  date: string
  value: number | null
}>({
  date: new Date().toISOString().substring(0, 10),
  value: null
})

const isExistingRate = computed(() => {
  if (!rateForm.value.date) return false
  return ratesQuery.items.value.some((r) => r.date === rateForm.value.date)
})

function openRateModal(): void {
  rateForm.value = {
    date: new Date().toISOString().substring(0, 10),
    value: currentVesRate.value ? Number(currentVesRate.value.value) : null
  }
  rateModalOpen.value = true
}

async function handleSaveRate(): Promise<void> {
  if (!rateForm.value.date) {
    showMessage('La fecha de vigencia es requerida.', 'error')
    return
  }
  if (!rateForm.value.value || rateForm.value.value <= 0) {
    showMessage('Ingresa una tasa de cambio válida mayor a 0.', 'error')
    return
  }
  isSubmittingRate.value = true
  try {
    const curId = vesCurrency.value.id
    const existingRate = ratesQuery.items.value.find(
      (r) => r.date === rateForm.value.date
    )

    if (existingRate) {
      await updateExchangeRate(curId, existingRate.id, {
        value: Number(rateForm.value.value)
      })
    } else {
      await createExchangeRate(curId, {
        date: rateForm.value.date,
        value: Number(rateForm.value.value)
      })
    }

    showMessage('Tasa de cambio actualizada exitosamente.')
    rateModalOpen.value = false
    await Promise.all([
      accountingStore.loadCurrentExchangeRate(curId),
      ratesQuery.refresh()
    ])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al registrar la tasa de cambio.'
    showMessage(msg, 'error')
  } finally {
    isSubmittingRate.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadCurrentExchangeRate(2)
  ])
  ratesQuery.refresh()
})
</script>

<template>
  <div class="exchange-rates-view">
    <!-- Encabezado de la Vista (Estilo Estándar sin card y sin icono) -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Tasas de Cambio de Divisas
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Configuración y consulta de las cotizaciones vigentes e históricas para operaciones en Bolívares
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          class="text-none font-weight-bold px-4"
          data-testid="btn-open-rate-modal"
          @click="openRateModal"
        >
          Actualizar Tasa
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
              data-testid="btn-mobile-rates-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-plus"
              title="Actualizar Tasa"
              @click="openRateModal"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Tarjeta de Tasa Activa Actual -->
    <v-card elevation="0" rounded="lg" class="border bg-white mb-6">
      <v-card-text class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-4 py-4">
        <div>
          <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase tracking-wide">
            Tasa de Cambio Vigente (VES / USD)
          </div>
          <div v-if="currentVesRate" class="d-flex flex-wrap align-baseline ga-2 mt-1">
            <span class="text-h4 font-weight-bold text-high-emphasis font-monospace" data-testid="current-rate-value">
              Bs. {{ Number(currentVesRate.value).toFixed(2) }}
            </span>
            <span class="text-body-2 text-medium-emphasis font-weight-medium">
              / 1.00 USD
            </span>
            <v-chip size="x-small" color="primary" variant="outlined" class="font-weight-medium ml-1">
              Vigente desde {{ currentVesRate.date }}
            </v-chip>
          </div>
          <div v-else class="d-flex align-center ga-2 mt-1" data-testid="no-active-rate-alert">
            <v-icon icon="mdi-alert-circle-outline" color="warning" size="20" />
            <span class="text-body-2 font-weight-medium text-warning">
              No se ha configurado una tasa de cambio activa
            </span>
          </div>
        </div>

        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-pencil-outline"
          class="text-none font-weight-medium"
          @click="openRateModal"
        >
          Modificar Tasa
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- Historial de Tasas de Cambio -->
    <v-card elevation="0" rounded="lg" class="border bg-white">
      <v-card-item class="py-3 px-4 border-b">
        <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-2">
          <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2 text-high-emphasis">
            <v-icon icon="mdi-history" color="primary" />
            Historial de Tasas de Cambio
          </v-card-title>
          <v-btn
            variant="text"
            color="primary"
            prepend-icon="mdi-refresh"
            size="small"
            @click="ratesQuery.refresh()"
          >
            Recargar Historial
          </v-btn>
        </div>
      </v-card-item>

      <v-data-table-server
        v-model:page="ratesQuery.page.value"
        v-model:items-per-page="ratesQuery.itemsPerPage.value"
        :headers="rateHeaders"
        :items="ratesQuery.items.value"
        :items-length="ratesQuery.totalItems.value"
        :loading="ratesQuery.isLoading.value"
        hover
        density="comfortable"
        data-testid="rates-table"
        @update:options="ratesQuery.onUpdateOptions"
      >
        <!-- Slot Fecha de Vigencia -->
        <template #[`item.date`]="{ item }">
          <div class="d-flex align-center ga-2 py-1 font-weight-medium text-body-2">
            <v-icon icon="mdi-calendar" size="small" color="grey-darken-1" />
            {{ item.date }}
          </div>
        </template>

        <!-- Slot Tasa de Cambio -->
        <template #[`item.value`]="{ item }">
          <span class="font-weight-bold text-body-1 font-monospace text-high-emphasis">
            Bs. {{ Number(item.value).toFixed(2) }}
          </span>
        </template>

        <!-- Slot Fecha de Creación -->
        <template #[`item.created_at`]="{ item }">
          <span class="text-caption text-medium-emphasis">
            {{ item.created_at || '-' }}
          </span>
        </template>

        <!-- Slot Moneda -->
        <template #[`item.currency`]>
          <v-chip size="x-small" color="primary" variant="outlined" class="font-weight-medium">
            VES (Bs.)
          </v-chip>
        </template>

        <!-- Estado Vacío -->
        <template #no-data>
          <div class="text-center py-8">
            <v-icon icon="mdi-currency-usd-off" size="48" color="grey" class="mb-2" />
            <div class="text-subtitle-1 text-grey font-weight-medium">
              No hay tasas de cambio registradas en el historial
            </div>
            <div class="text-caption text-grey mt-1">
              Haz clic en "Actualizar Tasa" para fijar la tasa de cambio vigente.
            </div>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Modal Estándar: Actualizar Tasa de Cambio -->
    <AppModal
      v-model="rateModalOpen"
      title="Actualizar Tasa de Cambio"
      subtitle="Ingresa la cotización en Bolívares (VES) y la fecha de vigencia"
      icon="mdi-currency-usd"
      icon-color="primary"
      :max-width="480"
      :persistent="true"
      :loading="isSubmittingRate"
      cancel-text="Cancelar"
      :submit-text="isExistingRate ? 'Actualizar' : 'Registrar'"
      submit-color="primary"
      submit-icon="mdi-check"
      submit-test-id="btn-save-rate"
      data-testid="rate-modal"
      @submit="handleSaveRate"
      @cancel="rateModalOpen = false"
    >
      <v-form @submit.prevent="handleSaveRate">
        <v-row density="compact" class="pt-2">
          <v-col cols="12">
            <v-text-field
              v-model="rateForm.date"
              label="Fecha de Vigencia *"
              type="date"
              variant="outlined"
              density="compact"
              data-testid="input-rate-date"
              required
            />
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-model.number="rateForm.value"
              label="Tasa de Cambio (Bs. por USD) *"
              type="number"
              step="0.01"
              min="0.01"
              prefix="Bs."
              variant="outlined"
              density="compact"
              placeholder="Ej: 54.20"
              data-testid="input-rate-value"
              required
              autofocus
            />
          </v-col>
        </v-row>
      </v-form>
    </AppModal>

    <!-- Snackbar de Notificación -->
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
