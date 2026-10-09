<script setup lang="ts">
import { computed } from 'vue'
import AppPaginatedSelect from './AppPaginatedSelect.vue'
import AppMetadataFileField from './AppMetadataFileField.vue'
import { resolveI18n, compileMetadataRules, type LocalizedString } from '@/utils/metadataValidation'

export interface MetadataGroupDefinition {
  title?: LocalizedString
  description?: LocalizedString
  position?: number
}

export interface MetadataFieldDefinition {
  id?: string | number
  code: string
  name?: string
  group?: string | null
  metadata_schema_group_id?: string | number | null
  type?: string
  field_type_code?: string
  attribute_values?: string | Record<string, any> | null
  rules?: any[] | string | Record<string, any> | null
  position?: number
  disabled?: boolean
  is_disabled?: string | boolean
}

export interface MetadataSchemaPayload {
  groups?: Record<string, MetadataGroupDefinition>
  fields?: Record<string, MetadataFieldDefinition> | MetadataFieldDefinition[]
}

interface Props {
  /** Esquema consolidado devuelto por la API (groups y fields) */
  schema?: MetadataSchemaPayload | null
  /** Lista plana alternativa de campos (soporte retrocompatible) */
  fields?: MetadataFieldDefinition[]
  /** Valores del formulario enlazados con v-model */
  modelValue: Record<string, any>
  /** Deshabilitar todos los campos */
  disabled?: boolean
  /** Modo de solo lectura */
  readonly?: boolean
  /** Densidad de Vuetify */
  density?: 'default' | 'comfortable' | 'compact'
  /** Ancho de columna en Vuetify grid (1 a 12) */
  columns?: number | string
  /** Idioma para resolver cadenas i18n */
  locale?: string
  /** Estilo de renderizado de grupos ('sections' | 'cards' | 'flat') */
  displayMode?: 'sections' | 'cards' | 'flat'
}

const props = withDefaults(defineProps<Props>(), {
  schema: null,
  fields: () => [],
  modelValue: () => ({}),
  disabled: false,
  readonly: false,
  density: 'comfortable',
  columns: 6,
  locale: 'es',
  displayMode: 'sections'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
  (e: 'change', fieldCode: string, value: any): void
}>()

function parseAttributes(attr: string | Record<string, any> | undefined | null): Record<string, any> {
  if (!attr) return {}
  if (typeof attr === 'string') {
    try {
      return JSON.parse(attr)
    } catch {
      return {}
    }
  }
  return typeof attr === 'object' ? attr : {}
}

interface NormalizedField {
  code: string
  name?: string
  group: string | null
  type: string
  attributes: Record<string, any>
  rules: any[]
  position: number
  disabled: boolean
}

interface NormalizedGroup {
  code: string
  title: string
  description: string
  position: number
  fields: NormalizedField[]
}

// 1. Normalización de campos y grupos estructurados
const normalizedGroups = computed<NormalizedGroup[]>(() => {
  const schemaObj = props.schema || {}
  const rawGroups = schemaObj.groups || {}
  let rawFields: NormalizedField[] = []

  // Extraer lista de campos desde schema.fields (Record o Array) o desde props.fields
  if (schemaObj.fields) {
    if (Array.isArray(schemaObj.fields)) {
      rawFields = schemaObj.fields.map(normalizeField)
    } else if (typeof schemaObj.fields === 'object') {
      rawFields = Object.entries(schemaObj.fields).map(([code, def]) =>
        normalizeField({ ...def, code: def.code || code })
      )
    }
  } else if (props.fields && props.fields.length > 0) {
    rawFields = props.fields.map(normalizeField)
  }

  // Filtrar campos inhabilitados
  const activeFields = rawFields.filter((f) => !f.disabled)

  // Mapear grupos declarados
  const groupsMap = new Map<string, NormalizedGroup>()

  for (const [groupCode, groupDef] of Object.entries(rawGroups)) {
    groupsMap.set(groupCode, {
      code: groupCode,
      title: resolveI18n(groupDef.title, props.locale) || groupCode,
      description: resolveI18n(groupDef.description, props.locale),
      position: Number(groupDef.position ?? 0),
      fields: []
    })
  }

  // Grupo por defecto para campos sin grupo asignado
  const ungroupedFields: NormalizedField[] = []

  for (const field of activeFields) {
    if (field.group && groupsMap.has(field.group)) {
      groupsMap.get(field.group)!.fields.push(field)
    } else {
      ungroupedFields.push(field)
    }
  }

  const result: NormalizedGroup[] = []

  // Agregar grupos ordenados por posición
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.position - b.position)
  for (const group of sortedGroups) {
    if (group.fields.length > 0) {
      group.fields.sort((a, b) => a.position - b.position)
      result.push(group)
    }
  }

  // Si hay campos sin grupo, agregarlos en una sección general
  if (ungroupedFields.length > 0) {
    ungroupedFields.sort((a, b) => a.position - b.position)
    result.push({
      code: '__ungrouped__',
      title: result.length > 0 ? 'Información Adicional' : '',
      description: '',
      position: 9999,
      fields: ungroupedFields
    })
  }

  return result
})

