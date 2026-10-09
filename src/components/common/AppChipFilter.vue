<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildDqbFieldFilter } from '@/utils/queryBuilder'
import type { DqbFilterTuple, DqbRelationalOperator, DqbLogicalOperator } from '@/types/query'

export interface ChipFilterOption {
  text?: string
  label?: string
  title?: string
  value: any
  icon?: string
  disabled?: boolean
  [key: string]: any
}

export type ChipFilterItemInput = string | number | ChipFilterOption

interface Props {
  /** Nombre del campo/columna en la base de datos para construir el filtro DQB (ej. 'status') */
  field?: string
  /** Array de opciones a la derecha de "Todos" (objetos { text, value } o primitivos) */
  items: ChipFilterItemInput[]
  /**
   * Filtro DQB activo (v-model).
   * Cuando es "Todos" o no hay selección, el valor emitido es `null`.
   * Cuando hay selecciones, emite un array de tuplas DQB `DqbFilterTuple[]`.
   */
  modelValue?: DqbFilterTuple[] | any[] | null
  /** Operador relacional DQB (por defecto '=') */
  operator?: DqbRelationalOperator
  /** Operador lógico para la primera tupla (por defecto 'AND') */
  logicalOperator?: DqbLogicalOperator
  /** Permitir selección múltiple de opciones (por defecto false) */
  multiple?: boolean
  /** Texto para la opción 'Todos' (por defecto 'Todos') */
  allText?: string
  /** Color Vuetify cuando un chip está seleccionado (por defecto 'primary') */
  color?: string
  /** Tamaño de los chips (x-small | small | default | large) */
  size?: 'x-small' | 'small' | 'default' | 'large'
  /** Densidad de los chips (default | comfortable | compact) */
  density?: 'default' | 'comfortable' | 'compact'
  /** Forzar modo en columnas en vez de fila horizontal deslizable */
  column?: boolean
  /** Deshabilitar la interacción con los chips */
  disabled?: boolean
  /** Clase CSS adicional para el contenedor del grupo */
  groupClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  field: '',
  modelValue: null,
  operator: '=',
  logicalOperator: 'AND',
  multiple: false,
  allText: 'Todos',
  color: 'primary',
  size: 'default',
  density: 'comfortable',
  column: false,
  disabled: false,
  groupClass: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: DqbFilterTuple[] | null): void
  (e: 'change', dqbFilter: DqbFilterTuple[] | null, rawValues: any[]): void
}>()

const ALL_VALUE = '__ALL__'

// Valores primitivos seleccionados internamente (ej. ['ACTIVE'] o ['__ALL__'])
const selected = ref<any[]>([ALL_VALUE])

// Normalizar la lista de opciones para garantizar formato consistente { text, value, icon, disabled }
const normalizedItems = computed(() => {
  return props.items.map((item) => {
    if (typeof item === 'object' && item !== null) {
      const option = item as ChipFilterOption
      return {
        text: String(option.text ?? option.label ?? option.title ?? option.value ?? ''),
        value: option.value,
        icon: option.icon,
        disabled: Boolean(option.disabled)
      }
    }
    return {
      text: String(item),
      value: item,
      icon: undefined,
      disabled: false
    }
  })
})

// Sincronizar desde modelValue externo
watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal || (Array.isArray(newVal) && newVal.length === 0)) {
      selected.value = [ALL_VALUE]
      return
    }

    const arr = Array.isArray(newVal) ? newVal : [newVal]
    // Extraer valor de tuplas DQB [campo, valor, ...] o valores directos
    const extracted = arr.map((item) => (Array.isArray(item) ? item[1] : item))
    const clean = extracted.filter((v) => v !== ALL_VALUE && v !== null && v !== undefined)

    selected.value = clean.length > 0 ? clean : [ALL_VALUE]
  },
  { immediate: true, deep: true }
)

const isAllActive = computed(() => {
  return selected.value.length === 0 || selected.value.includes(ALL_VALUE)
})

