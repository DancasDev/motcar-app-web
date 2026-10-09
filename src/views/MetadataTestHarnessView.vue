<script setup lang="ts">
import { ref } from 'vue'
import AppMetadataRenderer from '@/components/common/AppMetadataRenderer.vue'
import AppMetadataFileField from '@/components/common/AppMetadataFileField.vue'
import type { MetadataSchemaPayload } from '@/components/common/AppMetadataRenderer.vue'

// 1. Esquema con las 18 combinaciones de campos
const allTypesSchema: MetadataSchemaPayload = {
  groups: {
    personal: {
      title: { es: 'Datos Personales', en: 'Personal Data' },
      description: { es: 'Campos de texto, contacto y selección', en: 'Text and selection fields' },
      position: 1
    },
    dates_numbers: {
      title: { es: 'Fechas y Números', en: 'Dates and Numbers' },
      description: { es: 'Campos numéricos, temporales y rangos', en: 'Numbers and date pickers' },
      position: 2
    },
    documents: {
      title: { es: 'Documentos y Archivos', en: 'Documents and Files' },
      description: { es: 'Carga de archivos individuales y múltiples URLs', en: 'Single and multiple files' },
      position: 3
    }
  },
  fields: {
    f_text: {
      code: 'f_text',
      group: 'personal',
      type: 'text',
      attribute_values: { label: 'Nombre Completo', placeholder: 'Ingresa tu nombre' },
      rules: [{ code: 'required' }, { code: 'min_length', params: { value: 3 } }]
    },
    f_textarea: {
      code: 'f_textarea',
      group: 'personal',
      type: 'textarea',
      attribute_values: { label: 'Observaciones', rows: 2 },
      rules: [{ code: 'max_length', params: { value: 100 } }]
    },
    f_email: {
      code: 'f_email',
      group: 'personal',
      type: 'email',
      attribute_values: { label: 'Correo Electrónico' },
      rules: [{ code: 'required' }, { code: 'valid_email' }]
    },
    f_tel: {
      code: 'f_tel',
      group: 'personal',
      type: 'tel',
      attribute_values: { label: 'Teléfono de Contacto' },
      rules: [{ code: 'numeric' }]
    },
    f_password: {
      code: 'f_password',
      group: 'personal',
      type: 'password',
      attribute_values: { label: 'Clave Secreta' },
      rules: [{ code: 'min_length', params: { value: 6 } }]
    },
    f_url: {
      code: 'f_url',
      group: 'personal',
      type: 'url',
      attribute_values: { label: 'Sitio Web' },
      rules: [{ code: 'valid_url' }]
    },
    f_select: {
      code: 'f_select',
      group: 'personal',
      type: 'select',
      attribute_values: {
        label: 'Tipo de Documento',
        options: [
          { value: 'V', label: 'Venezolano' },
          { value: 'E', label: 'Extranjero' },
          { value: 'J', label: 'Jurídico' }
        ]
      },
      rules: [{ code: 'required' }]
    },
    f_select_multi: {
      code: 'f_select_multi',
      group: 'personal',
      type: 'select',
      attribute_values: {
        label: 'Intereses (Múltiple)',
        multiple: true,
        options: [
          { value: 'autos', label: 'Automóviles' },
          { value: 'motos', label: 'Motocicletas' },
          { value: 'repuestos', label: 'Repuestos' }
        ]
      },
      rules: [{ code: 'min_length', params: { value: 1 } }]
    },
    f_radio: {
      code: 'f_radio',
      group: 'personal',
      type: 'radio',
      attribute_values: {
        label: 'Género',
        options: [
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Femenino' }
        ]
      }
    },
    f_checkbox: {
      code: 'f_checkbox',
      group: 'personal',
      type: 'checkbox',
      attribute_values: { label: 'Acepto los términos y condiciones' },
      rules: [{ code: 'required' }]
    },
    f_number: {
      code: 'f_number',
      group: 'dates_numbers',
      type: 'number',
      attribute_values: { label: 'Edad', min: 18, max: 99 },
      rules: [{ code: 'greater_than_equal_to', params: { value: 18 } }]
    },
    f_range: {
      code: 'f_range',
      group: 'dates_numbers',
      type: 'range',
      attribute_values: { label: 'Presupuesto', min: 0, max: 50000, step: 1000 }
    },
    f_date: {
      code: 'f_date',
      group: 'dates_numbers',
      type: 'date',
      attribute_values: { label: 'Fecha de Nacimiento' },
      rules: [{ code: 'valid_date' }]
    },
    f_time: {
      code: 'f_time',
      group: 'dates_numbers',
      type: 'time',
      attribute_values: { label: 'Hora Preferida' }
    },
    f_datetime: {
      code: 'f_datetime',
      group: 'dates_numbers',
      type: 'datetime_local',
      attribute_values: { label: 'Cita Programada' }
    },
    f_month: {
      code: 'f_month',
      group: 'dates_numbers',
      type: 'month',
      attribute_values: { label: 'Mes de Inicio' }
    },
    f_week: {
      code: 'f_week',
      group: 'dates_numbers',
      type: 'week',
      attribute_values: { label: 'Semana de Entrega' }
    },
    f_color: {
      code: 'f_color',
      group: 'dates_numbers',
      type: 'color',
      attribute_values: { label: 'Color del Vehículo' }
    },
    f_file_single: {
      code: 'f_file_single',
      group: 'documents',
      type: 'file',
      attribute_values: {
        label: 'Cédula o Pasaporte (Archivo Único)',
        multiple: false,
        accept: 'image/*,application/pdf',
        max_size: 2048
      },
      rules: [{ code: 'required' }, { code: 'valid_url' }]
    },
    f_file_multi: {
      code: 'f_file_multi',
      group: 'documents',
      type: 'file',
      attribute_values: {
        label: 'Comprobantes de Ingreso (Múltiples URLs)',
        multiple: true,
        accept: 'image/*,application/pdf',
        max_size: 5120
      },
      rules: [{ code: 'required' }, { code: 'valid_url' }]
    }
  }
}

