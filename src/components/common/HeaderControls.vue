<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()
const currentLang = ref('ES')

const languages = [
  { code: 'ES', label: 'Español', flag: '🇪🇸' },
  { code: 'EN', label: 'English', flag: '🇺🇸' }
]

onMounted(() => {
  const savedTheme = localStorage.getItem('motcar_theme')
  if (savedTheme) {
    theme.global.name.value = savedTheme
  }
})

function toggleTheme(): void {
  const nextTheme = theme.global.current.value.dark ? 'motcarLight' : 'motcarDark'
  theme.global.name.value = nextTheme
  localStorage.setItem('motcar_theme', nextTheme)
}

function selectLanguage(langCode: string): void {
  currentLang.value = langCode
  localStorage.setItem('motcar_lang', langCode)
}
</script>

<template>
  <div class="d-flex align-center" style="gap: 8px;">
    <!-- Selector de Idioma -->
    <v-menu location="bottom end" offset="8">
      <template #activator="{ props }">
        <v-btn
          v-bind="props"
          variant="outlined"
          size="small"
          rounded="lg"
          class="text-none px-2 font-weight-bold header-ctrl-btn"
          density="comfortable"
          data-testid="header-lang-switcher"
        >
          <span class="mr-1">{{ languages.find(l => l.code === currentLang)?.flag || '🇪🇸' }}</span>
          <span>{{ currentLang }}</span>
          <v-icon end icon="mdi-chevron-down" size="x-small" />
        </v-btn>
      </template>

      <v-list density="compact" rounded="lg" elevation="3" class="py-1">
        <v-list-item
          v-for="lang in languages"
          :key="lang.code"
          :active="currentLang === lang.code"
          rounded="md"
          @click="selectLanguage(lang.code)"
        >
          <template #prepend>
            <span class="mr-2">{{ lang.flag }}</span>
          </template>
          <v-list-item-title class="text-body-2 font-weight-medium">
            {{ lang.label }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- Conmutador de Tema Claro / Oscuro -->
    <v-btn
      icon
      variant="outlined"
      size="small"
      rounded="lg"
      density="comfortable"
      class="header-ctrl-btn"
      :title="theme.global.current.value.dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      data-testid="header-theme-toggle"
      @click="toggleTheme"
    >
      <v-icon
        :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        size="small"
      />
    </v-btn>
  </div>
</template>

<style scoped>
.header-ctrl-btn {
  border-color: rgba(148, 163, 184, 0.35) !important;
  color: inherit;
  transition: all 0.2s ease;
}
.header-ctrl-btn:hover {
  border-color: rgba(14, 84, 164, 0.7) !important;
  background-color: rgba(14, 84, 164, 0.05);
}
</style>