function normalizeField(field: MetadataFieldDefinition): NormalizedField {
  const type = (field.type || field.field_type_code || 'text').toLowerCase()
  const attributes = parseAttributes(field.attribute_values)
  const rules = Array.isArray(field.rules)
    ? field.rules
    : typeof field.rules === 'string'
      ? JSON.parse(field.rules || '[]')
      : []

  const isDisabled =
    field.disabled === true ||
    field.is_disabled === '1' ||
    field.is_disabled === true

  return {
    code: field.code,
    name: field.name,
    group: field.group || (field.metadata_schema_group_id ? String(field.metadata_schema_group_id) : null),
    type,
    attributes,
    rules,
    position: Number(field.position ?? 0),
    disabled: isDisabled
  }
}

function getFieldLabel(field: NormalizedField): string {
  return (
    resolveI18n(field.attributes.label, props.locale) ||
    field.name ||
    field.code
  )
}

function getFieldPlaceholder(field: NormalizedField): string {
  return resolveI18n(field.attributes.placeholder, props.locale) || ''
}

function getFieldHint(field: NormalizedField): string {
  return (
    resolveI18n(field.attributes.description, props.locale) ||
    field.attributes.helperText ||
    ''
  )
}

function getFieldColSpan(field: NormalizedField): number {
  if (['textarea', 'file'].includes(field.type)) {
    return 12
  }
  return Number(props.columns) || 6
}

function handleValueChange(fieldCode: string, value: any): void {
  const updated = { ...props.modelValue, [fieldCode]: value }
  emit('update:modelValue', updated)
  emit('change', fieldCode, value)
}
</script>

