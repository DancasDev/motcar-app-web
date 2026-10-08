<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import LoginForm from '../components/LoginForm.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

function handleLoginSuccess(): void {
  const forceToFlags = Array.isArray(authStore.forceTo)
    ? authStore.forceTo.map(String)
    : (typeof authStore.forceTo === 'string'
        ? (authStore.forceTo as string).split(',').map((s) => s.trim())
        : [])

  // Si tiene cambio forzado de contraseña, ignorar redirect y dirigir a la vista forzada
  if (forceToFlags.includes('0')) {
    router.push('/force-password-change')
    return
  }

  const redirect = (route.query.redirect as string) || '/'
  router.push(redirect)
}
</script>

<template>
  <LoginForm @success="handleLoginSuccess" />
</template>
