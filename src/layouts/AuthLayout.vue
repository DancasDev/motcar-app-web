<script setup lang="ts">
import HeaderControls from '@/components/common/HeaderControls.vue'
</script>

<template>
  <v-main class="auth-layout fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Columna Izquierda: Hero Corporativo de Marca (Desktop) -->
      <v-col
        cols="12"
        md="5"
        lg="5"
        xl="4"
        class="d-none d-md-flex auth-hero flex-column justify-space-between pa-10 text-white position-relative"
      >
        <!-- Overlay poligonal con corte moderno (inspirado en SGA) -->
        <div class="auth-hero-overlay"></div>

        <!-- Encabezado Hero -->
        <div class="position-relative" style="z-index: 2;">
          <div class="d-flex align-center">
            <v-img
              src="/motcar-logo.png"
              alt="MotCar"
              max-width="170"
              height="auto"
              class="mb-4"
            />
          </div>
        </div>

        <!-- Contenido Central Hero -->
        <div class="position-relative my-auto" style="z-index: 2;">
          <div class="text-overline font-weight-bold text-secondary mb-2" style="letter-spacing: 0.15em;">
            PLATAFORMA INTEGRAL
          </div>
          <h1 class="text-h3 font-weight-bold mb-4" style="line-height: 1.15; letter-spacing: -0.02em;">
            Sistema de Gestión Automotriz
          </h1>
          <p class="text-body-1 text-grey-lighten-2 mb-8" style="max-width: 440px; line-height: 1.6;">
            Administración centralizada de inventario vehicular, solicitudes de crédito SAM, tesorería y control de acceso seguro multi-sucursal.
          </p>

          <!-- Badges de características -->
          <div class="d-flex flex-wrap" style="gap: 10px;">
            <div class="auth-feature-pill">
              <v-icon icon="mdi-shield-check-outline" size="small" class="mr-1 text-secondary" />
              <span>Seguridad GAC & RBAC</span>
            </div>
            <div class="auth-feature-pill">
              <v-icon icon="mdi-handshake-outline" size="small" class="mr-1 text-secondary" />
              <span>Financiamiento SAM</span>
            </div>
            <div class="auth-feature-pill">
              <v-icon icon="mdi-office-building-marker-outline" size="small" class="mr-1 text-secondary" />
              <span>Multi-Sucursal</span>
            </div>
          </div>
        </div>

        <!-- Pie Hero -->
        <div class="position-relative text-caption text-grey-lighten-3" style="z-index: 2;">
          MotCar Technologies &bull; Versión 1.0.0
        </div>
      </v-col>

      <!-- Columna Derecha: Contenedor de Formularios y Vistas Públicas -->
      <v-col
        cols="12"
        md="7"
        lg="7"
        xl="8"
        class="d-flex flex-column justify-space-between pa-6 pa-sm-10 bg-surface position-relative"
      >
        <!-- Barra Superior con Controles (Idioma y Tema) -->
        <div class="d-flex align-center justify-space-between w-100 mb-6">
          <div class="d-flex d-md-none align-center">
            <v-img
              src="/motcar-logo.png"
              alt="MotCar"
              max-width="140"
              height="auto"
            />
          </div>
          <div class="d-none d-md-block"></div>
          <HeaderControls />
        </div>

        <!-- Contenedor Centrado de la Vista Activa -->
        <div class="d-flex align-center justify-center flex-grow-1 my-4">
          <div style="width: 100%; max-width: 460px;">
            <router-view />
          </div>
        </div>

        <!-- Pie de Página -->
        <div class="text-center text-caption text-medium-emphasis pt-4 border-t">
          MotCar &copy; 2026 &bull; Todos los derechos reservados
        </div>
      </v-col>
    </v-row>
  </v-main>
</template>

<style scoped>
.auth-hero {
  background: linear-gradient(145deg, #07264a 0%, #0E54A4 60%, #173d6b 100%);
  overflow: hidden;
}

.auth-hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(circle at 20% 30%, rgba(219, 181, 29, 0.08) 0%, transparent 60%),
                    radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.1) 0%, transparent 50%);
  clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%);
  pointer-events: none;
}

.auth-feature-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 0.78rem;
  font-weight: 600;
  color: #f8fafc;
  backdrop-filter: blur(8px);
}
</style>
