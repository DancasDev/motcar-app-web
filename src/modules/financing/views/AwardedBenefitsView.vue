<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { fetchAwardedBenefits, fetchSamGroups } from '../api/financing.api'
import type { AwardedBenefitItem, SamGroupItem } from '../types'
import { money, waLink } from '@/utils/format'
import StatementModal from '../components/StatementModal.vue'

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()

const awardedList = ref<AwardedBenefitItem[]>([])
const groups = ref<SamGroupItem[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedGroupId = ref<number | string | null>(null)
const selectedSolvency = ref<'all' | 'solvent' | 'overdue'>('all')

// Estado de cuenta modal
const statementModalOpen = ref(false)
const selectedParticipantId = ref<number | string | null>(null)

async function loadAwarded(): Promise<void> {
  if (!branchesStore.activeBranchId) {
    awardedList.value = []
    return
  }
  isLoading.value = true
  try {
    const res = await fetchAwardedBenefits(
      branchesStore.activeBranchId,
      selectedGroupId.value ? Number(selectedGroupId.value) : undefined
    )
    awardedList.value = res.data || []
  } catch (err) {
    console.error('Error al cargar padrón de adjudicados:', err)
    awardedList.value = []
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
  loadAwarded()
  loadGroups()
})

watch(() => branchesStore.activeBranchId, () => {
  loadAwarded()
  loadGroups()
})

watch(selectedGroupId, () => {
  loadAwarded()
})

const summary = computed(() => {
  const total = awardedList.value.length
  const overdueCount = awardedList.value.filter(a => a.is_overdue || a.overdue_amount > 0).length
  const solventCount = total - overdueCount
  const overdueAmount = awardedList.value.reduce((acc, a) => acc + (a.overdue_amount || 0), 0)
  return { total, overdueCount, solventCount, overdueAmount }
})

const filteredList = computed(() => {
  let list = awardedList.value

  if (selectedSolvency.value === 'solvent') {
    list = list.filter(a => !a.is_overdue && (!a.overdue_amount || a.overdue_amount <= 0))
  } else if (selectedSolvency.value === 'overdue') {
    list = list.filter(a => a.is_overdue || a.overdue_amount > 0)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a => {
      const name = (a.client.name || '').toLowerCase()
      const idVal = (a.client.identification_value || '').toLowerCase()
      const grp = (a.group_name || '').toLowerCase()
      const refName = (a.referrer?.name || '').toLowerCase()
      const brand = String(a.benefit_metadata?.brand || '').toLowerCase()
      const model = String(a.benefit_metadata?.model || a.benefit_metadata?.vehicle_model || '').toLowerCase()
      return name.includes(q) || idVal.includes(q) || grp.includes(q) || refName.includes(q) || brand.includes(q) || model.includes(q)
    })
  }

  return list
})

