<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiClient } from '@/api/client'


interface Props {
  /** Valor almacenado: URL única (string) o lista de URLs (string[]) */
  modelValue: string | string[] | null | undefined
  /** Etiqueta del campo */
  label?: string
  /** Texto de ayuda o descripción */
  hint?: string
  /** URL o endpoint donde se enviará el archivo (POST multipart/form-data) */
  uploadUrl?: string
  /** Clave de la respuesta JSON que contiene la URL o ruta (default: 'url') */
  responseKey?: string
  /** Tipos de archivo permitidos (ej: 'image/*,application/pdf' o '.jpg,.png') */
  accept?: string | null
  /** Tamaño máximo en Kilobytes (KB) */
  maxSize?: number | null
  /** Permitir selección y almacenamiento múltiple */
  multiple?: boolean
  /** Deshabilitar interacción */
  disabled?: boolean
  /** Modo solo lectura */
  readonly?: boolean
  /** Reglas de validación para Vuetify */
  rules?: any[]
  /** Densidad del componente */
  density?: 'default' | 'comfortable' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  label: 'Subir archivo',
  hint: '',
  uploadUrl: '/v1/system/storage/contracts/documents',
  responseKey: 'url',
  accept: null,
  maxSize: 5120, // 5 MB por defecto
  multiple: false,
  disabled: false,
  readonly: false,
  rules: () => [],
  density: 'comfortable'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[] | null): void
  (e: 'change', value: string | string[] | null): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref<string | null>(null)
const isDragOver = ref(false)

// Normalizar archivos actuales en un array para visualización homogénea
const filesList = computed<string[]>(() => {
  if (!props.modelValue) return []
  if (Array.isArray(props.modelValue)) return props.modelValue.filter(Boolean)
  return [props.modelValue]
})

const isSingleFilePresent = computed(() => {
  return !props.multiple && filesList.value.length > 0
})

function isImage(url: string): boolean {
  if (!url) return false
  return /\.(png|jpe?g|webp|svg|gif|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image/')
}

function getFilename(url: string): string {
  if (!url) return ''
  try {
    const clean = url.split('?')[0]
    return clean.substring(clean.lastIndexOf('/') + 1) || url
  } catch {
    return url
  }
}

function triggerFileInput(): void {
  if (props.disabled || props.readonly || isUploading.value) return
  errorMessage.value = null
  fileInputRef.value?.click()
}

function validateFile(file: File): string | null {
  // Validación de tamaño (maxSize en KB)
  if (props.maxSize && file.size > props.maxSize * 1024) {
    const maxMb = (props.maxSize / 1024).toFixed(1)
    return `El archivo "${file.name}" supera el tamaño máximo permitido de ${maxMb} MB.`
  }

  // Validación básica de tipos accept si está configurado
  if (props.accept) {
    const acceptList = props.accept.split(',').map((a) => a.trim().toLowerCase())
    const fileType = file.type.toLowerCase()
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()

    const matches = acceptList.some((pattern) => {
      if (pattern.startsWith('.')) return pattern === fileExt
      if (pattern.endsWith('/*')) {
        const base = pattern.replace('/*', '')
        return fileType.startsWith(base)
      }
      return pattern === fileType
    })

    if (!matches) {
      return `El formato del archivo "${file.name}" no está permitido (${props.accept}).`
    }
  }

  return null
}

async function uploadSingleFile(file: File): Promise<string> {
  const resolvedUrl = props.uploadUrl?.startsWith('http')
    ? props.uploadUrl
    : `${props.uploadUrl?.startsWith('/') ? '' : '/'}${props.uploadUrl || 'v1/system/storage/contracts/documents'}`

  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post(resolvedUrl, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    }
  })

  const resData = response.data
  const key = props.responseKey || 'url'

  // Resolver clave de respuesta estándar (url, path, o anidada en data)
  const resultUrl =
    resData?.[key] ||
    resData?.data?.[key] ||
    resData?.url ||
    resData?.path ||
    resData?.filename

  if (!resultUrl) {
    throw new Error('No se recibió la URL o ruta del archivo desde el servidor.')
  }

  return resultUrl
}

