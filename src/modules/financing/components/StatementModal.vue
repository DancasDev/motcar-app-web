<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import { fetchParticipantStatement } from '../api/financing.api'
import type { ParticipantStatement, StatementInstallment } from '../types'
import { money, waLink } from '@/utils/format'

interface Props {
  modelValue: boolean
  participantId: number | string | null
  groupId?: number | string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { smAndDown } = useDisplay()
const branchesStore = useBranchesStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const isLoading = ref(false)
const statement = ref<ParticipantStatement | null>(null)
const errorMsg = ref<string | null>(null)
const copySuccess = ref(false)

const headers = [
  { title: 'Cuota / Glosa', key: 'description', align: 'start' as const },
  { title: 'Vencimiento', key: 'due_date', align: 'center' as const, width: '120px' },
  { title: 'Monto', key: 'total_amount', align: 'end' as const, width: '100px' },
  { title: 'Abonado', key: 'paid_amount', align: 'end' as const, width: '100px' },
  { title: 'Saldo', key: 'pending_amount', align: 'end' as const, width: '100px' },
  { title: 'Estado', key: 'status', align: 'center' as const, width: '120px' }
]

async function loadStatement(): Promise<void> {
  if (!isOpen.value || !props.participantId || !branchesStore.activeBranchId) {
    statement.value = null
    return
  }

  isLoading.value = true
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
    isLoading.value = false
  }
}

watch(() => [isOpen.value, props.participantId], ([open, pid]) => {
  if (open && pid) {
    loadStatement()
  } else {
    statement.value = null
    errorMsg.value = null
    copySuccess.value = false
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

const whatsappMessageText = computed<string>(() => {
  if (!statement.value) return ''
  const s = statement.value
  const lines: string[] = [
    `*ESTADO DE CUENTA — MOTCAR*`,
    `Cliente: *${s.client.name}* (${s.client.identification_type === '0' ? 'V' : 'E'}-${s.client.identification_value})`,
    `Grupo: *${s.participant.group_name}* (Turno #${s.participant.position})`,
    `---`,
    `Total Comprometido: ${money(s.summary.total_committed)}`,
    `Total Cancelado: ${money(s.summary.total_collected)}`,
    `Saldo Pendiente: ${money(s.summary.total_pending)}`,
    `Cuotas Pagadas: ${s.summary.installments_paid} de ${s.summary.installments_total}`,
  ]

  if (s.summary.overdue_amount > 0) {
    lines.push(`*Monto Vencido en Mora: ${money(s.summary.overdue_amount)}* (${s.summary.installments_overdue} cuotas)`)
  } else {
    lines.push(`Estado: *Al Día*`)
  }

  if (s.participant.is_awarded) {
    lines.push(`Vehículo Entregado: *Sí*`)
  }

  lines.push(`---`)
  lines.push(`Para conciliar o reportar pagos, responda a este mensaje con el comprobante.`)

  return lines.join('\n')
})

const clientWaHref = computed<string | null>(() => {
  if (!statement.value?.client.phone) return null
  return waLink(statement.value.client.phone, whatsappMessageText.value)
})

async function copySummaryToClipboard(): Promise<void> {
  if (!whatsappMessageText.value) return
  try {
    await navigator.clipboard.writeText(whatsappMessageText.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 3000)
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err)
  }
}
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
          <span>Estado de Cuenta / Cartola</span>
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="isOpen = false" />
      </v-toolbar>

      <v-card-text class="pa-4 flex-grow-1 overflow-y-auto">
        <!-- Estado de Carga -->
        <div v-if="isLoading" class="text-center py-10" data-testid="statement-loading">
          <v-progress-circular indeterminate color="primary" size="48" class="mb-3" />
          <div class="text-body-2 text-medium-emphasis">Cargando cartola del participante...</div>
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
                  <span>Turno: <strong>#{{ statement.participant.position }}</strong></span>
                  <span v-if="statement.client.phone">&bull;</span>
                  <span v-if="statement.client.phone" class="text-caption font-mono">
                    {{ statement.client.phone }}
                  </span>
                </div>
              </v-col>

              <v-col cols="12" md="5" class="text-md-end mt-2 mt-md-0">
                <v-chip
                  v-if="statement.participant.is_awarded"
                  color="purple"
                  variant="flat"
                  size="small"
                  class="font-weight-bold mr-2 mb-1"
                  prepend-icon="mdi-car-key"
                >
                  Vehículo Entregado
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

          <!-- 4 Métricas Financieras Clave -->
          <v-row density="compact" class="mb-4">
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="text-caption text-medium-emphasis text-uppercase">Comprometido</div>
                <div class="text-subtitle-1 font-weight-bold text-high-emphasis" data-testid="statement-total-committed">
                  {{ money(statement.summary.total_committed) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ statement.summary.installments_total }} cuotas
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="text-caption text-medium-emphasis text-uppercase">Cancelado</div>
                <div class="text-subtitle-1 font-weight-bold text-success" data-testid="statement-total-collected">
                  {{ money(statement.summary.total_collected) }}
                </div>
                <div class="text-caption text-success font-weight-medium">
                  {{ statement.summary.installments_paid }} pagadas
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="text-caption text-medium-emphasis text-uppercase">Saldo Pendiente</div>
                <div class="text-subtitle-1 font-weight-bold text-primary" data-testid="statement-total-pending">
                  {{ money(statement.summary.total_pending) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ statement.summary.installments_pending }} pendientes
                </div>
              </v-card>
            </v-col>
            <v-col cols="6" sm="3">
              <v-card elevation="0" rounded="lg" class="border pa-3 text-center bg-white h-100">
                <div class="text-caption text-error font-weight-bold text-uppercase">En Mora</div>
                <div class="text-subtitle-1 font-weight-bold text-error" data-testid="statement-overdue-amount">
                  {{ money(statement.summary.overdue_amount) }}
                </div>
                <div class="text-caption text-error">
                  {{ statement.summary.installments_overdue }} vencidas
                </div>
              </v-card>
            </v-col>
          </v-row>

          <!-- Acciones Rápidas para WhatsApp -->
          <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
            <div class="text-subtitle-2 font-weight-bold text-high-emphasis">
              Cronograma de Cuotas y Pagos
            </div>
            <div class="d-flex align-center ga-2">
              <v-btn
                variant="outlined"
                color="secondary"
                size="small"
                prepend-icon="mdi-content-copy"
                data-testid="statement-copy-wa-btn"
                @click="copySummaryToClipboard"
              >
                {{ copySuccess ? '¡Copiado!' : 'Copiar Resumen' }}
              </v-btn>
              <v-btn
                v-if="clientWaHref"
                :href="clientWaHref"
                target="_blank"
                rel="noopener"
                color="success"
                size="small"
                variant="flat"
                prepend-icon="mdi-whatsapp"
                data-testid="statement-open-wa-btn"
              >
                Enviar WhatsApp
              </v-btn>
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
              <span class="text-caption font-mono">{{ item.due_date }}</span>
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

      <v-card-actions class="pa-3 bg-grey-lighten-5 justify-end">
        <v-btn variant="plain" @click="isOpen = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