const headers = [
  { title: 'Cliente / Cédula', key: 'client', align: 'start' as const },
  { title: 'Grupo / Posición', key: 'group', align: 'start' as const, width: '150px' },
  { title: 'Vehículo / Beneficio', key: 'vehicle', align: 'start' as const },
  { title: 'Fecha Adjudicación', key: 'awarded_at', align: 'center' as const, width: '150px' },
  { title: 'Solvencia Post-Entrega', key: 'solvency', align: 'center' as const, width: '170px' },
  { title: 'Referente', key: 'referrer', align: 'start' as const, width: '150px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '130px' }
]

function formatVehicle(meta: Record<string, any> | null): string {
  if (!meta) return 'Vehículo entregado'
  const brand = meta.brand || ''
  const model = meta.model || meta.vehicle_model || ''
  const color = meta.color ? ` (${meta.color})` : ''
  const parts = [brand, model].filter(Boolean).join(' ')
  return (parts || 'Vehículo entregado') + color
}

function openStatement(participantId: number | string): void {
  selectedParticipantId.value = participantId
  statementModalOpen.value = true
}

function getClientWa(item: AwardedBenefitItem): string | null {
  const veh = formatVehicle(item.benefit_metadata)
  const msg = `Estimado(a) ${item.client.name}, le saludamos de MotCar en relación a su vehículo ${veh} del grupo ${item.group_name}. Deseamos validar su estatus y satisfacción con la unidad.`
  return waLink(item.client.phone, msg)
}

function getReferrerWa(item: AwardedBenefitItem): string | null {
  if (!item.referrer?.phone) return null
  const veh = formatVehicle(item.benefit_metadata)
  const msg = `Hola ${item.referrer.name}, le saludamos de MotCar respecto a su referido ${item.client.name} adjudicado con un(a) ${veh} en ${item.group_name}. Gracias por su colaboración.`
  return waLink(item.referrer.phone, msg)
}
</script>

<template>
  <div class="awarded-view" data-testid="awarded-view">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CABECERA DE PÁGINA                                          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Padrón de Adjudicaciones
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Bitácora de vehículos entregados, garantías y monitoreo de solvencia posterior
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
          data-testid="awarded-refresh-btn"
          @click="loadAwarded"
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
              data-testid="awarded-mobile-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-refresh"
              title="Actualizar"
              :disabled="isLoading"
              @click="loadAwarded"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TARJETAS DE RESUMEN EJECUTIVO                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-4" data-testid="awarded-kpis">
      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-purple text-uppercase">Total Adjudicados</span>
            <v-icon size="20" color="purple">mdi-shield-car</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-high-emphasis" data-testid="awarded-total-count">
            {{ summary.total }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Vehículos entregados a suscriptores
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-success text-uppercase">Solventes / Al Día</span>
            <v-icon size="20" color="success">mdi-check-decagram</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-success" data-testid="awarded-uptodate-count">
            {{ summary.solventCount }}
          </div>
          <div class="text-caption text-medium-emphasis">
            Mantienen sus pagos regulares tras entrega
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-error text-uppercase">Adjudicados con Mora</span>
            <v-icon size="20" color="error">mdi-alert-octagon</v-icon>
          </div>
          <div class="text-h6 font-weight-bold" :class="summary.overdueCount > 0 ? 'text-error' : 'text-high-emphasis'" data-testid="awarded-overdue-count">
            {{ summary.overdueCount }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ summary.overdueAmount > 0 ? money(summary.overdueAmount) + ' en mora activa' : 'Cero atrasos reportados' }}
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
            placeholder="Buscar por cliente, cédula, grupo, vehículo o referente..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            data-testid="awarded-search-input"
          />
        </v-col>

        <!-- Filtro por Grupo -->
        <v-col cols="12" sm="6" md="4">
          <v-select
            v-model="selectedGroupId"
            :items="[{ title: 'Todos los grupos', value: null }, ...groups.map(g => ({ title: g.name, value: g.id }))]"
            placeholder="Todos los grupos"
            variant="outlined"
            density="compact"
            hide-details
            data-testid="awarded-group-filter"
          />
        </v-col>

        <!-- Filtro Solvencia -->
        <v-col cols="12" sm="6" md="3">
          <div class="d-flex align-center ga-1">
            <v-btn
              size="small"
              :variant="selectedSolvency === 'all' ? 'flat' : 'outlined'"
              :color="selectedSolvency === 'all' ? 'primary' : 'default'"
              @click="selectedSolvency = 'all'"
            >
              Todos
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedSolvency === 'solvent' ? 'flat' : 'outlined'"
              :color="selectedSolvency === 'solvent' ? 'success' : 'default'"
              @click="selectedSolvency = 'solvent'"
            >
              Al Día
            </v-btn>
            <v-btn
              size="small"
              :variant="selectedSolvency === 'overdue' ? 'flat' : 'outlined'"
              :color="selectedSolvency === 'overdue' ? 'error' : 'default'"
              @click="selectedSolvency = 'overdue'"
            >
              Con Mora
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TABLA DE ADJUDICADOS                                       -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table
        :headers="headers"
        :items="filteredList"
        :loading="isLoading"
        :mobile="smAndDown"
        density="comfortable"
        hover
        :items-per-page="20"
        no-data-text="No se encontraron adjudicaciones registradas con los filtros seleccionados"
        data-testid="awarded-table"
      >
        <!-- Cliente -->
        <template #[`item.client`]="{ item }">
          <div class="py-1">
            <div class="font-weight-bold text-body-2 text-high-emphasis">
              {{ item.client.name }}
            </div>
            <div class="text-caption text-medium-emphasis d-flex align-center ga-1">
              <span>{{ item.client.identification_type === '0' ? 'V' : 'E' }}-{{ item.client.identification_value }}</span>
              <span v-if="item.client.phone">&bull;</span>
              <span v-if="item.client.phone" class="font-mono">{{ item.client.phone }}</span>
            </div>
          </div>
        </template>

        <!-- Grupo & Posición -->
        <template #[`item.group`]="{ item }">
          <div>
            <div class="font-weight-medium text-body-2">{{ item.group_name }}</div>
            <v-chip size="x-small" variant="tonal" color="info" class="font-weight-bold mt-1">
              Turno #{{ item.position }}
            </v-chip>
          </div>
        </template>

        <!-- Vehículo / Beneficio -->
        <template #[`item.vehicle`]="{ item }">
          <div class="d-flex align-center ga-2 py-1">
            <v-avatar size="32" color="purple-lighten-5">
              <v-icon size="18" color="purple">mdi-motorbike</v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium text-body-2 text-high-emphasis">
                {{ formatVehicle(item.benefit_metadata) }}
              </div>
              <div v-if="item.benefit_metadata?.raffle_number" class="text-caption text-medium-emphasis">
                Sorteo #{{ item.benefit_metadata.raffle_number }}
              </div>
            </div>
          </div>
        </template>

        <!-- Fecha Adjudicación -->
        <template #[`item.awarded_at`]="{ item }">
          <div class="text-center">
            <span class="text-body-2 font-mono font-weight-medium">{{ item.awarded_at }}</span>
          </div>
        </template>

        <!-- Solvencia Post-Entrega -->
        <template #[`item.solvency`]="{ item }">
          <div class="text-center">
            <v-chip
              v-if="item.is_overdue || item.overdue_amount > 0"
              color="error"
              variant="flat"
              size="small"
              class="font-weight-bold"
              prepend-icon="mdi-alert-circle"
            >
              En Mora ({{ money(item.overdue_amount) }})
            </v-chip>
            <v-chip
              v-else
              color="success"
              variant="tonal"
              size="small"
              class="font-weight-medium"
              prepend-icon="mdi-check-circle"
            >
              Solvente / Al Día
            </v-chip>
          </div>
        </template>

        <!-- Referente -->
        <template #[`item.referrer`]="{ item }">
          <div v-if="item.referrer">
            <div class="text-body-2 font-weight-medium">{{ item.referrer.name }}</div>
            <div v-if="item.referrer.phone" class="text-caption text-medium-emphasis font-mono">
              {{ item.referrer.phone }}
            </div>
          </div>
          <div v-else class="text-caption text-medium-emphasis font-italic">
            Sin referente
          </div>
        </template>

        <!-- Acciones -->
        <template #[`item.actions`]="{ item }">
          <div class="d-flex align-center justify-end ga-1">
            <!-- WhatsApp Cliente -->
            <v-btn
              v-if="getClientWa(item)"
              :href="getClientWa(item)!"
              target="_blank"
              rel="noopener"
              icon="mdi-whatsapp"
              size="small"
              variant="text"
              color="success"
              title="Contactar al cliente por WhatsApp"
              data-testid="awarded-wa-client-btn"
            />

            <!-- WhatsApp Referente -->
            <v-btn
              v-if="getReferrerWa(item)"
              :href="getReferrerWa(item)!"
              target="_blank"
              rel="noopener"
              icon="mdi-account-arrow-right"
              size="small"
              variant="text"
              color="primary"
              :title="`Contactar al referente (${item.referrer?.name}) por WhatsApp`"
              data-testid="awarded-wa-referrer-btn"
            />

            <!-- Cartola / Estado de Cuenta -->
            <v-btn
              icon="mdi-file-document-outline"
              size="small"
              variant="text"
              color="info"
              title="Ver Estado de Cuenta"
              data-testid="awarded-statement-btn"
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
