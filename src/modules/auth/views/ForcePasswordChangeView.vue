<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import { updateMyPassword } from '@/modules/my/api/my.api'

const router = useRouter()
const authStore = useAuthStore()

const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const fieldErrors = reactive({
  password_current: '',
  password_new: ''
})

const formData = reactive({
  password_current: '',
  password_new: '',
  confirm_password: ''
})

const passwordCriteria = computed(() => [
  { label: 'Entre 8 y 30 caracteres', valid: formData.password_new.length >= 8 && formData.password_new.length <= 30 },
  { label: 'Al menos una letra mayúscula (A-Z)', valid: /[A-Z]/.test(formData.password_new) },
  { label: 'Al menos una letra minúscula (a-z)', valid: /[a-z]/.test(formData.password_new) },
  { label: 'Al menos un número (0-9)', valid: /\d/.test(formData.password_new) },
  { label: 'Al menos un carácter especial (!@#$%^&*...)', valid: /[!@#$%^&*()_+\[\]{}|;:,.<>?\-]/.test(formData.password_new) }
])

const isCurrentPasswordValid = computed(() => !!formData.password_current.trim())
const isPasswordValid = computed(() => passwordCriteria.value.every((c) => c.valid))
const doPasswordsMatch = computed(() => !!formData.password_new && formData.password_new === formData.confirm_password)
const isDifferentFromCurrent = computed(
  () => !formData.password_current || formData.password_current !== formData.password_new
)

const canSubmit = computed(
  () =>
    isCurrentPasswordValid.value &&
    isPasswordValid.value &&
    doPasswordsMatch.value &&
    isDifferentFromCurrent.value
)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const { valid } = await formRef.value.validate()
  if (!valid || !canSubmit.value) return

  isLoading.value = true
  errorMessage.value = ''
  fieldErrors.password_current = ''
  fieldErrors.password_new = ''

  try {
    await updateMyPassword({
      password_current: formData.password_current,
      password_new: formData.password_new
    })
    // El backend revoca todas las sesiones previas (require_login: true)
    authStore.clearSession()
    router.push({
      path: '/login',
      query: { passwordUpdated: '1' }
    })
  } catch (err: any) {
    const errorData = err?.response?.data
    if (errorData?.messages && typeof errorData.messages === 'object') {
      if (errorData.messages.password_current) {
        fieldErrors.password_current = errorData.messages.password_current
      }
      if (errorData.messages.password_new) {
        fieldErrors.password_new = errorData.messages.password_new
      }
      if (errorData.messages.error) {
        errorMessage.value = errorData.messages.error
      } else if (!fieldErrors.password_current && !fieldErrors.password_new) {
        errorMessage.value = Object.values(errorData.messages).join(' ')
      }
    } else if (typeof errorData?.messages === 'string') {
      errorMessage.value = errorData.messages
    } else if (typeof errorData?.error === 'string') {
      errorMessage.value = errorData.error
    } else {
      errorMessage.value = err?.message || 'Error al actualizar la contraseña.'
    }
  } finally {
    isLoading.value = false
  }
}

async function handleLogout(): Promise<void> {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="force-password-layout fill-height d-flex flex-column bg-grey-lighten-4">
    <!-- Barra Superior Minimalista (Inspirado en ForcedActionLayout de SGA) -->
    <header class="forced-header px-6 py-3 bg-surface border-b d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-img
          src="/images/motcar-logo.png"
          alt="MotCar"
          max-width="140"
          height="auto"
        />
      </div>

      <div class="d-flex align-center" style="gap: 12px;">
        <!-- Cápsula de Usuario -->
        <div class="d-none d-sm-flex align-center user-capsule pa-1 pr-3 rounded-pill border">
          <v-avatar color="primary" size="32" class="mr-2 text-white font-weight-bold text-caption">
            {{ (authStore.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
          </v-avatar>
          <div class="mr-2 text-left" style="line-height: 1.2;">
            <div class="text-caption font-weight-bold text-truncate" style="max-width: 120px;">
              {{ authStore.fullName || authStore.user?.username }}
            </div>
            <div class="text-caption text-medium-emphasis" style="font-size: 0.7rem;">
              {{ authStore.userRoleCodes[0] || 'Usuario' }}
            </div>
          </div>
        </div>

        <v-btn
          icon="mdi-logout"
          variant="outlined"
          size="small"
          rounded="lg"
          density="comfortable"
          color="error"
          title="Cerrar Sesión"
          @click="handleLogout"
        />
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
        <!-- Ícono Destacado de Llave -->
        <div class="text-center mb-6">
          <v-avatar color="amber-lighten-5" size="64" class="mb-3">
            <v-icon icon="mdi-key-variant" color="amber-darken-2" size="32" />
          </v-avatar>
          <h2 class="text-h5 font-weight-bold text-high-emphasis mb-1">
            Actualización requerida
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            Por políticas de seguridad del sistema, debes establecer una nueva contraseña segura antes de continuar.
          </p>
        </div>

        <!-- Alerta de Error -->
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

        <v-form ref="formRef" @submit.prevent="handleSubmit">
          <v-text-field
            v-model="formData.password_current"
            label="Contraseña actual"
            placeholder="Introduce tu contraseña actual"
            prepend-inner-icon="mdi-lock-outline"
            :type="showCurrentPassword ? 'text' : 'password'"
            :append-inner-icon="showCurrentPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            :error-messages="fieldErrors.password_current ? [fieldErrors.password_current] : []"
            class="mb-3"
            autocomplete="current-password"
            data-testid="input-force-password-current"
            @input="fieldErrors.password_current = ''"
            @click:append-inner="showCurrentPassword = !showCurrentPassword"
          />

          <v-text-field
            v-model="formData.password_new"
            label="Nueva contraseña"
            placeholder="Introduce tu nueva contraseña"
            prepend-inner-icon="mdi-lock-plus-outline"
            :type="showNewPassword ? 'text' : 'password'"
            :append-inner-icon="showNewPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            :error-messages="[
              ...(formData.password_new && formData.password_current && !isDifferentFromCurrent ? ['La nueva contraseña debe ser diferente a la actual'] : []),
              ...(fieldErrors.password_new ? [fieldErrors.password_new] : [])
            ]"
            class="mb-3"
            autocomplete="new-password"
            data-testid="input-force-password-new"
            @input="fieldErrors.password_new = ''"
            @click:append-inner="showNewPassword = !showNewPassword"
          />

          <v-text-field
            v-model="formData.confirm_password"
            label="Confirmar nueva contraseña"
            placeholder="Repite la nueva contraseña"
            prepend-inner-icon="mdi-lock-check-outline"
            :type="showConfirmPassword ? 'text' : 'password'"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            :error-messages="formData.confirm_password && !doPasswordsMatch ? ['Las contraseñas no coinciden'] : []"
            class="mb-4"
            autocomplete="new-password"
            data-testid="input-force-confirm-password"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
          />

          <!-- Checklist de Requisitos -->
          <v-card variant="tonal" rounded="lg" color="grey" class="pa-4 mb-5">
            <div class="text-caption font-weight-bold text-uppercase mb-2 text-medium-emphasis">
              Requisitos de la contraseña:
            </div>
            <div
              v-for="(crit, idx) in passwordCriteria"
              :key="idx"
              class="d-flex align-center text-caption mb-1"
              :class="crit.valid ? 'text-success font-weight-medium' : 'text-medium-emphasis'"
              :data-testid="'force-criteria-row-' + idx"
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
            :disabled="!canSubmit"
            :loading="isLoading"
            class="text-none font-weight-bold"
            style="height: 48px;"
            data-testid="btn-force-password-submit"
          >
            Actualizar contraseña y continuar
          </v-btn>
        </v-form>
      </v-card>
    </main>
  </div>
</template>

<style scoped>
.forced-header {
  position: sticky;
  top: 0;
  z-index: 100;
}
.user-capsule {
  background: rgba(148, 163, 184, 0.08);
}
</style>
