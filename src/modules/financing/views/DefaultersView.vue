<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { fetchBranchDefaulters, fetchSamGroups } from '../api/financing.api'
import type { DefaulterItem, SamGroupItem } from '../types'
import { money, waLink } from '@/utils/format'
import StatementModal from '../components/StatementModal.vue'

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()

const defaulters = ref<DefaulterItem[]>([])
const groups = ref<SamGroupItem[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedGroupId = ref<number | string | null>(null)
const selectedBucket = ref<'all' | '1-15' | '16-30' | '30plus' | 'awarded'>('all')

// Estado de cuenta modal
const statementModalOpen = ref(false)
const selectedParticipantId = ref<number | string | null>(null)

async function loadDefaulters(): Promise<void> {
  if (!branchesStore.activeBranchId) {
    defaulters.value = []
    return
  }
  isLoading.value = true
  try {
    const res = await fetchBranchDefaulters(
      branchesStore.activeBranchId,
      selectedGroupId.value ? Number(selectedGroupId.value) : undefined
    )
    defaulters.value = res.data || []
  } catch (err) {
    console.error('Error al cargar cartera de morosos:', err)
    defaulters.value = []
  } finally {
    isLoading.value = false
  }
}

async function loadGroups(): Promise<void> {
  if (!branchesStore.activeBranchId) return
  try {
    const res = await fetchSamGroups(branchesStore.activeBranchId, { itemsPerPage: 100 })
    groups.value = res.data || []
  } catch (err) {
    console.error('Error al cargar grupos:', err)
  }
}

onMounted(() => {
  loadDefaulters()
  loadGroups()
})

watch(() => branchesStore.activeBranchId, () => {
  loadDefaulters()
  loadGroups()
})

watch(selectedGroupId, () => {
  loadDefaulters()
})

const filteredDefaulters = computed(() => {
  let list = defaulters.value

  // Filtro por tramo de mora
  if (selectedBucket.value === '1-15') {
    list = list.filter(d => d.days_overdue >= 1 && d.days_overdue <= 15)
  } else if (selectedBucket.value === '16-30') {
    list = list.filter(d => d.days_overdue >= 16 && d.days_overdue <= 30)
  } else if (selectedBucket.value === '30plus') {
    list = list.filter(d => d.days_overdue > 30)
  } else if (selectedBucket.value === 'awarded') {
    list = list.filter(d => d.is_awarded)
  }

  // Filtro de búsqueda textual
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d => {
      const name = (d.client.name || '').toLowerCase()
      const idVal = (d.client.identification_value || '').toLowerCase()
      const grp = (d.group_name || '').toLowerCase()
      const refName = (d.referrer?.name || '').toLowerCase()
      return name.includes(q) || idVal.includes(q) || grp.includes(q) || refName.includes(q)
    })
  }

  return list
})

const summary = computed(() => {
  const totalAmount = defaulters.value.reduce((acc, d) => acc + (d.overdue_amount || 0), 0)
  const totalCount = defaulters.value.length
  const criticalCount = defaulters.value.filter(d => d.days_overdue > 30 || d.is_awarded).length
  const awardedDefaulters = defaulters.value.filter(d => d.is_awarded).length
  return { totalAmount, totalCount, criticalCount, awardedDefaulters }
})

