<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { fetchCollectionCalendar, fetchSamGroups } from '../api/financing.api'
import type { CollectionCalendarReport, CalendarDay, CalendarReceivableItem, SamGroupItem } from '../types'
import { money, waLink } from '@/utils/format'
import StatementModal from '../components/StatementModal.vue'

const branchesStore = useBranchesStore()

const calendarReport = ref<CollectionCalendarReport | null>(null)
const groups = ref<SamGroupItem[]>([])
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)

const selectedGroupId = ref<number | string | null>(null)
const selectedPreset = ref<'current_fortnight' | 'next_fortnight' | 'current_month' | 'next_month' | 'custom'>('current_month')
const startDate = ref<string>('')
const endDate = ref<string>('')
const searchQuery = ref<string>('')

// Control de paneles expandidos
const expandedPanels = ref<number[]>([0])

// Modal de estado de cuenta
const statementModalOpen = ref(false)
const selectedParticipantId = ref<number | string | null>(null)

function formatDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function applyPreset(preset: 'current_fortnight' | 'next_fortnight' | 'current_month' | 'next_month' | 'custom'): void {
  selectedPreset.value = preset
  const now = new Date()

  if (preset === 'current_fortnight') {
    const year = now.getFullYear()
    const month = now.getMonth()
    if (now.getDate() <= 15) {
      startDate.value = formatDateStr(new Date(year, month, 1))
      endDate.value = formatDateStr(new Date(year, month, 15))
    } else {
      startDate.value = formatDateStr(new Date(year, month, 16))
      endDate.value = formatDateStr(new Date(year, month + 1, 0))
    }
  } else if (preset === 'next_fortnight') {
    const year = now.getFullYear()
    const month = now.getMonth()
    if (now.getDate() <= 15) {
      startDate.value = formatDateStr(new Date(year, month, 16))
      endDate.value = formatDateStr(new Date(year, month + 1, 0))
    } else {
      startDate.value = formatDateStr(new Date(year, month + 1, 1))
      endDate.value = formatDateStr(new Date(year, month + 1, 15))
    }
  } else if (preset === 'current_month') {
    const year = now.getFullYear()
    const month = now.getMonth()
    startDate.value = formatDateStr(new Date(year, month, 1))
    endDate.value = formatDateStr(new Date(year, month + 1, 0))
  } else if (preset === 'next_month') {
    const year = now.getFullYear()
    const month = now.getMonth()
    startDate.value = formatDateStr(new Date(year, month + 1, 1))
    endDate.value = formatDateStr(new Date(year, month + 2, 0))
  }
}

function shiftMonth(offset: number): void {
  selectedPreset.value = 'custom'
  const current = startDate.value ? new Date(startDate.value + 'T00:00:00') : new Date()
  const targetYear = current.getFullYear()
  const targetMonth = current.getMonth() + offset

  startDate.value = formatDateStr(new Date(targetYear, targetMonth, 1))
  endDate.value = formatDateStr(new Date(targetYear, targetMonth + 1, 0))
  loadCalendar()
}

function validateDateRange(): string | null {
  if (!startDate.value || !endDate.value) {
    return 'Debe especificar fecha inicial y final.'
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(startDate.value) || !dateRegex.test(endDate.value)) {
    return 'El formato de fecha debe ser YYYY-MM-DD.'
  }
  if (startDate.value > endDate.value) {
    return 'La fecha inicial no puede ser posterior a la fecha final.'
  }
  const diffMs = new Date(endDate.value + 'T00:00:00').getTime() - new Date(startDate.value + 'T00:00:00').getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 366) {
    return 'El rango de consulta no puede exceder 366 días (1 año).'
  }
  return null
}

