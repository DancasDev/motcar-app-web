import type {
  VuetifyTableOptions,
  DqbFilterItem,
  DqbFilterTuple,
  DqbOrder,
  DataQueryParams
} from '@/types/query'

export interface QueryBuilderConfig {
  /**
   * Campos sobre los cuales se aplicará búsqueda parcial (LIKE %valor%)
   */
  searchFields?: string[]

  /**
   * Filtros estáticos adicionales a concatenar en la consulta
   */
  staticFilters?: DqbFilterItem[]

  /**
   * Proyección de campos específicos a devolver (separados por comas)
   */
  fields?: string[]
}

/**
 * Serializa y traduce las opciones de v-data-table-server al estándar DQB
 */
export function buildDqbParams(
  options: VuetifyTableOptions,
  config: QueryBuilderConfig = {}
): DataQueryParams {
  const params: DataQueryParams = {
    page: options.page || 1,
    itemsPerPage: options.itemsPerPage || 25
  }

  // 1. Proyección de campos
  if (config.fields && config.fields.length > 0) {
    params.fields = config.fields.join(',')
  }

  // 2. Ordenamiento (order)
  if (options.sortBy && options.sortBy.length > 0) {
    const orderObj: DqbOrder = {}
    for (const sortItem of options.sortBy) {
      if (sortItem.key) {
        orderObj[sortItem.key] = sortItem.order === 'desc' ? 'DESC' : 'ASC'
      }
    }
    if (Object.keys(orderObj).length > 0) {
      params.order = JSON.stringify(orderObj)
    }
  }

  // 3. Filtros (filters)
  const filtersList: DqbFilterItem[] = []

  // Incorporar filtros estáticos
  if (config.staticFilters && config.staticFilters.length > 0) {
    filtersList.push(...config.staticFilters)
  }

  // Incorporar búsqueda global sobre los campos configurados
  const searchTerm = options.search?.trim()
  if (searchTerm && config.searchFields && config.searchFields.length > 0) {
    const searchTuples: DqbFilterTuple[] = config.searchFields.map((field, index) => [
      field,
      searchTerm,
      'LIKE',
      index === 0 ? 'AND' : 'OR',
      'BOTH'
    ])

    // Se agrupa como orGroupSearch para actuar como paréntesis lógico en SQL
    filtersList.push({
      orGroupSearch: searchTuples
    })
  }

  if (filtersList.length > 0) {
    params.filters = JSON.stringify(filtersList)
  }

  return params
}
