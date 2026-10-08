<script setup lang="ts">
import { useAuthStore } from '@/modules/auth/stores/auth.store'

const authStore = useAuthStore()

const kpis = [
  { title: 'Ventas Totales', value: '$124,500', icon: 'mdi-currency-usd', color: 'success', change: '+12.5% este mes' },
  { title: 'Solicitudes SAM', value: '48', icon: 'mdi-handshake-outline', color: 'primary', change: '+4 hoy' },
  { title: 'Sucursales Conectadas', value: '6', icon: 'mdi-office-building-marker-outline', color: 'info', change: '100% operativas' },
  { title: 'Operaciones Pendientes', value: '14', icon: 'mdi-clock-outline', color: 'warning', change: 'Requiere revisión' }
]

const recentActivities = [
  { id: 1, user: 'Carlos Silva', action: 'Aprobó solicitud de financiamiento SAM-2026-089', time: 'Hace 12 min', status: 'Aprobado', color: 'success' },
  { id: 2, user: 'María González', action: 'Generó asiento contable en Sucursal Valencia', time: 'Hace 45 min', status: 'Completado', color: 'primary' },
  { id: 3, user: 'Daniel Castillo', action: 'Actualizó permisos de roles en Control de Acceso', time: 'Hace 1 hora', status: 'Seguridad', color: 'info' },
  { id: 4, user: 'Soporte Técnico', action: 'Sincronización de catálogo de repuestos automotrices', time: 'Hace 3 horas', status: 'Sistema', color: 'secondary' },
  { id: 5, user: 'Auditoría Interna', action: 'Cierre de caja y conciliación bancaria diaria', time: 'Hace 5 horas', status: 'Completado', color: 'success' },
  { id: 6, user: 'Roberto Díaz', action: 'Revisión y arqueo de inventario central', time: 'Hace 6 horas', status: 'Inventario', color: 'warning' },
  { id: 7, user: 'Admin Sistema', action: 'Respaldo preventivo de base de datos finalizado', time: 'Hace 8 horas', status: 'Backup', color: 'primary' }
]

const systemModules = [
  { title: 'Financiamiento (SAM)', desc: 'Gestión de créditos y planes automotrices', icon: 'mdi-handshake-outline', route: '/financing' },
  { title: 'Contabilidad y Tesorería', desc: 'Libros contables, asientos y cuentas por cobrar', icon: 'mdi-cash-register', route: '/accounting' },
  { title: 'Catálogos Generales', desc: 'Productos, servicios, repuestos y tarifas', icon: 'mdi-book-open-page-variant-outline', route: '/catalogs' },
  { title: 'Sucursales y Puntos de Venta', desc: 'Configuración geográfica y terminales de caja', icon: 'mdi-office-building-marker-outline', route: '/branches' }
]
</script>

