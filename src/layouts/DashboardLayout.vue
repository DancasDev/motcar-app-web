<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTheme } from 'vuetify'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useMyStore } from '@/modules/my/stores/my.store'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'
import HeaderControls from '@/components/common/HeaderControls.vue'

const authStore = useAuthStore()
const myStore = useMyStore()
const branchesStore = useBranchesStore()
const router = useRouter()
const route = useRoute()
const theme = useTheme()

const drawer = ref(true)
const notificationsMenuOpen = ref(false)
const userMenuOpen = ref(false)
const isScrolled = ref(false)
const isSyncingAccess = ref(false)
const syncSuccessSnackbar = ref(false)

const isDark = computed(() => theme.global.current.value.dark)

function handleScroll(): void {
  isScrolled.value = window.scrollY > 15
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  if (authStore.isAuthenticated) {
    await Promise.all([
      myStore.loadUnreadCount(),
      branchesStore.loadBranches()
    ])
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

async function onOpenNotificationsMenu(isOpen: boolean): Promise<void> {
  notificationsMenuOpen.value = isOpen
  if (isOpen) {
    await myStore.loadNotifications()
  }
}

async function handleMarkAsRead(id: string | number): Promise<void> {
  await myStore.markAsRead(id)
}

async function handleLogout(): Promise<void> {
  await authStore.logout()
  router.push('/login')
}

async function handleSyncAccess(): Promise<void> {
  if (isSyncingAccess.value) return
  isSyncingAccess.value = true
  try {
    await Promise.all([
      authStore.fetchCurrentUser(),
      branchesStore.loadBranches()
    ])
    syncSuccessSnackbar.value = true
  } catch (err) {
    console.error('Error al sincronizar accesos:', err)
  } finally {
    setTimeout(() => {
      isSyncingAccess.value = false
    }, 600)
  }
}

const navGroups = [
  {
    title: 'Principal',
    items: [
      { to: '/', icon: 'mdi-view-dashboard-outline', title: 'Inicio', testId: 'nav-home' },
      { to: '/my/account', icon: 'mdi-account-circle-outline', title: 'Mi Cuenta', testId: 'nav-drawer-my-account' },
      { to: '/catalogs', icon: 'mdi-book-open-page-variant-outline', title: 'Catálogos', testId: 'nav-catalogs' }
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/financing', icon: 'mdi-handshake-outline', title: 'Financiamiento (SAM)', testId: 'nav-financing' },
      { to: '/accounting', icon: 'mdi-cash-register', title: 'Contabilidad y Tesorería', testId: 'nav-accounting' }
    ]
  },
  {
    title: 'Administración',
    items: [
      { to: '/branches', icon: 'mdi-office-building-marker-outline', title: 'Sucursales', testId: 'nav-branches' },
      { to: '/access', icon: 'mdi-shield-lock-outline', title: 'Control de Acceso', testId: 'nav-access' },
      { to: '/system', icon: 'mdi-cogs', title: 'Sistema y Auditoría', testId: 'nav-system' }
    ]
  }
]
</script>

<template>
  <v-layout class="fill-height">
    <!-- Barra de Navegación Lateral (Sidebar estilo SGA) -->
    <v-navigation-drawer
      v-model="drawer"
      elevation="0"
      class="sga-sidebar border-e"
      width="270"
    >
      <div class="d-flex flex-column fill-height">
        <!-- 1. Cabecera con Marca -->
        <div class="pa-4 d-flex align-center border-b">
          <v-img
            src="/motcar-logo.png"
            alt="Motcar"
            max-width="44"
            height="auto"
            class="mr-3"
          />
          <div>
            <div class="text-subtitle-1 font-weight-bold text-primary" style="line-height: 1.2;">
              Motcar App
            </div>
            <div class="text-caption text-medium-emphasis">
              Gestión Integral
            </div>
          </div>
        </div>

        <!-- 2. Perfil de Usuario Superior (Inspirado en SGA Sidebar) -->
        <div class="pa-4 user-profile-card border-b d-flex align-center">
          <v-avatar color="primary" size="40" class="mr-3 text-white font-weight-bold text-subtitle-2 shadow-xs">
            {{ (authStore.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
          </v-avatar>
          <div class="min-width-0 flex-grow-1 overflow-hidden">
            <div class="text-body-2 font-weight-bold text-truncate">
              {{ authStore.fullName || authStore.user?.username || 'Usuario' }}
            </div>
            <div class="d-flex flex-wrap mt-1" style="gap: 4px;">
              <span
                v-for="(r, idx) in authStore.userRoleCodes.slice(0, 2)"
                :key="idx"
                class="role-pill"
              >
                {{ r }}
              </span>
            </div>
          </div>
        </div>

        <!-- 3. Lista de Módulos Categorizados -->
        <div class="flex-grow-1 overflow-y-auto pa-2">
          <template v-for="(group, gIdx) in navGroups" :key="gIdx">
            <div class="px-3 pt-3 pb-1 text-overline font-weight-bold text-medium-emphasis" style="letter-spacing: 0.08em; font-size: 0.68rem;">
              {{ group.title }}
            </div>

            <v-list density="compact" nav class="pa-0 mb-2">
              <v-list-item
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :prepend-icon="item.icon"
                :title="item.title"
                :data-testid="item.testId"
                rounded="lg"
                class="mb-1 nav-item-btn"
                :active="item.to === '/' ? route.path === '/' : route.path.startsWith(item.to)"
                color="primary"
              />
            </v-list>
          </template>
        </div>

        <!-- 4. Pie del Sidebar: Botón de Sincronizar Accesos (Inspirado en SGA) -->
        <div class="pa-3 border-t bg-surface">
          <v-btn
            block
            variant="tonal"
            color="primary"
            size="small"
            rounded="lg"
            class="text-none font-weight-medium"
            :loading="isSyncingAccess"
            data-testid="btn-sync-access"
            @click="handleSyncAccess"
          >
            <v-icon
              start
              icon="mdi-refresh"
              :class="{ 'mdi-spin': isSyncingAccess }"
            />
            Sincronizar accesos
          </v-btn>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Barra Superior (Topbar con Glassmorphism en Scroll estilo SGA) -->
    <v-app-bar
      fixed
      elevation="0"
      density="comfortable"
      :class="['topbar-bar', { 'topbar-glass': isScrolled, 'border-b': isScrolled }]"
      :color="isScrolled ? (isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)') : 'surface'"
    >
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        data-testid="nav-drawer-toggle"
        rounded="lg"
        class="mr-2"
      />

      <div class="d-flex align-center">
        <span class="text-subtitle-1 font-weight-bold d-none d-sm-inline text-high-emphasis">
          MotCar Web App
        </span>
      </div>

      <v-spacer />

      <!-- Selector de Sucursal Activa Global (Pill moderno) -->
      <v-menu location="bottom end" offset="8">
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="outlined"
            size="small"
            rounded="lg"
            class="text-none mr-2 font-weight-medium border"
            data-testid="branch-switcher"
          >
            <v-icon start icon="mdi-office-building-marker" size="small" color="primary" />
            <span class="d-none d-sm-inline mr-1 text-medium-emphasis">Sucursal:</span>
            <span class="font-weight-bold text-high-emphasis">
              {{ branchesStore.activeBranch?.name || 'Seleccionar' }}
            </span>
            <v-icon end icon="mdi-chevron-down" size="x-small" />
          </v-btn>
        </template>
        <v-card min-width="260" rounded="lg" elevation="4">
          <v-card-item class="bg-primary text-white py-2">
            <div class="d-flex align-center justify-space-between">
              <v-card-title class="text-subtitle-2 font-weight-bold">
                Sucursal Activa
              </v-card-title>
              <v-chip size="x-small" color="white" variant="outlined">
                {{ branchesStore.branchesList.length }} disponibles
              </v-chip>
            </div>
          </v-card-item>
          <v-list density="compact" nav class="py-1" data-testid="branch-switcher-list">
            <v-list-item
              v-for="branch in branchesStore.branchesList"
              :key="branch.id"
              :active="String(branchesStore.activeBranchId) === String(branch.id)"
              color="primary"
              :data-testid="`branch-item-${branch.id}`"
              rounded="md"
              @click="branchesStore.setActiveBranch(branch.id)"
            >
              <template #prepend>
                <v-icon
                  :icon="String(branchesStore.activeBranchId) === String(branch.id) ? 'mdi-check-circle' : 'mdi-office-building-outline'"
                  :color="String(branchesStore.activeBranchId) === String(branch.id) ? 'primary' : 'grey'"
                  size="small"
                />
              </template>
              <v-list-item-title class="font-weight-medium text-body-2">
                {{ branch.name }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="branchesStore.branchesList.length === 0"
              class="text-caption text-grey text-center py-2"
            >
              No hay sucursales registradas
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>

      <!-- Controles de Encabezado: Idioma + Tema Oscuro/Claro -->
      <HeaderControls class="mr-2" />

      <!-- Campana de Notificaciones -->
      <v-menu
        v-model="notificationsMenuOpen"
        :close-on-content-click="false"
        location="bottom end"
        offset="10"
        @update:model-value="onOpenNotificationsMenu"
      >
        <template #activator="{ props }">
          <v-btn
            icon
            variant="outlined"
            size="small"
            rounded="lg"
            class="mr-2 border"
            v-bind="props"
            data-testid="notifications-bell-btn"
          >
            <v-badge
              :content="myStore.unreadCount"
              :model-value="myStore.unreadCount > 0"
              color="error"
              floating
              data-testid="notifications-badge"
            >
              <v-icon icon="mdi-bell-outline" size="small" />
            </v-badge>
          </v-btn>
        </template>

        <v-card width="360" rounded="lg" elevation="4">
          <v-card-item class="bg-primary text-white py-2">
            <div class="d-flex align-center justify-space-between">
              <v-card-title class="text-subtitle-1 font-weight-bold">
                Notificaciones
              </v-card-title>
              <v-chip size="x-small" color="white" variant="outlined">
                {{ myStore.unreadCount }} sin leer
              </v-chip>
            </div>
          </v-card-item>

          <v-divider />

          <!-- Lista de Notificaciones -->
          <v-list
            lines="two"
            max-height="320"
            class="overflow-y-auto pa-0"
            data-testid="notifications-menu-list"
          >
            <div v-if="myStore.isLoading" class="text-center py-4">
              <v-progress-circular indeterminate size="24" color="primary" />
            </div>

            <div
              v-else-if="myStore.notifications.length === 0"
              class="text-center py-6 text-grey text-caption"
            >
              <v-icon icon="mdi-bell-outline" size="large" class="mb-1" />
              <div>No tienes notificaciones pendientes</div>
            </div>

            <template v-else>
              <v-list-item
                v-for="item in myStore.notifications"
                :key="item.id"
                :class="!item.read_at ? 'bg-blue-lighten-5' : ''"
                class="border-b"
              >
                <template #prepend>
                  <v-icon
                    :icon="!item.read_at ? 'mdi-bell-alert' : 'mdi-bell-check-outline'"
                    :color="!item.read_at ? 'primary' : 'grey'"
                    size="small"
                  />
                </template>

                <v-list-item-title class="font-weight-medium text-body-2">
                  {{ item.title }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption text-truncate">
                  {{ item.message }}
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    v-if="!item.read_at"
                    icon="mdi-check"
                    size="x-small"
                    variant="text"
                    color="primary"
                    title="Marcar como leída"
                    data-testid="btn-mark-read"
                    @click="handleMarkAsRead(item.id)"
                  />
                </template>
              </v-list-item>
            </template>
          </v-list>

          <v-divider />

          <v-card-actions class="pa-2 bg-grey-lighten-4">
            <v-btn
              block
              size="small"
              variant="text"
              color="primary"
              to="/my/account"
              class="text-none"
              data-testid="nav-all-notifications"
              @click="notificationsMenuOpen = false; router.push('/my/account')"
            >
              Ver perfil y bitácora de actividad
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>

      <v-divider vertical class="mx-1" style="height: 24px;" />

      <!-- Menú y Cápsula de Usuario (Inspirado en SGA Topbar) -->
      <v-menu
        v-model="userMenuOpen"
        location="bottom end"
        offset="10"
      >
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            variant="text"
            rounded="pill"
            class="pa-1 pr-2 text-none d-flex align-center"
            data-testid="user-profile-menu-btn"
          >
            <v-avatar color="primary" size="32" class="mr-2 text-white font-weight-bold text-caption">
              {{ (authStore.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
            </v-avatar>
            <span class="d-none d-sm-inline font-weight-medium text-body-2 mr-1">
              {{ authStore.fullName || authStore.user?.username }}
            </span>
            <v-icon icon="mdi-chevron-down" size="x-small" />
          </v-btn>
        </template>

        <v-card min-width="220" rounded="lg" elevation="4">
          <div class="pa-3 border-b">
            <div class="text-body-2 font-weight-bold">
              {{ authStore.fullName || authStore.user?.username }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ authStore.user?.email || 'email@motcar.com' }}
            </div>
          </div>

          <v-list density="compact" nav class="py-1">
            <v-list-item
              to="/my/account"
              prepend-icon="mdi-account-circle-outline"
              title="Mi Cuenta & Seguridad"
              data-testid="nav-my-account"
              rounded="md"
              @click="userMenuOpen = false; router.push('/my/account')"
            />
            <v-divider class="my-1" />
            <v-list-item
              prepend-icon="mdi-logout"
              title="Cerrar Sesión"
              data-testid="btn-logout"
              rounded="md"
              class="text-error"
              @click="handleLogout"
            />
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Contenido Principal -->
    <v-main class="bg-background">
      <v-container fluid class="pa-4 pa-sm-6">
        <router-view />
      </v-container>
    </v-main>

    <!-- Notificación Toast de Sincronización de Accesos -->
    <v-snackbar
      v-model="syncSuccessSnackbar"
      color="success"
      location="bottom right"
      timeout="3000"
      rounded="lg"
    >
      <div class="d-flex align-center">
        <v-icon icon="mdi-check-circle" class="mr-2" />
        Accesos y sucursales sincronizados con éxito.
      </div>
    </v-snackbar>
  </v-layout>
</template>

<style scoped>
.sga-sidebar {
  transition: width 0.2s ease;
}

.user-profile-card {
  background-color: rgba(148, 163, 184, 0.05);
}

.role-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: rgba(14, 84, 164, 0.1);
  color: #0E54A4;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.nav-item-btn {
  font-size: 0.85rem;
  transition: all 0.18s ease;
}

.shadow-xs {
  box-shadow: 0 2px 6px rgba(14, 84, 164, 0.25);
}
</style>
