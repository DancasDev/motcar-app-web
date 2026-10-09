<script setup lang="ts">
// App.vue como contenedor raíz de Vuetify
</script>

<template>
  <v-app>
    <router-view />
  </v-app>
</template>

<style>
@keyframes shake-x {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.animate-shake {
  animation: shake-x 0.5s ease-in-out;
}

/* Glassmorphism scroll styling */
.topbar-glass {
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  transition: background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease !important;
}

/* Tooltip estandarizado y contrastado */
.v-overlay--tooltip .v-overlay__content,
.v-tooltip .v-overlay__content {
  background-color: #1e293b !important;
  color: #ffffff !important;
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  padding: 6px 10px !important;
  border-radius: 6px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
  opacity: 1 !important;
}

.v-overlay--tooltip .v-overlay__content * {
  color: #ffffff !important;
}
</style>