<template>
  <div class="home-view-container">
    <!-- 1. Tarjeta de Bienvenida Principal -->
    <v-row class="mb-2">
      <v-col cols="12">
        <v-card elevation="1" rounded="lg" class="pa-6 border bg-white">
          <v-card-item class="pa-0">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="56" class="mr-4 elevation-1">
                <v-icon icon="mdi-account" size="32" color="white" />
              </v-avatar>
              <div>
                <v-card-title class="text-h5 font-weight-bold pa-0 text-high-emphasis">
                  ¡Bienvenido, {{ authStore.fullName || authStore.user?.username }}!
                </v-card-title>
                <v-card-subtitle class="pa-0 mt-1 text-medium-emphasis">
                  Sesión iniciada correctamente en MotCar Web App
                </v-card-subtitle>
              </div>
            </div>
          </v-card-item>

          <v-divider class="my-4" />

          <v-card-text class="pa-0">
            <v-row>
              <v-col cols="12" md="6">
                <v-list density="compact" class="bg-transparent pa-0">
                  <v-list-item class="px-0">
                    <template #prepend>
                      <v-icon icon="mdi-account-circle" color="primary" class="mr-2" />
                    </template>
                    <v-list-item-title class="font-weight-medium">Nombre de usuario</v-list-item-title>
                    <v-list-item-subtitle>{{ authStore.user?.username }}</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item class="px-0">
                    <template #prepend>
                      <v-icon icon="mdi-email" color="primary" class="mr-2" />
                    </template>
                    <v-list-item-title class="font-weight-medium">Correo electrónico</v-list-item-title>
                    <v-list-item-subtitle>{{ authStore.user?.email }}</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item class="px-0">
                    <template #prepend>
                      <v-icon icon="mdi-shield-check" color="primary" class="mr-2" />
                    </template>
                    <v-list-item-title class="font-weight-medium">Roles asignados</v-list-item-title>
                    <v-list-item-subtitle class="mt-1">
                      <v-chip
                        v-for="role in authStore.roles"
                        :key="role.id"
                        size="small"
                        color="primary"
                        variant="outlined"
                        class="mr-1 mb-1"
                      >
                        {{ role.code }}
                      </v-chip>
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-col>

              <v-col cols="12" md="6">
                <v-alert type="info" variant="tonal" border="start" density="comfortable" rounded="lg">
                  <div class="text-subtitle-2 font-weight-bold mb-1">Módulos y Conectividad Activos</div>
                  <div class="text-body-2 text-medium-emphasis">
                    La plataforma empresarial MotCar está operando con normalidad. Los accesos granulares por sucursal y la arquitectura de API REST se encuentran sincronizados.
                  </div>
                </v-alert>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 2. KPIs del Sistema (Para generar contenido enriquecido y desborde) -->
    <v-row class="mb-2">
      <v-col v-for="(kpi, idx) in kpis" :key="idx" cols="12" sm="6" lg="3">
        <v-card elevation="1" rounded="lg" class="pa-4 border bg-white h-100">
          <div class="d-flex align-center justify-space-between mb-2">
            <span class="text-caption font-weight-medium text-medium-emphasis">{{ kpi.title }}</span>
            <v-avatar :color="kpi.color" variant="tonal" size="36" rounded="lg">
              <v-icon :icon="kpi.icon" size="20" />
            </v-avatar>
          </div>
          <div class="text-h5 font-weight-bold text-high-emphasis mb-1">{{ kpi.value }}</div>
          <div class="text-caption text-medium-emphasis font-weight-medium">
            <v-icon icon="mdi-trending-up" size="x-small" :color="kpi.color" class="mr-1" />
            {{ kpi.change }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- 3. Módulos y Actividad Reciente -->
    <v-row class="mb-4">
      <!-- Columna Izquierda: Actividad Reciente -->
      <v-col cols="12" lg="8">
        <v-card elevation="1" rounded="lg" class="border bg-white">
          <div class="px-5 py-4 border-b d-flex align-center justify-space-between">
            <div>
              <div class="text-subtitle-1 font-weight-bold text-high-emphasis">Actividad Reciente del Sistema</div>
              <div class="text-caption text-medium-emphasis">Registro de operaciones en tiempo real</div>
            </div>
            <v-chip size="small" variant="tonal" color="primary">En vivo</v-chip>
          </div>

          <v-list density="comfortable" class="pa-0">
            <template v-for="(act, aIdx) in recentActivities" :key="act.id">
              <v-list-item class="px-5 py-3">
                <template #prepend>
                  <v-avatar size="38" color="grey-lighten-4" class="mr-3 font-weight-bold text-caption text-primary">
                    {{ act.user.charAt(0) }}
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium text-body-2 text-high-emphasis">
                  {{ act.action }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-medium-emphasis mt-0-5">
                  Por <strong class="text-high-emphasis">{{ act.user }}</strong> &bull; {{ act.time }}
                </v-list-item-subtitle>

                <template #append>
                  <v-chip size="x-small" :color="act.color" variant="tonal" class="font-weight-medium">
                    {{ act.status }}
                  </v-chip>
                </template>
              </v-list-item>
              <v-divider v-if="aIdx < recentActivities.length - 1" />
            </template>
          </v-list>
        </v-card>
      </v-col>

      <!-- Columna Derecha: Accesos a Módulos y Estado -->
      <v-col cols="12" lg="4">
        <v-card elevation="1" rounded="lg" class="border bg-white mb-4">
          <div class="px-5 py-4 border-b">
            <div class="text-subtitle-1 font-weight-bold text-high-emphasis">Accesos Rápidos</div>
            <div class="text-caption text-medium-emphasis">Navegación directa a módulos clave</div>
          </div>

          <v-list density="compact" class="pa-2">
            <v-list-item
              v-for="(mod, mIdx) in systemModules"
              :key="mIdx"
              :to="mod.route"
              rounded="lg"
              class="mb-1"
            >
              <template #prepend>
                <v-icon :icon="mod.icon" color="primary" class="mr-2" />
              </template>
              <v-list-item-title class="font-weight-bold text-body-2 text-high-emphasis">
                {{ mod.title }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption text-medium-emphasis">
                {{ mod.desc }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card elevation="1" rounded="lg" class="pa-4 border bg-white">
          <div class="text-subtitle-2 font-weight-bold text-high-emphasis mb-2">
            Estado de Servicios
          </div>
          <div class="d-flex align-center justify-space-between mb-2 text-caption">
            <span class="text-medium-emphasis">API MotCar Core:</span>
            <v-chip size="x-small" color="success" variant="flat">En línea</v-chip>
          </div>
          <div class="d-flex align-center justify-space-between mb-2 text-caption">
            <span class="text-medium-emphasis">Base de Datos:</span>
            <v-chip size="x-small" color="success" variant="flat">Conectada</v-chip>
          </div>
          <div class="d-flex align-center justify-space-between text-caption">
            <span class="text-medium-emphasis">Motor de Autorización (GAC):</span>
            <v-chip size="x-small" color="success" variant="flat">Activo</v-chip>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
