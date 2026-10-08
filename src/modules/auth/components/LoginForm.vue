<script setup lang="ts">
import { ref, reactive, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth.store";
import type { LoginUserRequest } from "../types";
import PasswordRecoveryDialog from "@/modules/system/components/PasswordRecoveryDialog.vue";

const emit = defineEmits<{
  (e: "success"): void;
}>();

const route = useRoute();
const authStore = useAuthStore();

const formRef = ref<{ validate: () => Promise<{ valid: boolean }> } | null>(
  null,
);
const showPassword = ref(false);
const isRecoveryOpen = ref(false);
const recoverySuccessSnackbar = ref(false);
const showPasswordUpdatedAlert = ref(false);
const isShaking = ref(false);

onMounted(() => {
  if (route.query.passwordUpdated === "1") {
    showPasswordUpdatedAlert.value = true;
  }
});

function handleRecoverySuccess(_email: string): void {
  recoverySuccessSnackbar.value = true;
}

const credentials = reactive<LoginUserRequest>({
  username: "",
  password: "",
});

const rules = {
  required: (v: string) => !!v?.trim() || "Este campo es obligatorio.",
  minUser: (v: string) =>
    (v && v.length >= 5) || "El usuario debe tener al menos 5 caracteres.",
  minPass: (v: string) =>
    (v && v.length >= 8) || "La contraseña debe tener al menos 8 caracteres.",
};

// Sacudir al registrar error de autenticación (igual que SGA)
watch(
  () => authStore.error,
  (val) => {
    if (val) {
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 600);
    }
  },
);

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;

  const { valid } = await formRef.value.validate();
  if (!valid) return;

  try {
    await authStore.login({
      username: credentials.username.trim(),
      password: credentials.password,
    });
    emit("success");
  } catch {
    // Error en authStore.error activa watch y shake
  }
}
</script>

<template>
  <div :class="['w-100', { 'animate-shake': isShaking }]">
    <!-- Encabezado de Bienvenida -->
    <div class="mb-8">
      <h2
        class="text-h4 font-weight-bold text-high-emphasis mb-1"
        style="letter-spacing: -0.025em; line-height: 1.2"
      >
        ¡Bienvenido de nuevo!
      </h2>
      <p
        class="text-body-2 text-medium-emphasis mt-3"
        style="line-height: 1.45"
      >
        Accede a tu cuenta para gestionar las operaciones de financiamiento
      </p>
    </div>

    <!-- Alerta de Contraseña Actualizada -->
    <v-alert
      v-if="showPasswordUpdatedAlert"
      type="success"
      variant="tonal"
      closable
      density="comfortable"
      rounded="lg"
      class="mb-6 text-body-2"
      icon="mdi-check-circle-outline"
      @click:close="showPasswordUpdatedAlert = false"
    >
      Contraseña actualizada exitosamente. Por favor, inicia sesión con tu nueva contraseña.
    </v-alert>

    <!-- Alerta de Error con Ícono e Identidad Limpia -->
    <v-alert
      v-if="authStore.error"
      type="error"
      variant="tonal"
      closable
      density="comfortable"
      rounded="lg"
      class="mb-6 text-body-2"
      icon="mdi-alert-circle-outline"
      @click:close="authStore.error = null"
    >
      {{ authStore.error }}
    </v-alert>

    <!-- Formulario de Acceso -->
    <v-form ref="formRef" @submit.prevent="handleSubmit">
      <div class="mb-3">
        <v-text-field
          v-model="credentials.username"
          label="Usuario"
          placeholder="Ej: admin_master"
          prepend-inner-icon="mdi-account-outline"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          :rules="[rules.required, rules.minUser]"
          :disabled="authStore.isLoading"
          autocomplete="username"
          data-testid="input-username"
        />
      </div>

      <div class="mb-2">
        <v-text-field
          v-model="credentials.password"
          label="Contraseña"
          placeholder="••••••••"
          prepend-inner-icon="mdi-lock-outline"
          :type="showPassword ? 'text' : 'password'"
          :append-inner-icon="
            showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'
          "
          variant="outlined"
          density="comfortable"
          rounded="lg"
          :rules="[rules.required, rules.minPass]"
          :disabled="authStore.isLoading"
          autocomplete="current-password"
          data-testid="input-password"
          @click:append-inner="showPassword = !showPassword"
        />
      </div>

      <!-- Enlace para Recuperación de Contraseña -->
      <div class="d-flex justify-end mb-8 mt-2">
        <v-btn
          variant="plain"
          color="primary"
          size="small"
          :class="[
            'text-none font-weight-medium px-0 text-body-2',
            { 'animate-shake': isShaking },
          ]"
          data-testid="btn-forgot-password"
          @click="isRecoveryOpen = true"
        >
          ¿Olvidaste tu contraseña?
        </v-btn>
      </div>

      <!-- Botón Principal de Acceso -->
      <v-btn
        type="submit"
        color="primary"
        block
        size="large"
        variant="flat"
        rounded="lg"
        prepend-icon="mdi-login"
        :loading="authStore.isLoading"
        class="text-none font-weight-bold text-body-1 shadow-sm"
        data-testid="btn-login-submit"
        style="letter-spacing: 0.02em; height: 52px"
      >
        Iniciar Sesión
      </v-btn>
    </v-form>

    <!-- Modal de Recuperación de Contraseña (Servicio del Sistema) -->
    <PasswordRecoveryDialog
      v-model="isRecoveryOpen"
      @success="handleRecoverySuccess"
    />

    <!-- Feedback de Restablecimiento Exitoso -->
    <v-snackbar
      v-model="recoverySuccessSnackbar"
      color="success"
      location="bottom right"
      timeout="5000"
      rounded="lg"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-check-circle" class="mr-2" />
        Contraseña restablecida exitosamente. Inicia sesión con tus nuevas
        credenciales.
      </div>
    </v-snackbar>
  </div>
</template>

<style scoped>
.shadow-sm {
  box-shadow: 0 4px 12px rgba(14, 84, 164, 0.2) !important;
}
</style>
