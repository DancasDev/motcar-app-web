<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import AppCopyright from '@/components/common/AppCopyright.vue'
import {
  fetchInvitationSetupUser,
  completeInvitationSetup
} from '@/modules/system/api/system.api'
import type { InvitationSetupUserData } from '@/modules/system/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isVerifying = ref(true)
const isSubmitting = ref(false)
const isCompleted = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const userData = ref<InvitationSetupUserData | null>(null)
const tokenError = ref<{
  code: string
  title: string
  message: string
  icon: string
  color: string
} | null>(null)

const errorMessage = ref('')
const passwordFieldError = ref('')
const successMessage = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const formData = reactive({
  password: '',
  confirm_password: ''
})

const actionToken = computed(() => {
  const raw = route.query.token ?? route.query.action_token
  return typeof raw === 'string' ? raw.trim() : ''
})

const fullName = computed(() => {
  if (!userData.value) return ''
  return [userData.value.first_name, userData.value.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
})

// Reglas de contraseña sincronizadas con UserModel::$validationRules['password']
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

const hasOnlyAllowedChars = computed(
  () => !formData.password || /^[A-Za-z\d!@#$%^&*()_+\[\]{}|;:,.<>?\-]+$/.test(formData.password)
)

const isPasswordValid = computed(
  () => passwordCriteria.value.every((c) => c.valid) && hasOnlyAllowedChars.value
)

const doPasswordsMatch = computed(
  () => !!formData.password && formData.password === formData.confirm_password
)

const canSubmit = computed(() => isPasswordValid.value && doPasswordsMatch.value)

function resolveTokenError(err: any): {
  code: string
  title: string
  message: string
  icon: string
  color: string
} {
  const errorData = err?.response?.data
  const code = errorData?.error || 'ACTION_TOKEN_INVALID'
  const backendMessage =
    typeof errorData?.messages === 'object'
      ? errorData.messages.error || Object.values(errorData.messages).join(' ')
      : typeof errorData?.messages === 'string'
        ? errorData.messages
        : ''

  if (code === 'ACTION_TOKEN_EXPIRED') {
    return {
      code,
      title: 'Enlace de invitación expirado',
      message:
        backendMessage ||
        'Este enlace de invitación ha superado su tiempo de validez. Solicita a un administrador que te envíe una nueva invitación.',
      icon: 'mdi-clock-alert-outline',
      color: 'warning'
    }
  }

  if (code === 'ACTION_TOKEN_USED') {
    return {
      code,
      title: 'Invitación ya utilizada',
      message:
        backendMessage ||
        'Esta invitación ya fue procesada anteriormente y tu cuenta se encuentra activa. Puedes iniciar sesión con tus credenciales.',
      icon: 'mdi-check-decagram-outline',
      color: 'info'
    }
  }

  return {
    code,
    title: 'Enlace de invitación no válido',
    message:
      backendMessage ||
      'El enlace de invitación es inválido, está incompleto o ya no se encuentra disponible.',
    icon: 'mdi-link-off',
    color: 'error'
  }
}

async function verifyInvitationToken(): Promise<void> {
  if (!actionToken.value) {
    tokenError.value = {
      code: 'ACTION_TOKEN_REQUIRED',
      title: 'Enlace de invitación incompleto',
      message:
        'No se encontró el token de invitación en el enlace. Verifica que hayas abierto el enlace completo desde tu correo electrónico.',
      icon: 'mdi-link-off',
      color: 'error'
    }
    isVerifying.value = false
    return
  }

  isVerifying.value = true
  tokenError.value = null

  try {
    const res = await fetchInvitationSetupUser(actionToken.value)
    userData.value = res.data
  } catch (err: any) {
    tokenError.value = resolveTokenError(err)
  } finally {
    isVerifying.value = false
  }
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const { valid } = await formRef.value.validate()
  if (!valid || !canSubmit.value) return

  isSubmitting.value = true
  errorMessage.value = ''
  passwordFieldError.value = ''

  try {
    const res = await completeInvitationSetup({
      token: actionToken.value,
      password: formData.password
    })

    // Limpiar cualquier sesión previa en el navegador para evitar colisiones al ir al login
    authStore.clearSession()

    successMessage.value =
      res.messages?.success ||
      'Tu contraseña ha sido configurada exitosamente. Ya puedes iniciar sesión con tu cuenta.'
    isCompleted.value = true
  } catch (err: any) {
    const errorData = err?.response?.data
    const code = errorData?.error || ''

    if (
      code === 'ACTION_TOKEN_EXPIRED' ||
      code === 'ACTION_TOKEN_USED' ||
      code === 'ACTION_TOKEN_INVALID'
    ) {
      tokenError.value = resolveTokenError(err)
      return
    }

    if (errorData?.messages && typeof errorData.messages === 'object') {
      if (errorData.messages.password) {
        passwordFieldError.value = errorData.messages.password
      }
      if (errorData.messages.error) {
        errorMessage.value = errorData.messages.error
      } else if (!passwordFieldError.value) {
        errorMessage.value = Object.values(errorData.messages).join(' ')
      }
    } else if (typeof errorData?.messages === 'string') {
      errorMessage.value = errorData.messages
    } else {
      errorMessage.value =
        err?.message || 'Ocurrió un error al configurar la contraseña. Intenta nuevamente.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function goToLogin(withUpdatedFlag = false): void {
  router.push(
    withUpdatedFlag
      ? { path: '/login', query: { passwordUpdated: '1' } }
      : { path: '/login' }
  )
}

onMounted(() => {
  verifyInvitationToken()
})
</script>

<template>
  <div class="setup-layout fill-height d-flex flex-column bg-grey-lighten-4" data-testid="invitation-setup-view">
    <!-- Barra Superior Minimalista (Logo a la izquierda) -->
    <header class="setup-header px-6 py-3 bg-surface border-b d-flex align-center justify-space-between">
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
          data-testid="btn-header-login"
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
        class="border pa-6 pa-sm-8 bg-surface"
        style="width: 100%; max-width: 460px; box-shadow: 0 10px 30px rgba(0,0,0,0.04) !important;"
      >
        <!-- 1. Estado de Carga: Verificando Token -->
        <div
          v-if="isVerifying"
          class="text-center py-6"
          data-testid="setup-loading-state"
        >
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
            width="4"
            class="mb-4"
          />
          <h2 class="text-h6 font-weight-bold text-high-emphasis mb-1">
            Verificando tu invitación...
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            Estamos validando tu enlace de acceso para configurar tu cuenta.
          </p>
        </div>

        <!-- 2. Estado de Error de Token (Inválido, Expirado o Ya Utilizado) -->
        <div
          v-else-if="tokenError"
          class="text-center py-2"
          data-testid="setup-error-state"
        >
          <v-avatar
            :color="`${tokenError.color}-lighten-5`"
            size="64"
            class="mb-4"
          >
            <v-icon
              :icon="tokenError.icon"
              :color="tokenError.color"
              size="32"
            />
          </v-avatar>

          <h2
            class="text-h5 font-weight-bold text-high-emphasis mb-2"
            data-testid="setup-error-title"
          >
            {{ tokenError.title }}
          </h2>

          <p
            class="text-body-2 text-medium-emphasis mb-6"
            data-testid="setup-error-message"
          >
            {{ tokenError.message }}
          </p>

          <v-btn
            color="primary"
            block
            size="large"
            rounded="lg"
            variant="flat"
            prepend-icon="mdi-login"
            class="text-none font-weight-bold setup-submit-btn"
            data-testid="btn-setup-error-go-login"
            @click="goToLogin(false)"
          >
            Ir a Iniciar Sesión
          </v-btn>
        </div>

        <!-- 3. Estado de Éxito: Cuenta Activada -->
        <div
          v-else-if="isCompleted"
          class="text-center py-2"
          data-testid="setup-success-state"
        >
          <v-avatar color="success-lighten-5" size="64" class="mb-4">
            <v-icon icon="mdi-check-decagram" color="success" size="34" />
          </v-avatar>

          <h2
            class="text-h5 font-weight-bold text-high-emphasis mb-2"
            data-testid="setup-success-title"
          >
            ¡Cuenta activada!
          </h2>

          <p
            class="text-body-2 text-medium-emphasis mb-6"
            data-testid="setup-success-message"
          >
            {{ successMessage }}
          </p>

          <v-btn
            color="primary"
            block
            size="large"
            rounded="lg"
            variant="flat"
            prepend-icon="mdi-login"
            class="text-none font-weight-bold setup-submit-btn"
            data-testid="btn-setup-success-login"
            @click="goToLogin(true)"
          >
            Iniciar Sesión Ahora
          </v-btn>
        </div>

        <!-- 4. Estado Principal: Formulario de Configuración de Contraseña -->
        <div v-else data-testid="setup-form-state">
          <!-- Ícono de Llave Destacado y Bienvenida (Estilo ForcePassword / SGA) -->
          <div class="text-center mb-6">
            <v-avatar color="amber-lighten-5" size="64" class="mb-3">
              <v-icon icon="mdi-key-variant" color="amber-darken-2" size="32" />
            </v-avatar>
            <h2
              class="text-h5 font-weight-bold text-high-emphasis mb-1"
              data-testid="setup-welcome-title"
            >
              {{ fullName ? `¡Hola, ${fullName}!` : 'Configura tu contraseña' }}
            </h2>
            <p class="text-body-2 text-medium-emphasis">
              Por favor establece una contraseña segura para activar tu cuenta y comenzar a usar el sistema.
            </p>
          </div>

          <!-- Alerta de Error de Envío -->
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            closable
            density="comfortable"
            rounded="lg"
            class="mb-4 text-body-2"
            data-testid="setup-submit-error-alert"
            @click:close="errorMessage = ''"
          >
            {{ errorMessage }}
          </v-alert>

          <v-form ref="formRef" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="formData.password"
              label="Nueva contraseña"
              placeholder="Introduce tu nueva contraseña"
              prepend-inner-icon="mdi-lock-plus-outline"
              :type="showPassword ? 'text' : 'password'"
              :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              :error-messages="[
                ...(!hasOnlyAllowedChars ? ['La contraseña contiene caracteres o espacios no permitidos'] : []),
                ...(passwordFieldError ? [passwordFieldError] : [])
              ]"
              :disabled="isSubmitting"
              autocomplete="new-password"
              class="mb-3"
              data-testid="input-setup-password"
              @input="passwordFieldError = ''"
              @click:append-inner="showPassword = !showPassword"
            />

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
              :disabled="isSubmitting"
              autocomplete="new-password"
              class="mb-4"
              data-testid="input-setup-confirm-password"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
            />

            <!-- Checklist de Requisitos de Contraseña -->
            <v-card variant="tonal" rounded="lg" color="grey" class="pa-4 mb-5">
              <div class="text-caption font-weight-bold text-uppercase mb-2 text-medium-emphasis">
                Requisitos de la contraseña:
              </div>
              <div
                v-for="(crit, idx) in passwordCriteria"
                :key="idx"
                class="d-flex align-center text-caption mb-1"
                :class="crit.valid ? 'text-success font-weight-medium' : 'text-medium-emphasis'"
                :data-testid="'setup-criteria-row-' + idx"
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
              prepend-icon="mdi-key-check"
              :disabled="!canSubmit"
              :loading="isSubmitting"
              class="text-none font-weight-bold setup-submit-btn mb-4"
              data-testid="btn-setup-submit"
            >
              Configurar contraseña y activar cuenta
            </v-btn>
          </v-form>

          <!-- Enlace Volver a Login -->
          <div class="text-center">
            <v-btn
              variant="plain"
              size="small"
              color="medium-emphasis"
              class="text-none"
              prepend-icon="mdi-arrow-left"
              data-testid="btn-setup-back-login"
              @click="goToLogin(false)"
            >
              Volver a Iniciar Sesión
            </v-btn>
          </div>
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
.setup-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.setup-submit-btn {
  height: 48px;
}
</style>
