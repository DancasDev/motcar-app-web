<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useAccountingStore } from '../stores/accounting.store'
import { useDataQuery } from '@/composables/useDataQuery'
import {
  fetchPaymentAccounts,
  fetchPaymentCategories,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount
} from '../api/accounting.api'
import { fetchMetadataSchemaRender } from '@/modules/system/api/system.api'
import AppMetadataRenderer, { type MetadataSchemaPayload } from '@/components/common/AppMetadataRenderer.vue'
import AppChipFilter from '@/components/common/AppChipFilter.vue'
import { METADATA_LABELS_ES } from '@/utils/metadataValidation'
import type { DqbFilterTuple } from '@/types/query'
import type {
  PaymentAccountItem,
  PaymentCategoryItem,
  CreatePaymentAccountPayload
} from '../types'
import AppModal from '@/components/common/AppModal.vue'

const { smAndDown } = useDisplay()
const accountingStore = useAccountingStore()

// ---------------------------------------------------------------------
// 1. Categorías y Monedas
// ---------------------------------------------------------------------
const categories = ref<PaymentCategoryItem[]>([])

async function loadCategories(): Promise<void> {
  try {
    const res = await fetchPaymentCategories({ itemsPerPage: 100 })
    categories.value = res.data || []
  } catch (err) {
    console.error('Error loading payment categories:', err)
  }
}

const categoryOptions = computed(() => {
  return (categories.value || []).map((cat) => ({
    id: Number(cat.id),
    name: cat.name,
    metadata_schema_id: cat.metadata_schema_id ? Number(cat.metadata_schema_id) : null
  }))
})

const categoryFilterOptions = computed(() => {
  return (categories.value || []).map((cat) => ({
    text: cat.name,
    title: cat.name,
    value: Number(cat.id)
  }))
})

const currencyOptions = computed(() => {
  return (accountingStore.currencies || []).map((c) => ({
    id: Number(c.id),
    title: `${c.code} (${c.symbol}) - ${c.name}`
  }))
})

// ---------------------------------------------------------------------
// 2. Data Query de Métodos / Cuentas de Pago
// ---------------------------------------------------------------------
const accountsQuery = useDataQuery<PaymentAccountItem>(
  async (params) => {
    return fetchPaymentAccounts(params)
  },
  {
    initialItemsPerPage: 10,
    searchFields: ['name'],
    defaultOrder: { id: 'DESC' }
  }
)

function handleCategoryFilterChange(dqbFilter: DqbFilterTuple[] | null): void {
  if (dqbFilter && dqbFilter.length > 0) {
    accountsQuery.staticFilters.value = dqbFilter
  } else {
    accountsQuery.staticFilters.value = []
  }
  accountsQuery.page.value = 1
  accountsQuery.refresh()
}

const accountHeaders = [
  { title: 'Nombre / Canal', key: 'name', align: 'start' as const, sortable: true },
  { title: 'Categoría', key: 'category_name', align: 'center' as const, sortable: true, width: '190px' },
  { title: 'Moneda', key: 'currency_code', align: 'center' as const, sortable: true, width: '110px' },
  { title: 'Detalles / Datos', key: 'details', align: 'start' as const, sortable: false },
  { title: 'Estado', key: 'is_disabled', align: 'center' as const, sortable: true, width: '120px' },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false, width: '80px' }
]

function getCategoryColor(catId: number | string | undefined): string {
  const idNum = Number(catId)
  switch (idNum) {
    case 1:
      return 'success' // Efectivo
    case 2:
      return 'info' // Pago Móvil
    case 3:
      return 'primary' // Transferencia
    case 4:
      return 'purple' // Zelle
    default:
      return 'blue-grey'
  }
}

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}

