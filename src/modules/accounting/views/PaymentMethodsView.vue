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
const selectedCategoryFilter = ref<number | string | null>(null)

async function loadCategories(): Promise<void> {
  try {
    const res = await fetchPaymentCategories({ itemsPerPage: 100 })
    categories.value = res.data || []
  } catch (err) {
    console.error('Error loading payment categories:', err)
  }
}

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

// Filtro reactivo por categoría
watch(selectedCategoryFilter, (catId) => {
  if (catId) {
    accountsQuery.staticFilters.value = [['category_id', catId]]
  } else {
    accountsQuery.staticFilters.value = []
  }
  accountsQuery.page.value = 1
  accountsQuery.refresh()
})

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
    const bank = (meta.bank_name as string) || ''
    const acc = (meta.account_number as string) || ''
    const doc = (meta.id_document as string) || ''
    const holder = (meta.beneficiary_name as string) || ''
    const parts = []
    if (bank) parts.push(bank)
    if (acc) parts.push(`Cta: ${acc}`)
    if (doc || holder) parts.push(`Titular: ${holder} (${doc})`.trim())
    return parts.join(' • ') || 'Sin datos bancarios'
  }

  if (catId === 2) {
    // Pago Móvil
    const bank = (meta.bank_code as string) || ''
    const phone = (meta.phone_number as string) || ''
    const doc = (meta.id_document as string) || ''
    const parts = []
    if (bank) parts.push(`Banco: ${bank}`)
    if (phone) parts.push(`Telf: ${phone}`)
    if (doc) parts.push(`C.I: ${doc}`)
    return parts.join(' • ') || 'Sin datos de pago móvil'
  }

  if (catId === 4) {
    // Zelle
    const email = (meta.email as string) || ''
    const holder = (meta.account_holder as string) || ''
    return [email, holder ? `(${holder})` : ''].filter(Boolean).join(' ') || 'Sin datos de Zelle'
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

interface AccountFormData {
  category_id: number | null
  currency_id: number | null
  name: string
  is_active: boolean
  // Metadata fields
  bank_name: string
  account_number: string
  id_document: string
  beneficiary_name: string
  bank_code: string
  phone_number: string
  email: string
  account_holder: string
}

const formDefaults: AccountFormData = {
  category_id: null,
  currency_id: null,
  name: '',
  is_active: true,
  bank_name: '',
  account_number: '',
  id_document: '',
  beneficiary_name: '',
  bank_code: '',
  phone_number: '',
  email: '',
  account_holder: ''
}

const form = ref<AccountFormData>({ ...formDefaults })

function openCreateModal(): void {
  editingAccountId.value = null
  const defaultCurrency = accountingStore.currencies.find((c) => c.code === 'USD')?.id || 1
  const defaultCategory = categories.value[0]?.id ? Number(categories.value[0].id) : 3

  form.value = {
    ...formDefaults,
    currency_id: Number(defaultCurrency),
    category_id: defaultCategory
  }
  accountModalOpen.value = true
}

function openEditModal(item: PaymentAccountItem): void {
  editingAccountId.value = item.id
  const meta = parseMetadata(item.metadata)

  form.value = {
    category_id: Number(item.category_id),
    currency_id: Number(item.currency_id),
    name: item.name || '',
    is_active: String(item.is_disabled) === '0',
    bank_name: (meta.bank_name as string) || '',
    account_number: (meta.account_number as string) || '',
    id_document: (meta.id_document as string) || '',
    beneficiary_name: (meta.beneficiary_name as string) || '',
    bank_code: (meta.bank_code as string) || '',
    phone_number: (meta.phone_number as string) || '',
    email: (meta.email as string) || '',
    account_holder: (meta.account_holder as string) || ''
  }
  accountModalOpen.value = true
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

  // Validaciones condicionales según categoría
  const catId = Number(form.value.category_id)
  const metaPayload: Record<string, string> = {}

  if (catId === 3) {
    // Transferencia
    if (!form.value.account_number.trim()) {
      showMessage('Ingresa el número de cuenta bancaria.', 'error')
      return
    }
    metaPayload.bank_name = form.value.bank_name.trim()
    metaPayload.account_number = form.value.account_number.trim()
    metaPayload.id_document = form.value.id_document.trim()
    metaPayload.beneficiary_name = form.value.beneficiary_name.trim()
  } else if (catId === 2) {
    // Pago Móvil
    if (!form.value.phone_number.trim() || !form.value.id_document.trim()) {
      showMessage('El teléfono y la cédula/RIF son obligatorios para Pago Móvil.', 'error')
      return
    }
    metaPayload.bank_code = form.value.bank_code.trim()
    metaPayload.phone_number = form.value.phone_number.trim()
    metaPayload.id_document = form.value.id_document.trim()
  } else if (catId === 4) {
    // Zelle
    if (!form.value.email.trim()) {
      showMessage('El correo electrónico es obligatorio para cuentas Zelle.', 'error')
      return
    }
    metaPayload.email = form.value.email.trim()
    metaPayload.account_holder = form.value.account_holder.trim()
  }

  isSubmittingAccount.value = true
  try {
    const payload: CreatePaymentAccountPayload = {
      currency_id: Number(form.value.currency_id),
      name: form.value.name.trim(),
      metadata: Object.keys(metaPayload).length > 0 ? metaPayload : null,
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
    <!-- SEGUNDA SECCIÓN: BARRA DE BÚSQUEDA, FILTRO Y RECARGA          -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <v-row density="compact" align="center" justify="space-between" class="mb-3">
      <v-col cols="12" sm="7" md="6">
        <v-text-field
          v-model="accountsQuery.search.value"
          prepend-inner-icon="mdi-magnify"
          placeholder="Buscar por nombre de cuenta..."
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

      <v-col cols="10" sm="4" md="4" class="d-flex align-center ga-2">
        <v-select
          v-model="selectedCategoryFilter"
          :items="[{ id: null, name: 'Todas las categorías' }, ...categories]"
          item-title="name"
          item-value="id"
          label="Filtrar categoría"
          variant="solo"
          flat
          bg-color="white"
          density="comfortable"
          rounded="lg"
          hide-details
          class="border elevation-0"
          data-testid="category-filter-select"
        />
      </v-col>

      <v-col cols="auto">
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
      </v-col>
    </v-row>

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
          :items="categories"
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
          class="mb-3"
          data-testid="input-account-name"
        />

        <!-- CAMPOS CONDICIONALES DE METADATA -->
        <!-- 1. Transferencia Bancaria Nacional (catId 3) -->
        <div v-if="Number(form.category_id) === 3" class="mb-2">
          <v-divider class="my-3" />
          <p class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase">
            Datos Bancarios
          </p>

          <v-text-field
            v-model="form.bank_name"
            label="Banco *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-bank-name"
          />

          <v-text-field
            v-model="form.account_number"
            label="Número de Cuenta (20 dígitos) *"
            variant="outlined"
            density="comfortable"
            maxlength="20"
            class="mb-3"
            data-testid="input-meta-account-number"
          />

          <v-text-field
            v-model="form.id_document"
            label="Cédula / RIF *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-id-document"
          />

          <v-text-field
            v-model="form.beneficiary_name"
            label="Titular / Beneficiario *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-beneficiary"
          />
        </div>

        <!-- 2. Pago Móvil (catId 2) -->
        <div v-else-if="Number(form.category_id) === 2" class="mb-2">
          <v-divider class="my-3" />
          <p class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase">
            Datos de Pago Móvil
          </p>

          <v-text-field
            v-model="form.bank_code"
            label="Banco / Código *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-bank-code"
          />

          <v-text-field
            v-model="form.phone_number"
            label="Teléfono Registrado *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-phone"
          />

          <v-text-field
            v-model="form.id_document"
            label="Cédula / RIF *"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-pm-doc"
          />
        </div>

        <!-- 3. Zelle (catId 4) -->
        <div v-else-if="Number(form.category_id) === 4" class="mb-2">
          <v-divider class="my-3" />
          <p class="text-caption font-weight-bold text-medium-emphasis mb-2 text-uppercase">
            Datos de Zelle
          </p>

          <v-text-field
            v-model="form.email"
            label="Correo Electrónico Registrado *"
            type="email"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-zelle-email"
          />

          <v-text-field
            v-model="form.account_holder"
            label="Nombre del Titular"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            data-testid="input-meta-zelle-holder"
          />
        </div>

        <!-- 4. Efectivo (catId 1) -->
        <div v-else-if="Number(form.category_id) === 1" class="mb-2">
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            text="Este método registrará cobros directamente en caja física de efectivo."
            rounded="lg"
            class="my-3"
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
