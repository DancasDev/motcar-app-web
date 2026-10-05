<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="fill-height d-flex flex-column justify-center align-center text-center">
        <v-icon icon="mdi-vuetify" size="80" color="primary" class="mb-4" />

        <h1 class="text-h3 font-weight-bold mb-2">Motcar Web App</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-6">
          Vue 3 + TypeScript + Vuetify + Pinia + Vue Router
        </p>

        <v-card class="pa-6" elevation="2" rounded="lg" max-width="400" width="100%">
          <v-card-text>
            <div class="text-h6 mb-3">Prueba de Estado y Vuetify</div>
            <v-chip color="success" class="mb-4" label>
              <v-icon start icon="mdi-check-circle" />
              Entorno listo
            </v-chip>
            <div>
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                variant="elevated"
                @click="count++"
              >
                Clicks: {{ count }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>