async function loadCalendar(): Promise<void> {
  if (!branchesStore.activeBranchId) {
    calendarReport.value = null
    return
  }

  const validationError = validateDateRange()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  errorMessage.value = null
  isLoading.value = true
  try {
    const res = await fetchCollectionCalendar(
      branchesStore.activeBranchId,
      startDate.value,
      endDate.value,
      selectedGroupId.value ? Number(selectedGroupId.value) : undefined
    )
    calendarReport.value = res.data || null
    expandedPanels.value = [0] // Abre el primer día por defecto
  } catch (err: any) {
    console.error('Error al cargar calendario de cobros:', err)
    errorMessage.value = err?.response?.data?.message || 'Error al obtener calendario de cobros.'
    calendarReport.value = null
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
  // Inicializar en mes actual
  applyPreset('current_month')
  loadGroups()
  loadCalendar()
})

watch(() => branchesStore.activeBranchId, () => {
  loadGroups()
  loadCalendar()
})

watch(selectedGroupId, () => {
  loadCalendar()
})

const daysList = computed<CalendarDay[]>(() => {
  if (!calendarReport.value?.days) return []
  return Object.values(calendarReport.value.days).sort((a, b) => a.date.localeCompare(b.date))
})

const filteredDaysList = computed<CalendarDay[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return daysList.value

  return daysList.value
    .map(day => {
      const filteredItems = day.items.filter(item => {
        const clientName = (item.client.name || '').toLowerCase()
        const grp = (item.group_name || '').toLowerCase()
        const desc = (item.description || '').toLowerCase()
        const refName = (item.referrer?.name || '').toLowerCase()
        return clientName.includes(q) || grp.includes(q) || desc.includes(q) || refName.includes(q)
      })
      return {
        ...day,
        items: filteredItems,
        count: filteredItems.length
      }
    })
    .filter(day => day.items.length > 0)
})

const summary = computed(() => {
  const s = calendarReport.value?.summary
  const totalExpected = s?.total_expected || 0
  const totalCollected = s?.total_collected || 0
  const totalPending = s?.total_pending || 0
  const countTotal = s?.installments_total || 0
  const countPaid = s?.installments_paid || 0
  const countPending = s?.installments_pending || 0
  const pct = totalExpected > 0 ? Math.min(100, Math.round((totalCollected / totalExpected) * 100)) : 0
  return { totalExpected, totalCollected, totalPending, countTotal, countPaid, countPending, pct }
})

function getStatusChipColor(status: string, pending: number): string {
  if (pending <= 0 || status === '2') return 'success'
  if (status === '1') return 'warning'
  return 'default'
}

function getStatusChipText(status: string, pending: number): string {
  if (pending <= 0 || status === '2') return 'Pagada'
  if (status === '1') return 'Parcial'
  return 'Pendiente'
}

function openStatement(participantId: number | string): void {
  selectedParticipantId.value = participantId
  statementModalOpen.value = true
}

function getClientWa(item: CalendarReceivableItem): string | null {
  const msg = `Hola ${item.client.name}, le saludamos de MotCar. Le recordamos su cuota de ${item.description} por ${money(item.total_amount)} en ${item.group_name} con fecha de vencimiento hoy. Saldo pendiente: ${money(item.pending_amount)}.`
  return waLink(item.client.phone, msg)
}

function getReferrerWa(item: CalendarReceivableItem): string | null {
  if (!item.referrer?.phone) return null
  const msg = `Hola ${item.referrer.name}, le contactamos de MotCar respecto a su referido ${item.client.name} (${item.group_name}). Recordatorio de cuota ${item.description} vencimiento hoy (${money(item.pending_amount)} pendientes).`
  return waLink(item.referrer.phone, msg)
}
</script>