const headers = [
  { title: 'Cliente / Cédula', key: 'client', align: 'start' as const },
  { title: 'Grupo / Posición', key: 'group', align: 'start' as const, width: '160px' },
  { title: 'Cuotas Vencidas', key: 'overdue_installments', align: 'center' as const, width: '150px' },
  { title: 'Días de Mora', key: 'days_overdue', align: 'center' as const, width: '130px' },
  { title: 'Monto Vencido', key: 'overdue_amount', align: 'end' as const, width: '140px' },
  { title: 'Beneficio', key: 'is_awarded', align: 'center' as const, width: '150px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '150px' }
]

function getDaysColor(days: number): string {
  if (days <= 15) return 'warning'
  if (days <= 30) return 'deep-orange'
  return 'error'
}

function openStatement(participantId: number | string): void {
  selectedParticipantId.value = participantId
  statementModalOpen.value = true
}

function getClientWaLink(item: DefaulterItem): string | null {
  const msg = `Estimado(a) ${item.client.name}, le saludamos de MotCar. Le recordamos que presenta un saldo vencido de ${money(item.overdue_amount)} correspondiente a ${item.overdue_installments} cuota(s) en el grupo ${item.group_name}. Por favor contáctenos para regularizar su estatus.`
  return waLink(item.client.phone_primary, msg)
}

function getReferrerWaLink(item: DefaulterItem): string | null {
  if (!item.referrer?.phone) return null
  const msg = `Hola ${item.referrer.name}, le contactamos de MotCar respecto a su referido ${item.client.name} en el grupo ${item.group_name}. Presenta un atraso de ${item.overdue_installments} cuota(s) (${money(item.overdue_amount)}). Le agradecemos su apoyo para contactarlo.`
  return waLink(item.referrer.phone, msg)
}
</script>

<template>
  <div class="defaulters-view" data-testid="defaulters-view">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CABECERA: TÍTULO, SUBTÍTULO Y ACCIONES                      -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Cartera de Morosos
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Gestión preventiva de cuotas vencidas y seguimiento de alertas de adjudicación
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          variant="outlined"
          color="primary"
          density="comfortable"
          prepend-icon="mdi-refresh"
          class="text-none font-weight-medium"
          :loading="isLoading"
          data-testid="defaulters-refresh-btn"
          @click="loadDefaulters"
        >
          Actualizar
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
              data-testid="defaulters-mobile-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-refresh"
              title="Actualizar"
              :disabled="isLoading"
              @click="loadDefaulters"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TARJETAS DE RESUMEN EJECUTIVO                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-4" data-testid="defaulters-kpis">
      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-error text-uppercase">Total en Mora</span>
            <v-icon size="20" color="error">mdi-cash-remove</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-error" data-testid="defaulters-total-amount">
            {{ money(summary.totalAmount) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            En todas las cuotas vencidas activas
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Clientes Morosos</span>
            <v-icon size="20" color="warning">mdi-account-clock</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-high-emphasis" data-testid="defaulters-total-count">
            {{ summary.totalCount }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ summary.criticalCount }} en mora crítica (+30 días)
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-purple text-uppercase">Adjudicados con Mora</span>
            <v-icon size="20" color="purple">mdi-car-alert</v-icon>
          </div>
          <div class="text-h6 font-weight-bold" :class="summary.awardedDefaulters > 0 ? 'text-error' : 'text-high-emphasis'">
            {{ summary.awardedDefaulters }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Vehículos en riesgo por atraso
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- FILTROS Y BÚSQUEDA                                         -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white pa-3 mb-4">
      <v-row density="compact" align="center">
        <!-- Búsqueda textual -->
        <v-col cols="12" md="5">
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="mdi-magnify"
            placeholder="Buscar por cliente, cédula, grupo o referente..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            data-testid="defaulters-search-input"
          />
        </v-col>

        <!-- Filtro por Grupo -->
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="selectedGroupId"
            :items="[{ title: 'Todos los grupos', value: null }, ...groups.map(g => ({ title: g.name, value: g.id }))]"
            placeholder="Todos los grupos"
            variant="outlined"
            density="compact"
            hide-details
            data-testid="defaulters-group-filter"
          />
        </v-col>

        <!-- Tramos de Mora -->
        <v-col cols="12" sm="6" md="4">
          <div class="d-flex flex-wrap align-center ga-1">
            <v-btn
              size="small"
              :variant="selectedBucket === 'all' ? 'flat' : 'outlined'"
              :color="selectedBucket === 'all' ? 'primary' : 'default'"
              @click="selectedBucket = 'all'"
            >
              Todos
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedBucket === '1-15' ? 'flat' : 'outlined'"
              :color="selectedBucket === '1-15' ? 'warning' : 'default'"
              @click="selectedBucket = '1-15'"
            >
              1-15d
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedBucket === '16-30' ? 'flat' : 'outlined'"
              :color="selectedBucket === '16-30' ? 'deep-orange' : 'default'"
              @click="selectedBucket = '16-30'"
            >
              16-30d
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedBucket === '30plus' ? 'flat' : 'outlined'"
              :color="selectedBucket === '30plus' ? 'error' : 'default'"
              @click="selectedBucket = '30plus'"
            >
              +30d
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedBucket === 'awarded' ? 'flat' : 'outlined'"
              :color="selectedBucket === 'awarded' ? 'purple' : 'default'"
              @click="selectedBucket = 'awarded'"
            >
              Adjudicados
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TABLA DE MOROSOS                                           -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table
        :headers="headers"
        :items="filteredDefaulters"
        :loading="isLoading"
        :mobile="smAndDown"
        density="comfortable"
        hover
        :items-per-page="20"
        no-data-text="No se encontraron clientes morosos con los filtros seleccionados"
        data-testid="defaulters-table"
      >
        <!-- Columna Cliente -->
        <template #[`item.client`]="{ item }">
          <div class="py-1">
            <div class="font-weight-bold text-body-2 text-high-emphasis">
              {{ item.client.name }}
            </div>
            <div class="text-caption text-medium-emphasis d-flex align-center ga-1">
              <span>{{ item.client.identification_type === '0' ? 'V' : 'E' }}-{{ item.client.identification_value }}</span>
              <span v-if="item.client.phone_primary">&bull;</span>
              <span v-if="item.client.phone_primary" class="font-mono">{{ item.client.phone_primary }}</span>
            </div>
            <div v-if="item.referrer" class="text-caption text-primary">
              Ref: {{ item.referrer.name }}
            </div>
          </div>
        </template>

        <!-- Columna Grupo / Posición -->
        <template #[`item.group`]="{ item }">
          <div>
            <div class="font-weight-medium text-body-2">{{ item.group_name }}</div>
            <v-chip size="x-small" variant="tonal" color="info" class="font-weight-bold mt-1">
              Turno #{{ item.position }}
            </v-chip>
          </div>
        </template>

        <!-- Columna Cuotas Vencidas -->
        <template #[`item.overdue_installments`]="{ item }">
          <div class="text-center">
            <span class="font-weight-bold text-body-2 text-error">
              {{ item.overdue_installments }}
            </span>
            <div v-if="item.oldest_due_date" class="text-caption text-medium-emphasis font-mono">
              Desde {{ item.oldest_due_date }}
            </div>
          </div>
        </template>

        <!-- Columna Días de Mora -->
        <template #[`item.days_overdue`]="{ item }">
          <div class="text-center">
            <v-chip
              size="small"
              :color="getDaysColor(item.days_overdue)"
              variant="flat"
              class="font-weight-bold"
            >
              {{ item.days_overdue }} días
            </v-chip>
          </div>
        </template>

        <!-- Columna Monto Vencido -->
        <template #[`item.overdue_amount`]="{ item }">
          <div class="font-weight-bold text-body-2 text-error">
            {{ money(item.overdue_amount) }}
          </div>
        </template>

        <!-- Columna Entrega / Beneficio -->
        <template #[`item.is_awarded`]="{ item }">
          <div class="text-center">
            <v-chip
              v-if="item.is_awarded"
              color="error"
              variant="flat"
              size="small"
              class="font-weight-bold"
              prepend-icon="mdi-car-alert"
            >
              Entregado
            </v-chip>
            <v-chip
              v-else
              size="small"
              variant="tonal"
              color="grey"
            >
              En espera
            </v-chip>
          </div>
        </template>

        <!-- Columna Acciones -->
        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center justify-end ga-1">
            <!-- WhatsApp Cliente -->
            <v-btn
              v-if="getClientWaLink(item)"
              :href="getClientWaLink(item)!"
              target="_blank"
              rel="noopener"
              icon="mdi-whatsapp"
              size="small"
              variant="text"
              color="success"
              title="Contactar al cliente por WhatsApp"
              data-testid="defaulter-wa-client-btn"
            />

            <!-- WhatsApp Referente -->
            <v-btn
              v-if="getReferrerWaLink(item)"
              :href="getReferrerWaLink(item)!"
              target="_blank"
              rel="noopener"
              icon="mdi-account-arrow-right"
              size="small"
              variant="text"
              color="primary"
              :title="`Contactar al referente (${item.referrer?.name}) por WhatsApp`"
              data-testid="defaulter-wa-referrer-btn"
            />

            <!-- Cartola / Estado de Cuenta -->
            <v-btn
              icon="mdi-file-document-outline"
              size="small"
              variant="text"
              color="info"
              title="Ver Estado de Cuenta"
              data-testid="defaulter-statement-btn"
              @click="openStatement(item.participant_id)"
            />
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Modal de Cartola / Estado de Cuenta -->
    <StatementModal
      v-model="statementModalOpen"
      :participant-id="selectedParticipantId"
    />
  </div>
</template>