// Modelo reactivo para el esquema completo
const fullFormModel = ref<Record<string, any>>({
  f_text: 'Juan Pérez',
  f_select: 'V',
  f_file_single: 'https://cdn.example.com/cedula.jpg',
  f_file_multi: [
    'https://cdn.example.com/recibo1.pdf',
    'https://cdn.example.com/recibo2.png'
  ]
})

// Variables para testing dedicado de archivos individuales y múltiples
const singleFileValue = ref<string | null>('https://cdn.example.com/foto_perfil.png')
const multiFilesValue = ref<string[]>([
  'https://cdn.example.com/contrato1.pdf',
  'https://cdn.example.com/garantia.jpg'
])

// Variables para testing de validación estricta de formulario
const validationFormRef = ref<any>(null)
const validationModel = ref<Record<string, any>>({
  v_name: '',
  v_single_file: null,
  v_multi_files: []
})
const validationStatus = ref<string>('idle')

const validationSchema: MetadataSchemaPayload = {
  fields: {
    v_name: {
      code: 'v_name',
      type: 'text',
      attribute_values: { label: 'Nombre Requerido' },
      rules: [{ code: 'required' }]
    },
    v_single_file: {
      code: 'v_single_file',
      type: 'file',
      attribute_values: { label: 'Foto de Cédula (Obligatoria)', multiple: false },
      rules: [{ code: 'required' }, { code: 'valid_url' }]
    },
    v_multi_files: {
      code: 'v_multi_files',
      type: 'file',
      attribute_values: { label: 'Archivos Adjuntos (Obligatorios)', multiple: true },
      rules: [{ code: 'required' }, { code: 'valid_url' }, { code: 'min_length', params: { value: 2 } }]
    }
  }
}

async function validateTestForm() {
  if (!validationFormRef.value) return
  const result = await validationFormRef.value.validate()
  validationStatus.value = result.valid ? 'success' : 'failed'
}