function formatAccountDetails(item: PaymentAccountItem): string {
  const meta = parseMetadata(item.metadata)
  const catId = Number(item.category_id)

  if (catId === 3) {
    // Transferencia
    const acc = (meta.account_number as string) || ''
    const doc = (meta.id_document as string) || ''
    const holder = (meta.beneficiary_name as string) || ''
    const parts = []
    if (acc) parts.push(`Cta: ${acc}`)
    if (doc || holder) parts.push(`Titular: ${holder} (${doc})`.trim())
    return parts.join(' • ') || 'Sin datos bancarios'
  }

  if (catId === 2) {
    // Pago Móvil
    const doc = (meta.id_document as string) || ''
    const phone = (meta.phone_number as string) || ''
    const holder = (meta.account_holder as string) || ''
    const parts = []
    if (doc) parts.push(`C.I: ${doc}`)
    if (phone) parts.push(`Telf: ${phone}`)
    if (holder) parts.push(`Propietario: ${holder}`)
    return parts.join(' • ') || 'Sin datos de pago móvil'
  }

  if (catId === 4) {
    // Zelle
    const email = (meta.email as string) || ''
    const holder = (meta.account_holder as string) || ''
    return [email, holder ? `(${holder})` : ''].filter(Boolean).join(' ') || 'Sin datos de Zelle'
  }

  const entries = Object.entries(meta).filter(([_, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length > 0) {
    return entries.map(([k, v]) => `${METADATA_LABELS_ES[k] || k}: ${v}`).join(' • ')
  }

  return 'Caja receptora de efectivo'
}

async function refreshAll(): Promise<void> {
  await Promise.all([
    accountingStore.loadCurrencies(true),
    loadCategories(),
    accountingStore.loadBankAccounts(true),
    accountsQuery.executeFetch()
  ])
}

// ---------------------------------------------------------------------
// 3. Crear / Editar Método de Pago
// ---------------------------------------------------------------------
const accountModalOpen = ref(false)
const isSubmittingAccount = ref(false)
const editingAccountId = ref<string | number | null>(null)

// Gestión de Esquema de Metadatos Dinámicos
const categoryMetadataSchema = ref<MetadataSchemaPayload | null>(null)
const isLoadingSchema = ref(false)
const metadataFormData = ref<Record<string, any>>({})
const schemaCache = new Map<number | string, MetadataSchemaPayload>()

const hasMetadataFields = computed(() => {
  if (!categoryMetadataSchema.value?.fields) return false
  if (Array.isArray(categoryMetadataSchema.value.fields)) {
    return categoryMetadataSchema.value.fields.length > 0
  }
  return Object.keys(categoryMetadataSchema.value.fields).length > 0
})

async function loadCategoryMetadataSchema(categoryId: number | null): Promise<void> {
  if (!categoryId) {
    categoryMetadataSchema.value = null
    return
  }
  const category = categoryOptions.value.find((c) => c.id === categoryId)
  const schemaId = category?.metadata_schema_id
  if (!schemaId) {
    categoryMetadataSchema.value = null
    return
  }

  if (schemaCache.has(schemaId)) {
    categoryMetadataSchema.value = schemaCache.get(schemaId)!
    return
  }

  isLoadingSchema.value = true
  try {
    const res = await fetchMetadataSchemaRender(schemaId)
    const schema = (res.data || null) as MetadataSchemaPayload | null
    if (schema) {
      schemaCache.set(schemaId, schema)
    }
    categoryMetadataSchema.value = schema
  } catch (err) {
    console.error('Error al cargar esquema de metadatos:', err)
    categoryMetadataSchema.value = null
  } finally {
    isLoadingSchema.value = false
  }
}

interface AccountFormData {
  category_id: number | null
  currency_id: number | null
  name: string
  is_active: boolean
}

const formDefaults: AccountFormData = {
  category_id: null,
  currency_id: null,
  name: '',
  is_active: true
}

const form = ref<AccountFormData>({ ...formDefaults })

// Reaccionar al cambio de categoría para cargar el esquema dinámico correspondiente
watch(
  () => form.value.category_id,
  async (newCatId, oldCatId) => {
    if (newCatId !== oldCatId) {
      if (!editingAccountId.value) {
        metadataFormData.value = {}
      }
      await loadCategoryMetadataSchema(newCatId)
    }
  }
)

async function openCreateModal(): Promise<void> {
  editingAccountId.value = null
  const defaultCurrency = accountingStore.currencies.find((c) => c.code === 'USD')?.id || 1
  const defaultCategory = categoryOptions.value[0]?.id ? Number(categoryOptions.value[0].id) : 1

  metadataFormData.value = {}
  form.value = {
    ...formDefaults,
    currency_id: Number(defaultCurrency),
    category_id: defaultCategory
  }
  accountModalOpen.value = true
  await loadCategoryMetadataSchema(defaultCategory)
}

async function openEditModal(item: PaymentAccountItem): Promise<void> {
  editingAccountId.value = item.id
  const meta = parseMetadata(item.metadata)
  metadataFormData.value = { ...meta }

  form.value = {
    category_id: Number(item.category_id),
    currency_id: Number(item.currency_id),
    name: item.name || '',
    is_active: String(item.is_disabled) === '0'
  }
  accountModalOpen.value = true
  await loadCategoryMetadataSchema(Number(item.category_id))
}

async function handleSaveAccount(): Promise<void> {
  if (!form.value.category_id) {
    showMessage('Selecciona una categoría de pago.', 'error')
    return
  }
  if (!form.value.currency_id) {
    showMessage('Selecciona la moneda de la cuenta.', 'error')
    return
  }
  if (!form.value.name.trim()) {
    showMessage('El nombre del método de pago es obligatorio.', 'error')
    return
  }

  const catId = Number(form.value.category_id)

  // Extraer valores limpios de metadatos dinámicos
  const cleanedMetadata: Record<string, any> = {}
  for (const [key, val] of Object.entries(metadataFormData.value)) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      cleanedMetadata[key] = typeof val === 'string' ? val.trim() : val
    }
  }

  isSubmittingAccount.value = true
  try {
    const payload: CreatePaymentAccountPayload = {
      currency_id: Number(form.value.currency_id),
      name: form.value.name.trim(),
      metadata: Object.keys(cleanedMetadata).length > 0 ? cleanedMetadata : null,
      is_disabled: form.value.is_active ? '0' : '1'
    }

    if (editingAccountId.value) {
      await updatePaymentAccount(catId, editingAccountId.value, payload)
      showMessage('Método de pago actualizado exitosamente.')
    } else {
      await createPaymentAccount(catId, payload)
      showMessage('Método de pago registrado exitosamente.')
    }

    accountModalOpen.value = false
    await refreshAll()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { messages?: Record<string, string> | string; error?: string } } }
    const serverMsg =
      typeof axiosErr.response?.data?.messages === 'string'
        ? axiosErr.response.data.messages
        : Object.values(axiosErr.response?.data?.messages || {})[0]
    const msg = serverMsg || axiosErr.response?.data?.error || (err instanceof Error ? err.message : 'Error al guardar el método de pago.')
    showMessage(msg, 'error')
  } finally {
    isSubmittingAccount.value = false
  }
}

