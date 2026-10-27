<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBranchesStore } from '../stores/branches.store'
import type { BranchItem } from '../types'

const branchesStore = useBranchesStore()

const menuOpen = ref(false)
const searchQuery = ref('')

const activeBranch = computed(() => branchesStore.activeBranch)

const filteredBranches = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return branchesStore.branchesList
  return branchesStore.branchesList.filter((b: BranchItem) => {
    const nameMatch = b.name.toLowerCase().includes(query)
    const parentMatch = b.parent_name?.toLowerCase().includes(query)
    const idMatch = String(b.id).includes(query)
    return nameMatch || parentMatch || idMatch
  })
})

function selectBranch(branch: BranchItem): void {
  branchesStore.setActiveBranch(branch.id)
  menuOpen.value = false
  searchQuery.value = ''
}

function getBranchInitials(name: string): string {
  if (!name) return 'S'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="branch-switcher-root">
    <v-menu
      v-model="menuOpen"
      :close-on-content-click="false"
      location="end top"
      offset="14"
      theme="light"
      transition="scale-transition"
    >
      <template #activator="{ props: menuProps }">
        <!-- Trigger Card estilo GoHighLevel en el sidebar -->
        <div
          v-bind="menuProps"
          class="branch-trigger-card d-flex align-center cursor-pointer"
          data-testid="sidebar-branch-switcher"
          :title="activeBranch ? `${activeBranch.name} (Clic para cambiar)` : 'Seleccionar sucursal'"
        >
          <!-- Icono / Avatar con pin de ubicación con espacio adecuado -->
          <div class="branch-trigger-icon-box flex-shrink-0 d-flex align-center justify-center">
            <v-icon icon="mdi-map-marker-outline" size="18" color="white" />
          </div>

          <!-- Información de la Sucursal Activa con separación y jerarquía visual -->
          <div class="branch-trigger-info min-width-0 flex-grow-1 overflow-hidden">
            <div class="branch-name text-truncate text-white font-weight-bold" :title="activeBranch?.name">
              {{ activeBranch?.name || 'Seleccionar' }}
            </div>
            <div class="branch-location text-truncate">
              {{ activeBranch?.parent_name || 'Sucursal Activa' }}
            </div>
          </div>

          <!-- Selector Chevrons Up/Down (GoHighLevel) -->
          <v-icon
            icon="mdi-unfold-more-horizontal"
            size="18"
            class="branch-trigger-chevron flex-shrink-0"
          />
        </div>
      </template>

      <!-- Panel Desplegable Flotante estilo GoHighLevel -->
      <v-card
        theme="light"
        width="340"
        max-width="92vw"
        class="branch-dropdown-card d-flex flex-column"
      >
        <!-- 1. Buscador Superior -->
        <div class="branch-search-container">
          <v-text-field
            v-model="searchQuery"
            placeholder="Buscar una sucursal..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            single-line
            color="primary"
            class="branch-search-field"
            autofocus
          />
        </div>

        <!-- 2. Encabezado de Sección: TODAS LAS SUCURSALES -->
        <div class="branch-section-header d-flex align-center justify-space-between">
          <span class="branch-section-title">
            TODAS LAS SUCURSALES
          </span>
        </div>

        <!-- 3. Listado Scrollable de Sucursales -->
        <div class="branch-list-scroll flex-grow-1">
          <template v-if="filteredBranches.length > 0">
            <div
              v-for="branch in filteredBranches"
              :key="branch.id"
              class="branch-option-item d-flex align-center cursor-pointer transition-all"
              :class="{
                'branch-option-active': String(branchesStore.activeBranchId) === String(branch.id)
              }"
              :data-testid="`branch-select-item-${branch.id}`"
              @click="selectBranch(branch)"
            >
              <!-- Avatar Circular con Iniciales (GoHighLevel) -->
              <div
                class="branch-avatar-initials flex-shrink-0 d-flex align-center justify-center font-weight-bold"
              >
                {{ getBranchInitials(branch.name) }}
              </div>

              <!-- Textos de Sucursal con espacio y tipografía GoHighLevel -->
              <div class="min-width-0 flex-grow-1 ml-3 overflow-hidden">
                <div class="branch-option-name text-truncate" :title="branch.name">
                  {{ branch.name }}
                </div>
                <div class="branch-option-sub text-truncate">
                  {{ branch.parent_name ? `${branch.parent_name} • ID #${branch.id}` : `ID #${branch.id} • Principal` }}
                </div>
              </div>

              <!-- Pin Icon si está seleccionada (estilo GoHighLevel: gris sutil) -->
              <div v-if="String(branchesStore.activeBranchId) === String(branch.id)" class="flex-shrink-0 ml-2">
                <v-icon icon="mdi-pin" size="18" class="branch-pin-icon" />
              </div>
            </div>
          </template>

          <!-- Estado Vacío -->
          <div v-else class="text-center py-10 px-4 text-medium-emphasis">
            <v-icon icon="mdi-office-building-marker-outline" size="36" class="text-disabled mb-2" />
            <div class="text-body-2 font-weight-medium text-slate-600">
              No se encontraron sucursales para "{{ searchQuery }}"
            </div>
          </div>
        </div>
      </v-card>
    </v-menu>
  </div>
