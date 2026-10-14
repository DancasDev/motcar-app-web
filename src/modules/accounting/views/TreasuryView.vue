<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import { fetchClientCredits } from '../api/accounting.api'
import type { ClientCreditItem } from '../types'

const branchesStore = useBranchesStore()
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

// ---------------------------------------------------------------------
// Saldos a Favor de Clientes (Créditos Disponibles)
// ---------------------------------------------------------------------
const creditsQuery = useDataQuery<ClientCreditItem>(
  async (params) => {
    if (!branchesStore.activeBranchId) {
      return { data: [], count: 0, limit: 10, in_trash: false }
    }
    return fetchClientCredits(branchesStore.activeBranchId, params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['client_first_name', 'client_last_name', 'receipt_code']
  }
)

async function handleVoidCredit(creditId: string | number): Promise<void> {
  if (!branchesStore.activeBranchId) return
  try {
    await accountingStore.voidCredit(branchesStore.activeBranchId, creditId)
    showMessage('Saldo a favor anulado administrativamente.')
    creditsQuery.refresh()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al anular el saldo a favor.'
    showMessage(msg, 'error')
  }
}

onMounted(async () => {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadBankAccounts()
  ])
  if (branchesStore.activeBranchId) {
    creditsQuery.refresh()
  }
})

async function refreshTreasuryData(): Promise<void> {
  await Promise.all([
    accountingStore.loadCurrencies(),
    accountingStore.loadBankAccounts()
  ])
  if (branchesStore.activeBranchId) {
    creditsQuery.refresh()
  }
}

watch(
  () => branchesStore.activeBranchId,
  (newBranchId) => {
    if (newBranchId) {
      creditsQuery.refresh()
    }
  }
)
</script>