// ---------------------------------------------------------------------
// 4. Cambiar Estado (Habilitar / Inhabilitar)
// ---------------------------------------------------------------------
async function toggleAccountStatus(item: PaymentAccountItem): Promise<void> {
  const currentDisabled = String(item.is_disabled) === '1'
  const newDisabled = currentDisabled ? '0' : '1'
  try {
    await updatePaymentAccount(item.category_id, item.id, {
      is_disabled: newDisabled
    })
    showMessage(
      `Método de pago ${currentDisabled ? 'habilitado' : 'inhabilitado'} exitosamente.`
    )
    await refreshAll()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al cambiar estado.'
    showMessage(msg, 'error')
  }
}

// ---------------------------------------------------------------------
// 5. Eliminar Método de Pago
// ---------------------------------------------------------------------
const deleteDialogOpen = ref(false)
const accountToDelete = ref<PaymentAccountItem | null>(null)
const isDeletingAccount = ref(false)

function promptDeleteAccount(item: PaymentAccountItem): void {
  accountToDelete.value = item
  deleteDialogOpen.value = true
}

async function handleConfirmDelete(): Promise<void> {
  if (!accountToDelete.value) return
  isDeletingAccount.value = true
  try {
    await deletePaymentAccount(accountToDelete.value.category_id, accountToDelete.value.id)
    showMessage('Método de pago eliminado exitosamente.')
    deleteDialogOpen.value = false
    accountToDelete.value = null
    await refreshAll()
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { messages?: Record<string, string> | string } } }
    const serverMsg =
      typeof axiosErr.response?.data?.messages === 'string'
        ? axiosErr.response.data.messages
        : Object.values(axiosErr.response?.data?.messages || {})[0]
    const msg = serverMsg || (err instanceof Error ? err.message : 'Error al eliminar el método de pago.')
    showMessage(msg, 'error')
  } finally {
    isDeletingAccount.value = false
  }
}

