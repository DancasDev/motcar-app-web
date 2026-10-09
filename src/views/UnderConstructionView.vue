<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppUnderConstruction from '@/components/common/AppUnderConstruction.vue'

const route = useRoute()

const moduleName = computed(() => {
  const metaTitle = (route.meta?.title as string) || ''
  if (metaTitle) {
    return metaTitle.replace(/\s*-\s*Motcar\s*App/i, '').trim()
  }
  return (route.name as string) || ''
})
</script>

<template>
  <AppUnderConstruction :module-name="moduleName" />
</template>
