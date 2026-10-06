<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/modules/system/stores/system.store'

const router = useRouter()
const systemStore = useSystemStore()

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

// Reglas dinámicas de contraseña
const passwordCriteria = computed(() => [
  { label: 'Entre 8 y 30 caracteres', valid: formData.password.length >= 8 && formData.password.length <= 30 },
  { label: 'Al menos una letra mayúscula (A-Z)', valid: /[A-Z]/.test(formData.password) },
  { label: 'Al menos una letra minúscula (a-z)', valid: /[a-z]/.test(formData.password) },
  { label: 'Al menos un número (0-9)', valid: /\d/.test(formData.password) },
  { label: 'Al menos un carácter especial (!@#$%^&*...)', valid: /[!@#$%^&*()_+\[\]{}|;:,.<>?\-]/.test(formData.password) }
])

const isPasswordValid = computed(() => passwordCriteria.value.every((c) => c.valid))
const doPasswordsMatch = computed(() => formData.password && formData.password === formData.confirm_password)

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
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.messages?.error ||
      err?.response?.data?.messages?.email ||
      err?.message ||
      'Error al procesar la solicitud de recuperación.'
  }
}

async function handleConfirmReset(): Promise<void> {
  if (!resetFormRef.value) return
  const { valid } = await resetFormRef.value.validate()
  if (!valid || !isPasswordValid.value || !doPasswordsMatch.value) return

  errorMessage.value = ''

  try {
    await systemStore.confirmPasswordRecovery(
      formData.verification_id,
      formData.otp_code.trim(),
      formData.password
    )
    currentStep.value = 3
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.messages?.error ||
      err?.response?.data?.messages?.otp ||
      err?.message ||
      'Error al restablecer la contraseña.'
  }
}
</script>

