import type {
  VuetifyTableOptions,
  DqbFilterItem,
  DqbFilterTuple,
  DqbRelationalOperator,
  DqbLogicalOperator,
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

/**
 * Construye un array de tuplas de filtro DQB para un campo a partir de uno o varios valores.
 * Si no hay valores (o el array está vacío), retorna null.
 * El primer elemento utiliza el operador lógico inicial ('AND' por defecto),
 * y los siguientes elementos utilizan 'OR'.
 *
 * @param field - Nombre de la columna o campo a filtrar (ej. 'status')
 * @param values - Valor individual o array de valores seleccionados
 * @param operator - Operador relacional DQB (por defecto '=')
 * @param firstLogicalOperator - Operador lógico para el primer elemento (por defecto 'AND')
 */
export function buildDqbFieldFilter(
  field: string,
  values: any | any[] | null | undefined,
  operator: DqbRelationalOperator = '=',
  firstLogicalOperator: DqbLogicalOperator = 'AND'
): DqbFilterTuple[] | null {
  if (!field) return null
  if (values === null || values === undefined) return null

  const arrayValues = Array.isArray(values) ? values : [values]
  if (arrayValues.length === 0) return null

  return arrayValues.map((val, index) => [
    field,
    val,
    operator,
    index === 0 ? firstLogicalOperator : 'OR'
  ])
}