function isItemActive(val: any): boolean {
  if (isAllActive.value) return false
  return selected.value.some((v) => v === val)
}

/**
 * Calcula el array de filtros DQB o null cuando es "Todos", y emite los eventos
 */
function emitFilter(rawValues: any[]): void {
  let filterResult: DqbFilterTuple[] | null = null

  if (rawValues.length > 0 && props.field) {
    filterResult = buildDqbFieldFilter(
      props.field,
      rawValues,
      props.operator,
      props.logicalOperator
    )
  }

  emit('update:modelValue', filterResult)
  emit('change', filterResult, rawValues)
}

function onChipClick(val: any): void {
  if (props.disabled) return

  // 1. Caso: Seleccionar "Todos"
  if (val === ALL_VALUE) {
    if (isAllActive.value) return // Ya está activo "Todos"
    selected.value = [ALL_VALUE]
    emitFilter([])
    return
  }

  // 2. Caso: Selección Múltiple
  if (props.multiple) {
    const withoutAll = selected.value.filter((v) => v !== ALL_VALUE)
    const index = withoutAll.findIndex((v) => v === val)

    if (index >= 0) {
      // Si ya estaba marcado, se desmarca
      withoutAll.splice(index, 1)
    } else {
      // Si no estaba marcado, se agrega
      withoutAll.push(val)
    }

    // Si se desmarcaron todas las opciones, reactivar "Todos" y retornar null
    if (withoutAll.length === 0) {
      selected.value = [ALL_VALUE]
      emitFilter([])
    } else {
      selected.value = withoutAll
      emitFilter(withoutAll)
    }
    return
  }

  // 3. Caso: Selección Simple (individual)
  if (isItemActive(val)) {
    // Si hace click en la opción ya activa, se desmarca y vuelve a "Todos" (retorna null)
    selected.value = [ALL_VALUE]
    emitFilter([])
  } else {
    // Se marca esta opción y se desmarca "Todos" y cualquier otra
    selected.value = [val]
    emitFilter([val])
  }
}
</script>

<template>
  <div
    class="app-chip-filter d-inline-flex align-center ga-2 flex-wrap"
    :class="groupClass"
  >
    <!-- Opción por defecto: "Todos" -->
    <v-chip
      :color="isAllActive ? color : undefined"
      :variant="isAllActive ? 'flat' : 'outlined'"
      :size="size"
      :density="density"
      :disabled="disabled"
      class="app-chip-item"
      :class="isAllActive ? 'app-chip-item--selected' : 'app-chip-item--unselected'"
      @click="onChipClick(ALL_VALUE)"
    >
      {{ allText }}
    </v-chip>

    <!-- Resto de opciones -->
    <v-chip
      v-for="item in normalizedItems"
      :key="item.value"
      :color="isItemActive(item.value) ? color : undefined"
      :variant="isItemActive(item.value) ? 'flat' : 'outlined'"
      :size="size"
      :density="density"
      :disabled="disabled || item.disabled"
      class="app-chip-item"
      :class="isItemActive(item.value) ? 'app-chip-item--selected' : 'app-chip-item--unselected'"
      @click="onChipClick(item.value)"
    >
      <v-icon v-if="item.icon" start :icon="item.icon" size="small" />
      {{ item.text }}
    </v-chip>
  </div>
</template>

<style scoped>
.app-chip-filter {
  display: inline-flex;
  align-items: center;
}

.app-chip-item {
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
}

.app-chip-item--unselected {
  background-color: #ffffff !important;
  color: #475569 !important;
  border: 1px solid #e2e8f0 !important;
}

.app-chip-item--unselected:hover:not(:disabled) {
  background-color: #f8fafc !important;
  border-color: #cbd5e1 !important;
  color: #1e293b !important;
}

.app-chip-item--selected {
  background-color: rgb(var(--v-theme-primary)) !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  border: 1px solid transparent !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1) !important;
}
</style>
