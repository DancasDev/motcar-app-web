<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useSystemStore } from '../stores/system.store'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', email: string): void
}>()

const systemStore = useSystemStore()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

// Pasos del Wizard: 1 = Solicitar OTP, 2 = Confirmar OTP & Cambiar clave, 3 = Éxito final
const currentStep = ref<1 | 2 | 3>(1)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const emailFormRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)
const resetFormRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const formData = reactive({
  email: '',
  verification_id: 0,
  otp_code: '',
  password: '',
  confirm_password: ''
})

const errorMessage = ref('')
const infoMessage = ref('')

const rules = {
  required: (v: string) => !!v?.trim() || 'Este campo es obligatorio.',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Ingresa un correo electrónico válido.',
  otp: (v: string) => (!!v && v.trim().length >= 4) || 'Ingresa el código OTP recibido.',
  passwordMin: (v: string) => (!!v && v.length >= 8) || 'La contraseña debe tener al menos 8 caracteres.',
  passwordComplex: (v: string) =>
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:,.<>?\-])/.test(v) ||
    'Debe incluir mayúscula, minúscula, número y un carácter especial (!@#$%...).',
  passwordMatch: (v: string) => v === formData.password || 'Las contraseñas no coinciden.'
}

function handleClose(): void {
  isOpen.value = false
  setTimeout(() => {
    currentStep.value = 1
    formData.email = ''
    formData.verification_id = 0
    formData.otp_code = ''
    formData.password = ''
    formData.confirm_password = ''
    errorMessage.value = ''
    infoMessage.value = ''
  }, 300)
}

async function handleRequestOtp(): Promise<void> {
  if (!emailFormRef.value) return
  const { valid } = await emailFormRef.value.validate()
  if (!valid) return

  errorMessage.value = ''
  infoMessage.value = ''

  try {
    const res = await systemStore.requestPasswordRecovery(formData.email.trim())
    formData.verification_id = res.verification_id
    infoMessage.value = res.message
    currentStep.value = 2
  } catch (err: unknown) {
    const errObj = err as { response?: { data?: { messages?: { error?: string; email?: string } } }; message?: string }
    errorMessage.value =
      errObj?.response?.data?.messages?.error ||
      errObj?.response?.data?.messages?.email ||
      errObj?.message ||
      'Error al procesar la solicitud de recuperación.'
  }
}

