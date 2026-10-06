<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

export interface PaginatedQueryParams {
  page: number
  pageSize: number
  search: string
  searchField?: string
  extraParams?: Record<string, any>
  extraFilters?: any[]
}

export interface PaginatedResponse<T = any> {
  items: T[]
  total?: number
  recordsTotal?: number
  pagination?: {
    total: number
    page: number
    pageSize: number
  }
}

const props = withDefaults(
  defineProps<{
    modelValue: any
    fetchOptions?: (params: PaginatedQueryParams) => Promise<PaginatedResponse | any>
    fetchById?: (id: any) => Promise<any>
    initialOption?: any
    rootOption?: any
    valueKey?: string
    labelKey?: string
    searchField?: string
    extraParams?: Record<string, any>
    extraFilters?: any[]
    pageSize?: number
    debounceMs?: number
    returnObject?: boolean
    label?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    clearable?: boolean
    rules?: any[]
    chips?: boolean
    density?: 'default' | 'comfortable' | 'compact'
    variant?: 'outlined' | 'plain' | 'underlined' | 'filled' | 'solo' | 'solo-inverted' | 'solo-filled'
  }>(),
  {
    fetchOptions: undefined,
    fetchById: undefined,
    initialOption: null,
    rootOption: null,
    valueKey: 'id',
    labelKey: 'name',
    searchField: undefined,
    extraParams: () => ({}),
    extraFilters: () => [],
    pageSize: 20,
    debounceMs: 350,
    returnObject: false,
    label: 'Seleccionar...',
    placeholder: 'Escriba para buscar...',
    disabled: false,
    readonly: false,
    clearable: true,
    rules: () => [],
    chips: false,
    density: 'comfortable',
    variant: 'outlined'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'change', option: any): void
}>()

const options = ref<any[]>([])
const page = ref(1)
const totalCount = ref(0)
const searchQuery = ref('')
const isLoadingInitial = ref(false)
const isLoadingMore = ref(false)
const menuOpen = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)

let debounceTimer: any = null
let observer: IntersectionObserver | null = null

const hasMore = computed(() => {
  if (totalCount.value === 0) return false
  return options.value.length < totalCount.value
})

const itemValueResolver = computed(() => {
  return (item: any) => {
    if (!item) return null
    if (props.returnObject) return item
    return item[props.valueKey] !== undefined ? item[props.valueKey] : item
  }
})

const itemTitleResolver = computed(() => {
  return (item: any) => {
    if (!item) return ''
    if (typeof item === 'string' || typeof item === 'number') return String(item)
    return String(item[props.labelKey] || item.name || item.title || item.label || item[props.valueKey] || '')
  }
})

async function loadPage(pageToLoad: number, query: string, isAppend: boolean = false): Promise<void> {
  if (!props.fetchOptions) return

  if (isAppend) {
    isLoadingMore.value = true
  } else {
    isLoadingInitial.value = true
  }

  try {
    const params: PaginatedQueryParams = {
      page: pageToLoad,
      pageSize: props.pageSize,
      search: query.trim(),
      searchField: props.searchField || props.labelKey,
      extraParams: props.extraParams,
      extraFilters: props.extraFilters
    }

    const res = await props.fetchOptions(params)
    const newItems = Array.isArray(res) ? res : res?.items || res?.data || []
    const total = res?.total ?? res?.recordsTotal ?? res?.pagination?.total ?? newItems.length

    totalCount.value = total

    if (isAppend) {
      // Evitar duplicados por valueKey
      const existingIds = new Set(options.value.map((o) => o[props.valueKey]))
      const filtered = newItems.filter((o: any) => !existingIds.has(o[props.valueKey]))
      options.value = [...options.value, ...filtered]
    } else {
      let combined = [...newItems]
      if (props.rootOption) {
        combined = [props.rootOption, ...combined]
      }
      // Si hay una opción inicial preseleccionada y no está en la primera página, preservarla
      if (props.initialOption) {
        const hasIt = combined.some((o) => o[props.valueKey] === props.initialOption[props.valueKey])
        if (!hasIt) {
          combined.unshift(props.initialOption)
        }
      }
      options.value = combined
    }

    page.value = pageToLoad
  } catch (err) {
    console.error('[AppPaginatedSelect] Error fetching options:', err)
  } finally {
    isLoadingInitial.value = false
    isLoadingMore.value = false
  }
}