<template>
  <div class="treasury-view">
    <!-- Alerta de Sucursal Activa Requerida -->
    <v-alert
      v-if="!branchesStore.activeBranchId"
      type="warning"
      variant="tonal"
      rounded="lg"
      title="Sucursal no seleccionada"
      text="Para gestionar Tesorería y Conciliación Bancaria, debes seleccionar una Sucursal Activa en la barra superior."
      class="mb-4"
      data-testid="no-branch-alert-treasury"
    />

    <!-- Encabezado de la Vista (Estilo Estándar sin card y sin icono) -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Tesorería, Bancos y Saldos a Favor
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Gestión de cuentas bancarias receptoras, catálogo de divisas y administración de créditos de clientes
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          variant="outlined"
          color="primary"
          prepend-icon="mdi-refresh"
          class="text-none font-weight-medium"
          data-testid="btn-refresh-treasury"
          @click="refreshTreasuryData"
        >
          Actualizar Datos
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
              data-testid="btn-mobile-treasury-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-refresh"
              title="Actualizar Datos"
              @click="refreshTreasuryData"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <v-row>
      <!-- Cuentas Receptoras / Bancos -->
      <v-col cols="12" md="6">
        <v-card elevation="0" rounded="lg" class="border bg-white fill-height">
          <v-card-item class="py-3 px-4 border-b">
            <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2 text-high-emphasis">
              <v-icon icon="mdi-bank" color="primary" />
              Cuentas Receptoras de Pago
            </v-card-title>
          </v-card-item>

          <v-table density="compact" class="text-body-2">
            <thead>
              <tr>
                <th>Nombre de la Cuenta</th>
                <th>Categoría</th>
                <th>Moneda</th>
                <th>Detalles / Número</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="acc in accountingStore.bankAccounts" :key="acc.id">
                <td class="font-weight-medium text-high-emphasis">{{ acc.name }}</td>
                <td class="text-medium-emphasis">{{ acc.category_name || 'Bancaria' }}</td>
                <td>
                  <v-chip size="x-small" color="primary" variant="outlined">
                    {{ acc.currency_code || 'USD' }}
                  </v-chip>
                </td>
                <td class="text-caption text-medium-emphasis">
                  {{ acc.metadata?.account_number || 'Cuenta de cobro' }}
                </td>
              </tr>
              <tr v-if="accountingStore.bankAccounts.length === 0">
                <td colspan="4" class="text-center py-4 text-medium-emphasis">
                  No hay cuentas bancarias configuradas
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>

      <!-- Monedas Configuradas -->
      <v-col cols="12" md="6">
        <v-card elevation="0" rounded="lg" class="border bg-white fill-height">
          <v-card-item class="py-3 px-4 border-b">
            <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2 text-high-emphasis">
              <v-icon icon="mdi-cash-multiple" color="primary" />
              Catálogo de Monedas del Sistema
            </v-card-title>
          </v-card-item>

          <v-table density="compact" class="text-body-2">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre de la Moneda</th>
                <th>Símbolo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cur in accountingStore.currencies" :key="cur.id">
                <td class="font-weight-bold text-high-emphasis">{{ cur.code }}</td>
                <td class="text-medium-emphasis">{{ cur.name }}</td>
                <td class="font-weight-medium">{{ cur.symbol }}</td>
                <td>
                  <v-chip
                    :color="String(cur.is_disabled) === '0' ? 'success' : 'default'"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ String(cur.is_disabled) === '0' ? 'Activa' : 'Inactiva' }}
                  </v-chip>
                </td>
              </tr>
              <tr v-if="accountingStore.currencies.length === 0">
                <td colspan="4" class="text-center py-4 text-medium-emphasis">
                  No hay monedas registradas
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>

      <!-- Saldos a Favor de Clientes -->
      <v-col cols="12">
        <v-card elevation="0" rounded="lg" class="border bg-white">
          <v-card-item class="py-3 px-4 border-b">
            <div class="d-flex flex-column flex-sm-row justify-space-between align-start align-sm-center ga-2">
              <v-card-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2 text-high-emphasis">
                <v-icon icon="mdi-cash-refund" color="primary" />
                Saldos a Favor de Clientes (Créditos Disponibles)
              </v-card-title>
              <v-btn
                variant="text"
                color="primary"
                prepend-icon="mdi-refresh"
                size="small"
                @click="creditsQuery.refresh()"
              >
                Recargar Saldos
              </v-btn>
            </div>
          </v-card-item>

          <v-table density="compact" class="text-body-2">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Recibo Origen</th>
                <th>Monto Inicial</th>
                <th>Saldo Disponible</th>
                <th>Estado</th>
                <th class="text-end">Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in creditsQuery.items.value" :key="c.id">
                <td>#{{ c.id }}</td>
                <td class="font-weight-medium text-high-emphasis">
                  {{ c.client_first_name }} {{ c.client_last_name }}
                </td>
                <td>
                  <span class="font-monospace text-primary">{{ c.receipt_code || `#${c.receipt_id}` }}</span>
                </td>
                <td>${{ Number(c.amount).toFixed(2) }}</td>
                <td class="font-weight-bold text-high-emphasis">
                  ${{ Number(c.available_amount).toFixed(2) }}
                </td>
                <td>
                  <v-chip
                    :color="String(c.status) === '0' ? 'success' : String(c.status) === '1' ? 'default' : 'error'"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ String(c.status) === '0' ? 'Disponible' : String(c.status) === '1' ? 'Consumido' : 'Anulado' }}
                  </v-chip>
                </td>
                <td class="text-end">
                  <v-btn
                    v-if="String(c.status) === '0' && Number(c.available_amount) === Number(c.amount)"
                    size="x-small"
                    color="error"
                    variant="text"
                    @click="handleVoidCredit(c.id)"
                  >
                    Anular
                  </v-btn>
                </td>
              </tr>
              <tr v-if="creditsQuery.items.value.length === 0">
                <td colspan="7" class="text-center py-4 text-medium-emphasis">
                  No hay saldos a favor pendientes en esta sucursal
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

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