<template>
  <div class="calendar-view" data-testid="calendar-view">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CABECERA DE PÁGINA                                          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-6">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Calendario de Cobros
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Proyección quincenal y mensual de recaudación por fecha de vencimiento
        </p>
      </div>

      <!-- Acciones Desktop -->
      <div class="d-none d-sm-flex align-center ga-2">
        <v-btn
          variant="outlined"
          color="primary"
          density="comfortable"
          prepend-icon="mdi-chevron-left"
          class="text-none font-weight-medium"
          @click="shiftMonth(-1)"
        >
          Mes Ant.
        </v-btn>
        <v-btn
          variant="outlined"
          color="primary"
          density="comfortable"
          append-icon="mdi-chevron-right"
          class="text-none font-weight-medium"
          @click="shiftMonth(1)"
        >
          Mes Sig.
        </v-btn>
        <v-btn
          variant="flat"
          color="primary"
          density="comfortable"
          prepend-icon="mdi-refresh"
          class="text-none font-weight-bold"
          :loading="isLoading"
          data-testid="calendar-refresh-btn"
          @click="loadCalendar"
        >
          Consultar
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
              data-testid="calendar-mobile-menu"
            />
          </template>
          <v-list density="compact" rounded="lg" elevation="3">
            <v-list-item
              prepend-icon="mdi-refresh"
              title="Consultar"
              :disabled="isLoading"
              @click="loadCalendar"
            />
            <v-list-item
              prepend-icon="mdi-chevron-left"
              title="Mes Anterior"
              @click="shiftMonth(-1)"
            />
            <v-list-item
              prepend-icon="mdi-chevron-right"
              title="Mes Siguiente"
              @click="shiftMonth(1)"
            />
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TARJETAS DE RESUMEN FINANCIERO                              -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-4" data-testid="calendar-kpis">
      <!-- 1. Esperado -->
      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Cobro Proyectado</span>
            <v-icon size="20" color="info">mdi-calendar-check</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-high-emphasis" data-testid="calendar-summary-expected">
            {{ money(summary.totalExpected) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ summary.countTotal }} cuotas programadas en el período
          </div>
        </v-card>
      </v-col>

      <!-- 2. Cobrado -->
      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100 d-flex flex-column justify-space-between">
          <div>
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-caption font-weight-bold text-success text-uppercase">Recaudado</span>
              <v-icon size="20" color="success">mdi-cash-check</v-icon>
            </div>
            <div class="text-h6 font-weight-bold text-success" data-testid="calendar-summary-collected">
              {{ money(summary.totalCollected) }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ summary.countPaid }} cuotas cobradas satisfactoriamente
            </div>
          </div>
          <div class="mt-2">
            <div class="d-flex justify-space-between text-caption font-weight-medium mb-1">
              <span>Efectividad</span>
              <span class="font-weight-bold text-success">{{ summary.pct }}%</span>
            </div>
            <v-progress-linear :model-value="summary.pct" color="success" height="6" rounded />
          </div>
        </v-card>
      </v-col>

      <!-- 3. Pendiente -->
      <v-col cols="12" sm="4">
        <v-card elevation="0" rounded="lg" class="border bg-white pa-4 h-100">
          <div class="d-flex align-center justify-space-between mb-1">
            <span class="text-caption font-weight-bold text-error text-uppercase">Saldo por Cobrar</span>
            <v-icon size="20" color="error">mdi-cash-clock</v-icon>
          </div>
          <div class="text-h6 font-weight-bold text-error" data-testid="calendar-summary-pending">
            {{ money(summary.totalPending) }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ summary.countPending }} cuotas pendientes por recaudar
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- BARRA DE PRESETS Y FILTROS                                  -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white pa-3 mb-4">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
        <!-- Chips de períodos preestablecidos -->
        <div class="d-flex flex-wrap align-center ga-1" data-testid="calendar-preset-chips">
          <v-btn
            size="small"
            :variant="selectedPreset === 'current_fortnight' ? 'flat' : 'outlined'"
            :color="selectedPreset === 'current_fortnight' ? 'primary' : 'default'"
            @click="applyPreset('current_fortnight'); loadCalendar()"
          >
            Quincena Actual
          </v-btn>
          <v-btn
            size="small"
            :variant="selectedPreset === 'next_fortnight' ? 'flat' : 'outlined'"
            :color="selectedPreset === 'next_fortnight' ? 'primary' : 'default'"
            @click="applyPreset('next_fortnight'); loadCalendar()"
          >
            Próx. Quincena
          </v-btn>
          <v-btn
            size="small"
            :variant="selectedPreset === 'current_month' ? 'flat' : 'outlined'"
            :color="selectedPreset === 'current_month' ? 'primary' : 'default'"
            @click="applyPreset('current_month'); loadCalendar()"
          >
            Mes Actual
          </v-btn>
          <v-btn
            size="small"
            :variant="selectedPreset === 'next_month' ? 'flat' : 'outlined'"
            :color="selectedPreset === 'next_month' ? 'primary' : 'default'"
            @click="applyPreset('next_month'); loadCalendar()"
          >
            Próx. Mes
          </v-btn>
        </div>

        <!-- Grupo Filter -->
        <div style="min-width: 220px;">
          <v-select
            v-model="selectedGroupId"
            :items="[{ title: 'Todos los grupos', value: null }, ...groups.map(g => ({ title: g.name, value: g.id }))]"
            placeholder="Todos los grupos"
            variant="outlined"
            density="compact"
            hide-details
            data-testid="calendar-group-filter"
          />
        </div>
      </div>

      <v-divider class="mb-3" />

      <!-- Fechas personalizadas y búsqueda -->
      <v-row density="compact" align="center">
        <v-col cols="6" sm="3">
          <v-text-field
            v-model="startDate"
            label="Fecha Desde"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            data-testid="calendar-start-date"
            @change="selectedPreset = 'custom'; loadCalendar()"
          />
        </v-col>

        <v-col cols="6" sm="3">
          <v-text-field
            v-model="endDate"
            label="Fecha Hasta"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            data-testid="calendar-end-date"
            @change="selectedPreset = 'custom'; loadCalendar()"
          />
        </v-col>

        <v-col cols="12" sm="6">
          <v-text-field
            v-model="searchQuery"
            placeholder="Buscar suscriptor, grupo o cuota en el período..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            data-testid="calendar-search-input"
          />
        </v-col>
      </v-row>
    </v-card>

    <!-- Alerta de Error de Validación -->
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      class="mb-4"
      closable
      data-testid="calendar-error-alert"
      @click:close="errorMessage = null"
    >
      {{ errorMessage }}
    </v-alert>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DESGLOSE CRONOLÓGICO POR DÍAS                               -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div v-if="isLoading" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" size="48" class="mb-3" />
      <div class="text-body-2 text-medium-emphasis">Consultando calendario de cobros...</div>
    </div>

    <div v-else-if="filteredDaysList.length === 0" class="text-center py-12 border rounded-lg bg-white">
      <v-icon size="48" color="medium-emphasis" class="mb-2">mdi-calendar-blank</v-icon>
      <div class="text-subtitle-1 font-weight-bold text-medium-emphasis">
        No hay cuotas programadas para el rango de fechas seleccionado
      </div>
      <div class="text-caption text-medium-emphasis mt-1">
        Pruebe navegando a otros meses con los botones superiores o ajustando los filtros.
      </div>
    </div>

    <div v-else data-testid="calendar-days-panels">
      <v-expansion-panels v-model="expandedPanels" multiple class="d-flex flex-column ga-2">
        <v-expansion-panel
          v-for="day in filteredDaysList"
          :key="day.date"
          elevation="0"
          rounded="lg"
          class="border bg-white"
        >
          <v-expansion-panel-title class="py-3 px-4">
            <div class="d-flex flex-wrap align-center justify-space-between w-100 ga-2 pr-2">
              <!-- Fecha -->
              <div class="d-flex align-center ga-2">
                <v-icon size="20" color="primary">mdi-calendar-today</v-icon>
                <span class="text-subtitle-2 font-weight-bold font-mono text-high-emphasis">
                  {{ day.date }}
                </span>
                <v-chip size="x-small" variant="tonal" color="primary" class="font-weight-medium">
                  {{ day.count }} cuotas
                </v-chip>
              </div>

              <!-- Métricas del día -->
              <div class="d-flex flex-wrap align-center ga-3 text-caption">
                <div>
                  <span class="text-medium-emphasis">Esperado: </span>
                  <strong class="text-high-emphasis">{{ money(day.total_expected) }}</strong>
                </div>
                <div>
                  <span class="text-medium-emphasis">Cobrado: </span>
                  <strong class="text-success">{{ money(day.total_collected) }}</strong>
                </div>
                <div v-if="day.total_pending > 0">
                  <span class="text-medium-emphasis">Pendiente: </span>
                  <strong class="text-error">{{ money(day.total_pending) }}</strong>
                </div>
              </div>
            </div>
          </v-expansion-panel-title>

          <v-expansion-panel-text class="px-2 pb-2 pt-0">
            <v-divider class="mb-2" />

            <!-- Lista de cuotas del día -->
            <v-table density="compact" hover class="border rounded bg-white">
              <thead>
                <tr class="text-caption text-medium-emphasis">
                  <th class="text-start">Cliente / Cédula</th>
                  <th class="text-start">Grupo & Pos.</th>
                  <th class="text-start">Concepto</th>
                  <th class="text-end">Monto Total</th>
                  <th class="text-end">Abonado</th>
                  <th class="text-end">Saldo</th>
                  <th class="text-center">Estado</th>
                  <th class="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in day.items"
                  :key="item.receivable_id"
                  data-testid="calendar-receivable-row"
                >
                  <!-- Cliente -->
                  <td class="py-2">
                    <div class="font-weight-medium text-body-2">{{ item.client.name }}</div>
                    <div v-if="item.client.phone" class="text-caption text-medium-emphasis font-mono">
                      {{ item.client.phone }}
                    </div>
                    <div v-if="item.referrer" class="text-caption text-primary">
                      Ref: {{ item.referrer.name }}
                    </div>
                  </td>

                  <!-- Grupo & Posición -->
                  <td>
                    <div class="text-body-2 font-weight-medium">{{ item.group_name }}</div>
                    <v-chip size="x-small" variant="tonal" color="info">
                      Turno #{{ item.position }}
                    </v-chip>
                  </td>

                  <!-- Concepto -->
                  <td class="text-body-2">{{ item.description }}</td>

                  <!-- Monto Total -->
                  <td class="text-end font-weight-medium text-body-2">
                    {{ money(item.total_amount) }}
                  </td>

                  <!-- Abonado -->
                  <td class="text-end text-success font-weight-medium text-body-2">
                    {{ money(item.paid_amount) }}
                  </td>

                  <!-- Saldo -->
                  <td class="text-end font-weight-bold text-body-2" :class="item.pending_amount > 0 ? 'text-error' : 'text-medium-emphasis'">
                    {{ money(item.pending_amount) }}
                  </td>

                  <!-- Estado -->
                  <td class="text-center">
                    <v-chip
                      size="x-small"
                      :color="getStatusChipColor(item.status, item.pending_amount)"
                      variant="tonal"
                      class="font-weight-medium"
                    >
                      {{ getStatusChipText(item.status, item.pending_amount) }}
                    </v-chip>
                  </td>

                  <!-- Acciones -->
                  <td class="text-end">
                    <div class="d-flex align-center justify-end ga-1">
                      <!-- WhatsApp Cliente -->
                      <v-btn
                        v-if="getClientWa(item)"
                        :href="getClientWa(item)!"
                        target="_blank"
                        rel="noopener"
                        icon="mdi-whatsapp"
                        size="x-small"
                        variant="text"
                        color="success"
                        title="WhatsApp al cliente"
                        data-testid="calendar-wa-client-btn"
                      />

                      <!-- WhatsApp Referente -->
                      <v-btn
                        v-if="getReferrerWa(item)"
                        :href="getReferrerWa(item)!"
                        target="_blank"
                        rel="noopener"
                        icon="mdi-account-arrow-right"
                        size="x-small"
                        variant="text"
                        color="primary"
                        :title="`WhatsApp al referente (${item.referrer?.name})`"
                        data-testid="calendar-wa-referrer-btn"
                      />

                      <!-- Estado de Cuenta -->
                      <v-btn
                        icon="mdi-file-document-outline"
                        size="x-small"
                        variant="text"
                        color="info"
                        title="Ver Estado de Cuenta"
                        data-testid="calendar-statement-btn"
                        @click="openStatement(item.participant_id)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <!-- Modal de Cartola / Estado de Cuenta -->
    <StatementModal
      v-model="statementModalOpen"
      :participant-id="selectedParticipantId"
    />
  </div>
</template>