<template>
  <div class="app-metadata-renderer" :class="`display-mode-${displayMode}`">
    <div
      v-for="group in normalizedGroups"
      :key="group.code"
      class="metadata-group-container"
      :class="[
        displayMode === 'cards'
          ? 'border rounded-lg pa-4 mb-4 bg-white metadata-group-card shadow-sm'
          : 'metadata-group-wrapper mb-6'
      ]"
    >
      <!-- Cabecera de grupo (oculta en modo 'flat') -->
      <div v-if="displayMode !== 'flat' && group.title" class="group-header mb-3">
        <h3 class="text-subtitle-1 font-weight-bold text-high-emphasis mb-0 group-title">
          {{ group.title }}
        </h3>
        <p v-if="group.description" class="text-caption text-medium-emphasis mb-0 group-description">
          {{ group.description }}
        </p>
      </div>

      <!-- Contenedor de campos con Vuetify Row -->
      <v-row dense>
        <v-col
          v-for="field in group.fields"
          :key="field.code"
          cols="12"
          :sm="getFieldColSpan(field)"
          class="py-1"
        >
          <!-- 1. Textarea -->
          <v-textarea
            v-if="field.type === 'textarea'"
            :model-value="modelValue[field.code]"
            :label="getFieldLabel(field)"
            :placeholder="getFieldPlaceholder(field)"
            :hint="getFieldHint(field)"
            :persistent-hint="Boolean(getFieldHint(field))"
            :rows="field.attributes.rows || 3"
            :density="density"
            variant="outlined"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <!-- 2. Archivo (File / Upload / Storage) -->
          <AppMetadataFileField
            v-else-if="field.type === 'file'"
            :model-value="modelValue[field.code]"
            :label="getFieldLabel(field)"
            :hint="getFieldHint(field)"
            :upload-url="field.attributes.upload_url"
            :response-key="field.attributes.response_key || 'url'"
            :accept="field.attributes.accept"
            :max-size="field.attributes.max_size"
            :multiple="Boolean(field.attributes.multiple)"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :density="density"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <!-- 3. Desplegables (Select estático o remoto) -->
          <AppPaginatedSelect
            v-else-if="field.type === 'select' && field.attributes.fetchOptions"
            :model-value="modelValue[field.code]"
            :label="getFieldLabel(field)"
            :placeholder="getFieldPlaceholder(field)"
            :fetch-options="field.attributes.fetchOptions"
            :density="density"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <v-select
            v-else-if="field.type === 'select'"
            :model-value="modelValue[field.code]"
            :label="getFieldLabel(field)"
            :placeholder="getFieldPlaceholder(field)"
            :items="
              (field.attributes.options || []).map((o: any) =>
                typeof o === 'object'
                  ? { title: resolveI18n(o.label, locale) || o.name || o.value, value: o.value ?? o.id }
                  : { title: String(o), value: o }
              )
            "
            :multiple="Boolean(field.attributes.multiple)"
            :density="density"
            variant="outlined"
            :hint="getFieldHint(field)"
            :persistent-hint="Boolean(getFieldHint(field))"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            clearable
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <!-- 4. Radio buttons -->
          <div v-else-if="field.type === 'radio'" class="mb-2">
            <span class="text-caption font-weight-medium text-high-emphasis d-block mb-1">
              {{ getFieldLabel(field) }}
            </span>
            <v-radio-group
              :model-value="modelValue[field.code]"
              :disabled="disabled"
              :readonly="readonly || field.attributes.readonly"
              :density="density"
              inline
              :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
              @update:model-value="(val) => handleValueChange(field.code, val)"
            >
              <v-radio
                v-for="opt in (field.attributes.options || [])"
                :key="opt.value"
                :label="resolveI18n(opt.label, locale) || String(opt.value)"
                :value="opt.value"
                color="primary"
              />
            </v-radio-group>
          </div>

          <!-- 5. Checkbox booleano -->
          <v-checkbox
            v-else-if="field.type === 'checkbox'"
            :model-value="Boolean(modelValue[field.code])"
            :label="getFieldLabel(field)"
            color="primary"
            :density="density"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, Boolean(val))"
          />

          <!-- 6. Números y Rangos -->
          <v-text-field
            v-else-if="['number', 'range'].includes(field.type)"
            :model-value="modelValue[field.code]"
            type="number"
            :label="getFieldLabel(field)"
            :placeholder="getFieldPlaceholder(field)"
            :hint="getFieldHint(field)"
            :persistent-hint="Boolean(getFieldHint(field))"
            :min="field.attributes.min"
            :max="field.attributes.max"
            :step="field.attributes.step"
            :density="density"
            variant="outlined"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val !== '' && val !== null ? Number(val) : null)"
          />

          <!-- 7. Fechas y Horas -->
          <v-text-field
            v-else-if="['date', 'time', 'datetime_local', 'month', 'week'].includes(field.type)"
            :model-value="modelValue[field.code]"
            :type="field.type === 'datetime_local' ? 'datetime-local' : field.type"
            :label="getFieldLabel(field)"
            :hint="getFieldHint(field)"
            :persistent-hint="Boolean(getFieldHint(field))"
            :min="field.attributes.min"
            :max="field.attributes.max"
            :density="density"
            variant="outlined"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <!-- 8. Color -->
          <v-text-field
            v-else-if="field.type === 'color'"
            :model-value="modelValue[field.code]"
            type="color"
            :label="getFieldLabel(field)"
            :density="density"
            variant="outlined"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />

          <!-- 9. Texto, Correo, Teléfono, Contraseña, URL (Default) -->
          <v-text-field
            v-else
            :model-value="modelValue[field.code]"
            :type="['email', 'tel', 'password', 'url'].includes(field.type) ? field.type : 'text'"
            :label="getFieldLabel(field)"
            :placeholder="getFieldPlaceholder(field)"
            :hint="getFieldHint(field)"
            :persistent-hint="Boolean(getFieldHint(field))"
            :density="density"
            variant="outlined"
            :disabled="disabled"
            :readonly="readonly || field.attributes.readonly"
            :rules="compileMetadataRules(field.rules, getFieldLabel(field))"
            @update:model-value="(val) => handleValueChange(field.code, val)"
          />
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<style scoped>
.metadata-group-wrapper:not(:last-child) {
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 1rem;
}
</style>
