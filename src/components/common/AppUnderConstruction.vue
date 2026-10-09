<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  icon?: string
  color?: string
}

withDefaults(defineProps<Props>(), {
  title: 'Módulo en Construcción',
  description: 'Esta sección se encuentra actualmente en desarrollo. Muy pronto estará disponible.',
  icon: 'mdi-hard-hat',
  color: 'primary'
})
</script>

<template>
  <div class="fill-height d-flex flex-column align-center justify-center text-center px-4 py-8">
    <v-avatar :color="color" variant="tonal" size="88" class="mb-5">
      <v-icon :icon="icon" size="44" :color="color" />
    </v-avatar>

    <h1 class="text-h5 text-sm-h4 font-weight-bold text-high-emphasis mb-3">
      {{ title }}
    </h1>

    <p class="text-body-1 text-medium-emphasis mx-auto" style="max-width: 460px; line-height: 1.6;">
      {{ description }}
    </p>
  </div>
</template>
