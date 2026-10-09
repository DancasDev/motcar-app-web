<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { useMyStore } from '@/modules/my/stores/my.store'
import { useBranchesStore } from '@/modules/branches/stores/branches.store'

const authStore = useAuthStore()
const myStore = useMyStore()
const branchesStore = useBranchesStore()
const router = useRouter()
const route = useRoute()
const { mobile, mdAndUp } = useDisplay()

const appVersion = 'V0.0.1'
const drawer = ref<boolean>(!mobile.value)
const notificationsMenuOpen = ref(false)
const userMenuOpen = ref(false)
const isSyncingAccess = ref(false)
const syncSuccessSnackbar = ref(false)

function handleNavClick(): void {
  if (mobile.value) {
    drawer.value = false
  }
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await Promise.all([
      myStore.loadUnreadCount(),
      branchesStore.loadBranches()
    ])
  }
})

const isMarkingAllRead = ref(false)

async function onOpenNotificationsMenu(isOpen: boolean): Promise<void> {
  notificationsMenuOpen.value = isOpen
  if (isOpen) {
    await myStore.loadNotifications()
  }
}

async function handleMarkAsRead(id: string | number): Promise<void> {
  await myStore.markAsRead(id)
}

async function handleMarkAllAsRead(): Promise<void> {
  if (isMarkingAllRead.value) return
  isMarkingAllRead.value = true
  try {
    await myStore.markAllAsRead()
  } finally {
    isMarkingAllRead.value = false
  }
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

const navItems = [
  { to: '/', icon: 'mdi-view-dashboard-outline', title: 'Inicio', testId: 'nav-home' },
  { to: '/financing/groups', icon: 'mdi-handshake-outline', title: 'Autofinanciamiento Colectivo', testId: 'nav-financing' },
  { to: '/accounting', icon: 'mdi-cash-register', title: 'Cobranzas', testId: 'nav-accounting' }
]
</script>

<template>
  <v-layout class="fill-height dashboard-layout">
    <!-- Barra de Navegación Lateral (Sidebar Dark con Rail, Expand-on-hover y Backdrop desenfocado) -->
    <v-navigation-drawer
      v-model="drawer"
      theme="dark"
      :permanent="mdAndUp"
      :rail="mdAndUp"
      :expand-on-hover="mdAndUp"
      :temporary="mobile"
      width="270"
      rail-width="68"
      elevation="0"
      class="sidebar-drawer"
    >
      <div class="d-flex flex-column fill-height position-relative">
        <!-- 1. Cabecera con Marca: Avatar circular con fondo blanco, MOTCAR C.A y WEB APP V0.0.1 -->
        <div class="sidebar-header pa-3 d-flex align-center border-b-dark">
          <v-avatar
            color="white"
            size="44"
            class="flex-shrink-0 mr-3 brand-avatar elevation-2"
          >
            <v-img
              src="/images/motcar-logo.png"
              alt="Motcar"
              max-width="34"
              height="auto"
              class="brand-logo-img"
            />
          </v-avatar>
          <div class="sidebar-header-text min-width-0 flex-grow-1 overflow-hidden">
            <div class="text-subtitle-2 font-weight-bold text-white text-truncate letter-spacing-1" style="line-height: 1.2;">
              MOTCAR C.A
            </div>
            <div class="text-caption text-secondary font-weight-medium text-truncate mt-0-5" style="font-size: 0.7rem !important; letter-spacing: 0.05em;">
              WEB APP {{ appVersion }}
            </div>
          </div>
        </div>

        <!-- 2. Lista de Módulos (Directa sin encabezado de grupo) -->
        <div class="flex-grow-1 overflow-y-auto px-2 py-3 sidebar-scroll">
          <v-list density="compact" nav class="pa-0 bg-transparent">
            <v-list-item
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              :prepend-icon="item.icon"
              :title="item.title"
              :data-testid="item.testId"
              rounded="lg"
              class="mb-1 nav-item-btn text-white"
              :active="item.to === '/' ? route.path === '/' : route.path.startsWith(item.to)"
              color="secondary"
              @click="handleNavClick"
            />
          </v-list>
        </div>

        <!-- 3. Pie del Sidebar: Botón circular centrado con Tooltip en la parte superior -->
        <div class="pa-3 border-t-dark sidebar-footer d-flex justify-center">
          <v-tooltip
            text="Sincronizar permisos y sucursales"
            location="top"
            open-delay="200"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon
                variant="tonal"
                color="secondary"
                size="small"
                class="sidebar-sync-btn"
                :loading="isSyncingAccess"
                data-testid="btn-sync-access"
                @click="handleSyncAccess"
              >
                <v-icon
                  icon="mdi-refresh"
                  :class="{ 'mdi-spin': isSyncingAccess }"
                />
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Barra Superior (Topbar con mismo fondo gris de la app y elevación en scroll) -->
    <v-app-bar
      density="comfortable"
      scroll-behavior="elevate"
      scroll-target="#main-content"
      color="background"
      class="topbar-bar px-2 px-sm-4"
    >
      <!-- Botón de apertura de drawer exclusivo para cuando la barra lateral se oculta (pantallas pequeñas) -->
      <v-app-bar-nav-icon
        v-if="!mdAndUp"
        @click="drawer = !drawer"
        data-testid="nav-drawer-toggle"
        rounded="lg"
        class="mr-1"
      />

      <!-- Selector de Sucursal Activa Global (Visible según route.meta.showBranchSelector) -->
      <div v-if="Boolean(route.meta.showBranchSelector)" class="topbar-branch-wrapper d-flex align-center">
        <v-menu location="bottom start" :offset="14">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              variant="flat"
              size="small"
              rounded="pill"
              class="topbar-branch-btn text-none px-3 border"
              data-testid="branch-switcher"
            >
              <v-icon icon="mdi-office-building-marker" size="small" color="primary" class="mr-1 flex-shrink-0" />
              <span class="d-none d-sm-inline text-medium-emphasis mr-1 font-weight-regular flex-shrink-0">
                Sucursal:
              </span>
              <span class="font-weight-bold text-high-emphasis text-truncate topbar-branch-text">
                {{ branchesStore.activeBranch?.name || 'Seleccionar' }}
              </span>
              <v-icon icon="mdi-chevron-down" size="x-small" class="ml-1 text-medium-emphasis flex-shrink-0" />
            </v-btn>
          </template>

          <div class="popover-wrapper">
            <!-- Flecha apuntando al selector de sucursales -->
            <div class="popover-arrow popover-arrow-start"></div>

            <v-card min-width="270" max-width="340" rounded="lg" elevation="6" class="popover-dropdown-card">
              <div class="px-4 py-3 d-flex align-center justify-space-between border-b bg-white">
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                  Sucursales
                </span>
                <span class="text-caption text-medium-emphasis font-weight-medium">
                  {{ branchesStore.branchesList.length }} disponibles
                </span>
              </div>

              <v-list density="compact" nav class="py-1.5 px-2" data-testid="branch-switcher-list">
                <v-list-item
                  v-for="branch in branchesStore.branchesList"
                  :key="branch.id"
                  :active="String(branchesStore.activeBranchId) === String(branch.id)"
                  color="primary"
                  :data-testid="`branch-item-${branch.id}`"
                  rounded="lg"
                  class="my-0.5"
                  @click="branchesStore.setActiveBranch(branch.id)"
                >
                  <template #prepend>
                    <v-icon
                      :icon="String(branchesStore.activeBranchId) === String(branch.id) ? 'mdi-check-circle' : 'mdi-office-building-outline'"
                      :color="String(branchesStore.activeBranchId) === String(branch.id) ? 'primary' : 'medium-emphasis'"
                      size="small"
                    />
                  </template>
                  <v-list-item-title class="font-weight-medium text-body-2 text-truncate" :title="branch.name">
                    {{ branch.name }}
                  </v-list-item-title>
                </v-list-item>
                <v-list-item
                  v-if="branchesStore.branchesList.length === 0"
                  class="text-caption text-grey text-center py-4"
                >
                  No hay sucursales registradas
                </v-list-item>
              </v-list>
            </v-card>
          </div>
        </v-menu>
      </div>

      <v-spacer class="d-none d-md-flex" />

      <!-- Lado Derecho: Notificaciones y Cápsula de Usuario (Pastilla estilo referencia) -->
      <div class="d-flex align-center ml-auto">
        <!-- Campana de Notificaciones -->
        <v-menu
          v-model="notificationsMenuOpen"
          :close-on-content-click="false"
          location="bottom end"
          :offset="14"
          @update:model-value="onOpenNotificationsMenu"
        >
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="small"
              rounded="circle"
              class="mr-2 text-medium-emphasis topbar-icon-btn"
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
                <v-icon icon="mdi-bell-outline" size="22" />
              </v-badge>
            </v-btn>
          </template>

          <div class="popover-wrapper">
            <!-- Flecha/triángulo apuntando al icono de la campana -->
            <div class="popover-arrow popover-arrow-end"></div>

            <v-card width="360" max-width="95vw" rounded="lg" elevation="6" class="popover-dropdown-card">
              <!-- Encabezado Estilo Referencia: Título y texto de acción al lado -->
              <div class="px-4 py-3 d-flex align-center justify-space-between border-b bg-white">
                <span class="text-subtitle-2 font-weight-bold text-high-emphasis">
                  Notifications
                </span>

                <button
                  v-if="myStore.unreadCount > 0"
                  type="button"
                  class="notif-mark-read-link"
                  :disabled="isMarkingAllRead"
                  data-testid="btn-mark-all-read"
                  @click="handleMarkAllAsRead"
                >
                  {{ isMarkingAllRead ? 'Marcando...' : 'Mark all as read' }}
                </button>
              </div>

              <!-- Lista de Notificaciones -->
              <div
                class="overflow-y-auto notif-scroll pa-0"
                data-testid="notifications-menu-list"
                style="max-height: 380px;"
              >
                <div v-if="myStore.isLoading" class="text-center py-6">
                  <v-progress-circular indeterminate size="24" color="primary" />
                </div>

                <div
                  v-else-if="myStore.notifications.length === 0"
                  class="text-center py-8 text-grey text-caption"
                >
                  <v-icon icon="mdi-bell-outline" size="32" class="mb-2 text-medium-emphasis" />
                  <div class="text-body-2 font-weight-medium text-high-emphasis">No notifications</div>
                  <div class="text-caption text-medium-emphasis">You're all caught up!</div>
                </div>

                <template v-else>
                  <div
                    v-for="item in myStore.notifications"
                    :key="item.id"
                    :class="['notif-item px-4 py-3 d-flex align-start border-b', { 'notif-unread': !item.read_at }]"
                    @click="!item.read_at && handleMarkAsRead(item.id)"
                  >
                    <!-- Avatar con inicial del tipo o icono representativo -->
                    <v-avatar
                      size="36"
                      color="grey-lighten-3"
                      class="flex-shrink-0 mr-3 text-primary font-weight-bold"
                    >
                      <v-icon
                        :icon="!item.read_at ? 'mdi-bell-ring-outline' : 'mdi-bell-outline'"
                        size="18"
                        :color="!item.read_at ? 'primary' : 'grey-darken-1'"
                      />
                    </v-avatar>

                    <div class="flex-grow-1 min-width-0 pr-2">
                      <div class="text-body-2 font-weight-bold text-high-emphasis text-truncate" :title="item.title">
                        {{ item.title }}
                      </div>
                      <div class="text-caption text-medium-emphasis text-truncate-2 mt-0-5" style="line-height: 1.35;">
                        {{ item.message }}
                      </div>
                    </div>

                    <!-- Indicador de no leído: punto púrpura de la referencia -->
                    <div class="flex-shrink-0 pt-2 d-flex align-center justify-center">
                      <span v-if="!item.read_at" class="notif-unread-dot" title="Unread"></span>
                    </div>
                  </div>
                </template>
              </div>
            </v-card>
          </div>
        </v-menu>

        <!-- Pastilla de Usuario (Diseño limpio con Avatar, Nombre, Email y Chevron) -->
        <v-menu
          v-model="userMenuOpen"
          location="bottom end"
          :offset="14"
        >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              variant="text"
              rounded="pill"
              class="user-pill-btn text-none pa-1 pl-1 pr-3"
              data-testid="user-profile-menu-btn"
            >
              <v-avatar color="primary" size="36" class="mr-2 text-white font-weight-bold text-caption elevation-1">
                {{ (authStore.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
              </v-avatar>
              <div class="d-none d-sm-flex flex-column text-left mr-2 min-width-0" style="line-height: 1.15;">
                <span class="font-weight-bold text-body-2 text-high-emphasis text-truncate max-w-160">
                  {{ authStore.fullName || authStore.user?.username }}
                </span>
                <span class="text-caption text-medium-emphasis text-truncate max-w-160" style="font-size: 0.72rem !important;">
                  {{ authStore.user?.email || 'email@motcar.com' }}
                </span>
              </div>
              <v-icon icon="mdi-chevron-down" size="small" class="text-medium-emphasis ml-1" />
            </v-btn>
          </template>

          <div class="popover-wrapper">
            <!-- Flecha/triángulo apuntando al área de usuario -->
            <div class="popover-arrow popover-arrow-end"></div>

            <v-card width="270" max-width="90vw" rounded="lg" elevation="6" class="popover-dropdown-card">
              <!-- Encabezado Limpio con Avatar y Datos -->
              <div class="px-4 py-3 border-b bg-white d-flex align-center">
                <v-avatar color="primary" size="38" class="mr-3 text-white font-weight-bold text-subtitle-2 elevation-1 flex-shrink-0">
                  {{ (authStore.fullName || authStore.user?.username || 'U').charAt(0).toUpperCase() }}
                </v-avatar>
                <div class="min-width-0 flex-grow-1" style="line-height: 1.25;">
                  <div class="font-weight-bold text-body-2 text-high-emphasis text-truncate">
                    {{ authStore.fullName || authStore.user?.username }}
                  </div>
                  <div class="text-caption text-medium-emphasis text-truncate mt-0-5">
                    {{ authStore.user?.email || 'email@motcar.com' }}
                  </div>
                </div>
              </div>

              <v-list density="compact" nav class="py-1.5 px-2">
                <v-list-item
                  prepend-icon="mdi-logout"
                  title="Cerrar Sesión"
                  data-testid="btn-logout"
                  rounded="lg"
                  class="my-0.5 text-error"
                  @click="handleLogout"
                />
              </v-list>
            </v-card>
          </div>
        </v-menu>
      </div>
    </v-app-bar>

    <!-- Contenido Principal (Maneja el scroll vertical de las vistas con scroll-target) -->
    <v-main id="main-content" class="bg-background overflow-y-auto fill-height">
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
.sidebar-drawer {
  background: linear-gradient(180deg, #071E3D 0%, #05152B 50%, #030C19 100%) !important;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.border-b-dark {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.border-t-dark {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-avatar {
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.2s ease;
}

.brand-logo-img {
  padding: 2px;
}

/* Manejo de visibilidad en modo rail contraído */
.sidebar-drawer.v-navigation-drawer--rail:not(.v-navigation-drawer--is-hovering) .sidebar-header-text,
.sidebar-drawer.v-navigation-drawer--rail:not(:hover) .sidebar-header-text,
.sidebar-drawer.v-navigation-drawer--rail:not(.v-navigation-drawer--is-hovering) .sidebar-group-title,
.sidebar-drawer.v-navigation-drawer--rail:not(:hover) .sidebar-group-title {
  display: none !important;
}

.sidebar-drawer.v-navigation-drawer--rail:not(.v-navigation-drawer--is-hovering) .sidebar-header,
.sidebar-drawer.v-navigation-drawer--rail:not(:hover) .sidebar-header {
  justify-content: center !important;
  padding-left: 8px !important;
  padding-right: 8px !important;
}

.sidebar-drawer.v-navigation-drawer--rail:not(.v-navigation-drawer--is-hovering) .brand-avatar,
.sidebar-drawer.v-navigation-drawer--rail:not(:hover) .brand-avatar {
  margin-right: 0 !important;
}

/* Al expandirse con hover */
.sidebar-drawer.v-navigation-drawer--is-hovering .sidebar-header-text,
.sidebar-drawer:hover .sidebar-header-text {
  display: block !important;
}

.sidebar-drawer.v-navigation-drawer--is-hovering .sidebar-header,
.sidebar-drawer:hover .sidebar-header {
  justify-content: flex-start !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
}

.sidebar-drawer.v-navigation-drawer--is-hovering .brand-avatar,
.sidebar-drawer:hover .brand-avatar {
  margin-right: 12px !important;
}

.sidebar-sync-btn {
  transition: transform 0.2s ease;
}

.sidebar-sync-btn:hover {
  transform: scale(1.08);
}

.nav-item-btn {
  font-size: 0.85rem;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.nav-item-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
}

.dashboard-layout {
  height: 100vh !important;
  max-height: 100vh !important;
  overflow: hidden !important;
}

/* --- Estilos del Topbar --- */
.topbar-bar {
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease;
  border-bottom: none !important;
}

.topbar-bar.v-toolbar--flat {
  box-shadow: none !important;
}

.topbar-bar:not(.v-toolbar--flat) {
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04) !important;
}

/* Pastilla del Selector de Sucursal */
.topbar-branch-btn {
  background-color: #FFFFFF !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
  height: 38px !important;
}

.topbar-branch-text {
  max-width: 140px;
}

@media (min-width: 600px) {
  .topbar-branch-text {
    max-width: 220px;
  }
}

@media (max-width: 599px) {
  .topbar-branch-wrapper {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .topbar-branch-text {
    max-width: 110px;
  }
}

/* Botón de Icono */
.topbar-icon-btn {
  width: 40px !important;
  height: 40px !important;
  transition: background-color 0.2s ease;
}

.topbar-icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

/* Pastilla de Usuario (Estilo referencia con avatar, texto apilado y chevron) */
.user-pill-btn {
  transition: background-color 0.2s ease;
  height: auto !important;
  min-height: 44px;
}

.user-pill-btn:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.max-w-160 {
  max-width: 160px;
}

/* --- Dropdowns / Popovers Estilo Referencia (Notificaciones, Sucursal, Usuario) --- */
.popover-wrapper {
  position: relative;
  padding-top: 8px;
}

.popover-arrow {
  position: absolute;
  top: 1px;
  width: 14px;
  height: 14px;
  background-color: #FFFFFF;
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  transform: rotate(45deg);
  z-index: 10;
}

.popover-arrow-start {
  left: 22px;
}

.popover-arrow-end {
  right: 20px;
}

.popover-dropdown-card {
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  border-radius: 12px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04) !important;
  overflow: hidden;
  background-color: #FFFFFF !important;
}

.notif-mark-read-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: #64748B;
  cursor: pointer;
  transition: color 0.15s ease;
}

.notif-mark-read-link:hover {
  color: #0E54A4;
  text-decoration: underline;
}

.notif-mark-read-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.notif-item {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.notif-item:hover {
  background-color: #F8FAFC;
}

.notif-unread {
  background-color: #FFFFFF;
}

.notif-unread-dot {
  width: 7px;
  height: 7px;
  background-color: #9333EA;
  border-radius: 50%;
  display: inline-block;
}

.notif-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.notif-scroll::-webkit-scrollbar {
  width: 4px;
}

.notif-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 999px;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
