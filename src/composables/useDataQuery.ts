import { ref, watch } from 'vue'
import { buildDqbParams, type QueryBuilderConfig } from '@/utils/queryBuilder'
import type {
  DataQueryParams,
  PaginatedResponse,
  VuetifyTableOptions,
  DqbFilterItem
} from '@/types/query'

export interface UseDataQueryOptions extends QueryBuilderConfig {
  initialPage?: number
  initialItemsPerPage?: number
  debounceMs?: number
}

/**
 * Composable reutilizable para gestionar consultas paginadas con Vuetify v-data-table-server y DQB
 */
export function useDataQuery<T>(
  fetcher: (params: DataQueryParams) => Promise<PaginatedResponse<T>>,
  options: UseDataQueryOptions = {}
) {
  const items = ref<T[]>([])
  const totalItems = ref<number>(0)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Opciones de paginación y orden
  const page = ref<number>(options.initialPage || 1)
  const itemsPerPage = ref<number>(options.initialItemsPerPage || 25)
  const sortBy = ref<Array<{ key: string; order: 'asc' | 'desc' }>>([])
  const search = ref<string>('')
  const staticFilters = ref<DqbFilterItem[]>(options.staticFilters || [])

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const debounceDelay = options.debounceMs ?? 350

  /**
   * Ejecuta la consulta contra la API con los parámetros construidos
   */
  async function executeFetch(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const dqbParams = buildDqbParams(
        {
          page: page.value,
          itemsPerPage: itemsPerPage.value,
          sortBy: sortBy.value,
          search: search.value
        },
        {
          searchFields: options.searchFields,
          staticFilters: staticFilters.value,
          fields: options.fields
        }
      )

      const response = await fetcher(dqbParams)

      items.value = response.data || []
      totalItems.value = response.count || 0
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al cargar los datos desde la API.'
      error.value = message
      console.error('useDataQuery fetch error:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Handler directo para el evento @update:options de Vuetify
   */
  function onUpdateOptions(newOptions: VuetifyTableOptions): void {
    page.value = newOptions.page
    itemsPerPage.value = newOptions.itemsPerPage
    sortBy.value = newOptions.sortBy || []
    executeFetch()
  }

  /**
   * Recarga forzada de la tabla
   */
  function refresh(): void {
    executeFetch()
  }

  // Reactividad con debounce ante cambios de búsqueda
  watch(search, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      page.value = 1
      executeFetch()
    }, debounceDelay)
  })

  return {
    items,
    totalItems,
    isLoading,
    error,
    page,
    itemsPerPage,
    sortBy,
    search,
    staticFilters,
    onUpdateOptions,
    refresh,
    executeFetch
  }
}
