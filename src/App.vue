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
</style>