async function handleConfirmReset(): Promise<void> {
  if (!resetFormRef.value) return
  const { valid } = await resetFormRef.value.validate()
  if (!valid) return

  errorMessage.value = ''

  try {
    await systemStore.confirmPasswordRecovery(
      formData.verification_id,
      formData.otp_code.trim(),
      formData.password
    )
    currentStep.value = 3
    emit('success', formData.email.trim())
  } catch (err: unknown) {
    const errObj = err as { response?: { data?: { messages?: { error?: string; password?: string } } }; message?: string }
    errorMessage.value =
      errObj?.response?.data?.messages?.error ||
      errObj?.response?.data?.messages?.password ||
      errObj?.message ||
      'El código de verificación es inválido o ha expirado.'
  }
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="500" persistent>
    <v-card rounded="lg" elevation="4">
      <!-- Encabezado -->
      <v-card-item class="bg-primary text-white py-3 px-4">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon icon="mdi-lock-reset" size="24" class="mr-2" />
            <div>
              <div class="text-subtitle-1 font-weight-bold" style="line-height: 1.2;">
                Recuperación de Contraseña
              </div>
              <div class="text-caption text-white opacity-80">
                Servicio de Seguridad del Sistema
              </div>
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="handleClose" />
        </div>
      </v-card-item>

      <v-card-text class="pa-5">
        <!-- Alerta de Error -->
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          closable
          density="comfortable"
          class="mb-4"
          data-testid="recovery-error-alert"
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 1: Ingreso de Correo Electrónico -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-if="currentStep === 1">
          <div class="text-body-2 text-medium-emphasis mb-4">
            Ingresa tu correo electrónico registrado. Te enviaremos un código de seguridad OTP para verificar tu identidad y restablecer tu clave.
          </div>

          <v-form ref="emailFormRef" @submit.prevent="handleRequestOtp">
            <v-text-field
              v-model="formData.email"
              label="Correo Electrónico"
              placeholder="ejemplo@motcar.com"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.email]"
              :disabled="systemStore.isLoading"
              autocomplete="email"
              class="mb-4"
              data-testid="input-recovery-email"
            />

            <div class="d-flex justify-end ga-2">
              <v-btn
                variant="text"
                class="text-none"
                :disabled="systemStore.isLoading"
                @click="handleClose"
              >
                Cancelar
              </v-btn>
              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                prepend-icon="mdi-email-fast-outline"
                class="text-none font-weight-bold"
                :loading="systemStore.isLoading"
                data-testid="btn-submit-recovery-request"
              >
                Enviar Código OTP
              </v-btn>
            </div>
          </v-form>
        </div>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 2: Verificación de OTP y Nueva Contraseña -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-else-if="currentStep === 2">
          <!-- Mensaje Informativo de Envío -->
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4 text-caption"
            data-testid="recovery-info-alert"
          >
            {{ infoMessage || 'Revisa tu bandeja de entrada o spam para obtener el código.' }}
          </v-alert>

          <div class="text-caption text-grey mb-3">
            Destino: <strong>{{ formData.email }}</strong>
          </div>

          <v-form ref="resetFormRef" @submit.prevent="handleConfirmReset">
            <v-text-field
              v-model="formData.otp_code"
              label="Código OTP de 6 dígitos"
              placeholder="Ej: 123456"
              prepend-inner-icon="mdi-shield-key-outline"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.otp]"
              :disabled="systemStore.isLoading"
              class="mb-3"
              data-testid="input-recovery-otp"
            />

            <v-text-field
              v-model="formData.password"
              label="Nueva Contraseña"
              placeholder="••••••••"
              prepend-inner-icon="mdi-lock-outline"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.passwordMin, rules.passwordComplex]"
              :disabled="systemStore.isLoading"
              autocomplete="new-password"
              hint="Mín. 8 caracteres, mayúscula, minúscula, número y símbolo"
              persistent-hint
              class="mb-4"
              data-testid="input-recovery-new-password"
              @click:append-inner="showPassword = !showPassword"
            />

            <v-text-field
              v-model="formData.confirm_password"
              label="Confirmar Nueva Contraseña"
              placeholder="••••••••"
              prepend-inner-icon="mdi-lock-check-outline"
              :type="showConfirmPassword ? 'text' : 'password'"
              :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required, rules.passwordMatch]"
              :disabled="systemStore.isLoading"
              autocomplete="new-password"
              class="mb-4"
              data-testid="input-recovery-confirm-password"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
            />

            <div class="d-flex justify-space-between align-center mt-2">
              <v-btn
                variant="text"
                size="small"
                class="text-none"
                :disabled="systemStore.isLoading"
                @click="currentStep = 1"
              >
                Cambiar correo
              </v-btn>

              <v-btn
                type="submit"
                color="primary"
                variant="flat"
                prepend-icon="mdi-check-decagram"
                class="text-none font-weight-bold"
                :loading="systemStore.isLoading"
                data-testid="btn-submit-recovery-confirm"
              >
                Restablecer Contraseña
              </v-btn>
            </div>
          </v-form>
        </div>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 3: Éxito Final -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-else-if="currentStep === 3" class="text-center py-4">
          <v-icon icon="mdi-check-circle" color="success" size="64" class="mb-3" />
          <div class="text-h6 font-weight-bold mb-1 text-primary">
            ¡Contraseña Restablecida!
          </div>
          <div class="text-body-2 text-medium-emphasis mb-5">
            Tu contraseña ha sido actualizada con éxito en el sistema. Ya puedes iniciar sesión con tus nuevas credenciales.
          </div>
          <v-btn
            color="primary"
            variant="flat"
            block
            size="large"
            class="text-none font-weight-bold"
            data-testid="btn-recovery-finish"
            @click="handleClose"
          >
            Ir a Iniciar Sesión
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
