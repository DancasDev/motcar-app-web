<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { fetchParticipantStatement, generateParticipantReceivables } from '../api/financing.api'
import type { ParticipantStatement, StatementInstallment } from '../types'
import { money } from '@/utils/format'

interface Props {
  modelValue: boolean
  participantId: number | string | null
  groupId?: number | string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'quotes-generated'): void
  (e: 'message', text: string, color?: 'success' | 'error' | 'warning' | 'info'): void
}>()

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const isLoading = ref(false)
const isGenerating = ref(false)
const isRefreshing = ref(false)
const statement = ref<ParticipantStatement | null>(null)
const errorMsg = ref<string | null>(null)

const feedbackSnackbar = ref({
  show: false,
  text: '',
  color: 'success'
})

const headers = [
  { title: 'Descripción', key: 'description', align: 'start' as const },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, width: '130px' },
  { title: 'Monto', key: 'total_amount', align: 'end' as const, width: '100px' },
  { title: 'Abonado', key: 'paid_amount', align: 'end' as const, width: '100px' },
  { title: 'Saldo', key: 'pending_amount', align: 'end' as const, width: '100px' },
  { title: 'Estado', key: 'status', align: 'center' as const, width: '110px' }
]

const effectiveGroupId = computed(() => props.groupId || statement.value?.participant?.group_id)

const canGenerateQuotes = computed(() => {
  if (!statement.value?.participant) return false
  return String(statement.value.participant.status) === '1'
})

async function loadStatement(silent: boolean = false): Promise<void> {
  if (!isOpen.value || !props.participantId || !branchesStore.activeBranchId) {
    statement.value = null
    return
  }

  if (!silent) {
    isLoading.value = true
  }
  errorMsg.value = null
  try {
    const res = await fetchParticipantStatement(
      branchesStore.activeBranchId,
      props.participantId,
      props.groupId
    )
    statement.value = res.data
  } catch (err: unknown) {
    console.error('Error al cargar estado de cuenta:', err)
    errorMsg.value = 'No se pudo cargar el estado de cuenta del participante.'
    statement.value = null
  } finally {
    if (!silent) {
      isLoading.value = false
    }
  }
}

async function handleRefreshStatement(): Promise<void> {
  isRefreshing.value = true
  try {
    await loadStatement(true)
  } finally {
    isRefreshing.value = false
  }
}

async function handleGenerateQuotes(): Promise<void> {
  const gId = effectiveGroupId.value
  const pId = props.participantId || statement.value?.participant?.id
  const bId = branchesStore.activeBranchId

  if (!gId || !pId || !bId) return
  if (!canGenerateQuotes.value) return

  isGenerating.value = true
  try {
    const res = await generateParticipantReceivables(bId, gId, pId)
    const count = res.data?.generated ?? 0
    feedbackSnackbar.value = {
      show: true,
      text: `Cuotas generadas exitosamente (${count} ${count === 1 ? 'cuota' : 'cuotas'}).`,
      color: 'success'
    }
    emit('quotes-generated')
    emit('message', `Cuotas generadas exitosamente (${count} ${count === 1 ? 'cuota' : 'cuotas'}).`, 'success')
    // Sincronizar inmediatamente la tabla y los totales
    await loadStatement(true)
  } catch (err: unknown) {
    const errorObj = err as any
    const msg =
      errorObj?.response?.data?.messages?.error ||
      errorObj?.response?.data?.message ||
      errorObj?.response?.data?.error ||
      (err instanceof Error ? err.message : 'Error al generar cuotas del participante.')
    feedbackSnackbar.value = {
      show: true,
      text: msg,
      color: 'error'
    }
    emit('message', msg, 'error')
  } finally {
    isGenerating.value = false
  }
}

watch(() => [isOpen.value, props.participantId], ([open, pid]) => {
  if (open && pid) {
    loadStatement()
  } else {
    statement.value = null
    errorMsg.value = null
  }
})

function getInstallmentStatusColor(item: StatementInstallment): string {
  if (item.pending_amount <= 0) return 'success'
  if (item.is_overdue) return 'error'
  if (item.paid_amount > 0) return 'warning'
  return 'default'
}

function getInstallmentStatusText(item: StatementInstallment): string {
  if (item.pending_amount <= 0) return 'Pagada'
  if (item.is_overdue) return 'En Mora'
  if (item.paid_amount > 0) return 'Parcial'
  return 'Pendiente'
}

const nextPendingDueDate = computed<string>(() => {
  if (!statement.value?.installments || statement.value.installments.length === 0) {
    return 'N/A'
  }
  const pending = statement.value.installments.find(i => Number(i.pending_amount) > 0)
  return pending ? pending.due_date : 'Al día'
})
</script>