function resetTestForm() {
  validationFormRef.value?.reset()
  validationModel.value = {
    v_name: '',
    v_single_file: null,
    v_multi_files: []
  }
  validationStatus.value = 'idle'
}

function fillValidTestData() {
  validationModel.value = {
    v_name: 'Carlos Rodríguez',
    v_single_file: 'https://cdn.example.com/cedula-valida.png',
    v_multi_files: [
      'https://cdn.example.com/doc1.pdf',
      'https://cdn.example.com/doc2.pdf'
    ]
  }
}

// 4. Batería Completa de Combinaciones de Validación
const combosFormRef = ref<any>(null)
const combosModel = ref<Record<string, any>>({})
const combosStatus = ref<string>('idle')

const combosSchema: MetadataSchemaPayload = {
  fields: {
    c_email: {
      code: 'c_email',
      type: 'email',
      attribute_values: { label: 'Correo (valid_email)' },
      rules: [{ code: 'valid_email' }]
    },
    c_number: {
      code: 'c_number',
      type: 'number',
      attribute_values: { label: 'Rango Numérico (10 a 100, entero)' },
      rules: [
        { code: 'integer' },
        { code: 'greater_than_equal_to', params: { value: 10 } },
        { code: 'less_than_equal_to', params: { value: 100 } }
      ]
    },
    c_text_len: {
      code: 'c_text_len',
      type: 'text',
      attribute_values: { label: 'Longitud (3 a 8 caracteres)' },
      rules: [
        { code: 'min_length', params: { value: 3 } },
        { code: 'max_length', params: { value: 8 } }
      ]
    },
    c_regex: {
      code: 'c_regex',
      type: 'text',
      attribute_values: { label: 'Patrón Placa (ABC-123)' },
      rules: [{ code: 'regex_match', params: { value: '^[A-Z]{3}-[0-9]{3}$' } }]
    },
    c_in_list: {
      code: 'c_in_list',
      type: 'text',
      attribute_values: { label: 'Estado (ACTIVO o INACTIVO)' },
      rules: [{ code: 'in_list', params: { value: 'ACTIVO,INACTIVO' } }]
    },
    c_date: {
      code: 'c_date',
      type: 'date',
      attribute_values: { label: 'Fecha Posterior a 2026-01-01' },
      rules: [
        { code: 'valid_date' },
        { code: 'date_greater_than', params: { value: '2026-01-01' } }
      ]
    },
    c_alpha: {
      code: 'c_alpha',
      type: 'text',
      attribute_values: { label: 'Solo Letras (alpha)' },
      rules: [{ code: 'alpha' }]
    },
    c_json: {
      code: 'c_json',
      type: 'text',
      attribute_values: { label: 'JSON Válido (valid_json)' },
      rules: [{ code: 'valid_json' }]
    },
    c_file_multi: {
      code: 'c_file_multi',
      type: 'file',
      attribute_values: { label: 'Exactamente 2 URLs válidas', multiple: true },
      rules: [
        { code: 'required' },
        { code: 'valid_url' },
        { code: 'exact_length', params: { value: 2 } }
      ]
    }
  }
}

async function validateCombosForm() {
  if (!combosFormRef.value) return
  const result = await combosFormRef.value.validate()
  combosStatus.value = result.valid ? 'success' : 'failed'
}

function fillInvalidCombos() {
  combosModel.value = {
    c_email: 'correo-invalido',
    c_number: 5,
    c_text_len: 'no',
    c_regex: '123-abc',
    c_in_list: 'OTRO_ESTADO',
    c_date: '2025-12-31',
    c_alpha: 'Texto con 123',
    c_json: '{clave_sin_cerrar',
    c_file_multi: ['ruta-falsa-no-url']
  }
}

