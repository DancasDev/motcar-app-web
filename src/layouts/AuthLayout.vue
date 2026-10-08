<script setup lang="ts">
import AppCopyright from '@/components/common/AppCopyright.vue'
</script>

<template>
  <v-main class="auth-layout fill-height pa-0">
    <v-row no-gutters class="fill-height auth-main-row">
      <!-- Columna Izquierda: Hero Corporativo con imagen desenfocada y propuesta de valor (Desktop) -->
      <v-col
        cols="12"
        md="5"
        lg="5"
        xl="4"
        class="d-none d-md-flex auth-hero flex-column justify-center pa-10 pa-xl-16 text-white position-relative overflow-hidden"
      >
        <!-- Imagen de fondo con desenfoque suave optimizada para web -->
        <div class="auth-hero-backdrop"></div>

        <!-- Overlay con gradiente para garantizar contraste y legibilidad óptima -->
        <div class="auth-hero-overlay"></div>

        <!-- Contenido Central Hero (Orientado a la gestión administrativa del equipo) -->
        <div class="position-relative my-auto" style="z-index: 3;">
          <h1 class="text-h3 font-weight-bold mb-4" style="line-height: 1.2; letter-spacing: -0.02em;">
            Impulsando cada financiamiento sobre dos ruedas
          </h1>
          <p class="text-body-1 text-grey-lighten-2" style="max-width: 460px; line-height: 1.7;">
            Controla, evalúa y da seguimiento a las operaciones de financiamiento de forma ágil y transparente. La plataforma para que tu equipo trabaje con rapidez, claridad y confianza.
          </p>
        </div>
      </v-col>

      <!-- Columna Derecha: Contenedor de Formularios y Vistas Públicas -->
      <v-col
        cols="12"
        md="7"
        lg="7"
        xl="8"
        class="auth-content-col d-flex flex-column pa-6 pa-sm-10 pa-md-12 bg-surface position-relative"
      >
        <!-- Logo posicionado en la parte superior (fijo, sin scroll) -->
        <div class="d-flex align-center w-100 flex-shrink-0">
          <v-img
            src="/images/motcar-logo.png"
            alt="MotCar Financiamientos"
            max-width="170"
            height="auto"
          />
        </div>

        <!-- Contenedor con scroll interno exclusivo para la parte del formulario -->
        <div class="auth-form-scroll-container flex-grow-1 overflow-y-auto overflow-x-hidden">
          <div class="auth-form-inner mx-auto w-100" style="max-width: 440px;">
            <router-view />
          </div>
        </div>

        <!-- Pie de Página (fijo, sin scroll) -->
        <div class="pt-4 flex-shrink-0">
          <AppCopyright />
        </div>
      </v-col>
    </v-row>
  </v-main>
</template>

<style scoped>
.auth-layout {
  height: 100vh;
  max-height: 100dvh;
  overflow: hidden;
}

.auth-main-row {
  height: 100%;
  max-height: 100dvh;
}

.auth-content-col {
  height: 100%;
  max-height: 100dvh;
  overflow: hidden;
}

.auth-form-scroll-container {
  min-height: 0;
  display: flex;
  flex-direction: column;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.auth-form-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.auth-form-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.auth-form-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 999px;
}

.auth-form-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

.auth-form-inner {
  margin-top: auto;
  margin-bottom: auto;
  padding: 16px 0;
}

.auth-hero {
  background-color: #07264a;
}

.auth-hero-backdrop {
  position: absolute;
  top: -20px;
  left: -20px;
  right: -20px;
  bottom: -20px;
  background-image: url('/images/auth-hero-bg.webp');
  background-size: cover;
  background-position: center 30%;
  filter: blur(8px);
  transform: scale(1.05);
  z-index: 1;
}

.auth-hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    155deg,
    rgba(6, 28, 58, 0.82) 0%,
    rgba(14, 84, 164, 0.65) 50%,
    rgba(4, 18, 40, 0.9) 100%
  );
  z-index: 2;
}
</style>
