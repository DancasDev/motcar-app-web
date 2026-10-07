<script setup lang="ts">
interface Props {
  className?: string
}

defineProps<Props>()

const date = {
  year: new Date().getFullYear()
}
</script>

<template>
  <footer :class="['app-copyright text-center text-medium-emphasis', className]">
    MOTCAR &copy; {{ date.year }} &bull; Todos los derechos reservados
  </footer>
</template>

<style scoped>
.app-copyright {
  font-size: 0.72rem;
  letter-spacing: 0.03em;
  line-height: 1.4;
  user-select: none;
}
</style>