</template>

<style scoped>
.branch-switcher-root {
  width: 100%;
}

/* Card Trigger en el Sidebar */
.branch-trigger-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  padding: 8px 12px;
  gap: 12px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.branch-trigger-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.branch-trigger-icon-box {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.branch-trigger-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.branch-name {
  font-size: 0.85rem;
  line-height: 1.25;
  letter-spacing: 0.01em;
}

.branch-location {
  font-size: 0.7rem;
  color: #94A3B8;
  line-height: 1.2;
  margin-top: 2px;
}

.branch-trigger-chevron {
  color: #94A3B8;
  margin-left: auto;
}

.branch-trigger-card:hover .branch-trigger-chevron {
  color: #FFFFFF;
}

/* --- Panel Desplegable Flotante estilo GoHighLevel (Light Theme) --- */
.branch-dropdown-card {
  background-color: #FFFFFF !important;
  color: #0F172A !important;
  border: 1px solid #E2E8F0 !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
  min-height: 280px;
}

.branch-search-container {
  padding: 12px 14px 8px 14px;
}

/* Input de búsqueda con borde azul sutil redondeado idéntico a GoHighLevel */
.branch-search-field :deep(.v-field) {
  border-radius: 8px !important;
  background-color: #FFFFFF !important;
  font-size: 0.85rem;
}

.branch-search-field :deep(.v-field__outline) {
  --v-field-border-opacity: 1;
  color: #0284C7 !important;
}

.branch-search-field :deep(.v-field__input) {
  min-height: 38px;
  padding-top: 8px;
  padding-bottom: 8px;
  color: #0F172A;
}

.branch-search-field :deep(.v-field__prepend-inner) {
  padding-top: 8px;
  color: #94A3B8 !important;
}

.branch-section-header {
  padding: 6px 16px 8px 16px;
}

.branch-section-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #94A3B8;
}

/* Área de Listado Scrollable */
.branch-list-scroll {
  padding: 0 12px 12px 12px;
  min-height: 200px;
  max-height: 360px;
  overflow-y: auto;
}

/* Item dentro del dropdown estilo GoHighLevel */
.branch-option-item {
  background: #FFFFFF;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 4px;
  transition: all 0.15s ease;
}

.branch-option-item:hover {
  background: #F8FAFC;
}

/* Seleccionada: fondo blanco con borde azul cielo como GoHighLevel */
.branch-option-active {
  background: #FFFFFF !important;
  border: 1px solid #93C5FD !important;
}

.branch-option-name {
  color: #0F172A !important;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.25;
}

.branch-option-sub {
  color: #64748B !important;
  font-size: 0.75rem;
  line-height: 1.25;
  margin-top: 2px;
}

/* Avatar Circular con Iniciales (GoHighLevel) */
.branch-avatar-initials {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50% !important;
  background: #F1F5F9 !important;
  color: #475569 !important;
  font-size: 0.78rem;
}

/* Pin sutil gris en ángulo como GoHighLevel */
.branch-pin-icon {
  color: #94A3B8 !important;
  transform: rotate(35deg);
}

.branch-option-item:hover .branch-pin-icon {
  color: #64748B !important;
}

.text-slate-600 {
  color: #475569 !important;
}
</style>
