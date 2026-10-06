<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import { updateMyPassword } from '@/modules/my/api/my.api'
import HeaderControls from '@/components/common/HeaderControls.vue'

const router = useRouter()
const authStore = useAuthStore()

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(null)

const formData = reactive({
  password: '',
  confirm_password: ''
})

const passwordCriteria = computed(() => [
  { label: 'Entre 8 y 30 caracteres', valid: formData.password.length >= 8 && formData.password.length <= 30 },
  { label: 'Al menos una letra mayúscula (A-Z)', valid: /[A-Z]/.test(formData.password) },
  { label: 'Al menos una letra minúscula (a-z)', valid: /[a-z]/.test(formData.password) },
  { label: 'Al menos un número (0-9)', valid: /\d/.test(formData.password) },
  { label: 'Al menos un carácter especial (!@#$%^&*...)', valid: /[!@#$%^&*()_+\[\]{}|;:,.<>?\-]/.test(formData.password) }
])

const isPasswordValid = computed(() => passwordCriteria.value.every((c) => c.valid))
const doPasswordsMatch = computed(() => formData.password && formData.password === formData.confirm_password)

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const { valid } = await formRef.value.validate()
  if (!valid || !isPasswordValid.value || !doPasswordsMatch.value) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    await updateMyPassword(formData.password)
    // Limpiar bandera force_to localmente y refrescar usuario
    authStore.forceTo = null
    await authStore.fetchCurrentUser()
    router.push('/')
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.messages?.error ||
      err?.response?.data?.messages?.password ||
      err?.message ||
      'Error al actualizar la contraseña.'
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
          src="/motcar-logo.png"
          alt="MotCar"
          max-width="140"
          height="auto"
        />
      </div>

      <div class="d-flex align-center" style="gap: 12px;">
        <HeaderControls />

        <v-divider vertical class="mx-1" style="height: 24px;" />

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
            v-model="formData.password"
            label="Nueva contraseña"
            placeholder="Introduce tu nueva contraseña"
            prepend-inner-icon="mdi-lock-outline"
            :type="showPassword ? 'text' : 'password'"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            variant="outlined"
            density="comfortable"
            rounded="lg"
            class="mb-3"
            data-testid="input-force-password"
            @click:append-inner="showPassword = !showPassword"
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
            :disabled="!isPasswordValid || !doPasswordsMatch"
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
