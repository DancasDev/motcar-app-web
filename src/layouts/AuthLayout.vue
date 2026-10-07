<script setup lang="ts">
import AppCopyright from '@/components/common/AppCopyright.vue'
</script>

<template>
  <v-main class="auth-layout fill-height pa-0">
    <v-row no-gutters class="fill-height">
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
        class="d-flex flex-column justify-space-between pa-6 pa-sm-10 pa-md-12 bg-surface position-relative"
      >
        <!-- Logo posicionado en la esquina superior izquierda (estilo nav) -->
        <div class="d-flex align-center w-100">
          <v-img
            src="/images/motcar-logo.png"
            alt="MotCar Financiamientos"
            max-width="170"
            height="auto"
          />
        </div>

        <!-- Contenedor Centrado de la Vista Activa -->
        <div class="d-flex align-center justify-center flex-grow-1 my-auto py-6">
          <div style="width: 100%; max-width: 440px;">
            <router-view />
          </div>
        </div>

        <!-- Pie de Página -->
        <div class="pt-6">
          <AppCopyright />
        </div>
      </v-col>
    </v-row>
  </v-main>
</template>

<style scoped>
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