// ---------------------------------------------------------------------
// 6. Feedback
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
  await Promise.all([
    accountingStore.loadCurrencies(),
    loadCategories()
  ])
})
</script>

<template>
  <div class="payment-methods-module">
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- PRIMERA SECCIÓN: TÍTULO Y BOTÓN REGISTRAR                    -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-9">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis mb-0 leading-tight">
          Métodos de Pago
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0 mt-0">
          Cuentas bancarias receptoras, canales y medios para cobros y conciliación
        </p>
      </div>

      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        class="text-none font-weight-bold px-4"
        data-testid="btn-open-account-modal"
        @click="openCreateModal"
      >
        Registrar
      </v-btn>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA (SECCIÓN SOLA, 7 COLS)   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" class="mb-3">
      <v-col cols="12" md="7">
        <v-text-field
          v-model="accountsQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por nombre..."
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          clearable
          class="border search-field elevation-0"
          data-testid="account-search-input"
        />
      </v-col>
    </v-row>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TERCERA SECCIÓN: FILTROS DE CATEGORÍA Y BOTÓN DE RECARGA      -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
      <!-- Chips de categoría alineados a la izquierda -->
      <div class="d-flex align-center flex-wrap ga-2">
        <AppChipFilter
          field="category_id"
          :items="categoryFilterOptions"
          all-text="Todos"
          color="primary"
          density="comfortable"
          data-testid="category-chip-filter"
          @change="handleCategoryFilterChange"
        />
      </div>

      <!-- Botón de recarga a la derecha -->
      <v-tooltip text="Recargar la tabla" location="top" color="#1E293B">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            icon="mdi-refresh"
            variant="flat"
            color="white"
            size="small"
            class="border rounded-circle flex-shrink-0"
            :loading="accountsQuery.isLoading.value"
            data-testid="btn-refresh-accounts"
            @click="refreshAll"
          />
        </template>
      </v-tooltip>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- TERCERA SECCIÓN: TABLA BLANCA ESTANDARIZADA                   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-card elevation="0" rounded="lg" class="border bg-white overflow-hidden">
      <v-data-table-server
        v-model:items-per-page="accountsQuery.itemsPerPage.value"
        v-model:page="accountsQuery.page.value"
        v-model:sort-by="accountsQuery.sortBy.value"
        :headers="accountHeaders"
        :items="accountsQuery.items.value"
        :items-length="accountsQuery.totalItems.value"
        :loading="accountsQuery.isLoading.value"
        :mobile="smAndDown"
        no-data-text="No hay métodos de pago registrados"
        loading-text="Cargando métodos de pago..."
        density="comfortable"
        hover
        class="bg-white"
        data-testid="accounts-table"
        @update:options="accountsQuery.onUpdateOptions"
      >
        <!-- Columna: Nombre -->
        <template #[`item.name`]="{ item }">
          <div class="py-1">
            <span class="font-weight-bold text-body-2 text-high-emphasis d-block">
              {{ item.name }}
            </span>
          </div>
        </template>

        <!-- Columna: Categoría -->
        <template #[`item.category_name`]="{ item }">
          <v-chip
            size="small"
            :color="getCategoryColor(item.category_id)"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ item.category_name || 'Sin Categoría' }}
          </v-chip>
        </template>

        <!-- Columna: Moneda -->
        <template #[`item.currency_code`]="{ item }">
          <v-chip size="x-small" color="primary" variant="outlined" class="font-weight-bold">
            {{ item.currency_code || 'USD' }}
          </v-chip>
        </template>

        <!-- Columna: Detalles / Datos -->
        <template #[`item.details`]="{ item }">
          <span class="text-caption text-medium-emphasis">
            {{ formatAccountDetails(item) }}
          </span>
        </template>

        <!-- Columna: Estado -->
        <template #[`item.is_disabled`]="{ item }">
          <v-chip
            size="small"
            :color="String(item.is_disabled) === '0' ? 'success' : 'default'"
            variant="tonal"
            label
            class="font-weight-medium"
          >
            {{ String(item.is_disabled) === '0' ? 'Activa' : 'Inactiva' }}
          </v-chip>
        </template>

        <!-- Columna: Acciones (Kebab Menu) -->
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
                  data-testid="btn-account-actions-menu"
                />
              </template>
              <v-list density="compact" rounded="md" elevation="4" class="py-1 min-w-160">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Editar"
                  data-testid="menu-item-edit-account"
                  @click="openEditModal(item)"
                />
                <v-list-item
                  :prepend-icon="String(item.is_disabled) === '0' ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  :title="String(item.is_disabled) === '0' ? 'Inhabilitar' : 'Habilitar'"
                  data-testid="menu-item-toggle-account"
                  @click="toggleAccountStatus(item)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  prepend-icon="mdi-trash-can-outline"
                  title="Eliminar"
                  base-color="error"
                  data-testid="menu-item-delete-account"
                  @click="promptDeleteAccount(item)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: REGISTRAR / EDITAR MÉTODO DE PAGO                      -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="accountModalOpen"
      :title="editingAccountId ? 'Editar Método de Pago' : 'Registrar Método de Pago'"
      :subtitle="editingAccountId ? 'Modifica los datos del canal o cuenta seleccionada' : 'Ingresa la información del canal o cuenta receptora de fondos'"
      max-width="520"
      persistent
      :loading="isSubmittingAccount"
      :submit-text="editingAccountId ? 'Actualizar' : 'Registrar'"
      :submit-icon="editingAccountId ? 'mdi-check' : 'mdi-plus'"
      submit-test-id="btn-save-account"
      form-id="form-payment-account"
      data-testid="account-modal"
      @submit="handleSaveAccount"
    >
      <v-form id="form-payment-account" @submit.prevent="handleSaveAccount">
        <!-- Categoría -->
        <v-select
          v-model="form.category_id"
          :items="categoryOptions"
          item-title="name"
          item-value="id"
          label="Categoría *"
          variant="outlined"
          density="comfortable"
          :disabled="!!editingAccountId"
          class="mb-3"
          data-testid="input-account-category"
        />

        <!-- Moneda -->
        <v-select
          v-model="form.currency_id"
          :items="currencyOptions"
          item-title="title"
          item-value="id"
          label="Moneda *"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          data-testid="input-account-currency"
        />

        <!-- Nombre Descriptivo -->
        <v-text-field
          v-model="form.name"
          label="Nombre del Método / Cuenta *"
          variant="outlined"
          density="comfortable"
          maxlength="80"
          counter="80"
          class="mb-3"
          data-testid="input-account-name"
        />

        <!-- Renderizado dinámico de campos de metadatos desde el esquema del sistema -->
        <div v-if="isLoadingSchema" class="py-4 text-center">
          <v-progress-circular indeterminate color="primary" size="24" width="2" />
          <div class="text-caption text-medium-emphasis mt-2">Cargando campos del método...</div>
        </div>

        <div v-else-if="categoryMetadataSchema && hasMetadataFields" class="mb-2">
          <v-divider class="my-3" />
          <p class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase">
            Datos Específicos del Método
          </p>

          <AppMetadataRenderer
            :schema="categoryMetadataSchema"
            v-model="metadataFormData"
            density="comfortable"
            display-mode="flat"
            :columns="12"
          />
        </div>

        <!-- Estado Activo -->
        <v-switch
          v-model="form.is_active"
          color="primary"
          density="compact"
          hide-details
          label="Cuenta activa para registrar cobros"
          data-testid="switch-account-active"
          class="mt-2"
        />
      </v-form>
    </AppModal>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- MODAL: CONFIRMAR ELIMINACIÓN                                 -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="deleteDialogOpen"
      title="Eliminar Método de Pago"
      subtitle="Esta acción moverá el canal de pago a la papelera del sistema"
      max-width="460"
      :loading="isDeletingAccount"
      submit-text="Eliminar"
      submit-color="error"
      submit-icon="mdi-trash-can"
      @submit="handleConfirmDelete"
    >
      <div class="py-2">
        <p class="text-body-2 text-high-emphasis mb-3">
          ¿Estás seguro de que deseas eliminar el método de pago
          <strong>{{ accountToDelete?.name }}</strong>?
        </p>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
          text="El canal dejará de aparecer en la lista de cobros y en los formularios de recibo."
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
      data-testid="account-snackbar"
    >
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.min-w-160 {
  min-width: 160px;
}
</style>
