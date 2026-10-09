<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  subtitle?: string
  icon?: string
  iconColor?: string
  maxWidth?: string | number
  persistent?: boolean
  scrollable?: boolean
  fullscreen?: boolean
  loading?: boolean
  showClose?: boolean
  hideActions?: boolean
  hideCancel?: boolean
  hideSubmit?: boolean
  cancelText?: string
  submitText?: string
  submitColor?: string
  submitVariant?: 'flat' | 'text' | 'elevated' | 'tonal' | 'outlined'
  submitIcon?: string
  submitDisabled?: boolean
  formId?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  icon: '',
  iconColor: 'primary',
  maxWidth: 600,
  persistent: false,
  scrollable: true,
  fullscreen: false,
  loading: false,
  showClose: true,
  hideActions: false,
  hideCancel: false,
  hideSubmit: false,
  cancelText: 'Cancelar',
  submitText: 'Confirmar',
  submitColor: 'primary',
  submitVariant: 'flat',
  submitIcon: '',
  submitDisabled: false,
  formId: undefined
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

function handleClose(): void {
  emit('cancel')
  emit('update:modelValue', false)
}

function handleSubmit(): void {
  emit('submit')
}
</script>

<template>
  <v-dialog
    v-model="isOpen"
    :max-width="maxWidth"
    :persistent="persistent"
    :scrollable="scrollable"
    :fullscreen="fullscreen"
    class="app-modal"
    transition="dialog-transition"
  >
    <v-card class="app-modal__card" elevation="6" rounded="lg">
      <!-- 1. Encabezado / Título Fijo usando los componentes nativos estándar de Vuetify -->
      <slot name="header">
        <v-card-item v-if="title || subtitle" class="app-modal__header">
          <v-card-title>
            <slot name="title">{{ title }}</slot>
          </v-card-title>
          <v-card-subtitle v-if="subtitle">
            <slot name="subtitle">{{ subtitle }}</slot>
          </v-card-subtitle>
        </v-card-item>
      </slot>

      <!-- 2. Contenido con Scroll Único (con padding-top para que los labels de los campos outlined no se solapen) -->
      <v-card-text class="app-modal__body pt-3">
        <slot />
      </v-card-text>

      <!-- Divisor previo al pie de acción -->
      <v-divider />

      <!-- 3. Llamado a la Acción (Footer Fijo) -->
      <slot name="actions">
        <v-card-actions
          v-if="!hideActions"
          class="app-modal__footer px-6 py-4 d-flex align-center justify-space-between"
        >
          <!-- Botón secundario a la izquierda (cancelar / gris) -->
          <div>
            <slot name="cancel-action">
              <v-btn
                v-if="!hideCancel"
                variant="plain"
                color="grey-darken-1"
                :disabled="loading"
                class="text-none font-weight-medium px-4"
                data-testid="modal-cancel-btn"
                @click="handleClose"
              >
                {{ cancelText }}
              </v-btn>
            </slot>
            <slot name="prepend-actions" />
          </div>

          <!-- Botón de submit a la derecha -->
          <div class="d-flex align-center gap-2">
            <slot name="append-actions" />
            <v-btn
              v-if="!hideSubmit"
              :color="submitColor"
              :variant="submitVariant"
              :loading="loading"
              :disabled="submitDisabled || loading"
              :prepend-icon="submitIcon || undefined"
              :form="formId"
              :type="formId ? 'submit' : 'button'"
              class="text-none font-weight-bold px-5"
              data-testid="modal-submit-btn"
              @click="!formId && handleSubmit()"
            >
              {{ submitText }}
            </v-btn>
          </div>
        </v-card-actions>
      </slot>
    </v-card>
  </v-dialog>
</template>

<style>
/* Desenfoque en el fondo (backdrop blur glassmorphism) */
.app-modal .v-overlay__scrim {
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  background-color: rgba(15, 23, 42, 0.45) !important;
  opacity: 1 !important;
  transition: opacity 0.25s ease;
}
</style>

<style scoped>
.app-modal__card {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  background-color: rgb(var(--v-theme-surface));
  overflow: hidden;
}

.app-modal__header {
  flex-shrink: 0;
  /* Sin divisor en el header */
}

.app-modal__body {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
}

.app-modal__body::-webkit-scrollbar {
  width: 6px;
}

.app-modal__body::-webkit-scrollbar-track {
  background: transparent;
}

.app-modal__body::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 9999px;
}

.app-modal__body::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--v-theme-on-surface), 0.3);
}

.app-modal__footer {
  flex-shrink: 0;
  background-color: rgb(var(--v-theme-surface));
}
</style>
