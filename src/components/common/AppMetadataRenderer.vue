<script setup lang="ts">
import AppPaginatedSelect from './AppPaginatedSelect.vue'

export interface DynamicFieldRule {
  code: string
  value?: any
  message?: string
}

export interface DynamicFieldDefinition {
  id?: string | number
  code: string
  name?: string
  field_type_code: string // 'text' | 'string' | 'number' | 'integer' | 'decimal' | 'textarea' | 'select' | 'enum' | 'date' | 'boolean' | 'switch' | 'json'
  attribute_values?: string | Record<string, any>
  rules?: string | DynamicFieldRule[] | Record<string, any>
  default_value?: any
}

const props = withDefaults(
  defineProps<{
    fields: DynamicFieldDefinition[]
    modelValue: Record<string, any>
    disabled?: boolean
    readonly?: boolean
    density?: 'default' | 'comfortable' | 'compact'
    columns?: number | string
  }>(),
  {
    fields: () => [],
    modelValue: () => ({}),
    disabled: false,
    readonly: false,
    density: 'comfortable',
    columns: 12
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
  (e: 'change', fieldCode: string, value: any): void
}>()

function parseAttributes(attr: string | Record<string, any> | undefined): Record<string, any> {
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

function parseRules(rulesData: string | DynamicFieldRule[] | Record<string, any> | undefined, label: string): ((v: any) => boolean | string)[] {
  if (!rulesData) return []
  let ruleList: DynamicFieldRule[] = []

  if (Array.isArray(rulesData)) {
    ruleList = rulesData
  } else if (typeof rulesData === 'string') {
    try {
      const parsed = JSON.parse(rulesData)
      if (Array.isArray(parsed)) ruleList = parsed
    } catch {
      // Ignorar parsing error
    }
  } else if (typeof rulesData === 'object') {
    ruleList = Object.entries(rulesData).map(([code, value]) => ({ code, value }))
  }

  const vuetifyRules: ((v: any) => boolean | string)[] = []

  ruleList.forEach((r) => {
    const code = (r.code || '').toLowerCase()
    if (code === 'required') {
      vuetifyRules.push((v: any) => (v !== null && v !== undefined && String(v).trim() !== '') || `${label} es obligatorio.`)
    } else if (code === 'min_length' && r.value) {
      const min = Number(r.value)
      vuetifyRules.push((v: any) => !v || String(v).length >= min || `Mínimo ${min} caracteres.`)
    } else if (code === 'max_length' && r.value) {
      const max = Number(r.value)
      vuetifyRules.push((v: any) => !v || String(v).length <= max || `Máximo ${max} caracteres.`)
    } else if (code === 'min' && r.value !== undefined) {
      const min = Number(r.value)
      vuetifyRules.push((v: any) => v === '' || v === null || Number(v) >= min || `El valor mínimo es ${min}.`)
    } else if (code === 'max' && r.value !== undefined) {
      const max = Number(r.value)
      vuetifyRules.push((v: any) => v === '' || v === null || Number(v) <= max || `El valor máximo es ${max}.`)
    } else if (code === 'email') {
      vuetifyRules.push((v: any) => !v || /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(v)) || 'Formato de correo inválido.')
    }
  })

  return vuetifyRules
}

function handleFieldChange(fieldCode: string, value: any): void {
  const updated = { ...props.modelValue, [fieldCode]: value }
  emit('update:modelValue', updated)
  emit('change', fieldCode, value)
}
</script>

<template>
  <v-row dense>
    <v-col
      v-for="field in fields"
      :key="field.code"
      cols="12"
      :sm="Number(columns) <= 6 ? 12 : 6"
      :md="Number(columns)"
    >
      <!-- Procesamiento de Atributos Visuales -->
      <template
        v-for="attrs in [parseAttributes(field.attribute_values)]"
        :key="field.code + '-inner'"
      >
        <!-- 1. Textarea / Multilínea -->
        <v-textarea
          v-if="field.field_type_code.toLowerCase() === 'textarea'"
          :model-value="modelValue[field.code]"
          :label="attrs.label || field.name || field.code"
          :placeholder="attrs.placeholder || ''"
          :hint="attrs.helperText || ''"
          persistent-hint
          :rows="attrs.rows || 3"
          :density="density"
          variant="outlined"
          :disabled="disabled"
          :readonly="readonly"
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val)"
        />

        <!-- 2. Select con opciones estáticas -->
        <v-select
          v-else-if="
            ['select', 'enum'].includes(field.field_type_code.toLowerCase()) &&
            !attrs.fetchOptions
          "
          :model-value="modelValue[field.code]"
          :label="attrs.label || field.name || field.code"
          :items="
            (attrs.options || []).map((o: any) =>
              typeof o === 'object'
                ? { title: o.label || o.name || o.value, value: o.value ?? o.id }
                : { title: String(o), value: o }
            )
          "
          :density="density"
          variant="outlined"
          :hint="attrs.helperText || ''"
          persistent-hint
          :disabled="disabled"
          :readonly="readonly"
          clearable
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val)"
        />

        <!-- 3. Select Paginado Remoto (si trae fetchOptions) -->
        <AppPaginatedSelect
          v-else-if="
            ['select', 'enum'].includes(field.field_type_code.toLowerCase()) &&
            attrs.fetchOptions
          "
          :model-value="modelValue[field.code]"
          :label="attrs.label || field.name || field.code"
          :fetch-options="attrs.fetchOptions"
          :density="density"
          :disabled="disabled"
          :readonly="readonly"
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val)"
        />

        <!-- 4. Números / Decimales / Enteros -->
        <v-text-field
          v-else-if="['number', 'integer', 'decimal'].includes(field.field_type_code.toLowerCase())"
          :model-value="modelValue[field.code]"
          type="number"
          :label="attrs.label || field.name || field.code"
          :placeholder="attrs.placeholder || ''"
          :hint="attrs.helperText || ''"
          persistent-hint
          :density="density"
          variant="outlined"
          :disabled="disabled"
          :readonly="readonly"
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val !== '' ? Number(val) : null)"
        />

        <!-- 5. Fechas -->
        <v-text-field
          v-else-if="field.field_type_code.toLowerCase() === 'date'"
          :model-value="modelValue[field.code]"
          type="date"
          :label="attrs.label || field.name || field.code"
          :hint="attrs.helperText || ''"
          persistent-hint
          :density="density"
          variant="outlined"
          :disabled="disabled"
          :readonly="readonly"
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val)"
        />

        <!-- 6. Booleanos / Switch -->
        <v-switch
          v-else-if="['boolean', 'switch'].includes(field.field_type_code.toLowerCase())"
          :model-value="Boolean(modelValue[field.code])"
          :label="attrs.label || field.name || field.code"
          color="primary"
          :density="density"
          :disabled="disabled"
          :readonly="readonly"
          @update:model-value="(val) => handleFieldChange(field.code, Boolean(val))"
        />

        <!-- 7. Texto Predeterminado -->
        <v-text-field
          v-else
          :model-value="modelValue[field.code]"
          :label="attrs.label || field.name || field.code"
          :placeholder="attrs.placeholder || ''"
          :hint="attrs.helperText || ''"
          persistent-hint
          :density="density"
          variant="outlined"
          :disabled="disabled"
          :readonly="readonly"
          :rules="parseRules(field.rules, attrs.label || field.name || field.code)"
          @update:model-value="(val) => handleFieldChange(field.code, val)"
        />
      </template>
    </v-col>
  </v-row>
</template>
