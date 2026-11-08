<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSystemStore } from '@/modules/system/stores/system.store'
import AppCopyright from '@/components/common/AppCopyright.vue'

const router = useRouter()
const systemStore = useSystemStore()

// Pasos:
// 1 = Solicitar OTP (Email)
// 2 = Verificar código OTP (6 cajas individuales)
// 3 = Establecer nueva contraseña
// 4 = Éxito / Contraseña actualizada
const currentStep = ref<1 | 2 | 3 | 4>(1)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isResending = ref(false)

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
const successNotice = ref('')

// Reglas dinámicas de contraseña sincronizadas con UserModel::$validationRules['password']
const passwordCriteria = computed(() => [
  {
    label: 'Entre 8 y 30 caracteres',
    valid: formData.password.length >= 8 && formData.password.length <= 30
  },
  {
    label: 'Al menos una letra mayúscula (A-Z)',
    valid: /[A-Z]/.test(formData.password)
  },
  {
    label: 'Al menos una letra minúscula (a-z)',
    valid: /[a-z]/.test(formData.password)
  },
  {
    label: 'Al menos un número (0-9)',
    valid: /\d/.test(formData.password)
  },
  {
    label: 'Al menos un carácter especial (!@#$%^&*...)',
    valid: /[!@#$%^&*()_+\[\]{}|;:,.<>?\-]/.test(formData.password)
  }
])

const validCriteriaCount = computed(
  () => passwordCriteria.value.filter((c) => c.valid).length
)

const hasOnlyAllowedChars = computed(
  () => !formData.password || /^[A-Za-z\d!@#$%^&*()_+\[\]{}|;:,.<>?\-]+$/.test(formData.password)
)

const isPasswordValid = computed(
  () => validCriteriaCount.value === 5 && hasOnlyAllowedChars.value
)

const doPasswordsMatch = computed(
  () => !!formData.password && formData.password === formData.confirm_password
)

const canSubmitPassword = computed(
  () => isPasswordValid.value && doPasswordsMatch.value
)

// Paso 1: Solicitar OTP
async function handleRequestOtp(): Promise<void> {
  if (!emailFormRef.value) return
  const { valid } = await emailFormRef.value.validate()
  if (!valid) return

  errorMessage.value = ''
  infoMessage.value = ''
  successNotice.value = ''

  try {
    const res = await systemStore.requestPasswordRecovery(formData.email.trim())
    formData.verification_id = res.verification_id
    infoMessage.value = res.message
    currentStep.value = 2
  } catch (err: any) {
    const errorData = err?.response?.data
    errorMessage.value =
      errorData?.messages?.error ||
      errorData?.messages?.email ||
      (typeof errorData?.messages === 'string' ? errorData.messages : null) ||
      err?.message ||
      'Error al procesar la solicitud de recuperación.'
  }
}

// Paso 2: Reenviar OTP
async function handleResendOtp(): Promise<void> {
  if (!formData.email || isResending.value) return
  isResending.value = true
  errorMessage.value = ''
  successNotice.value = ''

  try {
    const res = await systemStore.requestPasswordRecovery(formData.email.trim())
    formData.verification_id = res.verification_id
    successNotice.value = 'Nuevo código enviado exitosamente a tu correo.'
  } catch (err: any) {
    const errorData = err?.response?.data
    errorMessage.value =
      errorData?.messages?.error ||
      errorData?.messages?.email ||
      'No fue posible reenviar el código en este momento.'
  } finally {
    isResending.value = false
  }
}

// Paso 2: Continuar a Paso 3 al tener el OTP
function handleContinueToPassword(): void {
  if (!formData.otp_code || formData.otp_code.trim().length < 6) {
    errorMessage.value = 'Por favor ingresa el código de verificación completo de 6 dígitos.'
    return
  }
  errorMessage.value = ''
  currentStep.value = 3
}

// Paso 3: Confirmar reseteo de contraseña
async function handleConfirmReset(): Promise<void> {
  if (!resetFormRef.value) return
  const { valid } = await resetFormRef.value.validate()
  if (!valid || !canSubmitPassword.value) return

  errorMessage.value = ''

  try {
    await systemStore.confirmPasswordRecovery(
      formData.verification_id,
      formData.otp_code.trim(),
      formData.password
    )
    currentStep.value = 4
  } catch (err: any) {
    const errorData = err?.response?.data
    const errorCode = errorData?.error || ''
    const msg =
      errorData?.messages?.error ||
      errorData?.messages?.otp ||
      errorData?.messages?.password ||
      (typeof errorData?.messages === 'string' ? errorData.messages : null) ||
      err?.message ||
      'Error al restablecer la contraseña.'

    // Si el error corresponde al código OTP (inválido o expirado), regresar al paso 2
    if (
      errorCode.includes('OTP') ||
      errorData?.messages?.otp ||
      msg.toLowerCase().includes('código') ||
      msg.toLowerCase().includes('otp')
    ) {
      errorMessage.value = msg || 'El código ingresado es incorrecto o ha expirado.'
      currentStep.value = 2
    } else {
      errorMessage.value = msg
    }
  }
}

function goToLogin(withSuccess = false): void {
  router.push(
    withSuccess
      ? { path: '/login', query: { passwordUpdated: '1' } }
      : { path: '/login' }
  )
}
</script>

<template>
  <div class="recovery-layout min-vh-100 d-flex flex-column bg-grey-lighten-4 overflow-y-auto" data-testid="recovery-view">
    <!-- Barra Superior Minimalista (Logo a la izquierda) -->
    <header class="recovery-header px-6 py-3 bg-surface border-b d-flex align-center justify-space-between flex-shrink-0">
      <div class="d-flex align-center">
        <v-img
          src="/images/motcar-logo.png"
          alt="MotCar"
          width="140"
          max-width="140"
          height="auto"
        />
      </div>

      <div class="d-flex align-center">
        <v-btn
          variant="text"
          size="small"
          color="primary"
          prepend-icon="mdi-login"
          class="text-none font-weight-medium"
          data-testid="btn-recovery-header-login"
          @click="goToLogin(false)"
        >
          <span class="d-none d-sm-inline">Iniciar Sesión</span>
        </v-btn>
      </div>
    </header>

    <!-- Contenido Centrado -->
    <main class="flex-grow-1 d-flex align-center justify-center pa-4 pa-sm-6">
      <v-card
        elevation="0"
        rounded="xl"
        class="border pa-5 pa-sm-7 bg-surface my-auto"
        style="width: 100%; max-width: 460px; box-shadow: 0 10px 30px rgba(0,0,0,0.04) !important;"
      >
        <!-- Ícono Destacado en Recuadro (Inspirado en Untitled UI) -->
        <div class="text-center mb-5">
          <div class="step-icon-badge mx-auto mb-3">
            <v-icon
              v-if="currentStep === 1"
              icon="mdi-fingerprint"
              color="primary"
              size="26"
            />
            <v-icon
              v-else-if="currentStep === 2"
              icon="mdi-email-outline"
              color="primary"
              size="26"
            />
            <v-icon
              v-else-if="currentStep === 3"
              icon="mdi-form-textbox-password"
              color="primary"
              size="26"
            />
            <v-icon
              v-else-if="currentStep === 4"
              icon="mdi-check-circle-outline"
              color="success"
              size="28"
            />
          </div>

          <!-- Títulos y subtítulos por paso -->
          <h2
            class="text-h5 font-weight-bold text-high-emphasis mb-1"
            data-testid="recovery-title"
          >
            <span v-if="currentStep === 1">¿Olvidaste tu contraseña?</span>
            <span v-else-if="currentStep === 2">Verifica tu correo</span>
            <span v-else-if="currentStep === 3">Establece tu nueva contraseña</span>
            <span v-else-if="currentStep === 4">¡Contraseña restablecida!</span>
          </h2>

          <p
            class="text-body-2 text-medium-emphasis mb-0"
            data-testid="recovery-subtitle"
          >
            <span v-if="currentStep === 1">
              No te preocupes, te enviaremos un código de verificación para restablecerla.
            </span>
            <span v-else-if="currentStep === 2">
              Enviamos un código de 6 dígitos a <strong class="text-high-emphasis">{{ formData.email }}</strong>
            </span>
            <span v-else-if="currentStep === 3">
              Tu nueva contraseña debe ser segura y diferente a las anteriores.
            </span>
            <span v-else-if="currentStep === 4">
              Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión con tus nuevas credenciales.
            </span>
          </p>
        </div>

        <!-- Alertas de Error o Información -->
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          closable
          density="comfortable"
          rounded="lg"
          class="mb-4 text-body-2"
          data-testid="recovery-error-alert"
          @click:close="errorMessage = ''"
        >
          {{ errorMessage }}
        </v-alert>

        <v-alert
          v-if="successNotice && currentStep === 2"
          type="success"
          variant="tonal"
          closable
          density="comfortable"
          rounded="lg"
          class="mb-4 text-body-2"
          data-testid="recovery-success-notice"
          @click:close="successNotice = ''"
        >
          {{ successNotice }}
        </v-alert>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 1: Ingreso de Correo Electrónico -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-if="currentStep === 1" data-testid="recovery-step-1">
          <v-form ref="emailFormRef" @submit.prevent="handleRequestOtp">
            <v-text-field
              v-model="formData.email"
              label="Correo electrónico"
              placeholder="ejemplo@motcar.com"
              prepend-inner-icon="mdi-email-outline"
              type="email"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :rules="[
                (v: string) => !!v?.trim() || 'El correo electrónico es obligatorio',
                (v: string) => /.+@.+\..+/.test(v) || 'Ingresa un correo electrónico válido'
              ]"
              :disabled="systemStore.isLoading"
              autocomplete="email"
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
              prepend-icon="mdi-email-fast-outline"
              :loading="systemStore.isLoading"
              class="text-none font-weight-bold recovery-submit-btn mb-4"
              data-testid="btn-recovery-send-otp"
            >
              Enviar código de verificación
            </v-btn>
          </v-form>

          <!-- Volver a Iniciar Sesión -->
          <div class="text-center">
            <v-btn
              variant="plain"
              size="small"
              color="medium-emphasis"
              class="text-none font-weight-medium"
              prepend-icon="mdi-arrow-left"
              data-testid="btn-recovery-back-login"
              @click="goToLogin(false)"
            >
              Volver a Iniciar Sesión
            </v-btn>
          </div>
        </div>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 2: Verificación de Código OTP (Cajas individuales) -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-else-if="currentStep === 2" data-testid="recovery-step-2">
          <div class="mb-5 d-flex justify-center">
            <v-otp-input
              v-model="formData.otp_code"
              length="6"
              type="number"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              autofocus
              :disabled="systemStore.isLoading"
              class="otp-custom-input"
              data-testid="input-recovery-otp"
              @finish="handleContinueToPassword"
            />
          </div>

          <v-btn
            color="primary"
            block
            size="large"
            rounded="lg"
            variant="flat"
            :disabled="!formData.otp_code || formData.otp_code.length < 6"
            class="text-none font-weight-bold recovery-submit-btn mb-4"
            data-testid="btn-recovery-continue-otp"
            @click="handleContinueToPassword"
          >
            Continuar
          </v-btn>

          <!-- Reenviar código -->
          <div class="text-center text-body-2 text-medium-emphasis mb-4">
            ¿No recibiste el correo?
            <v-btn
              variant="plain"
              color="primary"
              size="small"
              class="text-none font-weight-bold px-1"
              :loading="isResending"
              data-testid="btn-recovery-resend-otp"
              @click="handleResendOtp"
            >
              Haz clic para reenviar
            </v-btn>
          </div>

          <!-- Opciones de retorno -->
          <div class="d-flex justify-space-between align-center">
            <v-btn
              variant="plain"
              size="small"
              color="medium-emphasis"
              class="text-none"
              prepend-icon="mdi-pencil-outline"
              data-testid="btn-recovery-change-email"
              @click="currentStep = 1"
            >
              Cambiar correo
            </v-btn>

            <v-btn
              variant="plain"
              size="small"
              color="medium-emphasis"
              class="text-none"
              prepend-icon="mdi-arrow-left"
              @click="goToLogin(false)"
            >
              Volver a Iniciar Sesión
            </v-btn>
          </div>
        </div>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 3: Establecer Nueva Contraseña -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-else-if="currentStep === 3" data-testid="recovery-step-3">
          <v-form ref="resetFormRef" @submit.prevent="handleConfirmReset">
            <v-text-field
              v-model="formData.password"
              label="Nueva contraseña"
              placeholder="Introduce tu nueva contraseña"
              prepend-inner-icon="mdi-lock-outline"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :error-messages="
                !hasOnlyAllowedChars ? ['La contraseña contiene caracteres o espacios no permitidos'] : []
              "
              :disabled="systemStore.isLoading"
              autocomplete="new-password"
              class="mb-2"
              data-testid="input-recovery-password"
              @click:append-inner="showPassword = !showPassword"
            />

            <!-- Medidor segmentado de fortaleza de contraseña (Inspirado en Untitled UI) -->
            <div class="strength-segments d-flex ga-1 mb-3">
              <div
                v-for="idx in 5"
                :key="idx"
                class="strength-segment flex-grow-1"
                :class="{
                  'strength-segment--active-weak': idx <= validCriteriaCount && validCriteriaCount < 3,
                  'strength-segment--active-medium': idx <= validCriteriaCount && validCriteriaCount >= 3 && validCriteriaCount < 5,
                  'strength-segment--active-strong': idx <= validCriteriaCount && validCriteriaCount === 5
                }"
              />
            </div>

            <v-text-field
              v-model="formData.confirm_password"
              label="Confirmar nueva contraseña"
              placeholder="Repite tu nueva contraseña"
              prepend-inner-icon="mdi-lock-check-outline"
              :type="showConfirmPassword ? 'text' : 'password'"
              :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :error-messages="
                formData.confirm_password && !doPasswordsMatch
                  ? ['Las contraseñas no coinciden']
                  : []
              "
              :disabled="systemStore.isLoading"
              autocomplete="new-password"
              class="mb-3"
              data-testid="input-recovery-confirm"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
            />

            <!-- Checklist Compacto de Requisitos -->
            <v-card variant="tonal" rounded="lg" color="grey" class="pa-3 mb-4">
              <div class="text-caption font-weight-bold text-uppercase mb-2 text-medium-emphasis">
                Requisitos de la contraseña:
              </div>
              <div
                v-for="(crit, idx) in passwordCriteria"
                :key="idx"
                class="d-flex align-center text-caption mb-1"
                :class="crit.valid ? 'text-success font-weight-medium' : 'text-medium-emphasis'"
                :data-testid="'recovery-criteria-row-' + idx"
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
              prepend-icon="mdi-shield-key"
              :disabled="!canSubmitPassword"
              :loading="systemStore.isLoading"
              class="text-none font-weight-bold recovery-submit-btn mb-4"
              data-testid="btn-recovery-submit-reset"
            >
              Restablecer contraseña
            </v-btn>
          </v-form>

          <!-- Volver a Iniciar Sesión -->
          <div class="text-center">
            <v-btn
              variant="plain"
              size="small"
              color="medium-emphasis"
              class="text-none font-weight-medium"
              prepend-icon="mdi-arrow-left"
              @click="goToLogin(false)"
            >
              Volver a Iniciar Sesión
            </v-btn>
          </div>
        </div>

        <!-- ───────────────────────────────────────────────────────────── -->
        <!-- PASO 4: Éxito Final -->
        <!-- ───────────────────────────────────────────────────────────── -->
        <div v-else-if="currentStep === 4" data-testid="recovery-step-4" class="text-center py-2">
          <v-btn
            color="primary"
            block
            size="large"
            rounded="lg"
            variant="flat"
            prepend-icon="mdi-login"
            class="text-none font-weight-bold recovery-submit-btn"
            data-testid="btn-recovery-finish"
            @click="goToLogin(true)"
          >
            Iniciar Sesión Ahora
          </v-btn>
        </div>

        <!-- Indicador de Progreso en 4 Pasos (Barras Segmentadas como en Untitled UI) -->
        <div class="d-flex justify-center align-center ga-2 mt-6 pt-2">
          <div
            v-for="s in 4"
            :key="s"
            class="step-bar"
            :class="{
              'step-bar--active': currentStep === s,
              'step-bar--completed': currentStep > s
            }"
          />
        </div>
      </v-card>
    </main>

    <!-- Pie de Página Institucional -->
    <footer class="py-3 px-6 text-center">
      <AppCopyright />
    </footer>
  </div>
</template>

<style scoped>
.recovery-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.recovery-submit-btn {
  height: 48px;
}

/* Ícono en recuadro redondeado (Untitled UI) */
.step-icon-badge {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  border: 1px solid #E2E8F0;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* Medidor segmentado de fortaleza */
.strength-segments {
  height: 4px;
}

.strength-segment {
  background-color: #E2E8F0;
  border-radius: 999px;
  transition: background-color 0.25s ease;
}

.strength-segment--active-weak {
  background-color: #EF4444;
}

.strength-segment--active-medium {
  background-color: #F59E0B;
}

.strength-segment--active-strong {
  background-color: #10B981;
}

/* Indicadores de pasos inferiores */
.step-bar {
  height: 4px;
  width: 32px;
  border-radius: 999px;
  background-color: #E2E8F0;
  transition: all 0.3s ease;
}

.step-bar--active {
  background-color: #0E54A4;
  width: 44px;
}

.step-bar--completed {
  background-color: #0E54A4;
  opacity: 0.7;
}

:deep(.v-otp-input .v-field) {
  border-radius: 10px;
}
</style>