<template>
  <div class="w-100">
    <!-- Icono Distintivo Superior (Inspirado en SGA Recovery) -->
    <div class="text-center mb-6">
      <v-avatar color="primary-lighten-5" size="64" class="mb-3">
        <v-icon
          :icon="currentStep === 3 ? 'mdi-check-decagram' : 'mdi-lock-reset'"
          color="primary"
          size="32"
        />
      </v-avatar>
      <h2 class="text-h4 font-weight-bold text-high-emphasis mb-1">
        {{ currentStep === 3 ? 'Contraseña restablecida' : '¿Olvidaste tu contraseña?' }}
      </h2>
      <p class="text-body-2 text-medium-emphasis">
        {{
          currentStep === 1
            ? 'Ingresa tu correo para recibir un código OTP de verificación'
            : currentStep === 2
            ? 'Ingresa el código OTP recibido e introduce tu nueva contraseña'
            : 'Tu contraseña ha sido actualizada con éxito'
        }}
      </p>
    </div>

    <!-- Alertas -->
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      closable
      density="comfortable"
      rounded="lg"
      class="mb-4 text-body-2"
      @click:close="errorMessage = ''"
    >
      {{ errorMessage }}
    </v-alert>

    <v-alert
      v-if="infoMessage && currentStep === 2"
      type="info"
      variant="tonal"
      density="comfortable"
      rounded="lg"
      class="mb-4 text-body-2"
    >
      {{ infoMessage }}
    </v-alert>

    <!-- Paso 1: Solicitar OTP -->
    <v-form v-if="currentStep === 1" ref="emailFormRef" @submit.prevent="handleRequestOtp">
      <v-text-field
        v-model="formData.email"
        label="Correo electrónico"
        placeholder="ejemplo@motcar.com"
        prepend-inner-icon="mdi-email-outline"
        variant="outlined"
        density="comfortable"
        rounded="lg"
        :rules="[
          (v: string) => !!v?.trim() || 'El correo es obligatorio',
          (v: string) => /.+@.+\..+/.test(v) || 'Correo no válido'
        ]"
        class="mb-4"
        data-testid="input-recovery-email"
      />

      <v-btn
        type="submit"
        color="primary"
        block
        size="large"
        rounded="lg"
        variant="flat"
        :loading="systemStore.isLoading"
        class="text-none font-weight-bold mb-4"
        style="height: 48px;"
        data-testid="btn-request-otp"
      >
        Enviar Código
      </v-btn>
    </v-form>

    <!-- Paso 2: Validar OTP y Establecer Contraseña -->
    <v-form v-else-if="currentStep === 2" ref="resetFormRef" @submit.prevent="handleConfirmReset">
      <v-text-field
        v-model="formData.otp_code"
        label="Código OTP"
        placeholder="123456"
        prepend-inner-icon="mdi-numeric"
        variant="outlined"
        density="comfortable"
        rounded="lg"
        :rules="[(v: string) => (!!v && v.length >= 4) || 'Código requerido']"
        class="mb-3"
        data-testid="input-recovery-otp"
      />

      <v-text-field
        v-model="formData.password"
        label="Nueva contraseña"
        prepend-inner-icon="mdi-lock-outline"
        :type="showPassword ? 'text' : 'password'"
        :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        variant="outlined"
        density="comfortable"
        rounded="lg"
        class="mb-3"
        data-testid="input-recovery-password"
        @click:append-inner="showPassword = !showPassword"
      />

      <v-text-field
        v-model="formData.confirm_password"
        label="Confirmar nueva contraseña"
        prepend-inner-icon="mdi-lock-check-outline"
        :type="showConfirmPassword ? 'text' : 'password'"
        :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
        variant="outlined"
        density="comfortable"
        rounded="lg"
        :error-messages="formData.confirm_password && !doPasswordsMatch ? ['Las contraseñas no coinciden'] : []"
        class="mb-4"
        data-testid="input-recovery-confirm"
        @click:append-inner="showConfirmPassword = !showConfirmPassword"
      />

      <!-- Checklist de Requisitos de Contraseña (Inspirado en SGA) -->
      <v-card variant="tonal" rounded="lg" color="grey" class="pa-4 mb-5">
        <div class="text-caption font-weight-bold text-uppercase mb-2 text-medium-emphasis">
          Requisitos de la contraseña:
        </div>
        <div
          v-for="(crit, idx) in passwordCriteria"
          :key="idx"
          class="d-flex align-center text-caption mb-1"
          :class="crit.valid ? 'text-success font-weight-medium' : 'text-medium-emphasis'"
          :data-testid="'criteria-row-' + idx"
        >
          <v-icon
            :icon="crit.valid ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'"
            :color="crit.valid ? 'success' : 'grey'"
            size="14"
            class="mr-2"
          />
          <span :class="crit.valid ? 'text-success' : ''">{{ crit.label }}</span>
        </div>
      </v-card>

      <v-btn
        type="submit"
        color="primary"
        block
        size="large"
        rounded="lg"
        variant="flat"
        :disabled="!isPasswordValid || !doPasswordsMatch"
        :loading="systemStore.isLoading"
        class="text-none font-weight-bold mb-4"
        style="height: 48px;"
        data-testid="btn-confirm-recovery"
      >
        Restablecer Contraseña
      </v-btn>
    </v-form>

    <!-- Paso 3: Éxito Final -->
    <div v-else class="text-center py-4">
      <v-btn
        color="primary"
        block
        size="large"
        rounded="lg"
        variant="flat"
        class="text-none font-weight-bold mb-4"
        style="height: 48px;"
        @click="router.push('/login')"
      >
        Iniciar Sesión Ahora
      </v-btn>
    </div>

    <!-- Enlace Volver a Login -->
    <div class="text-center">
      <v-btn
        variant="plain"
        size="small"
        color="medium-emphasis"
        class="text-none"
        prepend-icon="mdi-arrow-left"
        @click="router.push('/login')"
      >
        Volver a Iniciar Sesión
      </v-btn>
    </div>
  </div>
</template>