async function handleFilesSelected(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return
  errorMessage.value = null

  const fileArray = Array.from(files)

  // Pre-validar todos los archivos antes de subir
  for (const file of fileArray) {
    const error = validateFile(file)
    if (error) {
      errorMessage.value = error
      return
    }
  }

  isUploading.value = true
  uploadProgress.value = 0

  try {
    if (props.multiple) {
      const uploadedUrls: string[] = []
      for (const file of fileArray) {
        const url = await uploadSingleFile(file)
        uploadedUrls.push(url)
      }
      const updated = [...filesList.value, ...uploadedUrls]
      emit('update:modelValue', updated)
      emit('change', updated)
    } else {
      const url = await uploadSingleFile(fileArray[0])
      emit('update:modelValue', url)
      emit('change', url)
    }
  } catch (err: unknown) {
    console.error('[AppMetadataFileField] Error uploading file:', err)
    errorMessage.value = err instanceof Error ? err.message : 'Error al subir el archivo.'
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

function onFileChange(e: Event): void {
  const target = e.target as HTMLInputElement
  handleFilesSelected(target.files)
}

function onDrop(e: DragEvent): void {
  isDragOver.value = false
  if (props.disabled || props.readonly || isUploading.value) return
  handleFilesSelected(e.dataTransfer?.files || null)
}

function removeFile(index: number): void {
  if (props.disabled || props.readonly) return
  if (props.multiple) {
    const updated = [...filesList.value]
    updated.splice(index, 1)
    const result = updated.length > 0 ? updated : []
    emit('update:modelValue', result)
    emit('change', result)
  } else {
    emit('update:modelValue', null)
    emit('change', null)
  }
}
</script>

<template>
  <v-input
    :model-value="modelValue"
    :rules="rules"
    :disabled="disabled"
    :readonly="readonly"
    :density="density"
    class="app-metadata-file-input mb-1"
  >
    <template #default>
      <div class="app-metadata-file-field w-100">
        <!-- Input HTML nativo oculto para compatibilidad total con multipart -->
        <input
          ref="fileInputRef"
          type="file"
          class="d-none"
          :accept="accept || undefined"
          :multiple="multiple"
          :disabled="disabled || readonly"
          @change="onFileChange"
        />

        <!-- Etiqueta superior del campo -->
        <div v-if="label" class="d-flex align-center justify-space-between mb-1">
          <span class="text-caption font-weight-medium text-high-emphasis">
            {{ label }}
          </span>
          <span v-if="maxSize" class="text-caption text-disabled font-mono">
            Máx: {{ Math.round(maxSize / 1024) }}MB
          </span>
        </div>

        <!-- 1. Estado: Archivo único ya presente (Modo individual) -->
        <div
          v-if="isSingleFilePresent && !multiple"
          class="file-preview-card border rounded-lg pa-3 bg-white"
        >
          <div class="d-flex align-center">
            <!-- Miniatura de imagen si es imagen -->
            <template v-if="isImage(filesList[0])">
              <v-avatar rounded="lg" size="48" class="mr-3 border bg-grey-lighten-4">
                <v-img :src="filesList[0]" cover>
                  <template #placeholder>
                    <div class="d-flex align-center justify-center fill-height">
                      <v-progress-circular indeterminate size="16" color="primary" />
                    </div>
                  </template>
                </v-img>
              </v-avatar>
            </template>

            <!-- Icono de documento si no es imagen -->
            <template v-else>
              <v-avatar color="primary" variant="tonal" rounded="lg" size="44" class="mr-3">
                <v-icon icon="mdi-file-document-outline" size="24" />
              </v-avatar>
            </template>

            <div class="flex-grow-1 overflow-hidden pr-2">
              <div class="text-body-2 font-weight-medium text-truncate text-high-emphasis file-name-label">
                {{ getFilename(filesList[0]) }}
              </div>
              <div class="d-flex align-center mt-0-5">
                <a
                  :href="filesList[0]"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-caption text-primary text-decoration-none d-flex align-center file-view-link"
                >
                  <v-icon icon="mdi-open-in-new" size="x-small" class="mr-1" />
                  Ver archivo
                </a>
              </div>
            </div>

            <!-- Acciones: Reemplazar o Eliminar -->
            <div v-if="!readonly && !disabled" class="d-flex align-center ga-1">
              <v-btn
                icon="mdi-swap-horizontal"
                size="small"
                variant="text"
                color="primary"
                title="Reemplazar archivo"
                class="btn-replace-file"
                @click="triggerFileInput"
              />
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                title="Eliminar archivo"
                class="btn-delete-file"
                @click="removeFile(0)"
              />
            </div>
          </div>
        </div>

        <!-- 2. Estado: Carga en progreso -->
        <div v-else-if="isUploading" class="border rounded-lg pa-4 bg-white text-center upload-in-progress">
          <div class="d-flex align-center justify-center mb-2">
            <v-progress-circular indeterminate size="24" width="2" color="primary" class="mr-3" />
            <span class="text-body-2 font-weight-medium text-primary">
              Subiendo archivo... {{ uploadProgress }}%
            </span>
          </div>
          <v-progress-linear :model-value="uploadProgress" color="primary" rounded height="4" class="mx-auto" />
        </div>

        <!-- 3. Estado: Dropzone / Selector de archivos para subir (Modo múltiple o modo individual sin archivo) -->
        <div
          v-else
          class="upload-dropzone border border-dashed rounded-lg pa-4 text-center cursor-pointer transition-swing"
          :class="{
            'dropzone-active': isDragOver,
            'bg-grey-lighten-5': !isDragOver,
            'opacity-60 pointer-events-none': disabled || readonly
          }"
          @click="triggerFileInput"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <v-icon
            icon="mdi-cloud-upload-outline"
            size="32"
            :color="isDragOver ? 'primary' : 'grey-darken-1'"
            class="mb-1"
          />
          <div class="text-body-2 font-weight-medium text-high-emphasis">
            {{ multiple ? 'Haz clic o arrastra archivos aquí' : 'Haz clic o arrastra un archivo aquí' }}
          </div>
          <div class="text-caption text-medium-emphasis mt-0-5">
            {{ accept ? `Formatos: ${accept}` : 'Cualquier archivo válido' }}
          </div>
        </div>

        <!-- 4. Lista de archivos cargados en modo múltiple -->
        <div v-if="multiple && filesList.length > 0" class="mt-2 ga-2 d-flex flex-column multi-files-list">
          <div
            v-for="(url, idx) in filesList"
            :key="url + idx"
            class="border rounded-lg pa-2 bg-white d-flex align-center justify-space-between multi-file-item"
          >
            <div class="d-flex align-center overflow-hidden mr-2">
              <v-icon
                :icon="isImage(url) ? 'mdi-image-outline' : 'mdi-file-document-outline'"
                size="small"
                color="primary"
                class="mr-2"
              />
              <span class="text-caption text-truncate font-weight-medium multi-file-name">
                {{ getFilename(url) }}
              </span>
            </div>

            <div class="d-flex align-center ga-1">
              <v-btn
                :href="url"
                target="_blank"
                icon="mdi-open-in-new"
                size="x-small"
                variant="text"
                color="primary"
                title="Ver archivo"
                class="btn-view-multi-file"
              />
              <v-btn
                v-if="!readonly && !disabled"
                icon="mdi-close"
                size="x-small"
                variant="text"
                color="error"
                title="Eliminar de la lista"
                class="btn-remove-multi-file"
                @click="removeFile(idx)"
              />
            </div>
          </div>
        </div>

        <!-- Mensaje de error de carga/subida -->
        <div v-if="errorMessage" class="text-caption text-error mt-1 d-flex align-center upload-error-msg">
          <v-icon icon="mdi-alert-circle-outline" size="x-small" class="mr-1" />
          {{ errorMessage }}
        </div>
      </div>
    </template>
  </v-input>
</template>

<style scoped>
.upload-dropzone {
  border-width: 1.5px !important;
  border-color: #cbd5e1 !important;
  background-color: #f8fafc;
  transition: all 0.2s ease;
}

.upload-dropzone:hover {
  border-color: #0e54a4 !important;
  background-color: #f1f5f9;
}

.dropzone-active {
  border-color: #0e54a4 !important;
  background-color: rgba(14, 84, 164, 0.06) !important;
}

.file-preview-card {
  border-color: #e2e8f0;
}
</style>