function handleSearch(val: string | null): void {
  const text = val || ''
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadPage(1, text, false)
  }, props.debounceMs)
}

async function loadNextPage(): Promise<void> {
  if (!hasMore.value || isLoadingMore.value || isLoadingInitial.value) return
  await loadPage(page.value + 1, searchQuery.value, true)
}

function handleMenuUpdate(isOpen: boolean): void {
  menuOpen.value = isOpen
  if (isOpen) {
    if (options.value.length === 0) {
      loadPage(1, searchQuery.value, false)
    }
    setupObserver()
  } else {
    teardownObserver()
  }
}

function setupObserver(): void {
  nextTick(() => {
    if (!sentinelRef.value) return
    teardownObserver()
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPage()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.value)
  })
}

function teardownObserver(): void {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// Resolver opción inicial si viene un ID pero no está cargado
watch(
  () => props.modelValue,
  async (newVal) => {
    if (!newVal) return
    const id = typeof newVal === 'object' ? newVal[props.valueKey] : newVal
    const exists = options.value.some((o) => o[props.valueKey] === id)
    if (!exists && props.fetchById) {
      try {
        const fetched = await props.fetchById(id)
        if (fetched) {
          options.value = [fetched, ...options.value]
        }
      } catch {
        // Ignorar fallo de búsqueda individual
      }
    }
  },
  { immediate: true }
)

// Carga inicial
onMounted(() => {
  if (props.initialOption) {
    options.value = [props.initialOption]
  }
  loadPage(1, '', false)
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  teardownObserver()
})

function onValueChange(val: any): void {
  emit('update:modelValue', val)
  emit('change', val)
}
</script>

<template>
  <v-autocomplete
    :model-value="modelValue"
    :items="options"
    :item-value="itemValueResolver"
    :item-title="itemTitleResolver"
    :loading="isLoadingInitial"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :clearable="clearable"
    :chips="chips"
    :density="density"
    :variant="variant"
    :rules="rules"
    :return-object="returnObject"
    no-filter
    :auto-select-first="false"
    menu-icon="mdi-chevron-down"
    @update:model-value="onValueChange"
    @update:search="handleSearch"
    @update:menu="handleMenuUpdate"
  >
    <!-- Slot personalizado para cada ítem -->
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :title="itemTitleResolver(item.raw)">
        <template #subtitle v-if="item.raw.description || item.raw.code">
          <span class="text-caption text-medium-emphasis">
            {{ item.raw.code ? `[${item.raw.code}] ` : '' }}{{ item.raw.description || '' }}
          </span>
        </template>
      </v-list-item>
    </template>

    <!-- Indicador de scroll infinito al final del listado -->
    <template #append-item>
      <div
        ref="sentinelRef"
        class="pa-3 text-center d-flex flex-column align-center justify-center border-t"
        v-if="hasMore || isLoadingMore"
      >
        <div v-if="isLoadingMore" class="d-flex align-center text-caption text-medium-emphasis">
          <v-progress-circular indeterminate size="16" width="2" color="primary" class="mr-2" />
          Cargando más opciones...
        </div>
        <v-btn
          v-else-if="hasMore"
          variant="text"
          size="x-small"
          color="primary"
          class="text-none font-weight-medium"
          @click.stop="loadNextPage"
        >
          <v-icon start icon="mdi-chevron-double-down" size="small" />
          Cargar más ({{ options.length }} de {{ totalCount }})
        </v-btn>
      </div>
      <div v-else-if="options.length > 0 && totalCount > 0" class="pa-2 text-center text-caption text-disabled border-t">
        Total de {{ options.length }} registros cargados
      </div>
    </template>

    <template #no-data>
      <div class="pa-4 text-center text-body-2 text-medium-emphasis">
        <v-icon icon="mdi-database-search" size="small" class="mb-1 d-block mx-auto text-disabled" />
        No se encontraron resultados
      </div>
    </template>
  </v-autocomplete>
</template>