function fillValidCombos() {
  combosModel.value = {
    c_email: 'test@motcar.com',
    c_number: 50,
    c_text_len: 'Valido',
    c_regex: 'ABC-123',
    c_in_list: 'ACTIVO',
    c_date: '2026-05-20',
    c_alpha: 'SoloLetras',
    c_json: '{"activo": true}',
    c_file_multi: [
      'https://cdn.example.com/archivo1.pdf',
      'https://cdn.example.com/archivo2.png'
    ]
  }
}

function resetCombosForm() {
  combosFormRef.value?.reset()
  combosModel.value = {}
  combosStatus.value = 'idle'
}

// Control de modo de visualización para tests
const selectedDisplayMode = ref<'sections' | 'cards' | 'flat'>('sections')
</script>

<template>
  <div class="metadata-test-harness pa-6 bg-grey-lighten-4 min-vh-100">
    <div class="mb-4 d-flex align-center justify-space-between flex-wrap ga-2">
      <div>
        <h1 class="text-h5 font-weight-bold text-high-emphasis">
          Harness de Pruebas: Motor de Metadatos
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Entorno para verificación exhaustiva con Playwright (18 tipos, archivos múltiples y validaciones).
        </p>
      </div>

      <!-- Selector de DisplayMode -->
      <div class="d-flex align-center ga-2">
        <v-btn-toggle v-model="selectedDisplayMode" mandatory color="primary" density="compact">
          <v-btn value="sections" id="btn-mode-sections">Sections</v-btn>
          <v-btn value="cards" id="btn-mode-cards">Cards</v-btn>
          <v-btn value="flat" id="btn-mode-flat">Flat</v-btn>
        </v-btn-toggle>
      </div>
    </div>

    <v-row>
      <!-- Panel 1: Renderizado completo de las 18 combinaciones -->
      <v-col cols="12" lg="7">
        <v-card class="pa-4 mb-4" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold px-0 pt-0">
            1. Formulario con 18 Tipos de Metadatos
          </v-card-title>
          <v-card-subtitle class="px-0 mb-4">
            Renderizado dinámico mediante AppMetadataRenderer en modo {{ selectedDisplayMode }}.
          </v-card-subtitle>

          <AppMetadataRenderer
            id="full-metadata-renderer"
            :schema="allTypesSchema"
            v-model="fullFormModel"
            :display-mode="selectedDisplayMode"
          />

          <v-divider class="my-4" />
          <div class="bg-grey-lighten-3 pa-3 rounded font-mono text-caption overflow-x-auto">
            <span class="font-weight-bold d-block mb-1">Estado de fullFormModel:</span>
            <pre id="full-model-output">{{ JSON.stringify(fullFormModel, null, 2) }}</pre>
          </div>
        </v-card>
      </v-col>

      <!-- Panel 2: Tests dedicados a Archivos y Validaciones Form -->
      <v-col cols="12" lg="5">
        <!-- 2.1 Test Dedicado: Archivo Individual vs Múltiple -->
        <v-card class="pa-4 mb-4" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold px-0 pt-0">
            2. Archivo Único vs Múltiples URLs
          </v-card-title>
          <v-card-subtitle class="px-0 mb-3">
            Prueba directa de AppMetadataFileField en ambos modos.
          </v-card-subtitle>

          <!-- Archivo individual -->
          <div id="panel-file-single" class="mb-4">
            <span class="text-caption font-weight-bold text-primary d-block mb-1">
              Modo Individual:
            </span>
            <AppMetadataFileField
              id="file-field-single"
              v-model="singleFileValue"
              label="Foto Documento (Único)"
              :multiple="false"
            />
            <div class="text-caption text-medium-emphasis">
              Valor actual: <code id="single-file-val">{{ singleFileValue || 'null' }}</code>
            </div>
          </div>

          <v-divider class="my-3" />

          <!-- Archivos múltiples -->
          <div id="panel-file-multi" class="mb-2">
            <span class="text-caption font-weight-bold text-primary d-block mb-1">
              Modo Múltiple (Array de URLs):
            </span>
            <AppMetadataFileField
              id="file-field-multi"
              v-model="multiFilesValue"
              label="Expedientes Adjuntos (Múltiple)"
              :multiple="true"
            />
            <div class="text-caption text-medium-emphasis mt-2">
              Cantidad de archivos: <strong id="multi-files-count">{{ multiFilesValue?.length || 0 }}</strong>
            </div>
            <pre id="multi-files-val" class="font-mono text-caption bg-grey-lighten-3 pa-2 rounded mt-1">{{ JSON.stringify(multiFilesValue) }}</pre>
          </div>
        </v-card>

        <!-- 2.2 Test Dedicado: Validación con v-form -->
        <v-card class="pa-4" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold px-0 pt-0">
            3. Validación Estricta con v-form
          </v-card-title>
          <v-card-subtitle class="px-0 mb-3">
            Evalúa cómo v-form valida campos requeridos de texto y archivos individuales y múltiples.
          </v-card-subtitle>

          <v-form ref="validationFormRef" id="test-vform">
            <AppMetadataRenderer
              :schema="validationSchema"
              v-model="validationModel"
              display-mode="flat"
            />

            <div class="d-flex align-center ga-2 mt-4 flex-wrap">
              <v-btn
                id="btn-validate-form"
                color="primary"
                variant="flat"
                @click="validateTestForm"
              >
                Validar Formulario
              </v-btn>

              <v-btn
                id="btn-fill-valid"
                color="secondary"
                variant="outlined"
                @click="fillValidTestData"
              >
                Llenar Datos Válidos
              </v-btn>

              <v-btn
                id="btn-reset-form"
                variant="text"
                color="grey-darken-1"
                @click="resetTestForm"
              >
                Limpiar
              </v-btn>
            </div>

            <!-- Estado de validación -->
            <div class="mt-3">
              <v-chip
                id="validation-status-badge"
                :color="validationStatus === 'success' ? 'success' : validationStatus === 'failed' ? 'error' : 'default'"
                size="small"
                variant="flat"
              >
                Estado: {{ validationStatus }}
              </v-chip>
            </div>
          </v-form>
        </v-card>

        <!-- 2.3 Test Dedicado: Batería Completa de Combinaciones de Validación -->
        <v-card class="pa-4 mt-4" rounded="lg">
          <v-card-title class="text-h6 font-weight-bold px-0 pt-0">
            4. Batería Completa de Combinaciones de Validación
          </v-card-title>
          <v-card-subtitle class="px-0 mb-3">
            Prueba intensiva de emails, rangos numéricos, límites de longitud, regex, fechas, listas, JSON y URLs de archivo.
          </v-card-subtitle>

          <v-form ref="combosFormRef" id="combos-vform">
            <AppMetadataRenderer
              :schema="combosSchema"
              v-model="combosModel"
              display-mode="flat"
              columns="12"
            />

            <div class="d-flex align-center ga-2 mt-4 flex-wrap">
              <v-btn
                id="btn-validate-combos"
                color="primary"
                variant="flat"
                @click="validateCombosForm"
              >
                Validar Combinaciones
              </v-btn>

              <v-btn
                id="btn-fill-invalid-combos"
                color="error"
                variant="outlined"
                @click="fillInvalidCombos"
              >
                Llenar Valores Inválidos
              </v-btn>

              <v-btn
                id="btn-fill-valid-combos"
                color="success"
                variant="outlined"
                @click="fillValidCombos"
              >
                Llenar Valores Válidos
              </v-btn>

              <v-btn
                id="btn-reset-combos"
                variant="text"
                color="grey-darken-1"
                @click="resetCombosForm"
              >
                Limpiar
              </v-btn>
            </div>

            <!-- Estado de validación -->
            <div class="mt-3">
              <v-chip
                id="combos-status-badge"
                :color="combosStatus === 'success' ? 'success' : combosStatus === 'failed' ? 'error' : 'default'"
                size="small"
                variant="flat"
              >
                Estado: {{ combosStatus }}
              </v-chip>
            </div>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.min-vh-100 {
  min-height: 100vh;
}
</style>
