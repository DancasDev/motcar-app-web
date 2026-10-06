<script setup lang="ts">
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const authStore = useAuthStore()
</script>

<template>
  <v-row>
    <v-col cols="12">
      <v-card elevation="2" rounded="lg" class="pa-6">
        <v-card-item>
          <div class="d-flex align-center">
            <v-avatar color="primary" size="56" class="mr-4">
              <v-icon icon="mdi-account" size="32" color="white" />
            </v-avatar>
            <div>
              <v-card-title class="text-h5 font-weight-bold pa-0">
                ¡Bienvenido, {{ authStore.fullName || authStore.user?.username }}!
              </v-card-title>
              <v-card-subtitle class="pa-0 mt-1">
                Sesión iniciada correctamente en Motcar API
              </v-card-subtitle>
            </div>
          </div>
        </v-card-item>

        <v-divider class="my-4" />

        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-list density="compact" class="bg-transparent">
                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-account-circle" color="primary" />
                  </template>
                  <v-list-item-title class="font-weight-medium">Nombre de usuario</v-list-item-title>
                  <v-list-item-subtitle>{{ authStore.user?.username }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-email" color="primary" />
                  </template>
                  <v-list-item-title class="font-weight-medium">Correo electrónico</v-list-item-title>
                  <v-list-item-subtitle>{{ authStore.user?.email }}</v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template #prepend>
                    <v-icon icon="mdi-shield-check" color="primary" />
                  </template>
                  <v-list-item-title class="font-weight-medium">Roles asignados</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      v-for="role in authStore.roles"
                      :key="role.id"
                      size="small"
                      color="primary"
                      variant="outlined"
                      class="mr-1 mt-1"
                    >
                      {{ role.code }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>

            <v-col cols="12" md="6">
              <v-alert type="info" variant="tonal" border="start" density="comfortable">
                <div class="text-subtitle-2 font-weight-bold mb-1">Fase 1: Módulo Auth Activo</div>
                <div class="text-body-2">
                  La infraestructura de cliente HTTP, interceptores de autorización Bearer, Pinia Store y Navigation Guards están plenamente operativos.
                </div>
              </v-alert>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
