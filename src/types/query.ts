/**
 * Definiciones de Tipos para el Motor de Consultas (DQB - Data Query Builder)
 * Basado en la especificación de @dancasdev/dqb y opencollection.yml
 */

export type DqbRelationalOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE'
export type DqbLogicalOperator = 'AND' | 'OR'
export type DqbLikeFormat = 'BOTH' | 'BEFORE' | 'AFTER'

/**
 * Tupla de filtro: [campo, valor, operador_relacional?, operador_logico?, formato_like?]
 * Ejemplo: ["username", "admin", "=", "AND"]
 * Ejemplo LIKE: ["name", "col", "LIKE", "OR", "BOTH"]
 */
export type DqbFilterTuple = [
  string,
  string | number | boolean | null,
  DqbRelationalOperator?,
  DqbLogicalOperator?,
  DqbLikeFormat?
]

/**
 * Grupo de filtros (paréntesis en SQL):
 * Ejemplo: { group0: [["country_id", "1"], ["city_id", "5", "=", "OR"]] }
 */
export type DqbFilterGroup = {
  [groupName: string]: Array<DqbFilterTuple | DqbFilterGroup>
}

export type DqbFilterItem = DqbFilterTuple | DqbFilterGroup

/**
 * Mapa de ordenamiento: { campo: "ASC" | "DESC" }
 * Ejemplo: { name: "ASC", id: "DESC" }
 */
export type DqbOrder = Record<string, 'ASC' | 'DESC'>

/**
 * Parámetros de consulta aceptados por el backend DQB
 */
export interface DataQueryParams {
  page?: number
  itemsPerPage?: number
  fields?: string
  filters?: string | DqbFilterItem[]
  order?: string | DqbOrder
  groupBy?: string
  having?: string | DqbFilterItem[]
  [key: string]: unknown
}

/**
 * Respuesta paginada estándar emitida por endpoints GET de listado
 */
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  limit: number
  in_trash: boolean
}

/**
 * Opciones emitidas por v-data-table-server de Vuetify 3
 */
export interface VuetifyTableOptions {
  page: number
  itemsPerPage: number
  sortBy: Array<{ key: string; order: 'asc' | 'desc' }>
  groupBy?: Array<{ key: string; order?: 'asc' | 'desc' }>
  search?: string
}