<template>
  <v-dialog
    v-model="isOpen"
    :fullscreen="smAndDown"
    max-width="960"
    scrollable
    persistent
  >
    <v-card class="d-flex flex-column" data-testid="statement-modal">
      <!-- Encabezado -->
      <v-toolbar color="primary" density="compact" class="px-2">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold d-flex align-center ga-2">
          <v-icon size="20">mdi-file-document-outline</v-icon>
          <span>Estado de cuenta</span>
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="isOpen = false" />
      </v-toolbar>

      <v-card-text class="pa-4 flex-grow-1 overflow-y-auto">
        <!-- Estado de Carga -->
        <div v-if="isLoading" class="text-center py-10" data-testid="statement-loading">
          <v-progress-circular indeterminate color="primary" size="48" class="mb-3" />
          <div class="text-body-2 text-medium-emphasis">Cargando estado de cuenta...</div>
        </div>

        <!-- Estado de Error -->
        <v-alert
          v-else-if="errorMsg"
          type="error"
          variant="tonal"
          class="mb-4"
          data-testid="statement-error"
        >
          {{ errorMsg }}
        </v-alert>

        <!-- Contenido Principal -->
        <div v-else-if="statement">
          <!-- Cabecera de Datos del Cliente & Grupo -->
          <v-card elevation="0" rounded="lg" class="border bg-grey-lighten-5 pa-3 mb-4">
            <v-row density="compact" align="center">
              <v-col cols="12" md="7">
                <div class="d-flex align-center ga-2 mb-1">
                  <span class="text-h6 font-weight-bold" data-testid="statement-client-name">
                    {{ statement.client.name }}
                  </span>
                  <v-chip size="small" variant="outlined" color="primary" class="font-weight-medium">
                    {{ statement.client.identification_type === '0' ? 'V' : 'E' }}-{{ statement.client.identification_value }}
                  </v-chip>
                </div>
                <div class="text-body-2 text-medium-emphasis d-flex flex-wrap align-center ga-2">
                  <span>Grupo: <strong>{{ statement.participant.group_name }}</strong></span>
                  <span>&bull;</span>
                  <span>Turno: <strong>{{ statement.participant.position ? `#${statement.participant.position}` : 'N/A' }}</strong></span>
                  <span>&bull;</span>
                  <span>Próx. Vencimiento: <strong>{{ nextPendingDueDate }}</strong></span>
                </div>
              </v-col>

              <v-col cols="12" md="5" class="text-md-end mt-2 mt-md-0">
                <v-chip
                  v-if="statement.participant.is_awarded"
                  color="purple"
                  variant="flat"
                  size="small"
                  class="font-weight-bold mr-2 mb-1"
                  prepend-icon="mdi-certificate-outline"
                >
                  Beneficio Entregado
                </v-chip>
                <v-chip
                  v-if="statement.summary.overdue_amount > 0"
                  color="error"
                  variant="flat"
                  size="small"
                  class="font-weight-bold mb-1"
                  prepend-icon="mdi-alert-circle"
                >
                  En Mora ({{ statement.summary.installments_overdue }} cuotas)
                </v-chip>
                <v-chip
                  v-else
                  color="success"
                  variant="flat"
                  size="small"
                  class="font-weight-bold mb-1"
                  prepend-icon="mdi-check-circle"
                >
                  Al Día
                </v-chip>

                <!-- Referente info -->
                <div v-if="statement.referrer" class="text-caption text-medium-emphasis mt-1">
                  Referido por: <strong>{{ statement.referrer.name }}</strong>
                </div>
              </v-col>
            </v-row>
          </v-card>

          <!-- Tarjetas de Métricas Resumen -->
          <v-row density="compact" class="mb-4">
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="d-flex align-center justify-center ga-1 mb-1">
                  <v-icon icon="mdi-cash-multiple" size="18" color="medium-emphasis" />
                  <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase" style="letter-spacing: 0.04em;">
                    Comprometido
                  </span>
                </div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis" data-testid="statement-total-committed">
                  {{ money(statement.summary.total_committed) }}
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="d-flex align-center justify-center ga-1 mb-1">
                  <v-icon icon="mdi-cash-check" size="18" color="medium-emphasis" />
                  <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase" style="letter-spacing: 0.04em;">
                    Cancelado
                  </span>
                </div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis" data-testid="statement-total-collected">
                  {{ money(statement.summary.total_collected) }}
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="d-flex align-center justify-center ga-1 mb-1">
                  <v-icon icon="mdi-cash-clock" size="18" color="medium-emphasis" />
                  <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase" style="letter-spacing: 0.04em;">
                    Saldo Pendiente
                  </span>
                </div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis" data-testid="statement-total-pending">
                  {{ money(statement.summary.total_pending) }}
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="d-flex align-center justify-center ga-1 mb-1">
                  <v-icon icon="mdi-alert-circle-outline" size="18" color="medium-emphasis" />
                  <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase" style="letter-spacing: 0.04em;">
                    En Mora
                  </span>
                </div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis" data-testid="statement-overdue-amount">
                  {{ money(statement.summary.overdue_amount) }}
                </div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Barra de Título del Cronograma y Acción Generar Cuota -->
          <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
            <div class="d-flex align-center ga-2">
              <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                Cronograma de Cuotas y Pagos
              </span>
              <v-chip
                v-if="statement.installments && statement.installments.length > 0"
                size="x-small"
                variant="tonal"
                color="primary"
                class="font-weight-medium"
              >
                {{ statement.installments.length }} {{ statement.installments.length === 1 ? 'cuota' : 'cuotas' }}
              </v-chip>
            </div>

            <div class="d-flex align-center ga-2">
              <v-tooltip
                text="Recargar cronograma"
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
                    :loading="isRefreshing"
                    data-testid="statement-refresh-btn"
                    @click="handleRefreshStatement"
                  />
                </template>
              </v-tooltip>
            </div>
          </div>

          <!-- Tabla de Cuotas -->
          <v-data-table
            :headers="headers"
            :items="statement.installments"
            :mobile="smAndDown"
            density="compact"
            class="border rounded-lg bg-white"
            data-testid="statement-table"
            :items-per-page="50"
            hover
          >
            <!-- Slot para cuando no hay cuotas -->
            <template #no-data>
              <div class="text-center py-8">
                <v-icon icon="mdi-calculator-variant-outline" size="44" color="medium-emphasis" class="mb-2" />
                <div class="text-body-2 font-weight-medium text-high-emphasis mb-1">
                  No hay cuotas generadas
                </div>
                <div class="text-caption text-medium-emphasis mb-3">
                  Este participante aún no tiene cuotas registradas en su cronograma.
                </div>
                <v-btn
                  v-if="canGenerateQuotes"
                  color="primary"
                  variant="flat"
                  size="small"
                  prepend-icon="mdi-calculator"
                  :loading="isGenerating"
                  @click="handleGenerateQuotes"
                >
                  Generar cuota
                </v-btn>
              </div>
            </template>

            <!-- Cuota / Glosa con detalle de pagos -->
            <template #[`item.description`]="{ item }">
              <div>
                <div class="font-weight-medium text-body-2">{{ item.description }}</div>
                <div v-if="item.payments && item.payments.length > 0" class="text-caption text-medium-emphasis">
                  <span v-for="(p, idx) in item.payments" :key="idx" class="d-inline-block mr-2">
                    &bull; {{ p.receipt_code }} ({{ money(p.applied_amount) }})
                  </span>
                </div>
              </div>
            </template>

            <!-- Vencimiento -->
            <template #[`item.due_date`]="{ item }">
              <span class="text-caption font-mono font-weight-medium text-high-emphasis">
                {{ item.due_date }}
              </span>
            </template>

            <!-- Monto -->
            <template #[`item.total_amount`]="{ item }">
              <span class="text-body-2 font-weight-medium">{{ money(item.total_amount) }}</span>
            </template>

            <!-- Abonado -->
            <template #[`item.paid_amount`]="{ item }">
              <span class="text-body-2 text-success font-weight-medium">{{ money(item.paid_amount) }}</span>
            </template>

            <!-- Saldo -->
            <template #[`item.pending_amount`]="{ item }">
              <span class="text-body-2 font-weight-bold" :class="item.pending_amount > 0 ? 'text-primary' : 'text-medium-emphasis'">
                {{ money(item.pending_amount) }}
              </span>
            </template>

            <!-- Estado -->
            <template #[`item.status`]="{ item }">
              <v-chip
                size="x-small"
                :color="getInstallmentStatusColor(item)"
                variant="tonal"
                class="font-weight-medium"
              >
                {{ getInstallmentStatusText(item) }}
              </v-chip>
            </template>

            <template #bottom></template>
          </v-data-table>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-3 bg-grey-lighten-5 justify-start">
        <v-btn variant="plain" @click="isOpen = false">Cerrar</v-btn>
      </v-card-actions>

      <!-- Snackbar de Notificaciones Internas -->
      <v-snackbar
        v-model="feedbackSnackbar.show"
        :color="feedbackSnackbar.color"
        timeout="3500"
        location="top"
      >
        <div class="d-flex align-center ga-2">
          <v-icon :icon="feedbackSnackbar.color === 'success' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'" />
          <span>{{ feedbackSnackbar.text }}</span>
        </div>
      </v-snackbar>
    </v-card>
  </v-dialog>
</template>
